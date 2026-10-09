import { Router, Request, Response, NextFunction } from "express";
import { createAdminClient } from "../supabase";
import { executeManualRun } from "../services/reconciliation-run-controller";
import {
  FindingsError,
  listFindings,
  listRuns,
  transitionFinding,
  type TransitionAction,
} from "../services/reconciliation-findings";

// ============================================================================
// Admin Reconciliation Router — Phases 3B-4 / 3B-5a
// ============================================================================
// Mounted at /api/admin/reconciliation (global authMiddleware already scopes
// /api/admin to admin|superadmin; this router re-asserts it defensively).
//
//   POST /api/admin/reconciliation/run  -> guarded manual reconciliation run
//     200 cron-parity body | 401 | 403 | 409 reconciliation_already_running
//     | 429 reconciliation_rate_limited (+Retry-After) | 500 failed summary
//
//   GET  /api/admin/reconciliation/findings
//     200 { items, total, counts } (total/counts null if counts RPC fails)
//     | 400 invalid_filter | 401 | 403 | 500
//   GET  /api/admin/reconciliation/runs?limit=10 (default 10, max 50)
//     200 { items } | 401 | 403 | 500
//   POST /api/admin/reconciliation/findings/:id/acknowledge  { note? }
//   POST /api/admin/reconciliation/findings/:id/resolve       { note } (req.)
//   POST /api/admin/reconciliation/findings/:id/reopen        { note? }
//     200 mapped finding (re-ack is idempotent: original attribution kept,
//         no audit row) | 400 invalid_id/invalid_note | 404 finding_not_found
//     | 409 finding_state_conflict { currentStatus, finding } | 500
//
// Lifecycle audits (reconciliation.finding_acknowledged / _resolved /
// _reopened) are written by the service; audit failure never alters the
// response. No financial writes here.
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

function firstQuery(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return Array.isArray(v) ? String(v[0]) : String(v);
}

function sendKnownError(res: Response, e: any): boolean {
  if (e instanceof FindingsError) {
    const body: Record<string, any> = { error: e.code };
    if (e.code === "finding_state_conflict") {
      body.currentStatus = e.extra?.currentStatus;
      body.finding = e.extra?.finding;
    }
    res.status(e.status).json(body);
    return true;
  }
  return false;
}

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

router.get("/findings", async (req: Request, res: Response) => {
  try {
    const result = await listFindings(createAdminClient(), {
      status: firstQuery(req.query.status),
      severity: firstQuery(req.query.severity),
      checkCode: firstQuery(req.query.check_code),
      subjectType: firstQuery(req.query.subject_type),
      q: firstQuery(req.query.q),
      limit: firstQuery(req.query.limit),
      offset: firstQuery(req.query.offset),
    });
    res.status(200).json(result);
  } catch (e: any) {
    if (sendKnownError(res, e)) return;
    console.error("[admin-reconciliation] findings list error:", e?.message ?? e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

router.get("/runs", async (req: Request, res: Response) => {
  try {
    const result = await listRuns(createAdminClient(), firstQuery(req.query.limit));
    res.status(200).json(result);
  } catch (e: any) {
    if (sendKnownError(res, e)) return;
    console.error("[admin-reconciliation] runs list error:", e?.message ?? e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

async function handleTransition(req: Request, res: Response, action: TransitionAction) {
  try {
    const initiatorId = ((req as any).user?.id as string | undefined) ?? null;
    const noteRaw = (req.body as any)?.note;
    const result = await transitionFinding(createAdminClient(), {
      findingId: String(req.params.id),
      action,
      initiatorId,
      note: noteRaw === undefined ? undefined : noteRaw,
    });
    res.status(200).json(result.finding);
  } catch (e: any) {
    if (sendKnownError(res, e)) return;
    console.error(
      `[admin-reconciliation] ${action} transition error:`,
      e?.message ?? e
    );
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}

router.post("/findings/:id/acknowledge", (req: Request, res: Response) => {
  void handleTransition(req, res, "acknowledge");
});

router.post("/findings/:id/resolve", (req: Request, res: Response) => {
  void handleTransition(req, res, "resolve");
});

router.post("/findings/:id/reopen", (req: Request, res: Response) => {
  void handleTransition(req, res, "reopen");
});

export default router;
