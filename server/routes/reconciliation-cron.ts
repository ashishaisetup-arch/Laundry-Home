import { Router, Request, Response } from "express";
import crypto from "crypto";
import { createAdminClient } from "../supabase";
import { runReconciliation } from "../services/reconciliation-service";

// ============================================================================
// Reconciliation Cron Router — Phase 3B-1
// ============================================================================
// Mounted at /api/cron (added to PUBLIC_ROUTES in middleware/auth.ts) and
// gated solely by a timing-safe CRON_SECRET Bearer comparison.
//
// NOTE: server/routes/cron.ts (forecast) is deliberately NOT mounted anywhere;
// /api/cron/forecast must remain unreachable.
//
// Triggers:
//   POST /api/cron/reconciliation   (Vercel cron / manual ops)
//   GET  /api/cron/reconciliation   (same handler — Vercel crons default GET)
// ============================================================================

const router = Router();

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Compare against itself so a length mismatch still burns a comparison.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

async function handler(req: Request, res: Response): Promise<void> {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      res.status(500).json({ error: "cron secret not configured" });
      return;
    }

    const auth = req.headers.authorization;
    const token = typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice(7)
      : "";
    if (!token || !timingSafeEqualStr(token, secret)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const summary = await runReconciliation({
      client: createAdminClient(),
      trigger: "cron",
    });
    res.status(summary.status === "failed" ? 500 : 200).json(summary);
  } catch (e: any) {
    console.error("[reconciliation-cron] unexpected error:", e?.message ?? e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}

router.post("/reconciliation", handler);
router.get("/reconciliation", handler);

export default router;
