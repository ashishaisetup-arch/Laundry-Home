import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";
import {
  createTopupOrder,
  verifyTopupPayment,
  getPaymentSummary,
  getTransactions,
  getInvoices,
} from "../services/payment-service";
import * as crypto from "crypto";

const router = Router();

// ============================================================================
// Helper: get authenticated user from cookies
// ============================================================================

async function getAuthenticatedUser(req: Request): Promise<{ id: string } | null> {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name]
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id } : null;
  } catch {
    return null;
  }
}

// ============================================================================
// POST /api/payments/wallet/topup/create-order
// Creates a Razorpay order and a pending payment transaction.
// ============================================================================

router.post("/payments/wallet/topup/create-order", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { amount, idempotencyKey } = req.body;

    if (!amount || typeof amount !== "number") {
      res.status(400).json({ error: "Valid amount is required" });
      return;
    }

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      res.status(400).json({ error: "idempotencyKey is required" });
      return;
    }

    const result = await createTopupOrder(user.id, amount, idempotencyKey);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      transactionId: result.transactionId,
      razorpayOrderId: result.razorpayOrderId,
      amount: result.amount,
      currency: result.currency,
      publicKeyId: result.publicKeyId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/payments/wallet/topup/verify
// Verifies Razorpay payment signature and finalizes wallet credit.
// ============================================================================

router.post("/payments/wallet/topup/verify", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transaction_id,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transaction_id) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await verifyTopupPayment(
      user.id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transaction_id
    );

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      alreadyCredited: result.alreadyCredited,
      walletTransactionId: result.walletTransactionId,
      newBalance: result.newBalance,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/payments/wallet/add (DISABLED)
// Direct wallet funding is no longer allowed.
// Use /wallet/topup/create-order instead.
// ============================================================================

router.post("/payments/wallet/add", async (_req: Request, res: Response) => {
  res.status(405).json({
    error: "Direct wallet top-up is disabled. Use /api/payments/wallet/topup/create-order instead.",
  });
});

// ============================================================================
// POST /api/payments/create-order (LEGACY — order payment, not wallet top-up)
// Kept for backward compatibility with order checkout flow.
// ============================================================================

router.post("/payments/create-order", async (req: Request, res: Response) => {
  try {
    const { amount, currency, order_id } = req.body;
    if (!amount || !order_id) {
      res.status(400).json({ error: "amount and order_id are required" });
      return;
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      res.status(503).json({ error: "Payment gateway not configured", fallback: true });
      return;
    }

    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: currency || "INR",
        receipt: order_id,
        payment_capture: 1,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.description || "Razorpay error" });
      return;
    }

    // Persist Razorpay order ID to the Laundry order (merge, don't replace)
    if (order_id && data.id) {
      const admin = createAdminClient();
      const { data: orderRow } = await admin
        .from("orders")
        .select("payment_details")
        .eq("id", order_id)
        .single();

      if (orderRow) {
        const existingDetails = orderRow.payment_details || {};
        await admin.from("orders").update({
          payment_details: {
            ...existingDetails,
            razorpay_order_id: data.id,
          },
        }).eq("id", order_id);
      }
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/payments/verify (LEGACY — order payment verification)
// Full verification chain:
//   authenticated user owns order
//   ↔ stored Razorpay order ID matches callback
//   ↔ HMAC signature valid
//   → atomic finalize_order_gateway_payment RPC
// ============================================================================

router.post("/payments/verify", async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      res.status(400).json({ error: "Missing payment verification fields" });
      return;
    }

    // 1. Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const admin = createAdminClient();

    // 2. Load order
    const { data: orderRow } = await admin
      .from("orders")
      .select("id, customer_id, total, wallet_paid_amount, payment_status, payment_details")
      .eq("id", order_id)
      .single();

    if (!orderRow) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // 3. Ownership check
    if (orderRow.customer_id !== user.id) {
      res.status(403).json({ error: "Not your order" });
      return;
    }

    // 4. Razorpay order linkage check
    const storedRazorpayOrderId = orderRow.payment_details?.razorpay_order_id;
    if (!storedRazorpayOrderId) {
      res.status(400).json({ error: "No Razorpay order linked to this order" });
      return;
    }
    if (storedRazorpayOrderId !== razorpay_order_id) {
      res.status(400).json({ error: "Razorpay order mismatch" });
      return;
    }

    // 5. Signature verification
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const expectedSig = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const sigBuf = Buffer.from(expectedSig, "hex");
    const providedBuf = Buffer.from(razorpay_signature, "hex");
    if (sigBuf.length !== providedBuf.length || !crypto.timingSafeEqual(sigBuf, providedBuf)) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }

    // 6. Idempotency check
    if (orderRow.payment_status === "paid" &&
        orderRow.payment_details?.razorpay_payment_id === razorpay_payment_id) {
      res.json({ success: true, already_verified: true, payment_id: razorpay_payment_id });
      return;
    }

    // 7. Compute gateway amount and call atomic RPC
    const gatewayAmount = orderRow.total - (orderRow.wallet_paid_amount || 0);
    if (gatewayAmount <= 0) {
      // Wallet already fully covers this order — nothing to charge via gateway
      res.json({ success: true, payment_id: razorpay_payment_id, note: "fully_covered_by_wallet" });
      return;
    }

    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "finalize_order_gateway_payment",
      {
        p_order_id: order_id,
        p_gateway_order_id: razorpay_order_id,
        p_gateway_payment_id: razorpay_payment_id,
        p_amount: gatewayAmount,
      }
    );

    if (rpcError) {
      res.status(500).json({ error: `Finalization RPC failed: ${rpcError.message}` });
      return;
    }

    if (!rpcResult?.success) {
      res.status(400).json({ error: rpcResult?.error || "Finalization failed" });
      return;
    }

    res.json({
      success: true,
      already_finalized: rpcResult.already_finalized || false,
      payment_id: razorpay_payment_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/customer/payments/summary
// Returns wallet balance, spending, and counts for the overview.
// ============================================================================

router.get("/customer/payments/summary", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const summary = await getPaymentSummary(user.id);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/customer/payments/transactions
// Paginated wallet transaction history.
// ============================================================================

router.get("/customer/payments/transactions", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await getTransactions(user.id, { page, limit, type, status });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/customer/invoices
// Paginated invoice list.
// ============================================================================

router.get("/customer/invoices", async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await getInvoices(user.id, { page, limit });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
