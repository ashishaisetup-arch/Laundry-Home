import { Router, Request, Response, NextFunction } from "express";
import { createAdminClient } from "../supabase";
import { executeManualRun } from "../services/reconciliation-run-controller";

// ============================================================================
// Admin Reconciliation Router — Phase 3B-4
// ============================================================================
// Mounted at /api/admin/reconciliation (global authMiddleware already scopes
// /api/admin to admin|superadmin; this router re-asserts it defensively).
//
//   POST /api/admin/reconciliation/run  -> guarded manual reconciliation run
//     200 cron-parity body | 401 | 403 | 409 reconciliation_already_running
//     | 429 reconciliation_rate_limited (+Retry-After) | 500 failed summary
//
// No UI, no ack/resolve, no financial writes here: the route only orchestrates
// runReconciliationWithAlerts and audit attribution.
// ============================================================================

const router = Router();

// Defense-in-depth — mirrors routes/admin-refunds.ts: the global
// authMiddleware already sets req.userRole for /api/admin/*; this check keeps
// the endpoint admin-only even if mount order changes in a future refactor.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).userRole as string | undefined;
  if (!role || !["admin", "superadmin"].includes(role)) {
    res.status(403).json({ error: "Forbidden: insufficient role" });
    return;
  }
  next();
}

router.use(requireAdmin);

router.post("/run", async (req: Request, res: Response) => {
  try {
    const initiatorId = ((req as any).user?.id as string | undefined) ?? null;
    const result = await executeManualRun({
      client: createAdminClient(),
      initiatorId,
    });
    if (result.retryAfterSeconds !== undefined) {
      res.set("Retry-After", String(result.retryAfterSeconds));
    }
    res.status(result.status).json(result.body);
  } catch (e: any) {
    console.error("[admin-reconciliation] unexpected error:", e?.message ?? e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

export default router;
