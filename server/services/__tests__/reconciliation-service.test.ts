import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { runReconciliation } from "../reconciliation-service";

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

async function run(client: any, now: Date = NOW) {
  return runReconciliation({ client, trigger: "test", now });
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
    expect(summary.failedChecks).toEqual(["C1", "C2", "C3"]);
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
    expect(summary.truncatedChecks).toEqual(["C2"]);
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
    expect(summary.failedChecks).toEqual(["C1", "C2", "C3", "C4", "C5", "C7", "C8"]);
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
    expect(runRow.checks_run).toEqual(["C1", "C2", "C3", "C4", "C5", "C7", "C8"]);
    expect(Object.keys(runRow.check_results).sort()).toEqual(
      ["C1", "C2", "C3", "C4", "C5", "C7", "C8"].sort()
    );
    expect(runRow.check_results.C1).toEqual({ status: "success", findings: 1 });
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
