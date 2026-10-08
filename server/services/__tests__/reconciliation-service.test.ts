import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  runReconciliation,
  compareGatewayPayment,
  compareGatewayRefund,
  razorpayErrorResult,
} from "../reconciliation-service";
import {
  dispatchReconciliationAlerts,
  runReconciliationWithAlerts,
} from "../reconciliation-alerts";

// ============================================================================
// Fake Supabase client
// ============================================================================
// In-memory tables + per-table failure injection. Implements exactly the
// query surface reconciliation-service uses:
//   select (eq/in/is/neq/lt + order/limit/single + count/head)
//   insert (array/obj, unique identity on reconciliation_findings)
//   update (.eq("id")/.in("id") + optional .select)
//   thenable resolution
//
// Distinguishes the four states the stale-resolution rules depend on:
//   query failure   -> injected table error -> { error }
//   empty result    -> no matching rows -> success, zero rows
//   truncated       -> fetched rows > cap (limit is cap+1) -> sliced + flag
//   zero-finding    -> success with zero candidates -> stale resolution RUNS

type Row = Record<string, any>;

interface TableFailure {
  message: string;
  code?: string;
}

class FakeDb {
  tables = new Map<string, Row[]>();
  failures = new Map<string, TableFailure>();

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  fail(table: string, message = "injected query failure", code = "XX000") {
    this.failures.set(table, { message, code });
  }

  unfail(table: string) {
    this.failures.delete(table);
  }
}

type Filter = { type: "eq" | "in" | "is" | "neq" | "lt"; col: string; val: any };

class FakeQuery implements PromiseLike<any> {
  private op: "select" | "insert" | "update" = "select";
  private filters: Filter[] = [];
  private payload: any = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private singleFlag = false;
  private headCount = false;

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select" && opts?.count === "exact" && opts.head) this.headCount = true;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }

  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }

  eq(col: string, val: any) { this.filters.push({ type: "eq", col, val }); return this; }
  in(col: string, val: any[]) { this.filters.push({ type: "in", col, val }); return this; }
  is(col: string, val: any) { this.filters.push({ type: "is", col, val }); return this; }
  neq(col: string, val: any) { this.filters.push({ type: "neq", col, val }); return this; }
  lt(col: string, val: any) { this.filters.push({ type: "lt", col, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleFlag = true; return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    for (const f of this.filters) {
      const v = row[f.col];
      switch (f.type) {
        case "eq":
          if (v === null || v === undefined || v !== f.val) return false;
          break;
        case "in":
          if (!Array.isArray(f.val) || !f.val.includes(v)) return false;
          break;
        case "is":
          if (f.val === null) { if (v !== null && v !== undefined) return false; }
          else if (v !== f.val) return false;
          break;
        case "neq":
          if (v === null || v === undefined || v === f.val) return false;
          break;
        case "lt":
          if (v === null || v === undefined || !(v < f.val)) return false;
          break;
      }
    }
    return true;
  }

  private execute(): { data: any; error: any; count?: number } {
    const failure = this.db.failures.get(this.table);
    if (failure) return { data: null, error: { message: failure.message, code: failure.code } };

    const rows = this.db.rows(this.table);

    if (this.op === "insert") {
      const incoming: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (this.table === "reconciliation_findings") {
        for (const r of incoming) {
          const dup = rows.some((e) =>
            e.check_code === r.check_code &&
            e.subject_type === r.subject_type &&
            e.subject_id === r.subject_id);
          if (dup) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value violates unique constraint" },
            };
          }
        }
      }
      if (this.table === "reconciliation_alerts") {
        for (const r of incoming) {
          const dup = rows.some((e) => e.alert_event_key === r.alert_event_key);
          if (dup) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value violates unique constraint" },
            };
          }
        }
      }
      const inserted = incoming.map((r) => {
        const row = { id: randomUUID(), ...r };
        rows.push(row);
        return row;
      });
      if (this.singleFlag) {
        if (inserted.length !== 1) {
          return { data: null, error: { code: "PGRST116", message: "expected a single row" } };
        }
        return { data: inserted[0], error: null };
      }
      return { data: inserted, error: null };
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.matches(r));
      for (const r of matched) Object.assign(r, this.payload);
      return { data: matched, error: null };
    }

    // select
    let matched = rows.filter((r) => this.matches(r));
    if (this.headCount) return { data: null, error: null, count: matched.length };
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      matched = matched.slice().sort((a, b) => {
        const av = a[col]; const bv = b[col];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : 1;
        return asc ? cmp : -cmp;
      });
    }
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

function createFakeDb(seed: Record<string, Row[]> = {}) {
  const db = new FakeDb();
  // Store seed rows by reference so tests asserting on seed objects observe
  // the exact same rows the service mutates (mirrors a real DB read-back).
  for (const [table, rows] of Object.entries(seed)) db.tables.set(table, rows);
  const client = { from: (table: string) => new FakeQuery(db, table) };
  return { db, client };
}

// ============================================================================
// Fixtures
// ============================================================================

const NOW = new Date("2026-10-01T12:00:00.000Z");
const RUN2_NOW = new Date("2026-10-01T13:00:00.000Z");

function minusMin(now: Date, min: number): string {
  return new Date(now.getTime() - min * 60000).toISOString();
}
function minusHours(now: Date, h: number): string {
  return minusMin(now, h * 60);
}

function baseReconConfig(overrides: Record<string, number> = {}) {
  return {
    refundSubmittingWarnMin: 15,
    refundSubmittingCritMin: 60,
    refundPendingWarnMin: 30,
    refundProcessingWarnHours: 24,
    paymentStuckWarnMin: 30,
    paymentStuckCritHours: 24,
    webhookPendingWarnMin: 5,
    maxFindingsPerCheck: 500,
    ...overrides,
  };
}

function systemConfigRow(recon: Record<string, number> = {}): Row {
  return { id: 1, config: { reconciliation: baseReconConfig(recon) }, updated_at: NOW.toISOString() };
}

function refund(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    payment_transaction_id: randomUUID(),
    order_id: null,
    user_id: randomUUID(),
    amount: 500,
    gateway_refund_amount: 0,
    wallet_refund_amount: 500,
    refund_status: "pending",
    refund_reason: "test",
    refund_source: "admin",
    gateway_refund_id: null,
    failure_reason: null,
    idempotency_key: `ik_${randomUUID()}`,
    metadata: {},
    created_at: minusMin(NOW, 120),
    updated_at: minusMin(NOW, 120),
    ...overrides,
  };
}

function payment(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    user_id: randomUUID(),
    order_id: null,
    transaction_purpose: "wallet_topup",
    amount: 100,
    currency: "INR",
    gateway: "razorpay",
    gateway_order_id: null,
    gateway_payment_id: null,
    gateway_signature_verified: false,
    gateway_capture_verified: false,
    payment_status: "created",
    wallet_transaction_id: null,
    failure_reason: null,
    metadata: {},
    idempotency_key: `ik_${randomUUID()}`,
    created_at: minusMin(NOW, 120),
    updated_at: minusMin(NOW, 120),
    ...overrides,
  };
}

function walletTxn(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    user_id: randomUUID(),
    type: "credit",
    amount: 100,
    method: "Razorpay",
    description: "test",
    order_id: null,
    status: "success",
    payment_transaction_id: null,
    balance_before: 0,
    balance_after: 100,
    idempotency_key: `ik_${randomUUID()}`,
    created_at: minusMin(NOW, 60),
    ...overrides,
  };
}

function profile(id: string, walletBalance: number): Row {
  return { id, wallet_balance: walletBalance };
}

function webhook(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    gateway: "razorpay",
    event_id: `evt_${randomUUID()}`,
    event_type: "payment.captured",
    payload: null,
    processed_at: null,
    status: "pending",
    created_at: minusMin(NOW, 60),
    ...overrides,
  };
}

// Injected gateway: records every lookup. Default handlers fail on purpose so
// legacy tests observe C6 as a failed check with ZERO owned-code writes and
// never touch the network. C6 tests pass explicit handlers.
function fakeGateway(opts: {
  payment?: (id: string) => any | Promise<any>;
  refund?: (id: string) => any | Promise<any>;
} = {}) {
  const calls: Array<{ kind: "payment" | "refund"; id: string; timeoutMs: number }> = [];
  return {
    calls,
    async getPayment(id: string, timeoutMs: number) {
      calls.push({ kind: "payment", id, timeoutMs });
      return opts.payment
        ? await opts.payment(id)
        : { kind: "failure" as const, error: "injected gateway failure" };
    },
    async getRefund(id: string, timeoutMs: number) {
      calls.push({ kind: "refund", id, timeoutMs });
      return opts.refund
        ? await opts.refund(id)
        : { kind: "failure" as const, error: "injected gateway failure" };
    },
  };
}

async function run(
  client: any,
  now: Date = NOW,
  opts: { gateway?: any; sleep?: (ms: number) => Promise<void> } = {}
) {
  const gateway = opts.gateway ?? fakeGateway();
  const sleep = opts.sleep ?? (async () => {});
  return runReconciliation({ client, trigger: "test", now, gateway, sleep });
}

