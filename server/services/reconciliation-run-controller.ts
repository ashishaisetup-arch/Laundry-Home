import {
  runReconciliationWithAlerts,
  AlertDispatchStats,
} from "./reconciliation-alerts";
import type { RunSummary, RunTrigger } from "./reconciliation-service";

// ============================================================================
// Reconciliation Run Controller — Phase 3B-4
// ============================================================================
// Shared guarded orchestration for BOTH trigger surfaces:
//   - POST /api/admin/reconciliation/run  (admin, trigger="manual")
//   - POST|GET /api/cron/reconciliation   (CRON_SECRET, trigger="cron")
// Hard invariants:
//   - one implementation of the guard/cool-down/classify/response path; the
//     routes stay thin so cron and admin semantics cannot drift
//   - fresh active run (< RUN_STALE_MS)        -> 409 reconciliation_already_running
//     (body carries activeRunId + startedAt)
//   - stale active run (>= RUN_STALE_MS)       -> conditional UPDATE ... WHERE
//     status='running'; audit reconciliation.run_abandoned ONLY if the row was
//     actually changed; then proceed
//   - manual run finished < COOLDOWN_MS ago    -> 429 reconciliation_rate_limited
//     + Retry-After (cron is exempt from the cooldown)
//   - run-insert 23505 (failureCode=active_run_conflict, set by the service)
//                                             -> 409 reconciliation_already_running
//     (TOCTOU backstop; activeRunId/startedAt legitimately absent)
//   - other reconciliation failure             -> 500, cron-compatible body
//   - true orchestration exception             -> route catch -> 500
//   - responses never contain alertCandidates or failureCode (internal-only)
//   - writes ONLY to reconciliation_runs (status/finalize fields), audit_logs
// ============================================================================

// An active run older than this crashed without finalizing (runs finalize in
// well under a minute in production) — abandon so the partial unique index
// reconciliation_runs_one_active can never wedge operations permanently.
export const RUN_STALE_MS = 15 * 60 * 1000;

// Manual-only cooldown measured from the most recent COMPLETED manual run.
export const COOLDOWN_MS = 60 * 1000;

const STALE_ABANDON_PREFIX = "abandoned:";
const STALE_ABANDON_ERROR = `${STALE_ABANDON_PREFIX} not finalized within ${Math.round(
  RUN_STALE_MS / 60000
)}min`;

export type GateDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 409 | 429;
      body: Record<string, unknown>;
      retryAfterSeconds?: number;
    };

export interface GuardedRunResult {
  status: number;
  body: Record<string, unknown>;
  retryAfterSeconds?: number;
}

// ----------------------------------------------------------------------------
// Shared active-run guard
// ----------------------------------------------------------------------------
// Fail-open on guard-query errors: the partial unique index is the hard
// backstop, so an unavailable pre-check degrades to 409-on-collision instead
// of taking the surface down.
export async function evaluateRunGate(
  client: any,
  opts: { trigger: RunTrigger; now?: Date }
): Promise<GateDecision> {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  let activeRows: any[] = [];
  try {
    const activeRes = await client
      .from("reconciliation_runs")
      .select("id, started_at")
      .eq("status", "running");
    if (activeRes?.error) {
      console.error(
        "[reconciliation-run] active-run query failed (fail-open):",
        activeRes.error.message
      );
    } else {
      activeRows = activeRes?.data ?? [];
    }
  } catch (e: any) {
    console.error(
      "[reconciliation-run] active-run query failed (fail-open):",
      String(e?.message ?? e)
    );
  }

  const fresh = activeRows
    .filter((r) => r?.started_at && nowMs - Date.parse(r.started_at) < RUN_STALE_MS)
    .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  if (fresh.length > 0) {
    return {
      allowed: false,
      status: 409,
      body: {
        error: "reconciliation_already_running",
        activeRunId: fresh[0].id,
        startedAt: fresh[0].started_at,
      },
    };
  }

  // Stale crash orphans: conditional update guards the status so a concurrent
  // guard's change wins and only the actual changer audits.
  const stale = activeRows.filter(
    (r) => r?.started_at && nowMs - Date.parse(r.started_at) >= RUN_STALE_MS
  );
  const abandonedIds: string[] = [];
  for (const row of stale) {
    try {
      const upd = await client
        .from("reconciliation_runs")
        .update({
          status: "failed",
          error: STALE_ABANDON_ERROR,
          finished_at: nowIso,
        })
        .eq("id", row.id)
        .eq("status", "running")
        .select("id");
      if (upd?.error) {
        console.error(
          "[reconciliation-run] stale abandon update failed:",
          upd.error.message
        );
      } else if (Array.isArray(upd?.data) && upd.data.length > 0) {
        abandonedIds.push(row.id);
      }
    } catch (e: any) {
      console.error(
        "[reconciliation-run] stale abandon update failed:",
        String(e?.message ?? e)
      );
    }
  }
  if (abandonedIds.length > 0) {
    try {
      const aRes = await client.from("audit_logs").insert({
        user_id: null,
        action: "reconciliation.run_abandoned",
        resource: "reconciliation_runs",
        details: {
          run_ids: abandonedIds,
          threshold_ms: RUN_STALE_MS,
          abandoned_at: nowIso,
        },
      });
      if (aRes?.error) {
        console.error(
          "[reconciliation-run] abandon audit failed:",
          aRes.error.message
        );
      }
    } catch (e: any) {
      console.error(
        "[reconciliation-run] abandon audit failed:",
        String(e?.message ?? e)
      );
    }
  }

  // Manual-only cooldown from the most recent COMPLETED manual run. A recent
  // cron run never blocks an admin diagnostic run. Abandoned crash rows are
  // excluded: they were never completed.
  if (opts.trigger === "manual") {
    try {
      const lastRes = await client
        .from("reconciliation_runs")
        .select("finished_at, error")
        .eq("trigger_source", "manual")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(10);
      if (lastRes?.error) {
        console.error(
          "[reconciliation-run] cooldown query failed (fail-open):",
          lastRes.error.message
        );
      } else {
        const rows = (lastRes?.data ?? []) as any[];
        const last = rows.find(
          (r) =>
            r?.finished_at &&
            !(typeof r.error === "string" && r.error.startsWith(STALE_ABANDON_PREFIX))
        );
        if (last?.finished_at) {
          const age = nowMs - Date.parse(last.finished_at);
          if (age >= 0 && age < COOLDOWN_MS) {
            const retryAfterSeconds = Math.max(
              1,
              Math.ceil((COOLDOWN_MS - age) / 1000)
            );
            return {
              allowed: false,
              status: 429,
              body: {
                error: "reconciliation_rate_limited",
                retryAfterSeconds,
              },
              retryAfterSeconds,
            };
          }
        }
      }
    } catch (e: any) {
      console.error(
        "[reconciliation-run] cooldown query failed (fail-open):",
        String(e?.message ?? e)
      );
    }
  }

  return { allowed: true };
}

