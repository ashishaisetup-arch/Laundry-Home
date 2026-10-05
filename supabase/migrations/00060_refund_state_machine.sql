-- ============================================================================
-- 00060: Refund state machine — submitting + reconciliation_required
-- ============================================================================
-- Extends the refund lifecycle with two new states and two new RPCs:
--
-- State machine:
--   pending → submitting → processing → completed / failed
--   submitting → (timeout/network/5xx) → stays submitting (no auto-resubmit)
--   processing → refund.processed + wallet debit impossible → reconciliation_required
--
-- New states:
--   submitting              — external API call in flight or outcome uncertain
--   reconciliation_required — gateway succeeded but internal wallet debit failed
--
-- New RPCs:
--   confirm_refund_gateway_submission(uuid, text)
--     Atomic conditional post-2xx transition. Only upgrades submitting → processing.
--     Never downgrades completed or reconciliation_required.
--
--   mark_refund_reconciliation_required(uuid, text, text)
--     DB-controlled transition for external-success/internal-failure.
--
-- Updated RPCs:
--   create_payment_refund        — reserved statuses include submitting + reconciliation_required
--   complete_payment_refund      — valid states include submitting
--   mark_refund_failed           — valid states include submitting
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend refund_status check constraint
-- ---------------------------------------------------------------------------

alter table payment_refunds drop constraint if exists payment_refunds_refund_status_check;
alter table payment_refunds add constraint payment_refunds_refund_status_check
  check (refund_status in ('pending','submitting','processing','completed','failed','reconciliation_required'));

-- ---------------------------------------------------------------------------
-- 2. Update create_payment_refund — reserved statuses
-- ---------------------------------------------------------------------------

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

  -- 2. Idempotency check with conflict detection
  select * into v_existing
  from payment_refunds
  where idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    if v_existing.payment_transaction_id = p_payment_transaction_id
       and v_existing.amount = p_amount then
      -- Valid retry: same key + same transaction + same amount
      return jsonb_build_object(
        'success', true,
        'already_exists', true,
        'refund_id', v_existing.id,
        'refund_status', v_existing.refund_status,
        'amount', v_existing.amount,
        'wallet_refund_amount', v_existing.wallet_refund_amount,
        'gateway_refund_amount', v_existing.gateway_refund_amount
      );
    else
      -- Idempotency conflict: same key, different request
      return jsonb_build_object(
        'success', false,
        'error', 'idempotency_conflict',
        'existing_refund_id', v_existing.id,
        'existing_amount', v_existing.amount,
        'existing_transaction_id', v_existing.payment_transaction_id
      );
    end if;
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
  --    = original amount - completed - pending/submitting/processing/reconciliation_required (reserved)
  select coalesce(sum(amount), 0) into v_remaining
  from payment_refunds
  where payment_transaction_id = p_payment_transaction_id
    and refund_status in ('completed', 'pending', 'submitting', 'processing', 'reconciliation_required');

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

