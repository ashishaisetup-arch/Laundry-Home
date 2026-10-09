import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import {
  evaluateRunGate,
  toRunResponse,
  executeGuardedRun,
  executeManualRun,
  RUN_STALE_MS,
  COOLDOWN_MS,
} from "../reconciliation-run-controller";
import { runReconciliationWithAlerts } from "../reconciliation-alerts";
import type { AlertDispatchStats } from "../reconciliation-alerts";
import type { RunSummary } from "../reconciliation-service";

// ============================================================================
// Run-controller harness (Phase 3B-4)
// ============================================================================
// Purpose-built fake for the exact query surface evaluateRunGate /
// executeGuardedRun use: select+eq (+not/order/limit), update+eq+eq+select
// (conditional abandon), insert (audits). The orchestrator is module-mocked
// so classification/response/audit behavior is tested without running scans.

vi.mock("../reconciliation-alerts", () => ({
  runReconciliationWithAlerts: vi.fn(),
}));

const mockRun = vi.mocked(runReconciliationWithAlerts);

type Row = Record<string, any>;

class Gdb {
  tables = new Map<string, Row[]>();
  failures = new Map<string, { message: string; code?: string; op?: string }>();
  skipNextUpdate = false;

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  fail(table: string, message = "injected query failure", code = "XX000", op?: string) {
    this.failures.set(table, { message, code, op });
  }
}

type GFilter = { kind: "eq" | "not"; col: string; val: any };

class GQuery implements PromiseLike<any> {
  private op: "select" | "insert" | "update" = "select";
  private filters: GFilter[] = [];
  private payload: any = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;

  constructor(private db: Gdb, private table: string) {}

  select(_cols?: string) { return this; }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = rows; return this; }
  update(patch: Row) { this.op = "update"; this.payload = patch; return this; }
  eq(col: string, val: any) { this.filters.push({ kind: "eq", col, val }); return this; }
  not(col: string, _op: string, val: any) { this.filters.push({ kind: "not", col, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    for (const f of this.filters) {
      const v = row[f.col];
      if (f.kind === "eq") {
        if (v !== f.val) return false;
      } else if (f.val === null || f.val === undefined) {
        // "col not is null" -> row value must be present
        if (v === null || v === undefined) return false;
      } else if (v === f.val) {
        return false;
      }
    }
    return true;
  }

  private execute(): { data: any; error: any } {
    const failure = this.db.failures.get(this.table);
    if (failure && (!failure.op || failure.op === this.op)) {
      return { data: null, error: { message: failure.message, code: failure.code } };
    }
    const rows = this.db.rows(this.table);

    if (this.op === "insert") {
      const incoming: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = incoming.map((r) => ({ id: r.id ?? randomUUID(), ...r }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }

    if (this.op === "update") {
      if (this.db.skipNextUpdate) {
        this.db.skipNextUpdate = false;
        return { data: [], error: null };
      }
      const matched = rows.filter((r) => this.matches(r));
      for (const r of matched) Object.assign(r, this.payload);
      return { data: matched, error: null };
    }

    let out = rows.filter((r) => this.matches(r));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => {
        const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
        return asc ? cmp : -cmp;
      });
    }
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return { data: out, error: null };
  }
}

function gClient(db: Gdb) {
  return { from: (table: string) => new GQuery(db, table) };
}

// ============================================================================
// Fixtures
// ============================================================================

const NOW = new Date("2026-10-05T12:00:00.000Z");

function iso(offsetMs: number): string {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

function runningRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    trigger_source: "cron",
    started_at: iso(-60_000),
    status: "running",
    ...overrides,
  };
}

function completedManualRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    trigger_source: "manual",
    started_at: iso(-90_000),
    finished_at: iso(-10_000),
    status: "success",
    error: null,
    ...overrides,
  };
}

function okSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: randomUUID(),
    status: "success",
    trigger: "manual",
    checkResults: {},
    findingsOpen: 37,
    findingsNew: 0,
    findingsResolved: 0,
    findingsReopened: 0,
    failedChecks: [],
    truncatedChecks: [],
    alertCandidates: [],
    ...overrides,
  };
}

function okAlerts(overrides: Partial<AlertDispatchStats> = {}): AlertDispatchStats {
  return {
    candidates: 0,
    recipients: 0,
    inAppSent: 0,
    inAppFailed: 0,
    webhook: "disabled",
    webhookFailed: 0,
    skippedDuplicates: 0,
    dispatchErrors: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockRun.mockReset();
  mockRun.mockResolvedValue({ summary: okSummary(), alerts: okAlerts() } as any);
});

// ============================================================================
// evaluateRunGate
// ============================================================================

