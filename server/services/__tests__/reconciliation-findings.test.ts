import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  listFindings,
  listRuns,
  transitionFinding,
  escapeLike,
  mapFinding,
  FindingsError,
  MAX_NOTE_LEN,
} from "../reconciliation-findings";

// ============================================================================
// Fake Supabase client — Phase 3B-5a findings service harness
// ============================================================================
// Implements exactly the query surface listFindings / transitionFinding /
// listRuns use:
//   select (eq/in + or-ilike + multi order + range/limit/single)
//   update (eq/in CAS + .select) — payload Object.assign'ed onto matched rows
//   insert (audit_logs)
//   rpc   — emulates the frozen 00067 aggregate function, INCLUDING its
//           escape chain (backslash, %, _), so list-side PostgREST semantics
//           and RPC-side SQL semantics can be compared for parity.
// Failure injection: list table failure, rpc error/throw, audit error/throw,
// beforeUpdate hook (to simulate lost CAS races).

type Row = Record<string, any>;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// SQL LIKE semantics (case-insensitive): % any, _ single, \ escape.
function sqlILike(value: string | null | undefined, pattern: string): boolean {
  if (value === null || value === undefined) return false;
  // PostgREST translates * to % before handing the pattern to SQL.
  const translated = pattern.replace(/\*/g, "%");
  let re = "";
  for (let i = 0; i < translated.length; i++) {
    const ch = translated[i];
    if (ch === "\\") {
      const next = translated[++i];
      if (next === undefined) return false;
      re += escapeRegex(next);
    } else if (ch === "%") {
      re += "[\\s\\S]*";
    } else if (ch === "_") {
      re += "[\\s\\S]";
    } else {
      re += escapeRegex(ch);
    }
  }
  return new RegExp(`^${re}$`, "i").test(value);
}

interface OrTerm {
  col: string;
  pattern: string;
}

interface Env {
  tables: Map<string, Row[]>;
  listFail: boolean;
  rpcFail: boolean;
  rpcThrow: boolean;
  auditFail: boolean;
  auditThrow: boolean;
  rpcCalls: any[];
  auditRows: Row[];
  lastLimit: number | null;
  beforeUpdate: (() => void) | null;
  from(table: string): FakeQuery;
  rpc(name: string, args: any): PromiseLike<{ data: any; error: any }>;
}

class FakeQuery implements PromiseLike<any> {
  private op: "select" | "update" | "insert" = "select";
  private filters: { kind: "eq" | "in"; col: string; val: any }[] = [];
  private orTerms: OrTerm[] = [];
  private payload: any = null;
  private orders: { col: string; asc: boolean }[] = [];
  private rangeBounds: [number, number] | null = null;
  private limitN: number | null = null;
  private singleFlag = false;

  constructor(private env: Env, private table: string) {}

