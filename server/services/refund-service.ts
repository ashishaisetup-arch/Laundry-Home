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

export interface BeginSubmissionResult {
  success: boolean;
  refund?: RefundRow;
  alreadyExists?: boolean;
  error?: string;
}

export interface SubmitRefundResult {
  success: boolean;
  refundId?: string;
  refundStatus?: string;
  gatewayRefundId?: string;
  alreadyExists?: boolean;
  uncertain?: boolean;
  webhookWonRace?: boolean;
  error?: string;
}

export interface ProcessRefundResult {
  success: boolean;
  refundId?: string;
  refundStatus?: string;
  gatewayRefundId?: string;
  alreadyCompleted?: boolean;
  alreadyExists?: boolean;
  uncertain?: boolean;
  error?: string;
}

export interface ResolveRefundResult {
  success: boolean;
  refund?: RefundRow;
  error?: string;
  critical?: boolean;
}

export interface WebhookRefundResult {
  success: boolean;
  refundId?: string;
  refundStatus?: string;
  gatewayRefundId?: string;
  walletMoved?: boolean;
  newWalletBalance?: number;
  alreadyCompleted?: boolean;
  error?: string;
  critical?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function razorpayAuth(): string {
  return Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}

function isConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

/**
 * Strict classifier for definitive Razorpay refund rejections.
 * Only patterns confirmed in Razorpay Test Mode are included.
 * Everything else stays in submitting → uncertain → reconciliation.
 */
function isKnownDefinitiveRazorpayRefundRejection(errorPayload: any): boolean {
  const description = (errorPayload?.error?.description || "").toLowerCase();

  const definitivePatterns = [
    "refund amount exceeds",
    "payment has already been fully refunded",
    "payment not found",
  ];

  return definitivePatterns.some((pattern) => description.includes(pattern));
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

  // Idempotency check BEFORE wallet check
  const { data: existingRefund } = await admin
    .from("payment_refunds")
    .select("id, payment_transaction_id, amount, refund_status")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (existingRefund) {
    if (
      (existingRefund as any).payment_transaction_id === paymentTransactionId &&
      (existingRefund as any).amount === amount
    ) {
      // Valid retry — return existing refund with ACTUAL status
      return {
        success: true,
        alreadyExists: true,
        refundId: (existingRefund as any).id,
        refundStatus: (existingRefund as any).refund_status,
        amount,
      };
    } else {
      // Idempotency conflict
      return { success: false, error: "idempotency_conflict" };
    }
  }

  // Advisory precheck: wallet balance (only for NEW refunds)
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

export async function getRefundEligibility(
  transactionId: string
): Promise<EligibilityResult> {
  if (!transactionId || !isValidUuid(transactionId)) {
    return { success: false, error: "Invalid transaction ID" };
  }

  const admin = createAdminClient();

  const { data: txn, error: txnError } = await admin
    .from("payment_transactions")
    .select("id, user_id, amount, gateway, transaction_purpose, payment_status, amount_refunded")
    .eq("id", transactionId)
    .single();

  if (txnError || !txn) {
    return { success: false, error: "payment_transaction_not_found" };
  }

  if (txn.transaction_purpose !== "wallet_topup") {
    return { success: false, error: "invalid_transaction_purpose" };
  }

  if (txn.gateway !== "razorpay") {
    return { success: false, error: "unsupported_gateway" };
  }

  // Calculate remaining refundable (includes submitting + reconciliation_required)
  const { data: existingRefunds } = await admin
    .from("payment_refunds")
    .select("amount")
    .eq("payment_transaction_id", transactionId)
    .in("refund_status", ["completed", "pending", "submitting", "processing", "reconciliation_required"]);

  const reservedTotal = (existingRefunds || []).reduce((sum, r) => sum + (r as any).amount, 0);
  const remainingRefundable = txn.amount - reservedTotal;

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

// ============================================================================
// 5. Begin Refund Submission (atomic pending → submitting)
// ============================================================================

export async function beginRefundSubmission(refundId: string): Promise<BeginSubmissionResult> {
  if (!refundId || !isValidUuid(refundId)) {
    return { success: false, error: "Invalid refund ID" };
  }

  const admin = createAdminClient();

  // Load current state
  const { data: current, error: loadError } = await admin
    .from("payment_refunds")
    .select("*")
    .eq("id", refundId)
    .single();

  if (loadError || !current) {
    return { success: false, error: "refund_not_found" };
  }

  const status = (current as any).refund_status;

  if (status === "pending") {
    // Atomic transition: pending → submitting
    const { data: updated, error: updateError } = await admin
      .from("payment_refunds")
      .update({ refund_status: "submitting", updated_at: new Date().toISOString() })
      .eq("id", refundId)
      .eq("refund_status", "pending")
      .select("*")
      .single();

    if (updateError || !updated) {
      // Concurrent modification — reload and return current state
      const { data: reloaded } = await admin
        .from("payment_refunds")
        .select("*")
        .eq("id", refundId)
        .single();
      return { success: true, alreadyExists: true, refund: reloaded as RefundRow };
    }

    return { success: true, refund: updated as RefundRow };
  }

  if (status === "submitting" || status === "processing") {
    return { success: true, alreadyExists: true, refund: current as RefundRow };
  }

  if (status === "completed") {
    return { success: false, error: "already_completed" };
  }

  if (status === "failed") {
    return { success: false, error: "refund_already_failed" };
  }

  if (status === "reconciliation_required") {
    return { success: false, error: "reconciliation_required" };
  }

  return { success: false, error: `invalid_refund_state: ${status}` };
}

// ============================================================================
// 6. Submit Refund to Gateway (Razorpay API call)
// ============================================================================
// Prerequisite: Refund must be in 'submitting' state.
// Never mutates wallet balance. Conservative 4xx classification.

export async function submitRefundToGateway(refundId: string): Promise<SubmitRefundResult> {
  if (!refundId || !isValidUuid(refundId)) {
    return { success: false, error: "Invalid refund ID" };
  }

  if (!isConfigured()) {
    return { success: false, error: "Razorpay not configured" };
  }

  const admin = createAdminClient();

  // Load refund — must be submitting
  const { data: refund, error: refundError } = await admin
    .from("payment_refunds")
    .select("*")
    .eq("id", refundId)
    .single();

  if (refundError || !refund) {
    return { success: false, error: "refund_not_found" };
  }

  const refundRow = refund as RefundRow;

  if (refundRow.refund_status !== "submitting") {
    return { success: false, error: `refund_not_in_submitting_state: ${refundRow.refund_status}` };
  }

  if (!refundRow.gateway_refund_amount || refundRow.gateway_refund_amount <= 0) {
    return { success: false, error: "gateway_refund_amount_required" };
  }

  // Load linked payment transaction for gateway_payment_id
  const { data: txn, error: txnError } = await admin
    .from("payment_transactions")
    .select("gateway_payment_id, gateway")
    .eq("id", refundRow.payment_transaction_id)
    .single();

  if (txnError || !txn) {
    return { success: false, error: "payment_transaction_not_found" };
  }

  const gatewayPaymentId = (txn as any).gateway_payment_id;
  if (!gatewayPaymentId) {
    return { success: false, error: "gateway_payment_id_missing" };
  }

  // Call Razorpay Refund API
  const amountPaise = Math.round(refundRow.gateway_refund_amount * 100);

  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/payments/${gatewayPaymentId}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayAuth()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        speed: "normal",
        notes: {
          laundry_refund_id: refundRow.id,
          idempotency_key: refundRow.idempotency_key,
        },
      }),
    });
  } catch (err: any) {
    // Network error — uncertain, stay submitting
    return {
      success: false,
      uncertain: true,
      error: `gateway_refund_uncertain_network: ${err.message}`,
    };
  }

  // Classify response
  if (response.ok) {
    // Parse Razorpay response
    let razorpayRefund: { id: string; status: string; amount: number };
    try {
      razorpayRefund = await response.json();
    } catch {
      return { success: false, uncertain: true, error: "gateway_refund_response_parse_failed" };
    }

    const gatewayRefundId = razorpayRefund.id;

    // Call RPC for atomic conditional transition
    const { data: confirmResult } = await admin.rpc("confirm_refund_gateway_submission", {
      p_refund_id: refundRow.id,
      p_gateway_refund_id: gatewayRefundId,
    });

    if (!confirmResult?.success) {
      if (confirmResult?.error === "gateway_refund_id_conflict") {
        console.error(`[refund] Conflict: refund ${refundRow.id} gateway_refund_id conflict`);
        return { success: false, error: "gateway_refund_id_conflict" };
      }
      return { success: false, error: `confirm_failed: ${confirmResult?.error}` };
    }

    // Interpret returned state
    const finalStatus = confirmResult.refund_status;

    if (finalStatus === "processing") {
      return {
        success: true,
        refundId: refundRow.id,
        refundStatus: "processing",
        gatewayRefundId,
      };
    }

    if (finalStatus === "completed") {
      // Webhook won the race — refund already completed
      return {
        success: true,
        refundId: refundRow.id,
        refundStatus: "completed",
        gatewayRefundId,
        webhookWonRace: true,
      };
    }

    if (finalStatus === "reconciliation_required") {
      return {
        success: true,
        refundId: refundRow.id,
        refundStatus: "reconciliation_required",
        gatewayRefundId,
      };
    }

    if (finalStatus === "failed") {
      console.error(`[refund] Conflict: refund ${refundRow.id} confirmed but status is failed`);
      return { success: false, error: "refund_status_conflict_investigate" };
    }

    return { success: false, error: `unexpected_refund_status: ${finalStatus}` };
  }

  // Classify non-2xx responses
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    // Uncertain — remain submitting
    return {
      success: false,
      uncertain: true,
      error: `gateway_refund_uncertain_${response.status}`,
    };
  }

  // Parse error payload for 4xx
  let errorPayload: any = null;
  try {
    errorPayload = await response.json();
  } catch {
    // Can't parse error — conservative: uncertain
    return {
      success: false,
      uncertain: true,
      error: `gateway_refund_uncertain_${response.status}_unparseable`,
    };
  }

  // Check for definitive rejection
  if (isKnownDefinitiveRazorpayRefundRejection(errorPayload)) {
    const failureReason = errorPayload?.error?.description || `Razorpay rejected refund: ${response.status}`;
    await admin.rpc("mark_refund_failed", {
      p_refund_id: refundRow.id,
      p_failure_reason: failureReason,
    });
    return {
      success: false,
      error: "gateway_refund_failed",
      refundStatus: "failed",
    };
  }

  // Conservative default: uncertain
  return {
    success: false,
    uncertain: true,
    error: `gateway_refund_uncertain_${response.status}`,
  };
}

