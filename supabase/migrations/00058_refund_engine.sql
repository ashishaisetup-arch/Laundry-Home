-- ============================================================================
-- 00058: Refund engine foundation
-- ============================================================================
-- Adds the refund data model and state machine RPCs:
--   1. payment_refunds table — source-specific refund records with allocation
--   2. payment_transactions.amount_refunded — COMPLETED refunds only
--   3. orders.refund_amount / refund_status / refund_reason — COMPLETED only
--   4. create_payment_refund() — reserves refundable amount, creates pending row
--   5. complete_payment_refund() — atomic financial completion
--   6. mark_refund_failed() — releases reservation, no money movement
--
-- Design rules:
--   - amount_refunded tracks COMPLETED refunds only
--   - remaining_refundable = amount - completed - pending/processing
--   - payment_refunds is source-specific (allocation from payment_transactions.gateway)
--   - No wallet credit while refund is pending
--   - Wallet-topup refunds debit wallet with unspent-balance guard at completion
--   - Order-level mixed allocation deferred to 3A2/3A3 orchestrator
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. payment_refunds table
-- ---------------------------------------------------------------------------

create table if not exists payment_refunds (
  id              uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references payment_transactions(id),
  order_id        uuid references orders(id),
  user_id         uuid not null references user_profiles(id),
  amount          integer not null check (amount > 0),
  gateway_refund_amount integer not null default 0
    check (gateway_refund_amount >= 0),
  wallet_refund_amount  integer not null default 0
    check (wallet_refund_amount >= 0),
  refund_status   text not null default 'pending'
    check (refund_status in ('pending','processing','completed','failed')),
  refund_reason   text,
  refund_source   text not null default 'admin'
    check (refund_source in ('admin','customer_cancel','auto','webhook')),
  gateway_refund_id text,
  failure_reason  text,
  idempotency_key text NOT NULL UNIQUE,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint allocation_matches_amount
    check (gateway_refund_amount + wallet_refund_amount = amount)
);

-- Unique partial index on gateway_refund_id (second line of defense for 3A3 webhooks)
create unique index if not exists idx_payment_refunds_gateway_refund_unique
  on payment_refunds (gateway_refund_id)
  where gateway_refund_id is not null;

create index if not exists idx_payment_refunds_transaction
  on payment_refunds (payment_transaction_id);
create index if not exists idx_payment_refunds_status
  on payment_refunds (refund_status);
create index if not exists idx_payment_refunds_user
  on payment_refunds (user_id);

-- ---------------------------------------------------------------------------
-- 2. Column additions
-- ---------------------------------------------------------------------------

-- payment_transactions: COMPLETED refunds only
alter table payment_transactions
  add column if not exists amount_refunded integer not null default 0
    check (amount_refunded >= 0);

-- orders: COMPLETED refunds only, with partial state
alter table orders
  add column if not exists refund_amount integer not null default 0
    check (refund_amount >= 0),
  add column if not exists refund_status text
    check (refund_status is null or refund_status in
      ('pending','processing','partial','completed','failed')),
  add column if not exists refund_reason text;

-- ---------------------------------------------------------------------------
-- 3. RLS: owner-only SELECT for authenticated users
-- ---------------------------------------------------------------------------

alter table payment_refunds enable row level security;

revoke all on payment_refunds from public;
revoke insert, update, delete on payment_refunds from authenticated;

grant select on payment_refunds to authenticated;

create policy "Customers can view own refunds"
on payment_refunds
for select
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. RPC: create_payment_refund
-- ---------------------------------------------------------------------------
-- Reserves the refundable amount via a pending refund row.
-- Derives allocation from payment_transactions.gateway (source-specific).
-- Does NOT mutate amount_refunded or payment_status.
-- Mandatory idempotency_key prevents duplicate reservations.

