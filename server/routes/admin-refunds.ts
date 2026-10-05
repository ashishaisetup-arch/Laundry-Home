import { Router, Request, Response, NextFunction } from "express";
import {
  requestWalletTopupRefund,
  getRefundEligibility,
  listRefunds,
  getRefundById,
} from "../services/refund-service";

const router = Router();

// ============================================================================
// Admin authorization — defense-in-depth
// ============================================================================
// The global authMiddleware (app.ts) already sets req.userRole for /api/admin/*.
// This router-level check ensures financial endpoints remain admin-only even if
// mount order changes in a future refactor.

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).userRole as string | undefined;
  if (!role || !["admin", "superadmin"].includes(role)) {
    res.status(403).json({ error: "Forbidden: insufficient role" });
    return;
  }
  next();
}

router.use(requireAdmin);

// ============================================================================
// GET /wallet-topup/:transactionId/eligibility
// ============================================================================
// Must be defined before GET /:id to avoid route capture.

router.get("/wallet-topup/:transactionId/eligibility", async (req: Request, res: Response) => {
  try {
    const transactionId = req.params.transactionId as string;
    const result = await getRefundEligibility(transactionId);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      transactionId: result.transactionId,
      amount: result.amount,
      amountRefunded: result.amountRefunded,
      paymentStatus: result.paymentStatus,
      gateway: result.gateway,
      transactionPurpose: result.transactionPurpose,
      remainingRefundable: result.remainingRefundable,
      walletBalance: result.walletBalance,
      canAbsorbDebit: result.canAbsorbDebit,
      eligible: result.eligible,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /wallet-topup
// ============================================================================
// Creates a pending refund reservation. No wallet movement.

router.post("/wallet-topup", async (req: Request, res: Response) => {
  try {
    const { paymentTransactionId, amount, idempotencyKey, refundReason } = req.body;

    if (!paymentTransactionId || typeof paymentTransactionId !== "string") {
      res.status(400).json({ error: "paymentTransactionId is required" });
      return;
    }
    if (!amount || typeof amount !== "number") {
      res.status(400).json({ error: "amount is required" });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      res.status(400).json({ error: "idempotencyKey is required" });
      return;
    }

    const result = await requestWalletTopupRefund({
      paymentTransactionId,
      amount,
      idempotencyKey,
      refundReason,
    });

    if (!result.success) {
      // Map known errors to HTTP 400
      res.status(400).json({
        error: result.error,
        remainingRefundable: result.remainingRefundable,
        walletBalance: result.walletBalance,
      });
      return;
    }

    // Idempotent valid retry → 200; new refund created → 201
    const statusCode = result.alreadyExists ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      alreadyExists: result.alreadyExists,
      refundId: result.refundId,
      refundStatus: result.refundStatus,
      amount: result.amount,
      gatewayRefundAmount: result.gatewayRefundAmount,
      walletRefundAmount: result.walletRefundAmount,
      remainingRefundable: result.remainingRefundable,
      walletBalance: result.walletBalance,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /
// ============================================================================
// List refunds with optional filters.

router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const userId = req.query.userId as string | undefined;

    const result = await listRefunds({ page, limit, status, userId });

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({
      refunds: result.refunds,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /:id
// ============================================================================
// Single refund detail. Must be last — parameterized route.

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await getRefundById(id);

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json(result.refund);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