// ============================================================================
// 7. Process Refund via Gateway (orchestrator for POST /:id/process)
// ============================================================================

export async function processRefundViaGateway(refundId: string): Promise<ProcessRefundResult> {
  if (!refundId || !isValidUuid(refundId)) {
    return { success: false, error: "Invalid refund ID" };
  }

  const admin = createAdminClient();

  const { data: refund, error: refundError } = await admin
    .from("payment_refunds")
    .select("*")
    .eq("id", refundId)
    .single();

  if (refundError || !refund) {
    return { success: false, error: "refund_not_found" };
  }

  const refundRow = refund as RefundRow;
  const status = refundRow.refund_status;

  switch (status) {
    case "pending": {
      // Begin submission then submit to gateway
      const beginResult = await beginRefundSubmission(refundId);
      if (!beginResult.success) {
        return { success: false, error: beginResult.error };
      }

      if (beginResult.alreadyExists && beginResult.refund) {
        // Already in submitting/processing — handle below
        const currentStatus = beginResult.refund.refund_status;
        if (currentStatus === "processing") {
          return {
            success: true,
            refundId,
            refundStatus: "processing",
            gatewayRefundId: beginResult.refund.gateway_refund_id,
            alreadyExists: true,
          };
        }
        if (currentStatus === "submitting") {
          // Try to submit (idempotent — will check gateway_refund_id)
          const submitResult = await submitRefundToGateway(refundId);
          return mapSubmitResult(submitResult);
        }
      }

      // Fresh submission
      const submitResult = await submitRefundToGateway(refundId);
      return mapSubmitResult(submitResult);
    }

    case "submitting":
      // Do NOT auto-resubmit — needs reconciliation
      return {
        success: false,
        uncertain: true,
        error: "submission_uncertain_reconciliation_required",
      };

    case "processing":
      return {
        success: true,
        refundId,
        refundStatus: "processing",
        gatewayRefundId: refundRow.gateway_refund_id,
        alreadyExists: true,
      };

    case "completed":
      return {
        success: true,
        refundId,
        refundStatus: "completed",
        gatewayRefundId: refundRow.gateway_refund_id,
        alreadyCompleted: true,
      };

    case "failed":
      return { success: false, error: "refund_already_failed" };

    case "reconciliation_required":
      return { success: false, error: "reconciliation_required" };

    default:
      return { success: false, error: `invalid_refund_state: ${status}` };
  }
}