  select(_cols?: string) {
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  in(col: string, val: any[]) {
    this.filters.push({ kind: "in", col, val });
    return this;
  }
  or(clause: string) {
    for (const part of clause.split(",")) {
      const m = part.match(/^([a-z_]+)\.ilike\.(.*)$/i);
      if (m) this.orTerms.push({ col: m[1], pattern: m[2] });
    }
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.singleFlag = true;
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private rowMatches(row: Row): boolean {
    for (const f of this.filters) {
      const v = row[f.col];
      if (f.kind === "eq") {
        if (v !== f.val) return false;
      } else {
        if (!f.val.includes(v)) return false;
      }
    }
    if (this.orTerms.length > 0) {
      const anyTerm = this.orTerms.some((t) => sqlILike(row[t.col], t.pattern));
      if (!anyTerm) return false;
    }
    return true;
  }

  private execute(): { data: any; error: any } {
    if (this.op === "insert") {
      if (this.table === "audit_logs") {
        if (this.env.auditThrow) throw new Error("audit insert exploded");
        if (this.env.auditFail) return { data: null, error: { message: "audit insert failed" } };
        this.env.auditRows.push({ ...this.payload });
        return { data: [this.payload], error: null };
      }
      throw new Error(`fake: unexpected insert into ${this.table}`);
    }

    const rows = this.env.tables.get(this.table) ?? [];

    if (this.op === "update") {
      if (this.env.beforeUpdate) this.env.beforeUpdate();
      const matched = rows.filter((r) => this.rowMatches(r));
      for (const r of matched) Object.assign(r, this.payload);
      return { data: matched, error: null };
    }

    // select
    if (this.table === "reconciliation_findings" && this.env.listFail) {
      return { data: null, error: { message: "findings table down" } };
    }
    let matched = rows.filter((r) => this.rowMatches(r));
    if (this.orders.length > 0) {
      matched = matched.slice().sort((a, b) => {
        for (const { col, asc } of this.orders) {
          const av = a[col];
          const bv = b[col];
          if (av === bv) continue;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const cmp = av < bv ? -1 : 1;
          return asc ? cmp : -cmp;
        }
        return 0;
      });
    }
    if (this.rangeBounds) {
      const [from, to] = this.rangeBounds;
      this.env.lastLimit = to - from + 1;
      matched = matched.slice(from, to + 1);
    }
    if (this.limitN !== null) this.env.lastLimit = this.limitN;
    if (this.limitN !== null) matched = matched.slice(0, this.limitN);
    if (this.singleFlag) {
      if (matched.length !== 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: `expected a single row, got ${matched.length}` },
        };
      }
      return { data: matched[0], error: null };
    }
    return { data: matched, error: null };
  }
}

// Emulates the frozen 00067 aggregate: identical filters + identical escape
// chain applied to p_q before ILIKE containment over summary OR subject_id.
function rpcCounts(rows: Row[], args: any): any[] {
  const likePattern =
    args.p_q === null || args.p_q === undefined
      ? null
      : `%${escapeLike(String(args.p_q))}%`;
  const matched = rows.filter((r) => {
    if (args.p_status !== null && args.p_status !== undefined && r.status !== args.p_status) return false;
    if (args.p_severity !== null && args.p_severity !== undefined && r.severity !== args.p_severity) return false;
    if (args.p_check_code !== null && args.p_check_code !== undefined && r.check_code !== args.p_check_code) return false;
    if (args.p_subject_type !== null && args.p_subject_type !== undefined && r.subject_type !== args.p_subject_type) return false;
    if (likePattern) {
      const hit = sqlILike(r.summary, likePattern) || sqlILike(r.subject_id, likePattern);
      if (!hit) return false;
    }
    return true;
  });
  const count = (pred: (r: Row) => boolean) => matched.filter(pred).length;
  return [
    {
      total: matched.length,
      open: count((r) => r.status === "open"),
      acknowledged: count((r) => r.status === "acknowledged"),
      resolved: count((r) => r.status === "resolved"),
      info: count((r) => r.severity === "info"),
      warning: count((r) => r.severity === "warning"),
      critical: count((r) => r.severity === "critical"),
    },
  ];
}

function createEnv(seed: Record<string, Row[]> = {}): Env {
  const env: Env = {
    tables: new Map(Object.entries(seed)),
    listFail: false,
    rpcFail: false,
    rpcThrow: false,
    auditFail: false,
    auditThrow: false,
    rpcCalls: [],
    auditRows: [],
    lastLimit: null,
    beforeUpdate: null,
    from(table: string) {
      if (!env.tables.has(table)) env.tables.set(table, []);
      return new FakeQuery(env, table);
    },
    rpc(name: string, args: any) {
      if (env.rpcThrow) return Promise.reject(new Error("rpc exploded")) as any;
      env.rpcCalls.push({ name, args });
      if (env.rpcFail) {
        return Promise.resolve({ data: null, error: { message: "rpc unavailable" } }) as any;
      }
      if (name !== "get_reconciliation_finding_counts") {
        return Promise.resolve({ data: null, error: { message: "unknown function" } }) as any;
      }
      const rows = env.tables.get("reconciliation_findings") ?? [];
      return Promise.resolve({ data: rpcCounts(rows, args), error: null }) as any;
    },
  };
  return env;
}