function findingsOf(db: FakeDb, checkCode?: string): Row[] {
  const rows = db.rows("reconciliation_findings");
  return checkCode ? rows.filter((r) => r.check_code === checkCode) : rows;
}

function runsOf(db: FakeDb): Row[] {
  return db.rows("reconciliation_runs");
}

const PROTECTED_TABLES = [
  "payment_transactions",
  "payment_refunds",
  "wallet_transactions",
  "user_profiles",
  "payment_webhook_events",
];

function snapshotProtected(db: FakeDb): string {
  return JSON.stringify(PROTECTED_TABLES.map((t) => db.rows(t)));
}

// ============================================================================
// Tests
// ============================================================================

describe("finding generation and severity tiers", () => {
  it("C1: reconciliation_required refund produces an open critical finding", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    const summary = await run(client);

    expect(summary.status).toBe("success");
    expect(summary.checkResults.C1).toEqual({ status: "success", findings: 1 });
    const f = findingsOf(db, "refund_reconciliation_required");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      severity: "critical",
      subject_type: "refund",
      subject_id: r.id,
      status: "open",
      occurrence_count: 1,
    });
    expect(summary.findingsNew).toBe(1);
    expect(summary.findingsOpen).toBe(1);
  });

  it("C2: submitting tiers — 10m none, 20m warning, 70m critical", async () => {
    const young = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 10) });
    const warn = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 20) });
    const crit = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 70) });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [young, warn, crit],
    });

    await run(client);

    const f = findingsOf(db, "refund_stuck_submitting");
    expect(f).toHaveLength(2);
    const bySubject = new Map(f.map((x) => [x.subject_id, x]));
    expect(bySubject.get(warn.id)?.severity).toBe("warning");
    expect(bySubject.get(crit.id)?.severity).toBe("critical");
    expect(bySubject.has(young.id)).toBe(false);
  });

  it("C3: pending/processing tiers — pending 31m warning, processing 25h warning, 73h critical", async () => {
    const pendingOld = refund({ refund_status: "pending", updated_at: minusMin(NOW, 31) });
    const pendingYoung = refund({ refund_status: "pending", updated_at: minusMin(NOW, 10) });
    const processingWarn = refund({ refund_status: "processing", updated_at: minusHours(NOW, 25) });
    const processingCrit = refund({ refund_status: "processing", updated_at: minusHours(NOW, 73) });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [pendingOld, pendingYoung, processingWarn, processingCrit],
    });

    await run(client);

    const f = findingsOf(db, "refund_stuck_other");
    expect(f).toHaveLength(3);
    const bySubject = new Map(f.map((x) => [x.subject_id, x]));
    expect(bySubject.get(pendingOld.id)?.severity).toBe("warning");
    expect(bySubject.get(processingWarn.id)?.severity).toBe("warning");
    expect(bySubject.get(processingCrit.id)?.severity).toBe("critical");
    expect(bySubject.has(pendingYoung.id)).toBe(false);
  });

  it("C4: uncertain 31m warning, 25h critical, captured top-up without wallet credit critical", async () => {
    const stuckWarn = payment({ payment_status: "pending", updated_at: minusMin(NOW, 31) });
    const stuckCrit = payment({ payment_status: "created", updated_at: minusHours(NOW, 25) });
    const missingCredit = payment({
      payment_status: "captured",
      transaction_purpose: "wallet_topup",
      gateway_order_id: "order_missing",
      gateway_payment_id: "pay_missing",
      wallet_transaction_id: null,
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [stuckWarn, stuckCrit, missingCredit],
    });

    await run(client);

    const f = findingsOf(db, "payment_stuck_uncertain");
    expect(f).toHaveLength(3);
    const bySubject = new Map(f.map((x) => [x.subject_id, x]));
    expect(bySubject.get(stuckWarn.id)?.severity).toBe("warning");
    expect(bySubject.get(stuckCrit.id)?.severity).toBe("critical");
    const mc = bySubject.get(missingCredit.id);
    expect(mc?.severity).toBe("critical");
    expect(mc?.details).toMatchObject({
      gateway_order_id: "order_missing",
      gateway_payment_id: "pay_missing",
      walletTransactionId: null,
    });
  });

  it("C5: linked ledger amount mismatch warns; consistent pair is silent", async () => {
    const userId = randomUUID();
    const badWalletId = randomUUID();
    const badPay = payment({
      payment_status: "captured",
      transaction_purpose: "wallet_topup",
      user_id: userId,
      wallet_transaction_id: badWalletId,
    });
    const goodWalletId = randomUUID();
    const goodPay = payment({
      payment_status: "captured",
      transaction_purpose: "wallet_topup",
      user_id: userId,
      wallet_transaction_id: goodWalletId,
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [badPay, goodPay],
      wallet_transactions: [
        walletTxn({ id: badWalletId, user_id: userId, type: "credit", amount: 90, payment_transaction_id: badPay.id }),
        walletTxn({ id: goodWalletId, user_id: userId, type: "credit", amount: 100, payment_transaction_id: goodPay.id }),
      ],
    });

    await run(client);

    const f = findingsOf(db, "ledger_payment_mismatch");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ subject_id: badPay.id, severity: "warning" });
    expect(f[0].details.issues[0]).toContain("ledger amount");
  });

  it("C7: failed and stale-pending warn; processed payload correlated with critical C4 escalates to critical", async () => {
    const criticalPay = payment({
      payment_status: "captured",
      transaction_purpose: "wallet_topup",
      gateway_order_id: "order_corr",
      gateway_payment_id: "pay_corr",
      wallet_transaction_id: null,
    });
    const failedEvt = webhook({ status: "failed", processed_at: minusMin(NOW, 10), created_at: minusMin(NOW, 12) });
    const stalePending = webhook({ status: "pending", created_at: minusMin(NOW, 10) });
    const freshPending = webhook({ status: "pending", created_at: minusMin(NOW, 1) });
    const correlated = webhook({
      status: "processed",
      event_type: "payment.captured",
      processed_at: minusMin(NOW, 3),
      payload: { payment: { id: "pay_corr", order_id: "order_corr" } },
    });
    const unrelated = webhook({
      status: "processed",
      processed_at: minusMin(NOW, 4),
      payload: { payment: { id: "pay_other", order_id: "order_other" } },
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [criticalPay],
      payment_webhook_events: [failedEvt, stalePending, freshPending, correlated, unrelated],
    });

    const summary = await run(client);

    const f = findingsOf(db, "webhook_processing_anomaly");
    expect(f).toHaveLength(3);
    const bySubject = new Map(f.map((x) => [x.subject_id, x]));

    const failedFinding = bySubject.get(failedEvt.event_id);
    expect(failedFinding?.severity).toBe("warning");
    expect(failedFinding?.details.source).toBe("failed");

    const pendingFinding = bySubject.get(stalePending.event_id);
    expect(pendingFinding?.severity).toBe("warning");
    expect(pendingFinding?.details.source).toBe("pending_stale");
    expect(bySubject.has(freshPending.event_id)).toBe(false);

    const corrFinding = bySubject.get(correlated.event_id);
    expect(corrFinding?.severity).toBe("critical");
    expect(corrFinding?.details.source).toBe("processed_correlated");
    expect(corrFinding?.details.gateway_order_id).toBe("order_corr");
    expect(bySubject.has(unrelated.event_id)).toBe(false);

    expect(summary.checkResults.C7.status).toBe("success");
  });

  it("C8: profile mismatch, balance-without-ledger and negative balance are all critical; clean ledger silent", async () => {
    // clean user: chain + arithmetic + profile consistent
    const cleanUser = randomUUID();
    const c1 = walletTxn({ user_id: cleanUser, type: "credit", amount: 100, balance_before: 0, balance_after: 100, created_at: minusMin(NOW, 90) });
    const c2 = walletTxn({ user_id: cleanUser, type: "debit", amount: 40, balance_before: 100, balance_after: 60, created_at: minusMin(NOW, 30) });

    // mismatched profile user
    const mismatchUser = randomUUID();
    const m1 = walletTxn({ user_id: mismatchUser, type: "credit", amount: 50, balance_before: 0, balance_after: 50, created_at: minusMin(NOW, 60) });

    // negative balance user (profile matches latest, but ledger went negative)
    const negUser = randomUUID();
    const n1 = walletTxn({ user_id: negUser, type: "credit", amount: 10, balance_before: 0, balance_after: 10, created_at: minusMin(NOW, 90) });
    const n2 = walletTxn({ user_id: negUser, type: "debit", amount: 30, balance_before: 10, balance_after: -20, created_at: minusMin(NOW, 30) });

    // nonzero wallet with no ledger rows at all
    const orphanUser = randomUUID();

    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      wallet_transactions: [c1, c2, m1, n1, n2],
      user_profiles: [
        profile(cleanUser, 60),
        profile(mismatchUser, 999),
        profile(negUser, -20),
        profile(orphanUser, 50),
      ],
    });

    const summary = await run(client);

    const f = findingsOf(db, "wallet_ledger_inconsistency");
    // mismatch + negative + orphan, merged per user; clean user has none
    expect(f).toHaveLength(3);
    for (const row of f) {
      expect(row.severity).toBe("critical");
      expect(row.subject_type).toBe("wallet_user");
    }
    const bySubject = new Map(f.map((x) => [x.subject_id, x]));

    const mismatch = bySubject.get(mismatchUser);
    expect(mismatch?.details.issue).toBe("profile_ledger_mismatch");
    expect(mismatch?.details.walletBalance).toBe(999);
    expect(mismatch?.details.latestLedgerBalance).toBe(50);

    const neg = bySubject.get(negUser);
    expect(neg?.details.issue).toBe("negative_balance");

    const orphan = bySubject.get(orphanUser);
    expect(orphan?.details.issue).toBe("balance_without_ledger");

    expect(bySubject.has(cleanUser)).toBe(false);
    expect(summary.checkResults.C8).toEqual({ status: "success", findings: 3 });
  });

  it("thresholds fall back to defaults when system_config is missing", async () => {
    const warnAgeDefaultOnly = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 20) });
    const { db, client } = createFakeDb({ payment_refunds: [warnAgeDefaultOnly] });

    const summary = await run(client);

    expect(summary.status).toBe("success");
    expect(findingsOf(db, "refund_stuck_submitting")).toHaveLength(1);
  });
});