function mapSubmitResult(result: SubmitRefundResult): ProcessRefundResult {
  return {
    success: result.success,
    refundId: result.refundId,
    refundStatus: result.refundStatus,
    gatewayRefundId: result.gatewayRefundId,
    alreadyExists: result.alreadyExists,
    uncertain: result.uncertain,
    error: result.error,
  };
}

// ============================================================================
// 8. Resolve Local Refund (common resolver for all refund webhooks)
// ============================================================================

export async function resolveLocalRefund(refundEntity: any): Promise<ResolveRefundResult> {
  const admin = createAdminClient();
  const gatewayRefundId = refundEntity?.id;

  if (!gatewayRefundId) {
    return { success: false, error: "missing_gateway_refund_id" };
  }

  // 1. Try gateway_refund_id lookup
  let { data: refund } = await admin
    .from("payment_refunds")
    .select("*")
    .eq("gateway_refund_id", gatewayRefundId)
    .single();

  // 2. If not found, try notes correlation
  if (!refund) {
    const laundryRefundId = refundEntity?.notes?.laundry_refund_id;
    if (!laundryRefundId) {
      return { success: false, error: "missing_notes_correlation" };
    }

    const { data: byNotes } = await admin
      .from("payment_refunds")
      .select("*")
      .eq("id", laundryRefundId)
      .single();

    if (!byNotes) {
      return { success: false, error: "refund_not_found" };
    }

    refund = byNotes;
  }

  const refundRow = refund as RefundRow;

  // 3. Validate amount match (Razorpay sends paise)
  const expectedAmountPaise = refundRow.gateway_refund_amount * 100;
  if (refundEntity.amount && refundEntity.amount !== expectedAmountPaise) {
    return { success: false, error: "webhook_amount_mismatch" };
  }

  // 4. Validate payment_id matches linked payment_transaction
  if (refundEntity.payment_id) {
    const { data: txn } = await admin
      .from("payment_transactions")
      .select("gateway_payment_id")
      .eq("id", refundRow.payment_transaction_id)
      .single();

    if (txn && (txn as any).gateway_payment_id && (txn as any).gateway_payment_id !== refundEntity.payment_id) {
      return { success: false, error: "webhook_payment_id_mismatch" };
    }
  }

  // 5. Bind gateway_refund_id if NULL
  if (!refundRow.gateway_refund_id) {
    const { data: bound } = await admin
      .from("payment_refunds")
      .update({ gateway_refund_id: gatewayRefundId, updated_at: new Date().toISOString() })
      .eq("id", refundRow.id)
      .is("gateway_refund_id", null)
      .select("*")
      .single();

    if (bound) {
      refundRow.gateway_refund_id = gatewayRefundId;
    } else {
      // Concurrent modification — reload
      const { data: reloaded } = await admin
        .from("payment_refunds")
        .select("*")
        .eq("id", refundRow.id)
        .single();
      if (reloaded) {
        Object.assign(refundRow, reloaded);
      }
    }
  }

  // 6. Check for conflict
  if (refundRow.gateway_refund_id && refundRow.gateway_refund_id !== gatewayRefundId) {
    return { success: false, critical: true, error: "gateway_refund_id_conflict" };
  }

  return { success: true, refund: refundRow };
}