function finding(over: Row = {}): Row {
  return {
    id: randomUUID(),
    check_code: "refund_reconciliation_required",
    severity: "warning",
    subject_type: "refund",
    subject_id: randomUUID(),
    summary: "Refund stuck submitting",
    details: { ageMin: 20 },
    status: "open",
    first_detected_at: "2026-10-01T10:00:00.000Z",
    last_detected_at: "2026-10-01T11:00:00.000Z",
    occurrence_count: 3,
    resolved_at: null,
    resolution_note: null,
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_by: null,
    created_at: "2026-10-01T10:00:00.000Z",
    ...over,
  };
}

function runRow(over: Row = {}): Row {
  return {
    id: randomUUID(),
    trigger_source: "cron",
    started_at: "2026-10-01T10:00:00.000Z",
    finished_at: "2026-10-01T10:00:05.000Z",
    status: "success",
    checks_run: ["C1", "C2"],
    findings_open: 5,
    findings_new: 1,
    findings_resolved: 0,
    check_results: { C1: { status: "success" }, C2: { status: "success" } },
    error: null,
    ...over,
  };
}

const INITIATOR = randomUUID();

async function expectFindingsError(p: Promise<any>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e) => e
  );
  expect(err).toBeInstanceOf(FindingsError);
  expect(err.code).toBe(code);
  expect(err.status).toBe(status);
  return err as FindingsError;
}

// ============================================================================
// escapeLike — must mirror the frozen 00067 SQL replace chain exactly
// ============================================================================
describe("escapeLike (list/RPC parity contract)", () => {
  it("escapes backslash first, then %, then _ — matching the SQL chain", () => {
    expect(escapeLike("pay_1")).toBe("pay\\_1");
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("evt_ABC%\\x")).toBe("evt\\_ABC\\%\\\\x");
  });
});