describe("dedupe, occurrence counting, reopen and stale resolution", () => {
  it("merges multiple C8 issues for one user into a single finding", async () => {
    const userId = randomUUID();
    // profile mismatch AND arithmetic error for the same user
    const r1 = walletTxn({ user_id: userId, type: "credit", amount: 100, balance_before: 0, balance_after: 90, created_at: minusMin(NOW, 60) });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      wallet_transactions: [r1],
      user_profiles: [profile(userId, 999)],
    });

    await run(client);

    const f = findingsOf(db, "wallet_ledger_inconsistency");
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain("profile_ledger_mismatch");
    expect(f[0].summary).toContain("chain_inconsistency");
    expect(f[0].severity).toBe("critical");
  });

  it("increments occurrence_count on repeat runs and keeps first_detected_at", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    const s1 = await run(client, NOW);
    const s2 = await run(client, RUN2_NOW);

    expect(s1.findingsNew).toBe(1);
    expect(s2.findingsNew).toBe(0);
    const f = findingsOf(db, "refund_reconciliation_required");
    expect(f).toHaveLength(1);
    expect(f[0].occurrence_count).toBe(2);
    expect(f[0].first_detected_at).toBe(NOW.toISOString());
    expect(f[0].last_detected_at).toBe(RUN2_NOW.toISOString());
    expect(runsOf(db)).toHaveLength(2);
  });

  it("reopens a resolved finding on recurrence with continued occurrence count", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    await run(client, NOW);
    const f = findingsOf(db, "refund_reconciliation_required")[0];
    // simulate an earlier resolution
    f.status = "resolved";
    f.resolved_at = RUN2_NOW.toISOString();
    f.resolution_note = "manual";

    const summary = await run(client, RUN2_NOW);

    expect(summary.findingsReopened).toBe(1);
    expect(f.status).toBe("open");
    expect(f.occurrence_count).toBe(2);
    expect(f.resolved_at).toBeNull();
    expect(f.resolution_note).toBeNull();
    expect(f.last_detected_at).toBe(RUN2_NOW.toISOString());
  });

  it("keeps an acknowledged finding acknowledged while the condition persists", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    await run(client, NOW);
    const f = findingsOf(db, "refund_reconciliation_required")[0];
    f.status = "acknowledged";

    await run(client, RUN2_NOW);

    expect(f.status).toBe("acknowledged");
    expect(f.occurrence_count).toBe(2);
    expect(f.last_detected_at).toBe(RUN2_NOW.toISOString());
  });

  it("stale-resolves open findings when the condition clears on a successful scan", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    await run(client, NOW);
    const f = findingsOf(db, "refund_reconciliation_required")[0];
    expect(f.status).toBe("open");

    // condition cleared: no reconciliation_required refunds anymore
    db.tables.set("payment_refunds", []);
    const summary = await run(client, RUN2_NOW);

    expect(summary.findingsResolved).toBe(1);
    expect(f.status).toBe("resolved");
    expect(f.resolved_at).toBe(RUN2_NOW.toISOString());
    expect(f.resolution_note).toBe("stale: condition cleared in automated scan");
  });

  it("stale-resolves acknowledged findings when the condition clears", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    await run(client, NOW);
    const f = findingsOf(db, "refund_reconciliation_required")[0];
    f.status = "acknowledged";

    db.tables.set("payment_refunds", []);
    const summary = await run(client, RUN2_NOW);

    expect(summary.findingsResolved).toBe(1);
    expect(f.status).toBe("resolved");
    expect(f.resolution_note).toBe("stale: condition cleared in automated scan");
  });
});

describe("failed and truncated checks perform zero writes", () => {
  it("failed check: no finding writes, pre-existing finding untouched, check_results records failure", async () => {
    const preExisting: Row = {
      id: randomUUID(),
      check_code: "refund_reconciliation_required",
      severity: "critical",
      subject_type: "refund",
      subject_id: randomUUID(),
      summary: "pre-existing",
      details: {},
      status: "open",
      first_detected_at: minusMin(NOW, 500),
      last_detected_at: minusMin(NOW, 500),
      occurrence_count: 4,
      resolved_at: null,
      resolution_note: null,
      created_at: minusMin(NOW, 500),
    };
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      reconciliation_findings: [preExisting],
      payment_refunds: [refund({ refund_status: "reconciliation_required" })],
    });
    db.fail("payment_refunds", "refunds db down");

    const before = JSON.stringify(findingsOf(db));
    const summary = await run(client);

    expect(summary.status).toBe("success"); // other checks succeeded
    expect(summary.checkResults.C1.status).toBe("failed");
    expect(summary.checkResults.C1.error).toBe("refunds db down");
    expect(summary.checkResults.C2.status).toBe("failed");
    expect(summary.checkResults.C3.status).toBe("failed");
    expect(summary.checkResults.C4.status).toBe("success");
    expect(summary.failedChecks).toEqual(["C1", "C2", "C3", "C6"]);
    expect(summary.truncatedChecks).toEqual([]);
    expect(summary.findingsResolved).toBe(0);
    expect(summary.findingsNew).toBe(0);
    // pre-existing finding is byte-for-byte untouched
    expect(JSON.stringify(findingsOf(db))).toBe(before);
    expect(preExisting.status).toBe("open");
    expect(preExisting.occurrence_count).toBe(4);
    expect(preExisting.last_detected_at).toBe(minusMin(NOW, 500));
  });

  it("exactly cap rows: NOT truncated, findings written", async () => {
    const a = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 20) });
    const b = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 70) });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ maxFindingsPerCheck: 2 })],
      payment_refunds: [a, b],
    });

    const summary = await run(client);

    expect(summary.checkResults.C2.status).toBe("success");
    expect(summary.checkResults.C2.findings).toBe(2);
    expect(summary.failedChecks).toEqual([]);
    expect(summary.truncatedChecks).toEqual([]);
    expect(findingsOf(db, "refund_stuck_submitting")).toHaveLength(2);
  });

  it("cap+1 rows: truncated, candidates reported but ZERO writes, existing finding untouched", async () => {
    const r1 = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 70) });
    const r2 = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 60) });
    const r3 = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 20) });
    const preExisting: Row = {
      id: randomUUID(),
      check_code: "refund_stuck_submitting",
      severity: "warning",
      subject_type: "refund",
      subject_id: randomUUID(),
      summary: "pre-existing C2",
      details: {},
      status: "open",
      first_detected_at: minusMin(NOW, 500),
      last_detected_at: minusMin(NOW, 500),
      occurrence_count: 3,
      resolved_at: null,
      resolution_note: null,
      created_at: minusMin(NOW, 500),
    };
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ maxFindingsPerCheck: 2 })],
      payment_refunds: [r1, r2, r3],
      reconciliation_findings: [preExisting],
    });

    const beforeCount = findingsOf(db).length;
    const summary = await run(client);

    expect(summary.checkResults.C2.status).toBe("truncated");
    // order by updated_at asc keeps r1(70m) and r2(60m) — both aged -> reported
    expect(summary.checkResults.C2.findings).toBe(2);
    // C2 truncated propagates: C6 is source-dependent
    expect(summary.truncatedChecks).toEqual(["C2", "C6"]);
    expect(summary.failedChecks).toEqual([]);
    // but nothing was written for C2
    expect(findingsOf(db)).toHaveLength(beforeCount);
    expect(preExisting.status).toBe("open");
    expect(preExisting.occurrence_count).toBe(3);
    expect(summary.findingsNew).toBe(0);
    expect(summary.findingsResolved).toBe(0);
  });

  it("all checks failed: run status is failed", async () => {
    const { db, client } = createFakeDb({ system_config: [systemConfigRow()] });
    for (const t of [
      "payment_refunds",
      "payment_transactions",
      "payment_webhook_events",
      "wallet_transactions",
      "user_profiles",
    ]) db.fail(t);

    const summary = await run(client);

    expect(summary.status).toBe("failed");
    expect(summary.error).toBe("all checks failed");
    expect(summary.failedChecks).toEqual([
      "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
    ]);
    expect(summary.truncatedChecks).toEqual([]);
    const runRow = runsOf(db)[0];
    expect(runRow.status).toBe("failed");
    expect(runRow.error).toBe("all checks failed");
  });
});