create or replace function create_payment_refund(
  p_payment_transaction_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_refund_reason text default null,
  p_refund_source text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn payment_transactions%rowtype;
  v_remaining integer;
  v_existing payment_refunds%rowtype;
  v_refund_id uuid;
  v_gateway_refund_amount integer;
  v_wallet_refund_amount integer;
begin
  -- 0. Validate idempotency key
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_idempotency_key');
  end if;

  -- 1. Lock the payment transaction
  select * into v_txn
  from payment_transactions
  where id = p_payment_transaction_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'payment_transaction_not_found');
  end if;

  -- 2. Idempotency check
  select * into v_existing
  from payment_refunds
  where idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    return jsonb_build_object(
      'success', true,
      'already_exists', true,
      'refund_id', v_existing.id,
      'refund_status', v_existing.refund_status,
      'amount', v_existing.amount,
      'wallet_refund_amount', v_existing.wallet_refund_amount,
      'gateway_refund_amount', v_existing.gateway_refund_amount
    );
  end if;

  -- 3. Validate amount
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  -- 4. Validate payment status
  if v_txn.payment_status not in ('captured', 'partially_refunded') then
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_status',
      'payment_status', v_txn.payment_status
    );
  end if;

  -- 5. Calculate remaining refundable
  --    = original amount - completed - pending/processing (reserved)
  select coalesce(sum(amount), 0) into v_remaining
  from payment_refunds
  where payment_transaction_id = p_payment_transaction_id
    and refund_status in ('completed', 'pending', 'processing');

  v_remaining := v_txn.amount - v_remaining;

  if p_amount > v_remaining then
    return jsonb_build_object(
      'success', false,
      'error', 'amount_exceeds_refundable',
      'requested', p_amount,
      'remaining_refundable', v_remaining,
      'original_amount', v_txn.amount
    );
  end if;

  -- 6. Derive allocation from gateway (source-specific)
  if v_txn.gateway = 'wallet' then
    v_wallet_refund_amount := p_amount;
    v_gateway_refund_amount := 0;
  elsif v_txn.gateway = 'razorpay' then
    v_wallet_refund_amount := 0;
    v_gateway_refund_amount := p_amount;
  else
    return jsonb_build_object(
      'success', false,
      'error', 'unsupported_gateway',
      'gateway', v_txn.gateway
    );
  end if;

  -- 7. Insert pending refund row
  v_refund_id := gen_random_uuid();
  insert into payment_refunds (
    id, payment_transaction_id, order_id, user_id,
    amount, gateway_refund_amount, wallet_refund_amount,
    refund_status, refund_reason, refund_source,
    idempotency_key, metadata, created_at, updated_at
  ) values (
    v_refund_id, p_payment_transaction_id, v_txn.order_id, v_txn.user_id,
    p_amount, v_gateway_refund_amount, v_wallet_refund_amount,
    'pending', p_refund_reason, p_refund_source,
    p_idempotency_key,
    jsonb_build_object('source', 'create_payment_refund'),
    now(), now()
  );

  -- 8. Return result (no financial mutation)
  return jsonb_build_object(
    'success', true,
    'already_exists', false,
    'refund_id', v_refund_id,
    'refund_status', 'pending',
    'amount', p_amount,
    'wallet_refund_amount', v_wallet_refund_amount,
    'gateway_refund_amount', v_gateway_refund_amount,
    'remaining_refundable', v_remaining - p_amount,
    'gateway', v_txn.gateway,
    'transaction_purpose', v_txn.transaction_purpose
  );
end;
$$;