// ============================================================================
// 9. Handle Refund Created Webhook
// ============================================================================

export async function handleRefundCreatedWebhook(
  refund: RefundRow,
  refundEntity: any
): Promise<WebhookRefundResult> {
  const admin = createAdminClient();

  // If refund is in pending or submitting, transition to processing
  if (["pending", "submitting"].includes(refund.refund_status)) {
    const { data: updated } = await admin
      .from("payment_refunds")
      .update({
        refund_status: "processing",
        gateway_refund_id: refundEntity.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", refund.id)
      .in("refund_status", ["pending", "submitting"])
      .select("*")
      .single();

    if (updated) {
      return {
        success: true,
        refundId: refund.id,
        refundStatus: "processing",
        gatewayRefundId: refundEntity.id,
      };
    }
  }

  // Already in processing or later state
  return {
    success: true,
    refundId: refund.id,
    refundStatus: refund.refund_status,
    gatewayRefundId: refund.gateway_refund_id || refundEntity.id,
  };
}

// ============================================================================
// 10. Handle Refund Processed Webhook
// ============================================================================

export async function handleRefundProcessedWebhook(
  refund: RefundRow,
  refundEntity: any
): Promise<WebhookRefundResult> {
  const admin = createAdminClient();

  // Idempotent: already completed
  if (refund.refund_status === "completed") {
    return {
      success: true,
      refundId: refund.id,
      refundStatus: "completed",
      alreadyCompleted: true,
    };
  }

  // Idempotent: already reconciliation_required
  if (refund.refund_status === "reconciliation_required") {
    return {
      success: true,
      refundId: refund.id,
      refundStatus: "reconciliation_required",
    };
  }

  // Call complete_payment_refund RPC
  const { data: rpcResult } = await admin.rpc("complete_payment_refund", {
    p_refund_id: refund.id,
    p_gateway_refund_id: refundEntity.id,
  });

  if (rpcResult?.success) {
    return {
      success: true,
      refundId: refund.id,
      refundStatus: "completed",
      gatewayRefundId: refundEntity.id,
      walletMoved: rpcResult.wallet_moved,
      newWalletBalance: rpcResult.new_wallet_balance,
    };
  }

  // Handle insufficient_wallet_balance → reconciliation_required
  if (rpcResult?.error === "insufficient_wallet_balance") {
    const { data: reconResult } = await admin.rpc("mark_refund_reconciliation_required", {
      p_refund_id: refund.id,
      p_gateway_refund_id: refundEntity.id,
      p_failure_reason: "wallet_debit_failed",
    });

    if (reconResult?.success) {
      return {
        success: false,
        refundId: refund.id,
        refundStatus: "reconciliation_required",
        error: "reconciliation_required",
      };
    }

    return {
      success: false,
      error: `reconciliation_transition_failed: ${reconResult?.error}`,
    };
  }

  // Handle already_completed (idempotent)
  if (rpcResult?.already_completed) {
    return {
      success: true,
      refundId: refund.id,
      refundStatus: "completed",
      alreadyCompleted: true,
    };
  }

  return {
    success: false,
    refundId: refund.id,
    error: rpcResult?.error || "complete_payment_refund_failed",
  };
}

// ============================================================================
// 11. Handle Refund Failed Webhook
// ============================================================================

export async function handleRefundFailedWebhook(
  refund: RefundRow,
  refundEntity: any
): Promise<WebhookRefundResult> {
  const admin = createAdminClient();

  // Idempotent: already failed
  if (refund.refund_status === "failed") {
    return {
      success: true,
      refundId: refund.id,
      refundStatus: "failed",
    };
  }

  const failureReason = refundEntity?.error_description || "Gateway refund failed";

  const { data: rpcResult } = await admin.rpc("mark_refund_failed", {
    p_refund_id: refund.id,
    p_failure_reason: failureReason,
  });

  if (rpcResult?.success) {
    return {
      success: true,
      refundId: refund.id,
      refundStatus: "failed",
    };
  }

  return {
    success: false,
    refundId: refund.id,
    error: rpcResult?.error || "mark_refund_failed_failed",
  };
}