describe("run recording", () => {
  it("persists the run row with checks_run, check_results and counts", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });

    const summary = await run(client, NOW);

    expect(summary.runId).toBeTruthy();
    const runRow = runsOf(db)[0];
    expect(runRow.id).toBe(summary.runId);
    expect(runRow.trigger_source).toBe("test");
    expect(runRow.status).toBe("success");
    expect(runRow.started_at).toBe(NOW.toISOString());
    expect(runRow.finished_at).toBeTruthy();
    expect(runRow.checks_run).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
    expect(Object.keys(runRow.check_results).sort()).toEqual(
      ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"].sort()
    );
    expect(runRow.check_results.C1).toEqual({ status: "success", findings: 1 });
    expect(runRow.check_results.C6).toEqual({
      status: "success",
      findings: 0,
      meta: {
        candidateCount: 1,
        attempted: 0,
        succeeded: 0,
        skippedNoGatewayId: 1,
        rateLimited: false,
        budgetExhausted: false,
      },
    });
    expect(runRow.findings_new).toBe(1);
    expect(runRow.findings_open).toBe(1);
    expect(runRow.findings_resolved).toBe(0);
    expect(runRow.error).toBeNull();
    expect(summary.failedChecks).toEqual([]);
    expect(summary.truncatedChecks).toEqual([]);
  });

  it("writes only to reconciliation_runs and reconciliation_findings", async () => {
    const r = refund({ refund_status: "reconciliation_required" });
    const p = payment({ payment_status: "pending", updated_at: minusMin(NOW, 45) });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
      payment_transactions: [p],
      wallet_transactions: [walletTxn()],
      user_profiles: [profile(randomUUID(), 10)],
      payment_webhook_events: [webhook({ status: "failed", processed_at: minusMin(NOW, 9) })],
    });

    const before = snapshotProtected(db);
    await run(client);
    const after = snapshotProtected(db);

    expect(after).toBe(before);
    expect(runsOf(db)).toHaveLength(1);
    expect(findingsOf(db).length).toBeGreaterThan(0);
  });

  it("recovers a finding whose identity was outside the preloaded scan (unique conflict -> reopen)", async () => {
    const hiddenRefundId = randomUUID();
    const hiddenExisting: Row = {
      id: randomUUID(),
      check_code: "refund_reconciliation_required",
      severity: "critical",
      subject_type: "refund",
      subject_id: hiddenRefundId,
      summary: "old",
      details: {},
      status: "resolved",
      first_detected_at: minusMin(NOW, 900),
      last_detected_at: minusMin(NOW, 900),
      occurrence_count: 5,
      resolved_at: minusMin(NOW, 800),
      resolution_note: "was resolved",
      created_at: minusMin(NOW, 900),
    };
    // Fill the preloaded scan (limit 10000) so the hidden row is NOT loaded:
    // first 10000 fillers are taken, hidden row sits at index 10000.
    const fillers: Row[] = [];
    for (let i = 0; i < 10000; i++) {
      fillers.push({
        id: randomUUID(),
        check_code: "wallet_ledger_inconsistency",
        severity: "critical",
        subject_type: "wallet_user",
        subject_id: randomUUID(),
        summary: `filler ${i}`,
        details: {},
        status: "resolved",
        first_detected_at: minusMin(NOW, 900),
        last_detected_at: minusMin(NOW, 900),
        occurrence_count: 1,
        resolved_at: minusMin(NOW, 900),
        resolution_note: "filler",
        created_at: minusMin(NOW, 900),
      });
    }
    const r = refund({ refund_status: "reconciliation_required", id: hiddenRefundId });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
      reconciliation_findings: [...fillers, hiddenExisting],
    });

    const summary = await run(client);

    // candidate existed in DB but not in the preloaded scan -> insert 23505 -> reopen
    expect(summary.findingsReopened).toBe(1);
    expect(hiddenExisting.status).toBe("open");
    expect(hiddenExisting.occurrence_count).toBe(6);
    expect(hiddenExisting.resolved_at).toBeNull();
    expect(hiddenExisting.resolution_note).toBeNull();
    expect(hiddenExisting.last_detected_at).toBe(NOW.toISOString());
    // fillers untouched
    expect(fillers[0].status).toBe("resolved");
    expect(fillers[0].occurrence_count).toBe(1);
  });
});