-- Revoke from PUBLIC and untrusted roles; grant only to service_role
revoke all on function create_payment_refund(uuid, integer, text, text, text) from public;
revoke execute on function create_payment_refund(uuid, integer, text, text, text) from anon;
revoke execute on function create_payment_refund(uuid, integer, text, text, text) from authenticated;
grant execute on function create_payment_refund(uuid, integer, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC: complete_payment_refund
-- ---------------------------------------------------------------------------
-- Performs the actual financial completion atomically.
-- Locks: payment_refunds + payment_transactions + orders + user_profiles (as needed).
--
-- Financial movement matrix:
--   order_payment + gateway='wallet'  -> credit wallet
--   order_payment + gateway='razorpay' -> no wallet movement (3A3 handles gateway)
--   wallet_topup  + gateway='razorpay' -> debit wallet with unspent guard
--
-- Updates amount_refunded (COMPLETED only) and orders.refund_status (partial/completed).

create or replace function complete_payment_refund(
  p_refund_id uuid,
  p_gateway_refund_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund payment_refunds%rowtype;
  v_txn payment_transactions%rowtype;
  v_order orders%rowtype;
  v_balance integer;
  v_new_balance integer;
  v_wallet_txn_id uuid;
  v_new_refund_amount integer;
  v_order_refund_status text;
begin
  -- 1. Lock the refund row
  select * into v_refund
  from payment_refunds
  where id = p_refund_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'refund_not_found');
  end if;

  if v_refund.refund_status = 'completed' then
    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'refund_id', v_refund.id,
      'refund_status', v_refund.refund_status
    );
  end if;

  if v_refund.refund_status = 'failed' then
    return jsonb_build_object(
      'success', false,
      'error', 'already_failed',
      'refund_id', v_refund.id,
      'failure_reason', v_refund.failure_reason
    );
  end if;

  if v_refund.refund_status not in ('pending', 'processing') then
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_refund_state',
      'refund_status', v_refund.refund_status
    );
  end if;

  -- 2. Lock the payment transaction
  select * into v_txn
  from payment_transactions
  where id = v_refund.payment_transaction_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'payment_transaction_not_found');
  end if;

  -- 3. Lock the order (if present)
  if v_refund.order_id is not null then
    select * into v_order
    from orders
    where id = v_refund.order_id
    for update;

    if not found then
      return jsonb_build_object('success', false, 'error', 'order_not_found');
    end if;
  end if;

  -- 4. Branch by transaction_purpose + gateway
  if v_txn.transaction_purpose = 'order_payment' and v_txn.gateway = 'wallet' then
    -- Wallet-sourced order payment refund: credit wallet
    select wallet_balance into v_balance
    from user_profiles
    where id = v_refund.user_id
    for update;

    if v_balance is null then
      return jsonb_build_object('success', false, 'error', 'user_not_found');
    end if;

    v_new_balance := v_balance + v_refund.amount;

    -- Insert wallet credit row
    v_wallet_txn_id := gen_random_uuid();
    insert into wallet_transactions (
      id, user_id, type, amount, method, description,
      order_id, balance_before, balance_after,
      idempotency_key, status, payment_transaction_id, created_at
    ) values (
      v_wallet_txn_id, v_refund.user_id, 'credit', v_refund.amount, 'wallet',
      'Refund for order ' || coalesce((select code from orders where id = v_refund.order_id), ''),
      v_refund.order_id, v_balance, v_new_balance,
      'refund_' || v_refund.id, 'success', v_txn.id, now()
    );

    -- Credit wallet balance
    update user_profiles
    set wallet_balance = v_new_balance, updated_at = now()
    where id = v_refund.user_id;

  elsif v_txn.transaction_purpose = 'order_payment' and v_txn.gateway = 'razorpay' then
    -- Gateway-sourced order payment refund: no wallet movement
    -- Requires gateway_refund_id (set by 3A3 webhook)
    if p_gateway_refund_id is null or btrim(p_gateway_refund_id) = '' then
      return jsonb_build_object('success', false, 'error', 'gateway_refund_id_required');
    end if;

    v_new_balance := null;

  elsif v_txn.transaction_purpose = 'wallet_topup' and v_txn.gateway = 'razorpay' then
    -- Wallet-topup refund: debit wallet with unspent guard
    if p_gateway_refund_id is null or btrim(p_gateway_refund_id) = '' then
      return jsonb_build_object('success', false, 'error', 'gateway_refund_id_required');
    end if;

    select wallet_balance into v_balance
    from user_profiles
    where id = v_refund.user_id
    for update;

    if v_balance is null then
      return jsonb_build_object('success', false, 'error', 'user_not_found');
    end if;

    if v_balance < v_refund.amount then
      return jsonb_build_object(
        'success', false,
        'error', 'insufficient_wallet_balance',
        'wallet_balance', v_balance,
        'required', v_refund.amount
      );
    end if;

    v_new_balance := v_balance - v_refund.amount;

    -- Insert wallet debit row
    v_wallet_txn_id := gen_random_uuid();
    insert into wallet_transactions (
      id, user_id, type, amount, method, description,
      order_id, balance_before, balance_after,
      idempotency_key, status, payment_transaction_id, created_at
    ) values (
      v_wallet_txn_id, v_refund.user_id, 'debit', v_refund.amount, 'wallet',
      'Wallet top-up refund adjustment',
      null, v_balance, v_new_balance,
      'refund_' || v_refund.id, 'success', v_txn.id, now()
    );

    -- Debit wallet balance
    update user_profiles
    set wallet_balance = v_new_balance, updated_at = now()
    where id = v_refund.user_id;

  else
    -- Unsupported combination
    return jsonb_build_object(
      'success', false,
      'error', 'unsupported_transaction',
      'transaction_purpose', v_txn.transaction_purpose,
      'gateway', v_txn.gateway
    );
  end if;

  -- 5. Update refund row
  update payment_refunds
  set refund_status = 'completed',
      gateway_refund_id = coalesce(p_gateway_refund_id, gateway_refund_id),
      updated_at = now()
  where id = v_refund.id;

  -- 6. Update payment_transactions (COMPLETED only)
  v_txn.amount_refunded := v_txn.amount_refunded + v_refund.amount;

  if v_txn.amount_refunded >= v_txn.amount then
    v_txn.payment_status := 'refunded';
  else
    v_txn.payment_status := 'partially_refunded';
  end if;

  update payment_transactions
  set amount_refunded = v_txn.amount_refunded,
      payment_status = v_txn.payment_status,
      updated_at = now()
  where id = v_txn.id;

  -- 7. Update orders (if present)
  if v_refund.order_id is not null then
    v_new_refund_amount := v_order.refund_amount + v_refund.amount;

    if v_new_refund_amount >= v_order.total then
      v_order_refund_status := 'completed';
    else
      v_order_refund_status := 'partial';
    end if;

    update orders
    set refund_amount = v_new_refund_amount,
        refund_status = v_order_refund_status,
        refund_reason = coalesce(v_refund.refund_reason, refund_reason),
        updated_at = now()
    where id = v_refund.order_id;
  else
    v_order_refund_status := null;
  end if;

  -- 8. Return result
  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'refund_id', v_refund.id,
    'refund_status', 'completed',
    'amount', v_refund.amount,
    'wallet_moved', v_wallet_txn_id is not null,
    'new_wallet_balance', v_new_balance,
    'payment_status', v_txn.payment_status,
    'amount_refunded', v_txn.amount_refunded,
    'order_refund_status', v_order_refund_status
  );
