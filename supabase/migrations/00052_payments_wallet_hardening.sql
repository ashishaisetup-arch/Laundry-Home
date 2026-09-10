-- ============================================================================
-- 00052: Payments & Wallet Hardening
-- ============================================================================

-- ============================================================================
-- 1. NEW TABLE: payment_transactions (gateway payment lifecycle)
-- ============================================================================
create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id),
  order_id uuid references orders(id),
  transaction_purpose text not null
    check (transaction_purpose in ('wallet_topup','order_payment')),
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  gateway text not null default 'razorpay',
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature_verified boolean default false,
  gateway_capture_verified boolean default false,
  payment_status text not null default 'created'
    check (payment_status in ('creating','created','pending','authorized','captured','failed','refunded','partially_refunded','cancelled')),
  wallet_transaction_id uuid,
  failure_reason text,
  metadata jsonb default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_txns_user on payment_transactions(user_id);
create index if not exists idx_payment_txns_status on payment_transactions(payment_status);
create index if not exists idx_payment_txns_gateway_order on payment_transactions(gateway_order_id);
create index if not exists idx_payment_txns_gateway_payment on payment_transactions(gateway_payment_id);

-- ============================================================================
-- 2. NEW TABLE: payment_webhook_events (idempotent webhook processing)
-- ============================================================================
create table if not exists payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null default 'razorpay',
  event_id text not null unique,
  event_type text not null,
  payload jsonb,
  processed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','processed','failed'))
);

create index if not exists idx_webhook_events_event_id on payment_webhook_events(event_id);

-- ============================================================================
-- 3. HARDEN wallet_transactions: add audit columns + link to payment_transactions
-- ============================================================================
alter table wallet_transactions add column if not exists payment_transaction_id uuid;
alter table wallet_transactions add column if not exists balance_before integer;
alter table wallet_transactions add column if not exists balance_after integer;
alter table wallet_transactions add column if not exists idempotency_key text;

-- Unique constraint on idempotency_key (only non-null values)
create unique index if not exists idx_wallet_txns_idempotency
  on wallet_transactions(idempotency_key)
  where idempotency_key is not null;

