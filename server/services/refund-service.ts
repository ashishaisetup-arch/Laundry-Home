import { createAdminClient } from "../supabase";

// ============================================================================
// Types
// ============================================================================

export interface RequestRefundResult {
  success: boolean;
  refundId?: string;
  refundStatus?: string;
  amount?: number;
  gatewayRefundAmount?: number;
  walletRefundAmount?: number;
  remainingRefundable?: number;
  walletBalance?: number;
  alreadyExists?: boolean;
  error?: string;
}

export interface EligibilityResult {
  success: boolean;
  eligible?: boolean;
  transactionId?: string;
  amount?: number;
  amountRefunded?: number;
  paymentStatus?: string;
  gateway?: string;
  transactionPurpose?: string;
  remainingRefundable?: number;
  walletBalance?: number;
  canAbsorbDebit?: boolean;
  error?: string;
}

export interface ListRefundsResult {
  success: boolean;
  refunds?: RefundRow[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

export interface GetRefundResult {
  success: boolean;
  refund?: RefundRow;
  error?: string;
}

export interface RefundRow {
  id: string;
  payment_transaction_id: string;
  order_id: string | null;
  user_id: string;
  amount: number;
  gateway_refund_amount: number;
  wallet_refund_amount: number;
  refund_status: string;
  refund_reason: string | null;
  refund_source: string;
  gateway_refund_id: string | null;
  failure_reason: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// ============================================================================
// 1. Request Wallet-Topup Refund
// ============================================================================
// Creates a pending refund reservation. Does NOT debit the wallet.
// Wallet balance check is ADVISORY only — real protection is in
// complete_payment_refund() which runs at gateway completion (3A3).

export async function requestWalletTopupRefund(params: {
  paymentTransactionId: string;
  amount: number;
  idempotencyKey: string;
  refundReason?: string;
}): Promise<RequestRefundResult> {
  const { paymentTransactionId, amount, idempotencyKey, refundReason } = params;

  // Validate inputs
  if (!paymentTransactionId || !isValidUuid(paymentTransactionId)) {
    return { success: false, error: "Invalid payment transaction ID" };
  }
  if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, error: "Valid amount is required" };
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    return { success: false, error: "Valid idempotency key is required" };
  }

  const admin = createAdminClient();

  // Load payment transaction
  const { data: txn, error: txnError } = await admin
    .from("payment_transactions")
    .select("id, user_id, amount, gateway, transaction_purpose, payment_status, amount_refunded")
    .eq("id", paymentTransactionId)
    .single();

  if (txnError || !txn) {
    return { success: false, error: "payment_transaction_not_found" };
  }

  // Validate it's a wallet_topup transaction
  if (txn.transaction_purpose !== "wallet_topup") {
    return { success: false, error: "invalid_transaction_purpose" };
  }

  // Validate gateway
  if (txn.gateway !== "razorpay") {
    return { success: false, error: "unsupported_gateway" };
  }

  // Validate payment status
  if (!["captured", "partially_refunded"].includes(txn.payment_status)) {
    return { success: false, error: "invalid_status" };
  }

  // Calculate remaining refundable
  const { data: existingRefunds } = await admin
    .from("payment_refunds")
    .select("amount")
    .eq("payment_transaction_id", paymentTransactionId)
    .in("refund_status", ["completed", "pending", "processing"]);

  const reservedTotal = (existingRefunds || []).reduce((sum, r) => sum + (r as any).amount, 0);
  const remainingRefundable = txn.amount - reservedTotal;

  if (amount > remainingRefundable) {
    return {
      success: false,
      error: "amount_exceeds_refundable",
      remainingRefundable,
    };
  }

  // Advisory precheck: wallet balance can absorb eventual debit
  // Real protection is in complete_payment_refund() at gateway completion (3A3)
  const { data: profile } = await admin
    .from("user_profiles")
    .select("wallet_balance")
    .eq("id", txn.user_id)
    .single();

  const walletBalance = (profile as any)?.wallet_balance ?? 0;

  if (walletBalance < amount) {
    return {
      success: false,
      error: "insufficient_wallet_balance_for_refund",
      walletBalance,
    };
  }

  // Call create_payment_refund RPC
  const { data: rpcResult, error: rpcError } = await admin.rpc("create_payment_refund", {
    p_payment_transaction_id: paymentTransactionId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_refund_reason: refundReason || null,
    p_refund_source: "admin",
  });

  if (rpcError) {
    return { success: false, error: `RPC failed: ${rpcError.message}` };
  }

  if (!rpcResult?.success) {
    return {
      success: false,
      error: rpcResult?.error || "refund_creation_failed",
      remainingRefundable: rpcResult?.remaining_refundable,
      walletBalance,
    };
  }

  return {
    success: true,
    alreadyExists: rpcResult.already_exists || false,
    refundId: rpcResult.refund_id,
    refundStatus: rpcResult.refund_status,
    amount: rpcResult.amount,
    gatewayRefundAmount: rpcResult.gateway_refund_amount,
    walletRefundAmount: rpcResult.wallet_refund_amount,
    remainingRefundable: rpcResult.remaining_refundable,
    walletBalance,
  };
}

// ============================================================================
// 2. Get Refund Eligibility
// ============================================================================
// Returns admin-useful fields only (not the full payment_transactions row).

export async function getRefundEligibility(
  transactionId: string
): Promise<EligibilityResult> {
  if (!transactionId || !isValidUuid(transactionId)) {
    return { success: false, error: "Invalid transaction ID" };
  }

  const admin = createAdminClient();

  // Load payment transaction
  const { data: txn, error: txnError } = await admin
    .from("payment_transactions")
    .select("id, user_id, amount, gateway, transaction_purpose, payment_status, amount_refunded")
    .eq("id", transactionId)
    .single();

  if (txnError || !txn) {
    return { success: false, error: "payment_transaction_not_found" };
  }

  // Validate it's a wallet_topup transaction
  if (txn.transaction_purpose !== "wallet_topup") {
    return { success: false, error: "invalid_transaction_purpose" };
  }

  if (txn.gateway !== "razorpay") {
    return { success: false, error: "unsupported_gateway" };
  }

  // Calculate remaining refundable
  const { data: existingRefunds } = await admin
    .from("payment_refunds")
    .select("amount")
    .eq("payment_transaction_id", transactionId)
    .in("refund_status", ["completed", "pending", "processing"]);

  const reservedTotal = (existingRefunds || []).reduce((sum, r) => sum + (r as any).amount, 0);
  const remainingRefundable = txn.amount - reservedTotal;

  // Load wallet balance
  const { data: profile } = await admin
    .from("user_profiles")
    .select("wallet_balance")
    .eq("id", txn.user_id)
    .single();

  const walletBalance = (profile as any)?.wallet_balance ?? 0;

  const eligible =
    ["captured", "partially_refunded"].includes(txn.payment_status) &&
    remainingRefundable > 0;

  return {
    success: true,
    eligible,
    transactionId: txn.id,
    amount: txn.amount,
    amountRefunded: txn.amount_refunded || 0,
    paymentStatus: txn.payment_status,
    gateway: txn.gateway,
    transactionPurpose: txn.transaction_purpose,
    remainingRefundable,
    walletBalance,
    canAbsorbDebit: walletBalance >= (remainingRefundable > 0 ? Math.min(remainingRefundable, txn.amount) : 0),
  };
}

// ============================================================================
// 3. List Refunds
// ============================================================================

export async function listRefunds(params: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}): Promise<ListRefundsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  let query = admin
    .from("payment_refunds")
    .select("*", { count: "exact" });

  if (params.status) {
    query = query.eq("refund_status", params.status);
  }
  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    refunds: (data as RefundRow[]) || [],
    total: count || 0,
    page,
    limit,
  };
}

// ============================================================================
// 4. Get Refund By ID
// ============================================================================

export async function getRefundById(refundId: string): Promise<GetRefundResult> {
  if (!refundId || !isValidUuid(refundId)) {
    return { success: false, error: "Invalid refund ID" };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payment_refunds")
    .select("*")
    .eq("id", refundId)
    .single();

  if (error || !data) {
    return { success: false, error: "refund_not_found" };
  }

  return { success: true, refund: data as RefundRow };
}