end;
$$;

-- Revoke from PUBLIC and untrusted roles; grant only to service_role
revoke all on function complete_payment_refund(uuid, text) from public;
revoke execute on function complete_payment_refund(uuid, text) from anon;
revoke execute on function complete_payment_refund(uuid, text) from authenticated;
grant execute on function complete_payment_refund(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC: mark_refund_failed
-- ---------------------------------------------------------------------------
-- Releases the reservation by changing pending/processing to failed.
-- No money movement — financial movement only happens at completion.

create or replace function mark_refund_failed(
  p_refund_id uuid,
  p_failure_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund payment_refunds%rowtype;
begin
  -- 1. Lock the refund row
  select * into v_refund
  from payment_refunds
  where id = p_refund_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'refund_not_found');
  end if;

  if v_refund.refund_status not in ('pending', 'processing') then
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_refund_state',
      'refund_status', v_refund.refund_status
    );
  end if;

  -- 2. Release reservation
  update payment_refunds
  set refund_status = 'failed',
      failure_reason = p_failure_reason,
      updated_at = now()
  where id = p_refund_id;

  -- 3. Return result (no money movement)
  return jsonb_build_object(
    'success', true,
    'refund_id', p_refund_id,
    'refund_status', 'failed',
    'failure_reason', p_failure_reason
  );
end;
$$;

-- Revoke from PUBLIC and untrusted roles; grant only to service_role
revoke all on function mark_refund_failed(uuid, text) from public;
revoke execute on function mark_refund_failed(uuid, text) from anon;
revoke execute on function mark_refund_failed(uuid, text) from authenticated;
grant execute on function mark_refund_failed(uuid, text) to service_role;
