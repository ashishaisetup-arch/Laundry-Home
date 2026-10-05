-- ============================================================================
-- 00057: Order payment / tender tracking
-- ============================================================================
-- Adds tender-tracking columns to orders, a unique gateway_payment_id index,
-- and two SECURITY DEFINER RPCs:
--   1. apply_order_wallet_payment  — atomic wallet settlement for orders
--   2. finalize_order_gateway_payment — atomic Razorpay settlement for orders
--
-- Both RPCs are idempotent and self-validating. They derive customer_id,
-- order code, and amounts from the database, not from application input.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tender-tracking columns on orders
-- ---------------------------------------------------------------------------
-- taxable_amount  — nullable; NULL = unknown (historical), exact for new orders
-- wallet_paid_amount  — portion of total settled via wallet debit
-- gateway_paid_amount — portion of total settled via online gateway
-- tender_type     — derived: cod | wallet | gateway | mixed | wallet_gateway

alter table orders
  add column if not exists taxable_amount      integer,
  add column if not exists wallet_paid_amount  integer not null default 0,
  add column if not exists gateway_paid_amount integer not null default 0,
  add column if not exists tender_type         text not null default 'cod'
    check (tender_type in ('cod','wallet','gateway','mixed','wallet_gateway'));

-- ---------------------------------------------------------------------------
-- 2. Unique partial index on gateway_payment_id
-- ---------------------------------------------------------------------------
-- Preflight verified 0 duplicates before this migration was written.
-- This prevents duplicate backfill rows and enforces one payment per gateway ID.

create unique index if not exists idx_payment_txns_gateway_payment_unique
  on payment_transactions (gateway_payment_id)
  where gateway_payment_id is not null;

-- ---------------------------------------------------------------------------
-- 3. RPC: apply_order_wallet_payment
-- ---------------------------------------------------------------------------
-- Atomically settles a wallet-funded portion of an order.
--   - Locks the order row FOR UPDATE
--   - Idempotency check FIRST (before remaining-payable calculation)
--   - Counts only captured payments as settled money
--   - Validates amount <= remaining payable
--   - Locks the customer wallet FOR UPDATE
--   - Debits wallet, inserts ledger entry, inserts payment_transactions row
--   - All in one SQL transaction
--
-- Self-validating: derives customer_id, order code, and total from the order
-- row itself. Does not trust application-supplied user IDs or order codes.

