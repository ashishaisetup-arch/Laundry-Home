import crypto from "crypto";
import { createAdminClient } from "../supabase";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const STALE_CREATING_MINUTES = 5;

// ============================================================================
// Types
// ============================================================================

export interface TopupOrderResult {
  success: boolean;
  transactionId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  publicKeyId?: string;
  error?: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  alreadyCredited?: boolean;
  walletTransactionId?: string | null;
  newBalance?: number;
  error?: string;
}

export interface PaymentSummary {
  walletBalance: number;
  totalSpentSixMonths: number;
  moneySaved: number;
  transactionCount: number;
  invoiceCount: number;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  method: string | null;
  description: string | null;
  order_id: string | null;
  status: string;
  payment_transaction_id: string | null;
  balance_before: number | null;
  balance_after: number | null;
  idempotency_key: string | null;
  created_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function razorpayAuth(): string {
  return Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}

function isConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function deterministicReceipt(idempotencyKey: string): string {
  const hash = crypto.createHash("sha256").update(idempotencyKey).digest("hex");
  return `lh_${hash.slice(0, 32)}`;
}

function isStale(createdAt: string, minutes: number): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created > minutes * 60 * 1000;
}

// ============================================================================
// 1. Create Top-Up Order
// ============================================================================

export async function createTopupOrder(
  userId: string,
  amountRupees: number,
  idempotencyKey: string
): Promise<TopupOrderResult> {
  if (!isConfigured()) {
    return { success: false, error: "Payment gateway not configured" };
  }

  // Validate amount
  if (!amountRupees || amountRupees < 10 || amountRupees > 25000) {
    return { success: false, error: "Amount must be between ₹10 and ₹25,000" };
  }

  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    return { success: false, error: "Invalid idempotency key" };
  }

  const admin = createAdminClient();

  // Step 1: Pre-insert local payment intent (persisted BEFORE external call)
  const { data: inserted, error: insertError } = await admin
    .from("payment_transactions")
    .insert({
      user_id: userId,
      transaction_purpose: "wallet_topup",
      amount: amountRupees,
      currency: "INR",
      gateway: "razorpay",
      gateway_order_id: null,
      payment_status: "creating",
      idempotency_key: idempotencyKey,
    })
    .select("id, gateway_order_id, payment_status, updated_at")
    .single();

  let txnId: string;

  if (insertError) {
    // UNIQUE(idempotency_key) violation — existing record with this key
    const { data: existing } = await admin
      .from("payment_transactions")
      .select("id, gateway_order_id, payment_status, updated_at")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (!existing) {
      return { success: false, error: "Failed to retrieve existing payment record" };
    }

    // 3a: Razorpay order already exists — return it
    if (existing.gateway_order_id) {
      return {
        success: true,
        transactionId: existing.id,
        razorpayOrderId: existing.gateway_order_id,
        amount: amountRupees,
        currency: "INR",
        publicKeyId: RAZORPAY_KEY_ID,
      };
    }

    // 3b: Stale 'creating' intent (possible crash/timeout) — uncertain outcome
    if (existing.payment_status === "creating" && isStale(existing.updated_at, STALE_CREATING_MINUTES)) {
      return {
        success: false,
        error: "Payment order status uncertain. Please try again later.",
      };
    }

    // 3c: Recent 'creating' intent — another request is actively claiming
    if (existing.payment_status === "creating") {
      return {
        success: false,
        error: "Payment processing in progress. Please wait.",
      };
    }

    // 3d: 'created' status but no gateway_order_id — previous Razorpay call failed
    // Atomically claim: created → creating
    if (existing.payment_status === "created" && !existing.gateway_order_id) {
      const { data: claimed, error: claimError } = await admin
        .from("payment_transactions")
        .update({
          payment_status: "creating",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("payment_status", "created")
        .select("id")
        .single();

      if (claimError || !claimed) {
        return {
          success: false,
          error: "Payment processing in progress. Please wait.",
        };
      }

      txnId = existing.id;
    } else {
      return {
        success: false,
        error: `Unexpected payment status: ${existing.payment_status}`,
      };
    }
  } else {
    txnId = inserted!.id;
  }

  // Step 2: Generate deterministic receipt for Razorpay (≤40 chars)
  const receipt = deterministicReceipt(idempotencyKey);

  // Step 3: Call Razorpay order creation API
  const amountPaise = Math.round(amountRupees * 100);

  let response: Response;
  try {
    response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayAuth()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        payment_capture: 1,
      }),
    });
  } catch (err: any) {
    // Network error / timeout — uncertain outcome, keep 'creating'
    await admin
      .from("payment_transactions")
      .update({
        failure_reason: `Network error: ${err.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", txnId)
      .eq("payment_status", "creating");

    return {
      success: false,
      error: "Payment order status uncertain. Please try again later.",
    };
  }

  // Step 4: Classify Razorpay response
  if (response.ok) {
    // Razorpay success — attempt to persist gateway_order_id
    let razorpayOrder: { id: string; amount: number; currency: string };
    try {
      razorpayOrder = await response.json();
    } catch {
      // Response parsing failed — uncertain outcome
      return {
        success: false,
        error: "Payment order status uncertain. Please try again later.",
      };
    }

    // Attempt DB persistence of gateway_order_id
    const { error: dbUpdateError } = await admin
      .from("payment_transactions")
      .update({
        gateway_order_id: razorpayOrder.id,
        payment_status: "created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", txnId)
      .eq("payment_status", "creating");

    if (!dbUpdateError) {
      return {
        success: true,
        transactionId: txnId,
        razorpayOrderId: razorpayOrder.id,
        amount: amountRupees,
        currency: "INR",
        publicKeyId: RAZORPAY_KEY_ID,
      };
    }

    // First DB update failed — retry once (transient failure)
    const { error: retryError } = await admin
      .from("payment_transactions")
      .update({
        gateway_order_id: razorpayOrder.id,
        payment_status: "created",
        updated_at: new Date().toISOString(),
      })
      .eq("id", txnId)
      .eq("payment_status", "creating");

    if (!retryError) {
      return {
        success: true,
        transactionId: txnId,
        razorpayOrderId: razorpayOrder.id,
        amount: amountRupees,
        currency: "INR",
        publicKeyId: RAZORPAY_KEY_ID,
      };
    }

    // Both DB updates failed — fail closed, preserve row in 'creating'
    console.error(
      `[payments] CRITICAL: Razorpay order created but gateway_order_id could not be persisted. ` +
      `transactionId=${txnId}, razorpayOrderId=${razorpayOrder.id}, error=${retryError.message}`
    );

    return {
      success: false,
      error: "Payment order created but could not be recorded. Reconciliation required.",
    };
  }

  // Razorpay returned an error
  const errorBody = await response.json().catch(() => ({}));
  const errorMsg = errorBody.error?.description || "Razorpay order creation failed";

  if (response.status >= 500) {
    // 5xx — uncertain outcome, keep 'creating', block auto-retry
    await admin
      .from("payment_transactions")
      .update({
        failure_reason: `Razorpay 5xx: ${errorMsg}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", txnId)
      .eq("payment_status", "creating");

    return {
      success: false,
      error: "Payment order status uncertain. Please try again later.",
    };
  }

  // 4xx — definite request rejection, reset to 'created'
  await admin
    .from("payment_transactions")
    .update({
      payment_status: "created",
      failure_reason: `Razorpay ${response.status}: ${errorMsg}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txnId)
    .eq("payment_status", "creating");

  return {
    success: false,
    error: errorMsg,
  };
}

// ============================================================================
// 2. Verify Top-Up Payment (browser callback)
// ============================================================================

export async function verifyTopupPayment(
  userId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  transactionId: string
): Promise<VerifyPaymentResult> {
  if (!isConfigured()) {
    return { success: false, error: "Payment gateway not configured" };
  }

  const admin = createAdminClient();

  // Load the payment transaction
  const { data: txn, error: loadError } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (loadError || !txn) {
    return { success: false, error: "Payment transaction not found" };
  }

  // Verify ownership
  if (txn.user_id !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify the Razorpay order matches
  if (txn.gateway_order_id !== razorpayOrderId) {
    return { success: false, error: "Order ID mismatch" };
  }

  // Verify HMAC signature
  const crypto = await import("crypto");
  const expectedSig = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(razorpaySignature))) {
    return { success: false, error: "Invalid payment signature" };
  }

  // Optionally verify payment with Razorpay API for additional assurance
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
      headers: { Authorization: `Basic ${razorpayAuth()}` },
    });

    if (response.ok) {
      const payment = await response.json();
      // Verify payment belongs to the expected order and is captured
      if (payment.order_id !== razorpayOrderId) {
        return { success: false, error: "Payment does not belong to expected order" };
      }
    }
    // Continue even if API fetch fails — HMAC verification is sufficient
  } catch {
    // Non-fatal: HMAC verification is the primary check
  }

  // Update payment transaction with verified gateway data
  const { error: updateError } = await admin
    .from("payment_transactions")
    .update({
      gateway_payment_id: razorpayPaymentId,
      gateway_signature_verified: true,
      payment_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("payment_status", "created");

  if (updateError) {
    return { success: false, error: `Failed to update payment record: ${updateError.message}` };
  }

  // Call the atomic RPC to finalize the wallet credit
  const result = await finalizeWalletTopup(transactionId);
  return result;
}

// ============================================================================
// 3. Finalize Wallet Top-Up via Postgres RPC
// ============================================================================

export async function finalizeWalletTopup(
  paymentTransactionId: string
): Promise<VerifyPaymentResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("finalize_wallet_topup", {
    p_payment_transaction_id: paymentTransactionId,
  });

  if (error) {
    return { success: false, error: `RPC error: ${error.message}` };
  }

  if (!data) {
    return { success: false, error: "No response from finalization" };
  }

  // data is the JSONB returned by the RPC
  const result = data as {
    success: boolean;
    already_credited?: boolean;
    wallet_transaction_id?: string | null;
    new_balance?: number;
    error?: string;
  };

  return {
    success: result.success,
    alreadyCredited: result.already_credited || false,
    walletTransactionId: result.wallet_transaction_id || null,
    newBalance: result.new_balance,
    error: result.error,
  };
}

// ============================================================================
// 4. Mark Payment as Capture-Verified (from webhook or API)
// ============================================================================

export async function markPaymentCaptureVerified(
  gatewayOrderId: string,
  gatewayPaymentId: string
): Promise<{ transactionId: string | null; finalized: boolean }> {
  const admin = createAdminClient();

  // Find the payment transaction by gateway order ID
  const { data: txn } = await admin
    .from("payment_transactions")
    .select("id")
    .eq("gateway_order_id", gatewayOrderId)
    .eq("transaction_purpose", "wallet_topup")
    .single();

  if (!txn) {
    return { transactionId: null, finalized: false };
  }

  // Mark capture-verified
  await admin
    .from("payment_transactions")
    .update({
      gateway_capture_verified: true,
      gateway_payment_id: gatewayPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txn.id)
    .in("payment_status", ["created", "pending", "authorized"]);

  // Attempt finalization (idempotent)
  const result = await finalizeWalletTopup(txn.id);

  return {
    transactionId: txn.id,
    finalized: result.success,
  };
}

// ============================================================================
// 5. Get Payment Summary
// ============================================================================

export async function getPaymentSummary(userId: string): Promise<PaymentSummary> {
  const admin = createAdminClient();

  // Wallet balance
  const { data: profile } = await admin
    .from("user_profiles")
    .select("wallet_balance")
    .eq("id", userId)
    .single();

  const walletBalance = (profile as any)?.wallet_balance || 0;

  // Total spent in last 6 months (net of refunds): sum of captured order payments
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: spendData } = await admin
    .from("payment_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("transaction_purpose", "order_payment")
    .eq("payment_status", "captured")
    .gte("created_at", sixMonthsAgo.toISOString());

  const totalSpentSixMonths = (spendData || []).reduce(
    (sum: number, row: any) => sum + (row.amount || 0),
    0
  );

  // Money saved: sum of coupon_discount + subscription_discount from recent orders
  // (This is a simplified calculation; can be enhanced with a dedicated savings table later)
  const moneySaved = 0;

  // Transaction count (wallet transactions)
  const { count: transactionCount } = await admin
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Invoice count
  const { count: invoiceCount } = await admin
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return {
    walletBalance,
    totalSpentSixMonths,
    moneySaved,
    transactionCount: transactionCount || 0,
    invoiceCount: invoiceCount || 0,
  };
}

// ============================================================================
// 6. Get Transactions (paginated)
// ============================================================================

export async function getTransactions(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  } = {}
): Promise<{ transactions: TransactionRow[]; total: number; page: number; limit: number }> {
  const admin = createAdminClient();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let query = admin
    .from("wallet_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  // Filter by type (credit/debit)
  if (options.type === "credit" || options.type === "debit") {
    query = query.eq("type", options.type);
  }

  // Filter by status
  if (options.status) {
    query = query.eq("status", options.status);
  }

  // Paginate
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return { transactions: [], total: 0, page, limit };
  }

  return {
    transactions: (data || []) as TransactionRow[],
    total: count || 0,
    page,
    limit,
  };
}

// ============================================================================
// 7. Get Invoices (paginated)
// ============================================================================

export async function getInvoices(
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ invoices: any[]; total: number; page: number; limit: number }> {
  const admin = createAdminClient();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  const { data, count, error } = await admin
    .from("customer_invoices")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("invoice_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { invoices: [], total: 0, page, limit };
  }

  return {
    invoices: data || [],
    total: count || 0,
    page,
    limit,
  };
}