// ============================================================================
// C6 — gateway-vs-DB reconciliation (Phase 3B-2)
// ============================================================================
describe("C6 gateway-vs-DB reconciliation", () => {
  const gwOk = (over: Record<string, any> = {}) => ({
    kind: "ok" as const,
    data: {
      id: "pay_x",
      status: "created",
      refund_status: null,
      amount: 10000,
      amount_refunded: 0,
      currency: "INR",
      order_id: null,
      ...over,
    },
  });

  function gatewayFindings(db: FakeDb): Row[] {
    return findingsOf(db).filter((r) => String(r.check_code).startsWith("gateway_"));
  }

  function gwFinding(code: string, subjectType: string, subjectId: string): Row {
    return {
      id: randomUUID(),
      check_code: code,
      severity: "critical",
      subject_type: subjectType,
      subject_id: subjectId,
      summary: "seeded C6 finding",
      details: {},
      status: "open",
      first_detected_at: minusMin(NOW, 500),
      last_detected_at: minusMin(NOW, 500),
      occurrence_count: 3,
      resolved_at: null,
      resolution_note: null,
      created_at: minusMin(NOW, 500),
    };
  }

  it("zero-attempt success when every candidate lacks a gateway id (explained by meta)", async () => {
    const r = refund({ refund_status: "reconciliation_required" }); // gateway_refund_id: null
    const p = payment({ gateway_payment_id: null });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
      payment_transactions: [p],
    });
    const gw = fakeGateway();

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    expect(summary.failedChecks).toEqual([]);
    expect(summary.checkResults.C6).toEqual({
      status: "success",
      findings: 0,
      meta: {
        candidateCount: 2,
        attempted: 0,
        succeeded: 0,
        skippedNoGatewayId: 2,
        rateLimited: false,
        budgetExhausted: false,
      },
    });
    expect(gw.calls).toHaveLength(0);
    expect(gatewayFindings(db)).toHaveLength(0);
  });

  it("status mismatch: uncertain DB + captured at gateway => critical finding; full meta emitted", async () => {
    const p = payment({ gateway_payment_id: "pay_st" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    const gw = fakeGateway({ payment: () => gwOk({ id: "pay_st", status: "captured" }) });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    expect(summary.checkResults.C6).toEqual({
      status: "success",
      findings: 1,
      meta: {
        candidateCount: 1,
        attempted: 1,
        succeeded: 1,
        skippedNoGatewayId: 0,
        rateLimited: false,
        budgetExhausted: false,
      },
    });
    const rows = findingsOf(db, "gateway_payment_status_mismatch");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      severity: "critical",
      subject_type: "payment",
      subject_id: p.id,
      status: "open",
      occurrence_count: 1,
    });
    expect(gatewayFindings(db)).toHaveLength(1);
    expect(summary.findingsNew).toBeGreaterThan(0);
  });

  it("amount + currency mismatch aggregate into one critical finding with fields", async () => {
    const p = payment({ gateway_payment_id: "pay_amt" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    const gw = fakeGateway({
      payment: () => gwOk({ id: "pay_amt", amount: 99999, currency: "USD" }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    expect(summary.checkResults.C6.findings).toBe(1);
    const rows = findingsOf(db, "gateway_payment_amount_mismatch");
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("critical");
    expect(rows[0].details.fields).toEqual(["amount", "currency"]);
    expect(findingsOf(db, "gateway_payment_status_mismatch")).toHaveLength(0);
    expect(gatewayFindings(db)).toHaveLength(1);
  });

  it("refunded-amount mismatch takes precedence over the status cell (no status finding)", async () => {
    const p = payment({
      payment_status: "captured",
      gateway_payment_id: "pay_pc",
      amount_refunded: 0,
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    const gw = fakeGateway({
      payment: () =>
        gwOk({ id: "pay_pc", status: "captured", refund_status: "partial", amount_refunded: 5000 }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.checkResults.C6.status).toBe("success");
    const am = findingsOf(db, "gateway_payment_amount_mismatch");
    expect(am).toHaveLength(1);
    expect(am[0].details.fields).toEqual(["amount_refunded"]);
    // the status cell would have disagreed (DB captured + gw refund_status partial)
    // but the refunded-amount divergence explains it first:
    expect(findingsOf(db, "gateway_payment_status_mismatch")).toHaveLength(0);
  });

  it("unknown gateway payment status => warning finding; matrix skipped; amounts still checked", async () => {
    const p = payment({ gateway_payment_id: "pay_z" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    const gw = fakeGateway({ payment: () => gwOk({ id: "pay_z", status: "zombie" }) });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    const unknown = findingsOf(db, "gateway_payment_unknown_status");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe("warning");
    expect(unknown[0].details.unknownField).toBe("status");
    expect(findingsOf(db, "gateway_payment_status_mismatch")).toHaveLength(0);
    expect(findingsOf(db, "gateway_payment_amount_mismatch")).toHaveLength(0);
    expect(gatewayFindings(db)).toHaveLength(1);
  });

  it("404 at gateway => evidence finding, check stays success", async () => {
    const p = payment({ gateway_payment_id: "pay_404" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    const gw = fakeGateway({ payment: () => ({ kind: "not_found" as const, status: 404 }) });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    expect(summary.failedChecks).toEqual([]);
    expect(summary.checkResults.C6).toEqual({
      status: "success",
      findings: 1,
      meta: {
        candidateCount: 1,
        attempted: 1,
        succeeded: 1,
        skippedNoGatewayId: 0,
        rateLimited: false,
        budgetExhausted: false,
      },
    });
    const rows = findingsOf(db, "gateway_payment_not_found");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ severity: "critical", subject_id: p.id });
  });

  it("any lookup failure => C6 failed, zero writes across owned codes, first failure aborts", async () => {
    const p = payment({ gateway_payment_id: "pay_f" });
    const r = refund({ refund_status: "reconciliation_required", gateway_refund_id: "rf_f" });
    const seedPayment = gwFinding("gateway_payment_status_mismatch", "payment", p.id);
    const seedRefund = gwFinding("gateway_refund_amount_mismatch", "refund", r.id);
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      payment_refunds: [r],
      reconciliation_findings: [seedPayment, seedRefund],
    });
    const gw = fakeGateway({
      payment: () => ({ kind: "failure" as const, error: "injected gateway failure" }),
    });

    const before = JSON.stringify(gatewayFindings(db));
    const summary = await run(client, NOW, { gateway: gw });

    expect(JSON.stringify(gatewayFindings(db))).toBe(before);
    expect(summary.status).toBe("success"); // other checks unaffected
    expect(summary.failedChecks).toContain("C6");
    expect(summary.checkResults.C6.status).toBe("failed");
    expect(summary.checkResults.C6.error).toContain("injected gateway failure");
    expect(summary.checkResults.C6.meta).toMatchObject({ attempted: 1, succeeded: 0 });
    expect(gw.calls).toHaveLength(1); // payment item first; failure aborts the refund lookup
    expect(seedPayment.occurrence_count).toBe(3);
    expect(seedPayment.status).toBe("open");
  });

  it("429 aborts immediately: single attempt, rateLimited meta, error tagged", async () => {
    const a = payment({ gateway_payment_id: "pay_a" });
    const b = payment({ gateway_payment_id: "pay_b" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [a, b],
    });
    const gw = fakeGateway({
      payment: () => ({ kind: "failure" as const, rateLimited: true, error: "429 too many requests" }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.failedChecks).toContain("C6");
    expect(summary.checkResults.C6.status).toBe("failed");
    expect(summary.checkResults.C6.error).toContain("[rate limited]");
    expect(summary.checkResults.C6.meta).toMatchObject({
      attempted: 1,
      rateLimited: true,
    });
    expect(gw.calls).toHaveLength(1);
    expect(gatewayFindings(db)).toHaveLength(0);
  });

  it("lookup cap exceeded => truncated, zero writes, no attempts", async () => {
    const a = payment({ gateway_payment_id: "pay_a" });
    const b = payment({ gateway_payment_id: "pay_b" });
    const seed = gwFinding("gateway_payment_status_mismatch", "payment", a.id);
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ gatewayMaxLookupsPerRun: 1 })],
      payment_transactions: [a, b],
      reconciliation_findings: [seed],
    });
    const gw = fakeGateway({ payment: () => gwOk() });

    const before = JSON.stringify(gatewayFindings(db));
    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.checkResults.C6.status).toBe("truncated");
    expect(summary.checkResults.C6.error).toContain("gateway lookup cap exceeded");
    expect(summary.checkResults.C6.meta).toMatchObject({
      candidateCount: 2,
      attempted: 0,
      budgetExhausted: false,
    });
    expect(summary.truncatedChecks).toContain("C6");
    expect(JSON.stringify(gatewayFindings(db))).toBe(before);
    expect(gw.calls).toHaveLength(0);
  });

  it("time budget exhausted => truncated with budgetExhausted meta, ZERO C6 writes", async () => {
    const a = payment({ gateway_payment_id: "pay_a" });
    const b = payment({ gateway_payment_id: "pay_b" });
    const seed = gwFinding("gateway_payment_status_mismatch", "payment", a.id);
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ gatewayTimeBudgetMs: 50 })],
      payment_transactions: [a, b],
      reconciliation_findings: [seed],
    });
    const gw = fakeGateway({ payment: () => gwOk() });

    const before = JSON.stringify(gatewayFindings(db));
    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.checkResults.C6.status).toBe("truncated");
    expect(summary.checkResults.C6.error).toContain("gateway time budget");
    expect(summary.checkResults.C6.meta).toMatchObject({
      candidateCount: 2,
      attempted: 1,
      succeeded: 1,
      budgetExhausted: true,
    });
    expect(summary.truncatedChecks).toContain("C6");
    expect(summary.failedChecks).toEqual([]);
    expect(gw.calls).toHaveLength(1);
    // all-or-nothing: no new gateway findings, seeded row byte-identical
    expect(JSON.stringify(gatewayFindings(db))).toBe(before);
    expect(gatewayFindings(db)).toHaveLength(1);
    expect(seed.occurrence_count).toBe(3);
  });

  it("configured 20000ms budget: work finishes below it => C6 success and findings merge", async () => {
    const p = payment({ gateway_payment_id: "pay_404b" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ gatewayTimeBudgetMs: 20000 })],
      payment_transactions: [p],
    });
    const gw = fakeGateway({ payment: () => ({ kind: "not_found" as const, status: 404 }) });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    expect(summary.failedChecks).toEqual([]);
    expect(summary.truncatedChecks).toEqual([]);
    expect(summary.checkResults.C6.status).toBe("success");
    expect(summary.checkResults.C6.meta).toMatchObject({
      candidateCount: 1,
      attempted: 1,
      succeeded: 1,
      skippedNoGatewayId: 0,
      rateLimited: false,
      budgetExhausted: false,
    });
    // merged, not merely fetched: the evidence finding is persisted
    const rows = findingsOf(db, "gateway_payment_not_found");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ subject_id: p.id, status: "open", occurrence_count: 1 });
    expect(summary.findingsNew).toBeGreaterThanOrEqual(1);
  });

  it("sleeps between lookups and never after the final one; timeouts bounded", async () => {
    const ids = ["pay_a", "pay_b", "pay_c"];
    const rows = ids.map((id) => payment({ gateway_payment_id: id }));
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: rows,
    });
    const gw = fakeGateway({ payment: () => gwOk() });
    const sleeps: number[] = [];

    const summary = await run(client, NOW, {
      gateway: gw,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    expect(summary.status).toBe("success");
    expect(summary.checkResults.C6.status).toBe("success");
    expect(summary.checkResults.C6.meta).toMatchObject({
      candidateCount: 3,
      attempted: 3,
      succeeded: 3,
    });
    expect(gw.calls).toHaveLength(3);
    expect(sleeps).toHaveLength(2); // between lookups only
    expect(gw.calls.every((c) => c.timeoutMs > 0 && c.timeoutMs <= 5000)).toBe(true);
    expect(gatewayFindings(db)).toHaveLength(0); // consistent payloads
  });

  it("source check failure => C6 failed with source error before any reload", async () => {
    const { db, client } = createFakeDb({ system_config: [systemConfigRow()] });
    db.fail("payment_transactions", "payments db down");

    const summary = await run(client);

    expect(summary.checkResults.C6.status).toBe("failed");
    expect(summary.checkResults.C6.error).toContain("source check C4 failed");
    expect(summary.checkResults.C6.meta).toEqual({
      candidateCount: 0,
      attempted: 0,
      succeeded: 0,
      skippedNoGatewayId: 0,
      rateLimited: false,
      budgetExhausted: false,
    });
    expect(summary.failedChecks).toContain("C4");
    expect(summary.failedChecks).toContain("C6");
    expect(gatewayFindings(db)).toHaveLength(0);
  });

  it("source truncation => C6 truncated with source error", async () => {
    const r1 = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 70) });
    const r2 = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 60) });
    const r3 = refund({ refund_status: "submitting", updated_at: minusMin(NOW, 20) });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ maxFindingsPerCheck: 2 })],
      payment_refunds: [r1, r2, r3],
    });

    const summary = await run(client);

    expect(summary.checkResults.C6.status).toBe("truncated");
    expect(summary.checkResults.C6.error).toContain("source check C2 truncated");
    expect(summary.truncatedChecks).toEqual(["C2", "C6"]);
    expect(summary.failedChecks).toEqual([]);
    expect(gatewayFindings(db)).toHaveLength(0);
  });

  it("missing gateway credentials => C6 failed with 'gateway not configured', zero writes", async () => {
    const p = payment({ gateway_payment_id: "pay_c" });
    const seed = gwFinding("gateway_payment_status_mismatch", "payment", p.id);
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [seed],
    });

    const prevId = process.env.RAZORPAY_KEY_ID;
    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    try {
      const before = JSON.stringify(gatewayFindings(db));
      const summary = await runReconciliation({ client, trigger: "test", now: NOW });

      expect(summary.status).toBe("success");
      expect(summary.failedChecks).toEqual(["C6"]);
      expect(summary.checkResults.C6.status).toBe("failed");
      expect(summary.checkResults.C6.error).toContain("gateway not configured");
      expect(JSON.stringify(gatewayFindings(db))).toBe(before);
      expect(gatewayFindings(db)).toHaveLength(1);
    } finally {
      if (prevId !== undefined) process.env.RAZORPAY_KEY_ID = prevId;
      else delete process.env.RAZORPAY_KEY_ID;
      if (prevSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = prevSecret;
      else delete process.env.RAZORPAY_KEY_SECRET;
    }
  });

  it("verified clear on a later run => prior C6 finding stale-resolves", async () => {
    const p = payment({ gateway_payment_id: "pay_r" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });

    const s1 = await run(client, NOW, {
      gateway: fakeGateway({ payment: () => gwOk({ status: "captured" }) }),
    });

    expect(s1.status).toBe("success");
    expect(s1.checkResults.C6.findings).toBe(1);
    const created = findingsOf(db, "gateway_payment_status_mismatch");
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("open");

    const s2 = await run(client, RUN2_NOW, {
      gateway: fakeGateway({ payment: () => gwOk() }), // gateway created == DB created
    });

    expect(s2.status).toBe("success");
    expect(s2.checkResults.C6.findings).toBe(0);
    expect(s2.checkResults.C6.meta).toMatchObject({ attempted: 1, succeeded: 1 });
    expect(s2.findingsResolved).toBeGreaterThanOrEqual(1);
    expect(created[0].status).toBe("resolved");
    expect(created[0].resolution_note).toBe("stale: condition cleared in automated scan");
    expect(created[0].resolved_at).toBe(RUN2_NOW.toISOString());
  });

  it("same subject on two codes => both findings survive dedupe (key includes checkCode)", async () => {
    const p = payment({ gateway_payment_id: "pay_d" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    const gw = fakeGateway({
      payment: () => gwOk({ status: "captured", amount: 99999 }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.checkResults.C6.findings).toBe(2);
    expect(findingsOf(db, "gateway_payment_status_mismatch")).toHaveLength(1);
    expect(findingsOf(db, "gateway_payment_amount_mismatch")).toHaveLength(1);
    expect(gatewayFindings(db)).toHaveLength(2);
  });

  it("payment matrix cells (direct): partial/refunded consistency, refunded-vs-captured, currency", () => {
    const partialConsistent = compareGatewayPayment(
      { id: "p1", payment_status: "partially_refunded", amount: 100, amount_refunded: 40, currency: "INR", gateway_order_id: null },
      { id: "pay", status: "captured", refund_status: "partial", amount: 10000, amount_refunded: 4000, currency: "INR", order_id: null }
    );
    expect(partialConsistent).toEqual([]);

    const refundedConsistent = compareGatewayPayment(
      { id: "p2", payment_status: "refunded", amount: 100, amount_refunded: 100, currency: "INR", gateway_order_id: null },
      { id: "pay", status: "refunded", refund_status: "full", amount: 10000, amount_refunded: 10000, currency: "INR", order_id: null }
    );
    expect(refundedConsistent).toEqual([]);

    const refundedVsCaptured = compareGatewayPayment(
      { id: "p3", payment_status: "refunded", amount: 100, amount_refunded: 100, currency: "INR", gateway_order_id: null },
      { id: "pay", status: "captured", refund_status: "partial", amount: 10000, amount_refunded: 10000, currency: "INR", order_id: null }
    );
    expect(refundedVsCaptured).toHaveLength(1);
    expect(refundedVsCaptured[0]).toMatchObject({
      checkCode: "gateway_payment_status_mismatch",
      severity: "critical",
    });

    const currency = compareGatewayPayment(
      { id: "p4", payment_status: "created", amount: 100, amount_refunded: 0, currency: "INR", gateway_order_id: null },
      { id: "pay", status: "created", refund_status: null, amount: 10000, amount_refunded: 0, currency: "USD", order_id: null }
    );
    expect(currency).toHaveLength(1);
    expect(currency[0].checkCode).toBe("gateway_payment_amount_mismatch");
    expect(currency[0].severity).toBe("critical");
    expect(currency[0].details.fields).toEqual(["currency"]);

    const order = compareGatewayPayment(
      { id: "p5", payment_status: "created", amount: 100, amount_refunded: 0, currency: "INR", gateway_order_id: "order_db" },
      { id: "pay", status: "created", refund_status: null, amount: 10000, amount_refunded: 0, currency: "INR", order_id: "order_gw" }
    );
    expect(order.map((f) => f.checkCode)).toEqual(["gateway_payment_order_mismatch"]);
    expect(order[0].severity).toBe("critical");
  });

  it("refund matrix cells (direct): processed/completed ok, pending critical, failed warning, unknown warning", () => {
    const baseDb = {
      id: "r1",
      refund_status: "completed",
      amount: 100,
      gateway_refund_amount: 100,
      payment_transaction_id: null,
      gateway_refund_id: "rf1",
      updated_at: NOW.toISOString(),
    };
    const ok = compareGatewayRefund(baseDb, null, {
      id: "rf1", status: "processed", amount: 10000, payment_id: "pay",
    });
    expect(ok).toEqual([]);

    const criticalPending = compareGatewayRefund(
      { ...baseDb, id: "r2" },
      null,
      { id: "rf2", status: "pending", amount: 10000, payment_id: "pay" }
    );
    expect(criticalPending).toHaveLength(1);
    expect(criticalPending[0]).toMatchObject({
      checkCode: "gateway_refund_status_mismatch",
      severity: "critical",
    });

    const warnPending = compareGatewayRefund(
      { ...baseDb, id: "r3", refund_status: "pending" },
      null,
      { id: "rf3", status: "failed", amount: 10000, payment_id: "pay" }
    );
    expect(warnPending).toHaveLength(1);
    expect(warnPending[0].severity).toBe("warning");

    const unknown = compareGatewayRefund(
      { ...baseDb, id: "r4" },
      null,
      { id: "rf4", status: "weird", amount: 10000, payment_id: "pay" }
    );
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatchObject({
      checkCode: "gateway_refund_unknown_status",
      severity: "warning",
    });

    const amountMismatch = compareGatewayRefund(
      { ...baseDb, id: "r5", gateway_refund_amount: 300 },
      null,
      { id: "rf5", status: "processed", amount: 10000, payment_id: "pay" }
    );
    expect(amountMismatch.map((f) => f.checkCode)).toEqual(["gateway_refund_amount_mismatch"]);

    const linkageMismatch = compareGatewayRefund(
      { ...baseDb, id: "r6", payment_transaction_id: "txn_1" },
      { id: "txn_1", gateway_payment_id: "pay_db" },
      { id: "rf6", status: "processed", amount: 10000, payment_id: "pay_gw" }
    );
    expect(linkageMismatch.map((f) => f.checkCode)).toEqual(["gateway_refund_payment_mismatch"]);
  });

  it("C1 refund candidate vs gateway: reconciliation_required + failed => critical status mismatch", async () => {
    const linkedId = randomUUID();
    const linked = payment({
      id: linkedId,
      payment_status: "captured",
      transaction_purpose: "order_payment",
      gateway_payment_id: "pay_link",
    });
    const r = refund({
      refund_status: "reconciliation_required",
      gateway_refund_id: "rf_gw",
      gateway_refund_amount: 500,
      amount: 500,
      payment_transaction_id: linkedId,
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
      payment_transactions: [linked],
    });
    const gw = fakeGateway({
      refund: () => ({
        kind: "ok" as const,
        data: { id: "rf_gw", status: "failed", amount: 50000, payment_id: "pay_link" },
      }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.status).toBe("success");
    expect(summary.checkResults.C6).toEqual({
      status: "success",
      findings: 1,
      meta: {
        candidateCount: 1,
        attempted: 1,
        succeeded: 1,
        skippedNoGatewayId: 0,
        rateLimited: false,
        budgetExhausted: false,
      },
    });
    const rows = findingsOf(db, "gateway_refund_status_mismatch");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      severity: "critical",
      subject_type: "refund",
      subject_id: r.id,
      status: "open",
      occurrence_count: 1,
    });
    expect(findingsOf(db, "gateway_refund_amount_mismatch")).toHaveLength(0);
    expect(findingsOf(db, "gateway_refund_payment_mismatch")).toHaveLength(0);
    expect(gw.calls).toHaveLength(1);
    expect(gw.calls[0]).toMatchObject({ kind: "refund", id: "rf_gw" });
  });

  it("refund 404 => gateway_refund_not_found evidence, check stays success", async () => {
    const r = refund({
      refund_status: "reconciliation_required",
      gateway_refund_id: "rf_404",
      gateway_refund_amount: 500,
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_refunds: [r],
    });
    const gw = fakeGateway({ refund: () => ({ kind: "not_found" as const, status: 404 }) });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.failedChecks).toEqual([]);
    expect(summary.checkResults.C6.findings).toBe(1);
    const rows = findingsOf(db, "gateway_refund_not_found");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ severity: "critical", subject_id: r.id });
  });

  it("Razorpay error classification: id-not-found is evidence, real errors stay failures", () => {
    // live-verified shapes: payments answer 400+BAD_REQUEST, refunds answer 404
    expect(
      razorpayErrorResult(400, {
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "The id provided does not exist",
          source: "internal",
          step: "payment_initiation",
          reason: "input_validation_failed",
        },
      })
    ).toEqual({ kind: "not_found", status: 400 });

    expect(razorpayErrorResult(404, { message: "no Route matched with those values" })).toEqual({
      kind: "not_found",
      status: 404,
    });

    // other 400s are real request failures, carrying the gateway description
    const other400 = razorpayErrorResult(400, {
      error: { code: "BAD_REQUEST_ERROR", description: "invalid parameter" },
    });
    expect(other400?.kind).toBe("failure");
    expect(other400?.error).toContain("400");
    expect(other400?.error).toContain("invalid parameter");

    const rate = razorpayErrorResult(429, null);
    expect(rate).toMatchObject({ kind: "failure", rateLimited: true });

    // unrecognized statuses fall through to the generic failure path
    expect(razorpayErrorResult(500, null)).toBeNull();
    expect(razorpayErrorResult(401, { error: { code: "UNAUTHORIZED" } })).toBeNull();
  });

  it("budget-clipped timeout => truncated (exhaustion), not failed", async () => {
    const a = payment({ gateway_payment_id: "pay_a" });
    const b = payment({ gateway_payment_id: "pay_b" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ gatewayTimeBudgetMs: 60 })],
      payment_transactions: [a, b],
    });
    // every attempt's timeout = min(5000, remaining<=60) < 5000 -> clipped
    const gw = fakeGateway({
      payment: () => ({ kind: "failure" as const, timeout: true, error: "gateway lookup timed out after 60ms" }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.checkResults.C6.status).toBe("truncated");
    expect(summary.checkResults.C6.error).toContain("gateway time budget");
    expect(summary.checkResults.C6.meta).toMatchObject({
      attempted: 1,
      budgetExhausted: true,
    });
    expect(summary.truncatedChecks).toContain("C6");
    expect(summary.failedChecks).toEqual([]);
    expect(gatewayFindings(db)).toHaveLength(0);
  });

  it("full-timeout failure (gateway never answered within its full timeout) => failed", async () => {
    const a = payment({ gateway_payment_id: "pay_a" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [a],
    });
    // default budget: timeoutMs = min(5000, ~10000) == 5000 -> gateway's own stall
    const gw = fakeGateway({
      payment: () => ({ kind: "failure" as const, timeout: true, error: "gateway lookup timed out after 5000ms" }),
    });

    const summary = await run(client, NOW, { gateway: gw });

    expect(summary.checkResults.C6.status).toBe("failed");
    expect(summary.checkResults.C6.error).toContain("timed out after 5000ms");
    expect(summary.failedChecks).toContain("C6");
    expect(gatewayFindings(db)).toHaveLength(0);
  });
});