create or replace function apply_order_wallet_payment(
  p_order_id uuid,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_user_id uuid;
  v_order_code text;
  v_order_total integer;
  v_already_paid integer;
  v_remaining integer;
  v_balance integer;
  v_new_balance integer;
  v_wallet_txn_id uuid;
  v_payment_txn_id uuid;
  v_existing_wallet uuid;
  v_existing_payment uuid;
begin
  -- 1. Lock and load the order
  select * into v_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  v_user_id := v_order.customer_id;
  v_order_code := v_order.code;
  v_order_total := coalesce(v_order.total, 0);

  -- Amount guard
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  -- 2. Idempotency check FIRST — before remaining-payable calculation
  select wt.id, pt.id
  into v_existing_wallet, v_existing_payment
  from wallet_transactions wt
  left join payment_transactions pt
    on pt.wallet_transaction_id = wt.id
  where wt.idempotency_key = 'order_wallet_' || p_order_id;

  if v_existing_wallet is not null then
    return jsonb_build_object(
      'success', true,
      'already_applied', true,
      'wallet_transaction_id', v_existing_wallet,
      'payment_transaction_id', v_existing_payment
    );
  end if;

  -- 3. Compute already-paid amount (captured only — settled money)
  select coalesce(sum(amount), 0) into v_already_paid
  from payment_transactions
  where order_id = p_order_id
    and transaction_purpose = 'order_payment'
    and payment_status = 'captured';

  v_remaining := v_order_total - v_already_paid;

  -- Amount must not exceed remaining payable
  if p_amount > v_remaining then
    return jsonb_build_object(
      'success', false,
      'error', 'amount_exceeds_remaining',
      'order_total', v_order_total,
      'already_paid', v_already_paid,
      'remaining', v_remaining
    );
  end if;

  -- 4. Lock the customer wallet
  select wallet_balance into v_balance
  from user_profiles
  where id = v_user_id
  for update;

  if v_balance is null then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_balance < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'wallet_balance', v_balance,
      'requested', p_amount
    );
  end if;

  v_new_balance := v_balance - p_amount;

  -- 5. Insert wallet ledger entry (positive amount, type=debit)
  v_wallet_txn_id := gen_random_uuid();
  insert into wallet_transactions (
    id, user_id, type, amount, method, description,
    order_id, balance_before, balance_after,
    idempotency_key, status, created_at
  ) values (
    v_wallet_txn_id, v_user_id, 'debit', p_amount, 'wallet',
    'Payment for order ' || v_order_code,
    p_order_id, v_balance, v_new_balance,
    'order_wallet_' || p_order_id, 'success', now()
  );

  -- 6. Debit wallet balance
  update user_profiles
  set wallet_balance = v_new_balance,
      updated_at = now()
  where id = v_user_id;

  -- 7. Create payment_transactions row (gateway='wallet')
  v_payment_txn_id := gen_random_uuid();
  insert into payment_transactions (
    id, user_id, order_id, transaction_purpose,
    amount, currency, gateway,
    gateway_order_id, gateway_payment_id,
    payment_status, wallet_transaction_id,
    metadata, created_at, updated_at
  ) values (
    v_payment_txn_id, v_user_id, p_order_id, 'order_payment',
    p_amount, 'INR', 'wallet',
    null, null,
    'captured', v_wallet_txn_id,
    jsonb_build_object(
      'source', 'order_wallet_debit',
      'order_code', v_order_code
    ),
    now(), now()
  );

  return jsonb_build_object(
    'success', true,
    'already_applied', false,
    'wallet_transaction_id', v_wallet_txn_id,
    'payment_transaction_id', v_payment_txn_id,
    'balance_before', v_balance,
    'balance_after', v_new_balance,
    'order_total', v_order_total,
    'already_paid', v_already_paid,
    'remaining', v_remaining
  );
end;
$$;