// ============================================================================
// listFindings
// ============================================================================
describe("listFindings", () => {
  it("returns camelCase items with exact RPC-backed total and counts", async () => {
    const a = finding({ status: "open", severity: "warning" });
    const b = finding({ status: "acknowledged", severity: "critical" });
    const c = finding({ status: "resolved", severity: "info" });
    const env = createEnv({ reconciliation_findings: [a, b, c] });

    const res = await listFindings(env as any, {});

    expect(res.items).toHaveLength(3);
    expect(res.total).toBe(3);
    expect(res.counts).toEqual({
      byStatus: { open: 1, acknowledged: 1, resolved: 1 },
      bySeverity: { info: 1, warning: 1, critical: 1 },
    });
    const item = res.items[0];
    expect(item.checkCode).toBe("refund_reconciliation_required");
    expect(item.subjectType).toBe("refund");
    expect(item.occurrenceCount).toBe(3);
    expect(item.acknowledgedBy).toBeNull();
    expect(item.resolvedBy).toBeNull();
    expect(item.details).toEqual({ ageMin: 20 });
    expect(item.firstDetectedAt).toBe("2026-10-01T10:00:00.000Z");
    expect("check_code" in item).toBe(false);
  });

  it("HARD GUARD: rpc error still returns items with total:null, counts:null", async () => {
    const env = createEnv({ reconciliation_findings: [finding()] });
    env.rpcFail = true;

    const res = await listFindings(env as any, {});

    expect(res.items).toHaveLength(1);
    expect(res.total).toBeNull();
    expect(res.counts).toBeNull();
  });

  it("HARD GUARD: rpc throwing still returns items with total:null, counts:null", async () => {
    const env = createEnv({ reconciliation_findings: [finding()] });
    env.rpcThrow = true;

    const res = await listFindings(env as any, {});

    expect(res.items).toHaveLength(1);
    expect(res.total).toBeNull();
    expect(res.counts).toBeNull();
  });

  it("passes filters to the row query and the same filters to the RPC", async () => {
    const env = createEnv({ reconciliation_findings: [finding()] });

    await listFindings(env as any, {
      status: "open",
      severity: "warning",
      checkCode: "refund_reconciliation_required",
      subjectType: "refund",
      q: "stuck",
      limit: "10",
      offset: "0",
    });

    const call = env.rpcCalls[0];
    expect(call.name).toBe("get_reconciliation_finding_counts");
    expect(call.args).toEqual({
      p_status: "open",
      p_severity: "warning",
      p_check_code: "refund_reconciliation_required",
      p_subject_type: "refund",
      p_q: "stuck",
    });
  });

  it("RPC receives the RAW q (SQL side does the escaping)", async () => {
    const env = createEnv({ reconciliation_findings: [finding()] });
    await listFindings(env as any, { q: "pay_1" });
    expect(env.rpcCalls[0].args.p_q).toBe("pay_1");
  });

  it("UNDERSCORE PARITY: q with _ matches literally on list AND rpc sides", async () => {
    const literal = finding({ subject_id: "pay_123ABC", summary: "gateway pay_123" });
    const decoy = finding({ subject_id: "payX123ABC", summary: "gateway payX123" });
    const env = createEnv({ reconciliation_findings: [literal, decoy] });

    const res = await listFindings(env as any, { q: "pay_1" });

    // list side: PostgREST pattern has the underscore escaped
    expect(res.items).toHaveLength(1);
    expect(res.items[0].subjectId).toBe("pay_123ABC");
    // rpc side: raw q, SQL escaping inside the function — totals agree
    expect(res.total).toBe(1);
    expect(res.counts?.byStatus.open).toBe(1);
    // and a decoy that only matches as a wildcard does NOT leak in
    const res2 = await listFindings(createEnv({ reconciliation_findings: [decoy] }) as any, { q: "pay_1" });
    expect(res2.items).toHaveLength(0);
    expect(res2.total).toBe(0);
  });

  it("rejects unsupported q syntax with 400 invalid_filter (never strips)", async () => {
    const env = createEnv({ reconciliation_findings: [] });
    for (const q of ["a,b", "a(b)", "100%", "a*b", "a\\b", "x".repeat(201)]) {
      await expectFindingsError(listFindings(env as any, { q }), "invalid_filter", 400);
    }
  });

  it("rejects invalid enum/format filters with 400 invalid_filter", async () => {
    const env = createEnv({ reconciliation_findings: [] });
    await expectFindingsError(listFindings(env as any, { status: "closed" }), "invalid_filter", 400);
    await expectFindingsError(listFindings(env as any, { severity: "blocker" }), "invalid_filter", 400);
    await expectFindingsError(listFindings(env as any, { subjectType: "invoice" }), "invalid_filter", 400);
    await expectFindingsError(listFindings(env as any, { checkCode: "C1; drop" }), "invalid_filter", 400);
  });

  it("clamps limit and offset", async () => {
    const env = createEnv({ reconciliation_findings: [] });
    await listFindings(env as any, { limit: "1000" });
    expect(env.lastLimit).toBe(100);
    await listFindings(env as any, { limit: "0" });
    expect(env.lastLimit).toBe(1);
    await listFindings(env as any, { limit: "abc" });
    expect(env.lastLimit).toBe(50);
    await listFindings(env as any, { limit: undefined });
    expect(env.lastLimit).toBe(50);
    // negative / junk offset degrades to 0 without error
    const res = await listFindings(env as any, { offset: "-5" });
    expect(res.items).toEqual([]);
  });

  it("sorts newest first and pages with range", async () => {
    const older = finding({ last_detected_at: "2026-10-01T09:00:00.000Z", summary: "older" });
    const newer = finding({ last_detected_at: "2026-10-01T12:00:00.000Z", summary: "newer" });
    const env = createEnv({ reconciliation_findings: [older, newer] });

    const page1 = await listFindings(env as any, { limit: "1", offset: "0" });
    expect(page1.items[0].summary).toBe("newer");
    expect(page1.total).toBe(2);

    const page2 = await listFindings(env as any, { limit: "1", offset: "1" });
    expect(page2.items[0].summary).toBe("older");
  });

  it("surfaces a real row-query failure as an error (list is primary)", async () => {
    const env = createEnv({ reconciliation_findings: [] });
    env.listFail = true;
    const err = await listFindings(env as any, {}).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(FindingsError);
    expect(String(err.message)).toContain("findings list failed");
  });
});