// ============================================================================
// Reconciliation alerts (Phase 3B-3) — transition candidates + orchestration
// ============================================================================
// Invariants under test:
//   - only new / reopened / warning|info→critical escalated emit candidates
//   - repeat-open critical, acknowledged-critical re-detect, downgrades,
//     failed checks and truncated checks emit NOTHING
//   - escalation derives from PERSISTED prior severity captured pre-update
//   - eventKey = findingId:transition:runId (never a timestamp)
//   - candidates never persist to the run row (in-memory only)
//   - dispatch: reserve-first (23505 ⇒ skip all downstream), admin+superadmin
//     in-app batch, audit, delivery stats — and it can never change the
//     reconciliation result

function withAlertEnv<T>(fn: () => Promise<T>): Promise<T> {
  const savedUrl = process.env.RECON_ALERT_WEBHOOK_URL;
  const savedSecret = process.env.RECON_ALERT_WEBHOOK_SECRET;
  delete process.env.RECON_ALERT_WEBHOOK_URL;
  delete process.env.RECON_ALERT_WEBHOOK_SECRET;
  return fn().finally(() => {
    if (savedUrl === undefined) delete process.env.RECON_ALERT_WEBHOOK_URL;
    else process.env.RECON_ALERT_WEBHOOK_URL = savedUrl;
    if (savedSecret === undefined) delete process.env.RECON_ALERT_WEBHOOK_SECRET;
    else process.env.RECON_ALERT_WEBHOOK_SECRET = savedSecret;
  });
}