revoke all on function create_payment_refund(uuid, integer, text, text, text) from public;
revoke execute on function create_payment_refund(uuid, integer, text, text, text) from anon;
revoke execute on function create_payment_refund(uuid, integer, text, text, text) from authenticated;
grant execute on function create_payment_refund(uuid, integer, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Update complete_payment_refund — valid-state check includes submitting
-- ---------------------------------------------------------------------------

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

  if v_refund.refund_status = 'reconciliation_required' then
    return jsonb_build_object(
      'success', false,
      'error', 'reconciliation_required',
      'refund_id', v_refund.id,
      'failure_reason', v_refund.failure_reason
    );
  end if;

  if v_refund.refund_status not in ('pending', 'submitting', 'processing') then
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

revoke all on function complete_payment_refund(uuid, text) from public;
revoke execute on function complete_payment_refund(uuid, text) from anon;
revoke execute on function complete_payment_refund(uuid, text) from authenticated;
grant execute on function complete_payment_refund(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Update mark_refund_failed — valid-state check includes submitting
-- ---------------------------------------------------------------------------

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

  if v_refund.refund_status not in ('pending', 'submitting', 'processing') then
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

revoke all on function mark_refund_failed(uuid, text) from public;
revoke execute on function mark_refund_failed(uuid, text) from anon;
revoke execute on function mark_refund_failed(uuid, text) from authenticated;
grant execute on function mark_refund_failed(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC: confirm_refund_gateway_submission
-- ---------------------------------------------------------------------------
-- Atomic conditional post-2xx transition after Razorpay refund API call.
-- Only upgrades submitting → processing. Never downgrades completed or
-- reconciliation_required. This prevents a late HTTP response from
-- downgrading a refund that a webhook already completed.

create or replace function confirm_refund_gateway_submission(
  p_refund_id uuid,
  p_gateway_refund_id text
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

  -- 2. Conflict detection: existing gateway_refund_id differs from new
  if v_refund.gateway_refund_id is not null
     and v_refund.gateway_refund_id <> p_gateway_refund_id then
    return jsonb_build_object(
      'success', false,
      'error', 'gateway_refund_id_conflict',
      'existing_gateway_refund_id', v_refund.gateway_refund_id,
      'new_gateway_refund_id', p_gateway_refund_id,
      'refund_status', v_refund.refund_status
    );
  end if;

  -- 3. Conditional transition: only upgrade submitting → processing
  --    Never downgrade completed, reconciliation_required, or processing
  update payment_refunds
  set gateway_refund_id = coalesce(gateway_refund_id, p_gateway_refund_id),
      refund_status = case
        when refund_status = 'submitting' then 'processing'
        else refund_status
      end,
      updated_at = now()
  where id = p_refund_id
    and (gateway_refund_id is null or gateway_refund_id = p_gateway_refund_id)
  returning * into v_refund;

  if not found then
    -- Concurrent modification — reload and return current state
    select * into v_refund from payment_refunds where id = p_refund_id;
    return jsonb_build_object(
      'success', true,
      'refund_id', v_refund.id,
      'refund_status', v_refund.refund_status,
      'gateway_refund_id', v_refund.gateway_refund_id,
      'note', 'concurrent_modification'
    );
  end if;

  -- 4. Return result
  return jsonb_build_object(
    'success', true,
    'refund_id', v_refund.id,
    'refund_status', v_refund.refund_status,
    'gateway_refund_id', v_refund.gateway_refund_id
  );
end;
$$;

revoke all on function confirm_refund_gateway_submission(uuid, text) from public;
revoke execute on function confirm_refund_gateway_submission(uuid, text) from anon;
revoke execute on function confirm_refund_gateway_submission(uuid, text) from authenticated;
grant execute on function confirm_refund_gateway_submission(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC: mark_refund_reconciliation_required
-- ---------------------------------------------------------------------------
-- DB-controlled transition for external-success/internal-failure.
-- Used when Razorpay refund succeeded but wallet debit is impossible.
-- Validates gateway_refund_id matches to prevent stale transitions.

create or replace function mark_refund_reconciliation_required(
  p_refund_id uuid,
  p_gateway_refund_id text,
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

  -- 2. Validate current state
  if v_refund.refund_status not in ('submitting', 'processing') then
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_refund_state',
      'refund_status', v_refund.refund_status
    );
  end if;

  -- 3. Validate gateway_refund_id match
  if v_refund.gateway_refund_id is distinct from p_gateway_refund_id then
    return jsonb_build_object('success', false, 'error', 'gateway_refund_id_mismatch');
  end if;

  -- 4. Transition to reconciliation_required
  update payment_refunds
  set refund_status = 'reconciliation_required',
      failure_reason = p_failure_reason,
      updated_at = now()
  where id = p_refund_id;

  -- 5. Return result
  return jsonb_build_object(
    'success', true,
    'refund_id', p_refund_id,
    'refund_status', 'reconciliation_required',
    'failure_reason', p_failure_reason
  );
end;
$$;

revoke all on function mark_refund_reconciliation_required(uuid, text, text) from public;
revoke execute on function mark_refund_reconciliation_required(uuid, text, text) from anon;
revoke execute on function mark_refund_reconciliation_required(uuid, text, text) from authenticated;
grant execute on function mark_refund_reconciliation_required(uuid, text, text) to service_role;