// ============================================================================
// transitionFinding — lifecycle matrix, CAS, idempotency, audits
// ============================================================================
describe("transitionFinding", () => {
  it("acknowledge: open -> acknowledged sets attribution and audits", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "acknowledge",
      initiatorId: INITIATOR,
      note: "looking into it",
    });

    expect(res.changed).toBe(true);
    expect(res.fromStatus).toBe("open");
    expect(res.finding.status).toBe("acknowledged");
    expect(res.finding.acknowledgedBy).toBe(INITIATOR);
    expect(res.finding.acknowledgedAt).toBeTruthy();

    expect(env.auditRows).toHaveLength(1);
    const audit = env.auditRows[0];
    expect(audit.action).toBe("reconciliation.finding_acknowledged");
    expect(audit.resource).toBe("reconciliation_findings");
    expect(audit.user_id).toBe(INITIATOR);
    expect(audit.details.finding_id).toBe(f.id);
    expect(audit.details.from_status).toBe("open");
    expect(audit.details.to_status).toBe("acknowledged");
    expect(audit.details.note).toBe("looking into it");
  });

  it("re-acknowledge: idempotent 200, first attribution preserved, note ignored, NO audit", async () => {
    const firstAckAt = "2026-10-01T10:00:00.000Z";
    const f = finding({
      status: "acknowledged",
      acknowledged_at: firstAckAt,
      acknowledged_by: INITIATOR,
    });
    const env = createEnv({ reconciliation_findings: [f] });

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "acknowledge",
      initiatorId: randomUUID(),
      note: "second operator note",
    });

    expect(res.changed).toBe(false);
    expect(res.finding.status).toBe("acknowledged");
    expect(res.finding.acknowledgedAt).toBe(firstAckAt);
    expect(res.finding.acknowledgedBy).toBe(INITIATOR);
    expect(env.auditRows).toHaveLength(0);
    expect(env.auditRows).not.toHaveLength(1);
  });

  it("acknowledge on resolved -> 409 finding_state_conflict with current row", async () => {
    const f = finding({ status: "resolved" });
    const env = createEnv({ reconciliation_findings: [f] });

    const err = await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "acknowledge", initiatorId: INITIATOR }),
      "finding_state_conflict",
      409
    );
    expect(err.extra?.currentStatus).toBe("resolved");
    expect(err.extra?.finding.status).toBe("resolved");
    expect(err.extra?.finding.id).toBe(f.id);
    expect(env.auditRows).toHaveLength(0);
  });

  it("resolve: requires note (missing / blank / too long -> 400 invalid_note)", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });

    await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "resolve", initiatorId: INITIATOR }),
      "invalid_note",
      400
    );
    await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "resolve", initiatorId: INITIATOR, note: "   " }),
      "invalid_note",
      400
    );
    await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "resolve", initiatorId: INITIATOR, note: "x".repeat(MAX_NOTE_LEN + 1) }),
      "invalid_note",
      400
    );
    expect(f.status).toBe("open");
    expect(env.auditRows).toHaveLength(0);
  });

  it("resolve: sets resolved attribution, preserves acknowledgement attribution, audits", async () => {
    const ackAt = "2026-10-01T10:30:00.000Z";
    const ackBy = randomUUID();
    const f = finding({
      status: "acknowledged",
      acknowledged_at: ackAt,
      acknowledged_by: ackBy,
    });
    const env = createEnv({ reconciliation_findings: [f] });

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "resolve",
      initiatorId: INITIATOR,
      note: "gateway confirmed settled",
    });

    expect(res.changed).toBe(true);
    expect(res.fromStatus).toBe("acknowledged");
    expect(res.finding.status).toBe("resolved");
    expect(res.finding.resolutionNote).toBe("gateway confirmed settled");
    expect(res.finding.resolvedBy).toBe(INITIATOR);
    expect(res.finding.resolvedAt).toBeTruthy();
    expect(res.finding.acknowledgedAt).toBe(ackAt);
    expect(res.finding.acknowledgedBy).toBe(ackBy);

    expect(env.auditRows).toHaveLength(1);
    expect(env.auditRows[0].action).toBe("reconciliation.finding_resolved");
    expect(env.auditRows[0].details.from_status).toBe("acknowledged");
    expect(env.auditRows[0].details.note).toBe("gateway confirmed settled");
  });

  it("resolve on resolved -> 409 conflict", async () => {
    const f = finding({ status: "resolved" });
    const env = createEnv({ reconciliation_findings: [f] });
    const err = await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "resolve", initiatorId: INITIATOR, note: "again" }),
      "finding_state_conflict",
      409
    );
    expect(err.extra?.currentStatus).toBe("resolved");
  });

  it("reopen: clears ALL lifecycle attribution/state, keeps detection history, audits with note", async () => {
    const f = finding({
      status: "resolved",
      resolved_at: "2026-10-01T11:30:00.000Z",
      resolution_note: "earlier fix",
      resolved_by: randomUUID(),
      acknowledged_at: "2026-10-01T10:30:00.000Z",
      acknowledged_by: randomUUID(),
      occurrence_count: 7,
      first_detected_at: "2026-10-01T08:00:00.000Z",
    });
    const env = createEnv({ reconciliation_findings: [f] });

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "reopen",
      initiatorId: INITIATOR,
      note: "not actually fixed",
    });

    expect(res.changed).toBe(true);
    expect(res.finding.status).toBe("open");
    expect(res.finding.resolvedAt).toBeNull();
    expect(res.finding.resolutionNote).toBeNull();
    expect(res.finding.resolvedBy).toBeNull();
    expect(res.finding.acknowledgedAt).toBeNull();
    expect(res.finding.acknowledgedBy).toBeNull();
    // detection history preserved
    expect(res.finding.occurrenceCount).toBe(7);
    expect(res.finding.firstDetectedAt).toBe("2026-10-01T08:00:00.000Z");

    expect(env.auditRows).toHaveLength(1);
    expect(env.auditRows[0].action).toBe("reconciliation.finding_reopened");
    expect(env.auditRows[0].details.from_status).toBe("resolved");
    expect(env.auditRows[0].details.to_status).toBe("open");
    expect(env.auditRows[0].details.note).toBe("not actually fixed");
  });

  it("reopen on open -> 409 with currentStatus", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });
    const err = await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "reopen", initiatorId: INITIATOR }),
      "finding_state_conflict",
      409
    );
    expect(err.extra?.currentStatus).toBe("open");
  });

  it("invalid uuid -> 400 invalid_id for every action", async () => {
    const env = createEnv({ reconciliation_findings: [] });
    for (const action of ["acknowledge", "resolve", "reopen"] as const) {
      await expectFindingsError(
        transitionFinding(env as any, { findingId: "not-a-uuid", action, initiatorId: INITIATOR, note: "n" }),
        "invalid_id",
        400
      );
    }
  });

  it("unknown finding -> 404 finding_not_found", async () => {
    const env = createEnv({ reconciliation_findings: [] });
    await expectFindingsError(
      transitionFinding(env as any, { findingId: randomUUID(), action: "reopen", initiatorId: INITIATOR }),
      "finding_not_found",
      404
    );
  });

  it("CAS race: another operator acknowledged first -> idempotent 200, no audit", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });
    const firstAckAt = "2026-10-01T11:59:00.000Z";
    const firstAckBy = randomUUID();
    // Between the pre-fetch and the CAS update, a concurrent ack lands.
    env.beforeUpdate = () => {
      f.status = "acknowledged";
      f.acknowledged_at = firstAckAt;
      f.acknowledged_by = firstAckBy;
      env.beforeUpdate = null;
    };

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "acknowledge",
      initiatorId: INITIATOR,
    });

    expect(res.changed).toBe(false);
    expect(res.finding.acknowledgedAt).toBe(firstAckAt);
    expect(res.finding.acknowledgedBy).toBe(firstAckBy);
    expect(env.auditRows).toHaveLength(0);
  });

  it("CAS race: state changed to an illegal status -> 409 with the latest row", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });
    env.beforeUpdate = () => {
      f.status = "resolved";
      f.resolved_at = "2026-10-01T11:59:00.000Z";
      f.resolved_by = randomUUID();
      env.beforeUpdate = null;
    };

    const err = await expectFindingsError(
      transitionFinding(env as any, { findingId: f.id, action: "resolve", initiatorId: INITIATOR, note: "racing" }),
      "finding_state_conflict",
      409
    );
    expect(err.extra?.currentStatus).toBe("resolved");
    expect(env.auditRows).toHaveLength(0);
  });

  it("audit failure isolation: audit insert error still returns the transition", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });
    env.auditFail = true;

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "acknowledge",
      initiatorId: INITIATOR,
    });
    expect(res.changed).toBe(true);
    expect(res.finding.status).toBe("acknowledged");
  });

  it("audit failure isolation: audit insert throwing still returns the transition", async () => {
    const f = finding({ status: "open" });
    const env = createEnv({ reconciliation_findings: [f] });
    env.auditThrow = true;

    const res = await transitionFinding(env as any, {
      findingId: f.id,
      action: "resolve",
      initiatorId: INITIATOR,
      note: "audit explodes",
    });
    expect(res.changed).toBe(true);
    expect(res.finding.status).toBe("resolved");
    expect(res.finding.resolutionNote).toBe("audit explodes");
  });
});