describe("evaluateRunGate", () => {
  it("no active runs -> allowed", async () => {
    const db = new Gdb();
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate).toEqual({ allowed: true });
  });

  it("fresh active run -> 409 with activeRunId + startedAt (manual)", async () => {
    const db = new Gdb();
    const row = runningRow({ started_at: iso(-60_000) });
    db.rows("reconciliation_runs").push(row);
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate.allowed).toBe(false);
    if (gate.allowed) return;
    expect(gate.status).toBe(409);
    expect(gate.body).toEqual({
      error: "reconciliation_already_running",
      activeRunId: row.id,
      startedAt: row.started_at,
    });
  });

  it("fresh active run -> 409 for cron as well", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(runningRow({ started_at: iso(-1000) }));
    const gate = await evaluateRunGate(gClient(db), { trigger: "cron", now: NOW });
    expect(gate.allowed).toBe(false);
    if (gate.allowed) return;
    expect(gate.status).toBe(409);
  });

  it("fresh wins over cooldown: fresh run + recent manual finish -> 409", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(
      runningRow({ started_at: iso(-5000) }),
      completedManualRow({ finished_at: iso(-5000) })
    );
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate.allowed).toBe(false);
    if (gate.allowed) return;
    expect(gate.status).toBe(409);
  });

  it("stale active run -> conditional abandon + run_abandoned audit + proceed", async () => {
    const db = new Gdb();
    const stale = runningRow({ started_at: iso(-(RUN_STALE_MS + 60_000)) });
    db.rows("reconciliation_runs").push(stale);
    const gate = await evaluateRunGate(gClient(db), { trigger: "cron", now: NOW });
    expect(gate).toEqual({ allowed: true });
    expect(stale.status).toBe("failed");
    expect(String(stale.error)).toContain("abandoned:");
    expect(stale.finished_at).toBe(NOW.toISOString());
    const audits = db.rows("audit_logs");
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("reconciliation.run_abandoned");
    expect(audits[0].user_id).toBeNull();
    expect(audits[0].details.run_ids).toEqual([stale.id]);
    expect(audits[0].details.threshold_ms).toBe(RUN_STALE_MS);
  });

  it("stale row NOT changed by the conditional update -> no audit, still proceed", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(
      runningRow({ started_at: iso(-(RUN_STALE_MS + 60_000)) })
    );
    db.skipNextUpdate = true;
    const gate = await evaluateRunGate(gClient(db), { trigger: "cron", now: NOW });
    expect(gate).toEqual({ allowed: true });
    expect(db.rows("audit_logs")).toHaveLength(0);
  });

  it("manual cooldown: completed manual run 10s ago -> 429 + Retry-After", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(
      completedManualRow({ finished_at: iso(-10_000) })
    );
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate.allowed).toBe(false);
    if (gate.allowed) return;
    expect(gate.status).toBe(429);
    expect(gate.body.error).toBe("reconciliation_rate_limited");
    expect(gate.retryAfterSeconds).toBe(50);
    expect(gate.body.retryAfterSeconds).toBe(50);
  });

  it("manual cooldown elapsed (61s ago) -> allowed", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(
      completedManualRow({ finished_at: iso(-(COOLDOWN_MS + 1000)) })
    );
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate).toEqual({ allowed: true });
  });

  it("cron is exempt from the cooldown", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(
      completedManualRow({ finished_at: iso(-5000) })
    );
    const gate = await evaluateRunGate(gClient(db), { trigger: "cron", now: NOW });
    expect(gate).toEqual({ allowed: true });
  });

  it("abandoned crash rows are excluded from the cooldown window", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(
      completedManualRow({
        finished_at: iso(-5000),
        status: "failed",
        error: "abandoned: not finalized within 15min",
      }),
      completedManualRow({ finished_at: iso(-COOLDOWN_MS - 5000) })
    );
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate).toEqual({ allowed: true });
  });

  it("gate query failure fails open (unique index remains the backstop)", async () => {
    const db = new Gdb();
    db.fail("reconciliation_runs", "select unavailable", "XX000", "select");
    const gate = await evaluateRunGate(gClient(db), { trigger: "manual", now: NOW });
    expect(gate).toEqual({ allowed: true });
  });
});

// ============================================================================
// toRunResponse — cron parity + internal-marker stripping
// ============================================================================