-- ============================================================================
-- 4. NEW TABLE: customer_invoices (schema only, no generation logic yet)
-- ============================================================================
create table if not exists customer_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id),
  order_id uuid references orders(id),
  invoice_number text not null unique,
  invoice_date timestamptz not null default now(),
  vendor_name text,
  taxable_amount integer not null default 0,
  gst_rate integer not null default 18,
  gst_amount integer not null default 0,
  total_amount integer not null default 0 check (total_amount > 0),
  status text not null default 'generated'
    check (status in ('generated','downloaded','void')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_user on customer_invoices(user_id);
create index if not exists idx_invoices_order on customer_invoices(order_id);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- 5.1 payment_transactions: customer reads own; server/admin writes
alter table payment_transactions enable row level security;

drop policy if exists "payment_txns_select" on payment_transactions;
create policy "payment_txns_select"
  on payment_transactions for select
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- No INSERT/UPDATE/DELETE for customers: all writes through server service_role

-- 5.2 payment_webhook_events: admin-only (server-mediated)
alter table payment_webhook_events enable row level security;

drop policy if exists "webhook_events_admin" on payment_webhook_events;
create policy "webhook_events_admin"
  on payment_webhook_events for all
  using (get_user_role() in ('admin','superadmin'));

-- 5.3 customer_invoices: customer reads own; server/admin writes
alter table customer_invoices enable row level security;

drop policy if exists "invoices_select" on customer_invoices;
create policy "invoices_select"
  on customer_invoices for select
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 5.4 payment_methods: customer CRUD on own records
alter table payment_methods enable row level security;

drop policy if exists "payment_methods_select" on payment_methods;
drop policy if exists "payment_methods_insert" on payment_methods;
drop policy if exists "payment_methods_update" on payment_methods;
drop policy if exists "payment_methods_delete" on payment_methods;

create policy "payment_methods_select"
  on payment_methods for select
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

create policy "payment_methods_insert"
  on payment_methods for insert
  with check (user_id = auth.uid());

create policy "payment_methods_update"
  on payment_methods for update
  using (user_id = auth.uid());

create policy "payment_methods_delete"
  on payment_methods for delete
  using (user_id = auth.uid());

-- 5.5 Tighten wallet_transactions: SELECT-only for customers
drop policy if exists "Wallet user access" on wallet_transactions;

create policy "wallet_txns_select"
  on wallet_transactions for select
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- No INSERT/UPDATE/DELETE for customers: all writes through server service_role

-- ============================================================================
-- 6. ATOMIC WALLET FINALIZATION RPC
-- ============================================================================
-- SECURITY DEFINER + restricted search_path: customer cannot call directly.
-- Only service_role (admin client) can execute.

create or replace function finalize_wallet_topup(
  p_payment_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_profile record;
  v_new_balance integer;
  v_wallet_txn_id uuid;
  v_idempotency_key text;
begin
  -- 1. Lock the payment transaction row
  select * into v_payment
  from payment_transactions
  where id = p_payment_transaction_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Payment transaction not found'
    );
  end if;

  -- 2. Idempotent repeat: if already finalized with linked wallet tx, return success
  if v_payment.wallet_transaction_id is not null then
    return jsonb_build_object(
      'success', true,
      'already_credited', true,
      'wallet_transaction_id', v_payment.wallet_transaction_id
    );
  end if;

  -- 3. Verify the payment is intended for wallet top-up
  if v_payment.transaction_purpose != 'wallet_topup' then
    return jsonb_build_object(
      'success', false,
      'error', 'Transaction is not a wallet top-up: ' || v_payment.transaction_purpose
    );
  end if;

  -- 4. Verify gateway
  if v_payment.gateway != 'razorpay' then
    return jsonb_build_object(
      'success', false,
      'error', 'Unsupported gateway: ' || v_payment.gateway
    );
  end if;

  -- 5. Verify amount is positive
  if v_payment.amount is null or v_payment.amount <= 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid payment amount'
    );
  end if;

  -- 6. Verify gateway IDs are present
  if v_payment.gateway_order_id is null or v_payment.gateway_payment_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Missing gateway order or payment ID'
    );
  end if;

  -- 7. Verify trusted payment confirmation (browser HMAC or webhook/API capture)
  if v_payment.gateway_signature_verified != true
     and v_payment.gateway_capture_verified != true then
    return jsonb_build_object(
      'success', false,
      'error', 'Payment not yet verified by trusted source'
    );
  end if;

  -- 8. Verify status is eligible for first-time finalization
  if v_payment.payment_status not in ('created', 'pending', 'authorized') then
    return jsonb_build_object(
      'success', false,
      'error', 'Payment not eligible for finalization: status=' || v_payment.payment_status
    );
  end if;

  -- 9. Lock the user profile row
  select * into v_profile
  from user_profiles
  where id = v_payment.user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  end if;

  -- 10. Belt-and-suspenders: check for existing wallet ledger entry with same idempotency key
  v_idempotency_key := 'topup_' || p_payment_transaction_id::text;

  select id into v_wallet_txn_id
  from wallet_transactions
  where idempotency_key = v_idempotency_key
  limit 1;

  if v_wallet_txn_id is not null then
    -- Ledger entry already exists; link it and return
    update payment_transactions
    set payment_status = 'captured',
        wallet_transaction_id = v_wallet_txn_id,
        updated_at = now()
    where id = p_payment_transaction_id
      and wallet_transaction_id is null;

    return jsonb_build_object(
      'success', true,
      'already_credited', true,
      'wallet_transaction_id', v_wallet_txn_id
    );
  end if;

  -- 11. Compute new balance
  v_new_balance := coalesce(v_profile.wallet_balance, 0) + v_payment.amount;

  -- 12. Insert immutable wallet credit ledger entry
  v_wallet_txn_id := gen_random_uuid();
  insert into wallet_transactions (
    id, user_id, type, amount, method, description,
    payment_transaction_id, balance_before, balance_after,
    idempotency_key, status, created_at
  ) values (
    v_wallet_txn_id,
    v_payment.user_id,
    'credit',
    v_payment.amount,
    'Razorpay',
    'Wallet top-up via Razorpay',
    p_payment_transaction_id,
    coalesce(v_profile.wallet_balance, 0),
    v_new_balance,
    v_idempotency_key,
    'success',
    now()
  );

  -- 13. Update wallet balance
  update user_profiles
  set wallet_balance = v_new_balance,
      updated_at = now()
  where id = v_payment.user_id;

  -- 14. Mark payment as captured and link wallet transaction
  update payment_transactions
  set payment_status = 'captured',
      wallet_transaction_id = v_wallet_txn_id,
      updated_at = now()
  where id = p_payment_transaction_id;

  return jsonb_build_object(
    'success', true,
    'already_credited', false,
    'wallet_transaction_id', v_wallet_txn_id,
    'new_balance', v_new_balance
  );
end;
$$;

-- Revoke direct execution from untrusted roles
revoke execute on function finalize_wallet_topup(uuid) from anon;
revoke execute on function finalize_wallet_topup(uuid) from authenticated;
-- Only service_role (used by createAdminClient) can call it

-- ============================================================================
-- 7. HELPER: generate sequential invoice numbers
-- ============================================================================
create or replace function generate_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  select count(*) + 1 into v_seq from customer_invoices;
  return 'LH-INV-' || lpad(v_seq::text, 6, '0');
end;
$$;
