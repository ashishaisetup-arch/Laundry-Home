-- ============================================================================
-- 00059: Refund idempotency conflict detection
-- ============================================================================
-- Strengthens create_payment_refund idempotency semantics:
--   same idempotency_key + same payment_transaction_id + same amount
--     → already_exists=true (valid retry)
--   same idempotency_key + different transaction or amount
--     → idempotency_conflict (financial-safety invariant)
--
-- Without this check, a buggy client could reuse an idempotency key for a
-- different refund and receive the old refund as if the new request succeeded.
-- ============================================================================

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