-- Revoke from PUBLIC and untrusted roles; grant only to service_role
revoke all on function apply_order_wallet_payment(uuid, integer) from public;
revoke execute on function apply_order_wallet_payment(uuid, integer) from anon;
revoke execute on function apply_order_wallet_payment(uuid, integer) from authenticated;
grant execute on function apply_order_wallet_payment(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC: finalize_order_gateway_payment
-- ---------------------------------------------------------------------------
-- Atomically finalizes a Razorpay (gateway) payment for an order.
--   - Locks the order row FOR UPDATE
--   - Idempotency check on gateway_payment_id
--   - Counts only captured payments as settled money
--   - Validates amount <= remaining payable
--   - Inserts payment_transactions row (gateway='razorpay')
--   - Updates orders: gateway_paid_amount, tender_type, payment_details (merge),
--     payment_status
--   - All in one SQL transaction
--
-- Called by the Express route AFTER: authentication, ownership check,
-- stored-Razorpay-order linkage check, and HMAC signature verification.

create or replace function finalize_order_gateway_payment(
  p_order_id uuid,
  p_gateway_order_id text,
  p_gateway_payment_id text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_user_id uuid;
  v_order_total integer;
  v_wallet_used integer;
  v_already_paid integer;
  v_remaining integer;
  v_gateway_amount integer;
  v_payment_txn_id uuid;
  v_existing_payment uuid;
  v_new_tender_type text;
  v_new_gateway_paid integer;
  v_new_payment_details jsonb;
begin
  -- 1. Lock and load the order
  select * into v_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'order_not_found');
  end if;

  v_user_id := v_order.customer_id;
  v_order_total := coalesce(v_order.total, 0);
  v_wallet_used := coalesce(v_order.wallet_paid_amount, v_order.wallet_used, 0);

  -- Validate inputs
  if p_gateway_order_id is null or p_gateway_order_id = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_gateway_order_id');
  end if;

  if p_gateway_payment_id is null or p_gateway_payment_id = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_gateway_payment_id');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  -- 2. Idempotency check on gateway_payment_id
  select id into v_existing_payment
  from payment_transactions
  where gateway_payment_id = p_gateway_payment_id;

  if v_existing_payment is not null then
    return jsonb_build_object(
      'success', true,
      'already_finalized', true,
      'payment_transaction_id', v_existing_payment
    );
  end if;

  -- 3. Compute already-paid amount (captured only)
  select coalesce(sum(amount), 0) into v_already_paid
  from payment_transactions
  where order_id = p_order_id
    and transaction_purpose = 'order_payment'
    and payment_status = 'captured';

  v_remaining := v_order_total - v_already_paid;

  -- Amount must not exceed remaining payable
  if p_amount > v_remaining then
    return jsonb_build_object(
      'success', false,
      'error', 'amount_exceeds_remaining',
      'order_total', v_order_total,
      'already_paid', v_already_paid,
      'remaining', v_remaining
    );
  end if;

  -- 4. Insert payment_transactions row (gateway='razorpay')
  v_gateway_amount := p_amount;
  v_payment_txn_id := gen_random_uuid();

  insert into payment_transactions (
    id, user_id, order_id, transaction_purpose,
    amount, currency, gateway,
    gateway_order_id, gateway_payment_id,
    gateway_signature_verified,
    payment_status,
    metadata, created_at, updated_at
  ) values (
    v_payment_txn_id, v_user_id, p_order_id, 'order_payment',
    v_gateway_amount, 'INR', 'razorpay',
    p_gateway_order_id, p_gateway_payment_id,
    true,
    'captured',
    jsonb_build_object(
      'source', 'order_gateway_finalize',
      'order_total', v_order_total,
      'wallet_used', v_wallet_used
    ),
    now(), now()
  );

  -- 5. Update orders: tender fields, payment_details, payment_status
  v_new_gateway_paid := coalesce(v_order.gateway_paid_amount, 0) + v_gateway_amount;
  v_wallet_used := coalesce(v_order.wallet_paid_amount, 0);

  if v_wallet_used > 0 and v_new_gateway_paid > 0 then
    v_new_tender_type := 'wallet_gateway';
  elsif v_new_gateway_paid > 0 then
    v_new_tender_type := 'gateway';
  elsif v_wallet_used > 0 then
    v_new_tender_type := 'wallet';
  else
    v_new_tender_type := 'cod';
  end if;

  -- Merge with existing payment_details (don't replace whole object)
  v_new_payment_details := coalesce(v_order.payment_details, '{}'::jsonb)
    || jsonb_build_object(
      'razorpay_order_id', p_gateway_order_id,
      'razorpay_payment_id', p_gateway_payment_id
    );

  update orders
  set gateway_paid_amount = v_new_gateway_paid,
      tender_type = v_new_tender_type,
      payment_details = v_new_payment_details,
      payment_status = 'paid',
      updated_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'already_finalized', false,
    'payment_transaction_id', v_payment_txn_id,
    'gateway_paid_amount', v_new_gateway_paid,
    'tender_type', v_new_tender_type,
    'order_total', v_order_total,
    'already_paid', v_already_paid,
    'remaining', v_remaining
  );
end;
$$;

-- Revoke from PUBLIC and untrusted roles; grant only to service_role
revoke all on function finalize_order_gateway_payment(uuid, text, text, integer) from public;
revoke execute on function finalize_order_gateway_payment(uuid, text, text, integer) from anon;
revoke execute on function finalize_order_gateway_payment(uuid, text, text, integer) from authenticated;
grant execute on function finalize_order_gateway_payment(uuid, text, text, integer) to service_role;
