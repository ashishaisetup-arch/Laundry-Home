import { Router, Request, Response } from "express";
import { createServerClientWithCookies } from "../supabase";
import {
  createTopupOrder,
  verifyTopupPayment,
  getPaymentSummary,
  getTransactions,
  getInvoices,
} from "../services/payment-service";

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

router.post("/wallet/topup/create-order", async (req: Request, res: Response) => {
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

router.post("/wallet/topup/verify", async (req: Request, res: Response) => {
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

router.post("/wallet/add", async (_req: Request, res: Response) => {
  res.status(405).json({
    error: "Direct wallet top-up is disabled. Use /api/payments/wallet/topup/create-order instead.",
  });
});

// ============================================================================
// POST /api/payments/create-order (LEGACY — order payment, not wallet top-up)
// Kept for backward compatibility with order checkout flow.
// ============================================================================

router.post("/create-order", async (req: Request, res: Response) => {
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
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/payments/verify (LEGACY — order payment verification)
// Kept for backward compatibility with order checkout flow.
// ============================================================================

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing payment verification fields" });
      return;
    }

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const crypto = await import("crypto");
    const expectedSig = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }

    // Note: This legacy endpoint still uses direct Supabase update.
    // A future phase should migrate this to use payment_transactions + finalize_wallet_topup.
    const { createAdminClient } = await import("../supabase");
    const admin = createAdminClient();

    if (order_id) {
      await admin.from("orders").update({
        payment_status: "paid",
        payment_details: { razorpay_payment_id, razorpay_order_id },
      }).eq("id", order_id);
    }

    res.json({ success: true, payment_id: razorpay_payment_id });
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