describe("toRunResponse", () => {
  it("active_run_conflict -> 409 with stable error only (no run ids)", () => {
    const resp = toRunResponse(
      okSummary({ status: "failed", error: "failed to insert run: dup", failureCode: "active_run_conflict" }),
      okAlerts()
    );
    expect(resp.status).toBe(409);
    expect(resp.body).toEqual({ error: "reconciliation_already_running" });
    expect("activeRunId" in resp.body).toBe(false);
  });

  it("success -> 200, alerts attached, alertCandidates + failureCode stripped", () => {
    const resp = toRunResponse(okSummary(), okAlerts());
    expect(resp.status).toBe(200);
    expect(resp.body.alerts).toBeDefined();
    expect(resp.body.trigger).toBe("manual");
    expect(resp.body.findingsOpen).toBe(37);
    expect("alertCandidates" in resp.body).toBe(false);
    expect("failureCode" in resp.body).toBe(false);
  });

  it("failed summary without marker -> 500, cron-compatible body", () => {
    const resp = toRunResponse(
      okSummary({ status: "failed", error: "all checks failed" }),
      okAlerts()
    );
    expect(resp.status).toBe(500);
    expect(resp.body.error).toBe("all checks failed");
    expect("alertCandidates" in resp.body).toBe(false);
    expect("failureCode" in resp.body).toBe(false);
    expect(resp.body.alerts).toBeDefined();
  });

  it("dispatchErrors never change the status", () => {
    const resp = toRunResponse(
      okSummary(),
      okAlerts({ dispatchErrors: ["recipients query failed: boom"] })
    );
    expect(resp.status).toBe(200);
  });
});

// ============================================================================
// executeGuardedRun / executeManualRun
// ============================================================================

describe("executeGuardedRun", () => {
  it("active run -> 409 and the orchestrator is never invoked", async () => {
    const db = new Gdb();
    const row = runningRow({ started_at: iso(-30_000) });
    db.rows("reconciliation_runs").push(row);
    const result = await executeGuardedRun({
      client: gClient(db),
      trigger: "cron",
      now: NOW,
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toBe("reconciliation_already_running");
    expect(result.body.activeRunId).toBe(row.id);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("manual happy path: orchestrator called once with trigger=manual + initiator audit", async () => {
    const db = new Gdb();
    const initiatorId = randomUUID();
    const summary = okSummary({ trigger: "manual" });
    mockRun.mockResolvedValue({ summary, alerts: okAlerts() } as any);

    const result = await executeManualRun({ client: gClient(db), initiatorId, now: NOW });

    expect(mockRun).toHaveBeenCalledTimes(1);
    const callArg = mockRun.mock.calls[0][0];
    expect(callArg.trigger).toBe("manual");
    expect(callArg.now).toBe(NOW);
    expect(result.status).toBe(200);
    expect(result.body.runId).toBe(summary.runId);

    const audits = db.rows("audit_logs").filter((r) => r.action === "reconciliation.manual_run");
    expect(audits).toHaveLength(1);
    expect(audits[0].user_id).toBe(initiatorId);
    expect(audits[0].resource).toBe("reconciliation_runs");
    expect(audits[0].details.run_id).toBe(summary.runId);
    expect(audits[0].details.status).toBe("success");
    expect(audits[0].details.trigger).toBe("manual");
  });

  it("TOCTOU 23505 -> 409 and no manual-run audit (nothing executed)", async () => {
    const db = new Gdb();
    mockRun.mockResolvedValue({
      summary: okSummary({
        status: "failed",
        error: 'failed to insert run: duplicate key value violates unique constraint "reconciliation_runs_one_active"',
        failureCode: "active_run_conflict",
        runId: null,
      }),
      alerts: okAlerts(),
    } as any);

    const result = await executeManualRun({ client: gClient(db), initiatorId: randomUUID(), now: NOW });

    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: "reconciliation_already_running" });
    expect(db.rows("audit_logs").filter((r) => r.action === "reconciliation.manual_run")).toHaveLength(0);
  });

  it("failed run without marker -> 500 AND manual-run audit still written", async () => {
    const db = new Gdb();
    mockRun.mockResolvedValue({
      summary: okSummary({ status: "failed", error: "all checks failed" }),
      alerts: okAlerts(),
    } as any);

    const result = await executeManualRun({ client: gClient(db), initiatorId: randomUUID(), now: NOW });

    expect(result.status).toBe(500);
    const audits = db.rows("audit_logs").filter((r) => r.action === "reconciliation.manual_run");
    expect(audits).toHaveLength(1);
    expect(audits[0].details.status).toBe("failed");
  });

  it("cron surface: trigger=cron and no manual-run audit", async () => {
    const db = new Gdb();
    const result = await executeGuardedRun({ client: gClient(db), trigger: "cron", now: NOW });
    expect(mockRun.mock.calls[0][0].trigger).toBe("cron");
    expect(result.status).toBe(200);
    expect(db.rows("audit_logs").filter((r) => r.action === "reconciliation.manual_run")).toHaveLength(0);
  });

  it("cooldown gate -> 429 with retryAfterSeconds, orchestrator never invoked", async () => {
    const db = new Gdb();
    db.rows("reconciliation_runs").push(completedManualRow({ finished_at: iso(-15_000) }));
    const result = await executeManualRun({ client: gClient(db), initiatorId: randomUUID(), now: NOW });
    expect(result.status).toBe(429);
    expect(result.body.error).toBe("reconciliation_rate_limited");
    expect(result.retryAfterSeconds).toBe(45);
    expect(mockRun).not.toHaveBeenCalled();
  });
});