// ----------------------------------------------------------------------------
// Shared response builder — cron parity by construction
// ----------------------------------------------------------------------------
export function toRunResponse(
  summary: RunSummary,
  alerts: AlertDispatchStats
): { status: number; body: Record<string, unknown> } {
  if (summary.failureCode === "active_run_conflict") {
    return {
      status: 409,
      body: { error: "reconciliation_already_running" },
    };
  }
  const {
    alertCandidates: _candidates,
    failureCode: _failureCode,
    ...rest
  } = summary;
  return {
    status: summary.status === "failed" ? 500 : 200,
    body: { ...rest, alerts },
  };
}

// ----------------------------------------------------------------------------
// Guarded orchestration (shared by cron + manual surfaces)
// ----------------------------------------------------------------------------
export interface GuardedRunOptions {
  client: any;
  trigger: RunTrigger;
  initiatorId?: string | null;
  now?: Date;
}

export async function executeGuardedRun(
  opts: GuardedRunOptions
): Promise<GuardedRunResult> {
  const gate = await evaluateRunGate(opts.client, {
    trigger: opts.trigger,
    now: opts.now,
  });
  if (!gate.allowed) {
    return {
      status: gate.status,
      body: gate.body,
      ...(gate.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: gate.retryAfterSeconds }
        : {}),
    };
  }

  const { summary, alerts } = await runReconciliationWithAlerts({
    client: opts.client,
    trigger: opts.trigger,
    ...(opts.now ? { now: opts.now } : {}),
  });
  const resp = toRunResponse(summary, alerts);

  // Manual runs are audit-logged with the initiator. TOCTOU-409 runs never
  // executed, so they are not audited. Audit failure never alters the response.
  if (opts.trigger === "manual" && summary.failureCode !== "active_run_conflict") {
    try {
      const aRes = await opts.client.from("audit_logs").insert({
        user_id: opts.initiatorId ?? null,
        action: "reconciliation.manual_run",
        resource: "reconciliation_runs",
        details: {
          run_id: summary.runId,
          status: summary.status,
          trigger: "manual",
          failed_checks: summary.failedChecks,
        },
      });
      if (aRes?.error) {
        console.error(
          "[reconciliation-run] manual-run audit failed:",
          aRes.error.message
        );
      }
    } catch (e: any) {
      console.error(
        "[reconciliation-run] manual-run audit failed:",
        String(e?.message ?? e)
      );
    }
  }

  return resp;
}

export async function executeManualRun(opts: {
  client: any;
  initiatorId?: string | null;
  now?: Date;
}): Promise<GuardedRunResult> {
  return executeGuardedRun({ ...opts, trigger: "manual" });
}