// ============================================================================
// listRuns
// ============================================================================
describe("listRuns", () => {
  it("maps run rows: trigger/status/timestamps + derived failed/truncated checks", async () => {
    const done = runRow({
      trigger_source: "manual",
      check_results: {
        C1: { status: "success" },
        C2: { status: "failed", error: "boom" },
        C3: { status: "truncated" },
      },
    });
    const running = runRow({
      status: "running",
      finished_at: null,
      check_results: {},
      trigger_source: "cron",
    });
    const env = createEnv({ reconciliation_runs: [done, running] });

    const res = await listRuns(env as any, undefined);

    expect(res.items).toHaveLength(2);
    const [first, second] = res.items;
    expect(first.trigger).toBe("manual");
    expect(first.status).toBe("success");
    expect(first.finishedAt).toBe("2026-10-01T10:00:05.000Z");
    expect(first.failedChecks).toEqual(["C2"]);
    expect(first.truncatedChecks).toEqual(["C3"]);
    expect(first.findingsOpen).toBe(5);
    expect(first.error).toBeNull();

    expect(second.trigger).toBe("cron");
    expect(second.status).toBe("running");
    expect(second.finishedAt).toBeNull();
    expect(second.failedChecks).toEqual([]);
    expect(second.truncatedChecks).toEqual([]);
  });

  it("clamps limit: default 10, min 1, max 50", async () => {
    const env = createEnv({ reconciliation_runs: [] });
    await listRuns(env as any, undefined);
    expect(env.lastLimit).toBe(10);
    await listRuns(env as any, "500");
    expect(env.lastLimit).toBe(50);
    await listRuns(env as any, "0");
    expect(env.lastLimit).toBe(1);
    await listRuns(env as any, "abc");
    expect(env.lastLimit).toBe(10);
  });

  it("orders newest first", async () => {
    const older = runRow({ started_at: "2026-10-01T09:00:00.000Z" });
    const newer = runRow({ started_at: "2026-10-01T12:00:00.000Z" });
    const env = createEnv({ reconciliation_runs: [older, newer] });
    const res = await listRuns(env as any, "10");
    expect(res.items[0].startedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(res.items[1].startedAt).toBe("2026-10-01T09:00:00.000Z");
  });
});

// ============================================================================
// mapFinding — attribution fields on the wire
// ============================================================================
describe("mapFinding", () => {
  it("exposes attribution as camelCase with null defaults", () => {
    const m = mapFinding({
      id: "x",
      check_code: "c",
      severity: "info",
      subject_type: "payment",
      subject_id: "s",
      summary: "sum",
      details: null,
      status: "open",
      first_detected_at: "a",
      last_detected_at: "b",
      occurrence_count: 1,
      created_at: "c",
    });
    expect(m.details).toEqual({});
    expect(m.acknowledgedAt).toBeNull();
    expect(m.acknowledgedBy).toBeNull();
    expect(m.resolvedBy).toBeNull();
    expect(m.resolvedAt).toBeNull();
    expect(m.resolutionNote).toBeNull();
  });
});