function stuckCritPayment(): Row {
  return payment({ payment_status: "created", updated_at: minusHours(NOW, 25) });
}

function stuckWarnPayment(): Row {
  return payment({ payment_status: "pending", updated_at: minusMin(NOW, 31) });
}

function seededFinding(p: Row, overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    check_code: "payment_stuck_uncertain",
    subject_type: "payment",
    subject_id: p.id,
    severity: "critical",
    status: "open",
    summary: `Payment ${p.id} stuck in ${p.payment_status}`,
    details: {},
    first_detected_at: minusHours(NOW, 48),
    last_detected_at: minusHours(NOW, 24),
    occurrence_count: 1,
    resolved_at: null,
    resolution_note: null,
    ...overrides,
  };
}

describe("reconciliation alerts — transition candidates", () => {
  it("new critical finding emits a 'new' candidate keyed by findingId:transition:runId", async () => {
    const p = stuckCritPayment();
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });

    const s = await run(client);

    const cands = s.alertCandidates.filter((c) => c.checkCode === "payment_stuck_uncertain");
    expect(cands).toHaveLength(1);
    const c = cands[0];
    expect(c).toMatchObject({
      transition: "new",
      severity: "critical",
      subjectType: "payment",
      subjectId: p.id,
      runId: s.runId,
      checkCode: "payment_stuck_uncertain",
    });
    expect(c.findingId).toBeTruthy();
    expect(c.eventKey).toBe(`${c.findingId}:new:${s.runId}`);
    expect(s.alertCandidates.every((x) => x.eventKey.includes(x.runId))).toBe(true);

    // candidates are in-memory only: never written to the run row
    const runRow = db.rows("reconciliation_runs")[0];
    expect(runRow).toBeDefined();
    expect(runRow.check_results).toBeDefined();
    expect(runRow.check_results).not.toHaveProperty("alertCandidates");
    expect(runRow.alertCandidates).toBeUndefined();
  });

  it("new warning finding inserts the row but emits no candidate", async () => {
    const p = stuckWarnPayment();
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });

    const s = await run(client);

    expect(s.findingsNew).toBe(1);
    expect(findingsOf(db, "payment_stuck_uncertain")).toHaveLength(1);
    expect(s.alertCandidates).toEqual([]);
  });

  it("repeat detection of an open critical finding: occurrence bumps silently, no re-alert", async () => {
    const p = stuckCritPayment();
    const f = seededFinding(p, { status: "open", severity: "critical" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [f],
    });

    const s = await run(client);

    expect(s.alertCandidates).toEqual([]);
    expect(s.findingsNew).toBe(0);
    expect(s.findingsReopened).toBe(0);
    const row = findingsOf(db, "payment_stuck_uncertain")[0];
    expect(row.occurrence_count).toBe(2);
    expect(row.status).toBe("open");
    expect(row.severity).toBe("critical");
  });

  it("resolved finding detected critical again emits a 'reopened' candidate", async () => {
    const p = stuckCritPayment();
    const f = seededFinding(p, {
      status: "resolved",
      severity: "critical",
      resolved_at: minusHours(NOW, 2),
      resolution_note: "auto-resolved earlier",
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [f],
    });

    const s = await run(client);

    expect(s.findingsReopened).toBe(1);
    expect(s.alertCandidates).toHaveLength(1);
    const c = s.alertCandidates[0];
    expect(c.transition).toBe("reopened");
    expect(c.eventKey).toBe(`${c.findingId}:reopened:${s.runId}`);
    expect(c.findingId).toBe(f.id);
    const row = findingsOf(db, "payment_stuck_uncertain")[0];
    expect(row.status).toBe("open");
    expect(row.resolved_at).toBeNull();
  });

  it("open warning finding detected critical escalates using persisted prior severity", async () => {
    const p = stuckCritPayment();
    const f = seededFinding(p, { status: "open", severity: "warning" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [f],
    });

    const s = await run(client);

    expect(s.findingsNew).toBe(0);
    expect(s.alertCandidates).toHaveLength(1);
    const c = s.alertCandidates[0];
    expect(c.transition).toBe("escalated");
    expect(c.severity).toBe("critical");
    expect(c.eventKey).toBe(`${c.findingId}:escalated:${s.runId}`);
    expect(c.findingId).toBe(f.id);
    const row = findingsOf(db, "payment_stuck_uncertain")[0];
    expect(row.severity).toBe("critical"); // stored critical becomes next run's prior state
    expect(row.status).toBe("open");
  });

  it("acknowledged warning finding detected critical also escalates", async () => {
    const p = stuckCritPayment();
    const f = seededFinding(p, { status: "acknowledged", severity: "warning" });
    const { client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [f],
    });

    const s = await run(client);

    expect(s.alertCandidates).toHaveLength(1);
    expect(s.alertCandidates[0].transition).toBe("escalated");
  });

  it("acknowledged critical finding re-detected stays acknowledged and emits nothing", async () => {
    const p = stuckCritPayment();
    const f = seededFinding(p, { status: "acknowledged", severity: "critical" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [f],
    });

    const s = await run(client);

    expect(s.alertCandidates).toEqual([]);
    const row = findingsOf(db, "payment_stuck_uncertain")[0];
    expect(row.status).toBe("acknowledged");
    expect(row.occurrence_count).toBe(2);
  });

  it("critical → warning downgrade stores the warning and emits nothing", async () => {
    const p = stuckWarnPayment();
    const f = seededFinding(p, { status: "open", severity: "critical" });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
      reconciliation_findings: [f],
    });

    const s = await run(client);

    expect(s.alertCandidates).toEqual([]);
    expect(s.findingsNew).toBe(0);
    const row = findingsOf(db, "payment_stuck_uncertain")[0];
    expect(row.severity).toBe("warning");
    expect(row.occurrence_count).toBe(2);
  });

  it("failed check emits no candidates and writes no findings", async () => {
    const p = stuckCritPayment();
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow()],
      payment_transactions: [p],
    });
    db.fail("payment_transactions");

    const s = await run(client);

    expect(s.checkResults.C4.status).toBe("failed");
    expect(s.failedChecks).toContain("C4");
    expect(s.alertCandidates).toEqual([]);
    expect(findingsOf(db, "payment_stuck_uncertain")).toHaveLength(0);
    expect(s.status).toBe("success"); // other checks succeeded
  });

  it("truncated check (cap reached mid-scan) emits no candidates", async () => {
    const pCrit = payment({
      payment_status: "created",
      created_at: minusHours(NOW, 30),
      updated_at: minusHours(NOW, 25),
    });
    const pWarn = payment({
      payment_status: "pending",
      created_at: minusMin(NOW, 90),
      updated_at: minusMin(NOW, 31),
    });
    const { db, client } = createFakeDb({
      system_config: [systemConfigRow({ maxFindingsPerCheck: 1 })],
      payment_transactions: [pCrit, pWarn],
    });

    const s = await run(client);

    expect(s.checkResults.C4.status).toBe("truncated");
    expect(s.truncatedChecks).toContain("C4");
    expect(s.alertCandidates).toEqual([]); // merge never runs for truncated
    expect(findingsOf(db, "payment_stuck_uncertain")).toHaveLength(0);
  });
});

describe("reconciliation alerts — dispatch orchestration", () => {
  const admin = { id: randomUUID(), role: "admin" };
  const superadmin = { id: randomUUID(), role: "superadmin" };
  const customer = { id: randomUUID(), role: "customer" };
  const vendor = { id: randomUUID(), role: "vendor" };

  it("runReconciliationWithAlerts: end-to-end — ledger, admin-only in-app, audit, disabled webhook", async () => {
    await withAlertEnv(async () => {
      const p = stuckCritPayment();
      const { db, client } = createFakeDb({
        system_config: [systemConfigRow()],
        payment_transactions: [p],
        user_profiles: [admin, superadmin, customer, vendor],
      });

      const { summary, alerts } = await runReconciliationWithAlerts({
        client,
        trigger: "test",
        now: NOW,
        gateway: fakeGateway(),
      });

      expect(summary.status).toBe("success");
      expect(alerts).toMatchObject({
        candidates: 1,
        recipients: 2,
        inAppSent: 2,
        inAppFailed: 0,
        webhook: "disabled",
        webhookFailed: 0,
        skippedDuplicates: 0,
      });
      expect(alerts.dispatchErrors).toEqual([]);

      const ledger = db.rows("reconciliation_alerts");
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({
        transition: "new",
        run_id: summary.runId,
        check_code: "payment_stuck_uncertain",
        severity: "critical",
        subject_type: "payment",
        subject_id: p.id,
      });
      expect(ledger[0].alert_event_key).toBe(`${ledger[0].finding_id}:new:${summary.runId}`);
      expect(ledger[0].dispatched_at).toBeTruthy();
      expect(ledger[0].delivery).toMatchObject({
        recipients: 2,
        inAppSent: 2,
        inAppFailed: 0,
        webhook: "disabled",
        webhookFailed: 0,
      });

      const notes = db.rows("notifications");
      expect(notes).toHaveLength(2);
      expect(notes.map((n: Row) => n.user_id).sort()).toEqual([admin.id, superadmin.id].sort());
      expect(notes[0]).toMatchObject({ type: "recon_alert", channel: "push" });
      expect(notes[0].title).toBe("New critical reconciliation finding");
      expect(notes[0].body).toContain("payment_stuck_uncertain");
      expect(notes[0].body).toContain("payment");

      const audits = db.rows("audit_logs").filter((a: Row) => a.action === "reconciliation.alert_dispatched");
      expect(audits).toHaveLength(1);
      expect(audits[0].user_id).toBeNull();
      expect(audits[0].resource).toBe("reconciliation_alerts");
      expect(audits[0].details).toMatchObject({
        finding_id: ledger[0].finding_id,
        alert_event_key: ledger[0].alert_event_key,
        transition: "new",
        run_id: summary.runId,
        recipients: 2,
        inAppSent: 2,
        inAppFailed: 0,
        webhook: "disabled",
      });
    });
  });

  it("zero candidates: nothing dispatched, stats all zero/disabled", async () => {
    await withAlertEnv(async () => {
      const { db, client } = createFakeDb({
        system_config: [systemConfigRow()],
        user_profiles: [admin],
      });

      const { summary, alerts } = await runReconciliationWithAlerts({
        client,
        trigger: "test",
        now: NOW,
        gateway: fakeGateway(),
      });

      expect(summary.alertCandidates).toEqual([]);
      expect(alerts).toMatchObject({
        candidates: 0,
        recipients: 0,
        inAppSent: 0,
        inAppFailed: 0,
        webhook: "disabled",
        webhookFailed: 0,
        skippedDuplicates: 0,
      });
      expect(db.rows("reconciliation_alerts")).toHaveLength(0);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs").filter((a: Row) => a.action === "reconciliation.alert_dispatched")).toHaveLength(0);
    });
  });

  it("duplicate ledger reservation (23505) skips every downstream channel", async () => {
    await withAlertEnv(async () => {
      const findingId = randomUUID();
      const runId = randomUUID();
      const ev = {
        findingId,
        transition: "new" as const,
        runId,
        checkCode: "payment_stuck_uncertain",
        severity: "critical" as const,
        subjectType: "payment" as const,
        subjectId: randomUUID(),
        summary: "Payment x stuck in created for 1500m",
        eventKey: `${findingId}:new:${runId}`,
      };
      const { db, client } = createFakeDb({
        user_profiles: [admin],
        reconciliation_alerts: [{ id: randomUUID(), alert_event_key: ev.eventKey }],
      });

      const stats = await dispatchReconciliationAlerts({ client, candidates: [ev] });

      expect(stats.skippedDuplicates).toBe(1);
      expect(stats.dispatchErrors).toEqual([]);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs")).toHaveLength(0);
      expect(db.rows("reconciliation_alerts")).toHaveLength(1); // seed only
    });
  });

  it("notifications insert failure is counted, not thrown — run result untouched", async () => {
    await withAlertEnv(async () => {
      const p = stuckCritPayment();
      const { db, client } = createFakeDb({
        system_config: [systemConfigRow()],
        payment_transactions: [p],
        user_profiles: [admin, superadmin],
      });
      db.fail("notifications");

      const { summary, alerts } = await runReconciliationWithAlerts({
        client,
        trigger: "test",
        now: NOW,
        gateway: fakeGateway(),
      });

      expect(summary.status).toBe("success");
      expect(summary.findingsNew).toBe(1);
      expect(alerts.inAppFailed).toBe(2);
      expect(alerts.inAppSent).toBe(0);
      expect(alerts.candidates).toBe(1);
      const ledger = db.rows("reconciliation_alerts");
      expect(ledger).toHaveLength(1);
      expect(ledger[0].delivery).toMatchObject({ inAppFailed: 2, inAppSent: 0 });
    });
  });

  it("ledger reservation failure blocks all downstream dispatch (reserve-first)", async () => {
    await withAlertEnv(async () => {
      const p = stuckCritPayment();
      const { db, client } = createFakeDb({
        system_config: [systemConfigRow()],
        payment_transactions: [p],
        user_profiles: [admin, superadmin],
      });
      db.fail("reconciliation_alerts");

      const { summary, alerts } = await runReconciliationWithAlerts({
        client,
        trigger: "test",
        now: NOW,
        gateway: fakeGateway(),
      });

      expect(summary.status).toBe("success"); // dispatch failure never changes the run
      expect(alerts.dispatchErrors.some((e) => e.includes("ledger reserve failed"))).toBe(true);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs").filter((a: Row) => a.action.startsWith("reconciliation.alert"))).toHaveLength(0);
    });
  });
});
