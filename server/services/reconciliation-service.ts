import crypto from "crypto";

// ============================================================================
// Reconciliation Service — Phase 3B-1 (detection only)
// ============================================================================
// Observational reconciliation: detect, classify, record. NEVER repairs.
//
// Hard invariants (3B-1):
//   - Writes ONLY to reconciliation_runs and reconciliation_findings.
//     Never mutates payment_transactions, payment_refunds, wallet_transactions,
//     user_profiles.wallet_balance, or payment_webhook_events.
//   - Reads payment_webhook_events but never reclaims/retries/resets them
//     (webhook retry belongs to the 3A3 webhook processing path).
//   - Stale auto-resolution of findings happens ONLY when the owning check
//     completed successfully AND was not truncated. A failed or truncated
//     scan leaves every existing finding untouched.
//
// Check registry (3B-2 adds C6 gateway-vs-DB comparison):
//   C1 refund_reconciliation_required
//   C2 refund_stuck_submitting
//   C3 refund_stuck_other
//   C4 payment_stuck_uncertain
//   C5 ledger_payment_mismatch
//   C6 gateway-vs-DB — execution check owning C6_OWNED_CODES below
//   C7 webhook_processing_anomaly
//   C8 wallet_ledger_inconsistency
//
// C6 invariants (3B-2):
//   - Gateway access is GET-only, one attempt per lookup, no retries,
//     no refunds, no state transitions.
//   - Any gateway failure or 429 fails the whole C6 execution check:
//     zero finding writes across ALL C6_OWNED_CODES for that run.
//   - Cap or time-budget exhaustion truncates C6: same zero-writes rule.
//   - A C6 success may stale-resolve only its owned codes.
//   - A zero-attempt success is only legal when every candidate was
//     skipped for a missing gateway id (meta explains it); anything
//     else becomes failed via the tripwire in checkC6.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "info" | "warning" | "critical";
export type SubjectType = "payment" | "refund" | "order" | "webhook_event" | "wallet_user";
export type CheckStatus = "success" | "failed" | "truncated";
export type RunTrigger = "cron" | "manual" | "test";

export interface FindingCandidate {
  checkCode: string;
  severity: Severity;
  subjectType: SubjectType;
  subjectId: string;
  summary: string;
  details: Record<string, unknown>;
}

export type AlertTransition = "new" | "reopened" | "escalated";

// Phase 3B-3 — in-memory only, never persisted to reconciliation_runs and
// stripped from the HTTP response by the route. Identity is deterministic
// from the run: eventKey = findingId:transition:runId (mirrors the DB
// unique (finding_id, transition, run_id) + unique (alert_event_key)).
// Emitted ONLY for critical severity, only from persisted old→new state
// transitions: new inserts, resolved→critical reopens, warning|info→critical
// escalations. Repeat-open and acknowledged-critical re-detections never
// emit; failed/truncated checks never reach merge and therefore never emit.
export interface AlertCandidate {
  findingId: string;
  transition: AlertTransition;
  runId: string;
  checkCode: string;
  severity: Severity;
  subjectType: SubjectType;
  subjectId: string;
  summary: string;
  eventKey: string;
}

export interface CheckOutcome {
  checkId: string;
  checkCode: string;
  completed: boolean;
  truncated: boolean;
  findings: FindingCandidate[];
  error?: string;
  meta?: C6Meta;
}

export interface Thresholds {
  refundSubmittingWarnMin: number;
  refundSubmittingCritMin: number;
  refundPendingWarnMin: number;
  refundProcessingWarnHours: number;
  paymentStuckWarnMin: number;
  paymentStuckCritHours: number;
  webhookPendingWarnMin: number;
  maxFindingsPerCheck: number;
  gatewayMaxLookupsPerRun: number;
  gatewayLookupDelayMs: number;
  gatewayTimeBudgetMs: number;
  gatewayLookupTimeoutMs: number;
}

export interface RunCheckResult {
  status: CheckStatus;
  findings: number;
  error?: string;
  meta?: C6Meta;
}

export interface RunSummary {
  runId: string | null;
  status: "success" | "failed";
  trigger: RunTrigger;
  checkResults: Record<string, RunCheckResult>;
  findingsOpen: number;
  findingsNew: number;
  findingsResolved: number;
  findingsReopened: number;
  // Derived from checkResults (response-only; no DB column). Lets an operator
  // distinguish "run completed" from "every check succeeded" at a glance.
  failedChecks: string[];
  truncatedChecks: string[];
  // Phase 3B-3 — critical alert transitions observed during the merge phase.
  // In-memory only: not persisted to reconciliation_runs and omitted from the
  // HTTP response (the route replaces it with dispatch stats).
  alertCandidates: AlertCandidate[];
  error?: string;
}

export interface RunReconciliationOptions {
  client: any;
  trigger: RunTrigger;
  now?: Date;
  gateway?: GatewayClient;
  sleep?: (ms: number) => Promise<void>;
}

export const CHECK_CODES: Record<string, string> = {
  C1: "refund_reconciliation_required",
  C2: "refund_stuck_submitting",
  C3: "refund_stuck_other",
  C4: "payment_stuck_uncertain",
  C5: "ledger_payment_mismatch",
  C7: "webhook_processing_anomaly",
  C8: "wallet_ledger_inconsistency",
};

// C6 is one execution check with several semantic finding codes. All of them
// must be gated, loaded and stale-resolved together under the C6 status.
export const C6_OWNED_CODES = [
  "gateway_payment_status_mismatch",
  "gateway_payment_amount_mismatch",
  "gateway_payment_order_mismatch",
  "gateway_payment_not_found",
  "gateway_payment_unknown_status",
  "gateway_refund_status_mismatch",
  "gateway_refund_amount_mismatch",
  "gateway_refund_payment_mismatch",
  "gateway_refund_not_found",
  "gateway_refund_unknown_status",
];

const GATEWAY_PAYMENT_STATUSES = ["created", "authorized", "captured", "refunded", "failed"];
const GATEWAY_REFUND_STATUSES = ["pending", "processed", "failed"];

export interface GatewayLookupResult {
  kind: "ok" | "not_found" | "failure";
  status?: number;
  data?: any;
  error?: string;
  rateLimited?: boolean;
  timeout?: boolean;
}

// Read-only gateway access. Implementations must never retry, never issue
// non-GET verbs and never mutate gateway or financial state.
export interface GatewayClient {
  getPayment(gatewayPaymentId: string, timeoutMs: number): Promise<GatewayLookupResult>;
  getRefund(gatewayRefundId: string, timeoutMs: number): Promise<GatewayLookupResult>;
}

export interface C6Meta {
  candidateCount: number;
  attempted: number;
  succeeded: number;
  skippedNoGatewayId: number;
  rateLimited: boolean;
  budgetExhausted: boolean;
}

function emptyC6Meta(): C6Meta {
  return {
    candidateCount: 0,
    attempted: 0,
    succeeded: 0,
    skippedNoGatewayId: 0,
    rateLimited: false,
    budgetExhausted: false,
  };
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  refundSubmittingWarnMin: 15,
  refundSubmittingCritMin: 60,
  refundPendingWarnMin: 30,
  refundProcessingWarnHours: 24,
  paymentStuckWarnMin: 30,
  paymentStuckCritHours: 24,
  webhookPendingWarnMin: 5,
  maxFindingsPerCheck: 500,
  gatewayMaxLookupsPerRun: 30,
  gatewayLookupDelayMs: 100,
  gatewayTimeBudgetMs: 10000,
  gatewayLookupTimeoutMs: 5000,
};

const CHECK_ORDER = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];

// Full-history ledger scan cap. Beyond it the C8 scan is truncated and NO
// stale resolution is allowed (missing rows must never read as "cleared").
const LEDGER_SCAN_LIMIT = 10000;

// Detail keys that participate in C7 <-> financial-critical correlation.
const CORRELATION_KEYS = ["gateway_order_id", "gateway_payment_id", "gateway_refund_id"];

interface Ctx {
  client: any;
  thresholds: Thresholds;
  cap: number;
  now: Date;
}

interface FetchResult {
  rows: any[];
  truncated: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function fetchAll(builder: any, cap: number): Promise<FetchResult> {
  try {
    const { data, error } = await builder;
    if (error) return { rows: [], truncated: false, error: error.message || String(error) };
    const rows = Array.isArray(data) ? data : [];
    if (rows.length > cap) return { rows: rows.slice(0, cap), truncated: true };
    return { rows, truncated: false };
  } catch (e: any) {
    return { rows: [], truncated: false, error: String(e?.message || e) };
  }
}

function minutesSince(iso: string | null | undefined, now: Date): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return (now.getTime() - t) / 60000;
}

function severityRank(s: Severity): number {
  return s === "critical" ? 2 : s === "warning" ? 1 : 0;
}

function maxSeverity(a: Severity, b: Severity): Severity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function baseOutcome(checkId: string): CheckOutcome {
  return { checkId, checkCode: CHECK_CODES[checkId], completed: true, truncated: false, findings: [] };
}

function failedOutcome(checkId: string, error: string): CheckOutcome {
  return { checkId, checkCode: CHECK_CODES[checkId], completed: false, truncated: false, findings: [], error };
}

// Collapse duplicate candidates for the same subject inside one check
// (identity is check_code + subject_type + subject_id — mirrors uq_recon_finding).
function dedupeFindings(findings: FindingCandidate[]): FindingCandidate[] {
  const map = new Map<string, FindingCandidate>();
  for (const f of findings) {
    const key = `${f.checkCode}|${f.subjectType}|${f.subjectId}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...f, details: { ...f.details } });
    } else {
      prev.severity = maxSeverity(prev.severity, f.severity);
      prev.summary = `${prev.summary}; ${f.summary}`;
      prev.details = { ...prev.details, ...f.details };
    }
  }
  return Array.from(map.values());
}

async function loadThresholds(client: any): Promise<Thresholds> {
  try {
    const { data, error } = await client.from("system_config").select("config").eq("id", 1).single();
    if (error || !data) return { ...DEFAULT_THRESHOLDS };
    const t = data.config?.reconciliation || {};
    const merged: Thresholds = { ...DEFAULT_THRESHOLDS };
    for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]) {
      const v = t[key];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) merged[key] = v;
    }
    return merged;
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

// ---------------------------------------------------------------------------
// C1 — refund_reconciliation_required
// ---------------------------------------------------------------------------

async function checkC1(ctx: Ctx): Promise<CheckOutcome> {
  const out = baseOutcome("C1");
  const f = await fetchAll(
    ctx.client.from("payment_refunds").select("*").eq("refund_status", "reconciliation_required").limit(ctx.cap + 1),
    ctx.cap
  );
  if (f.error) return failedOutcome("C1", f.error);
  out.truncated = f.truncated;
  out.findings = f.rows.map((r: any) => ({
    checkCode: out.checkCode,
    severity: "critical" as Severity,
    subjectType: "refund" as SubjectType,
    subjectId: r.id,
    summary: `Refund ${r.id} requires manual reconciliation (gateway succeeded, internal settlement incomplete)`,
    details: {
      refundStatus: r.refund_status,
      amount: r.amount,
      paymentTransactionId: r.payment_transaction_id,
      gateway_refund_id: r.gateway_refund_id ?? null,
      failureReason: r.failure_reason ?? null,
      updatedAt: r.updated_at,
    },
  }));
  return out;
}

// ---------------------------------------------------------------------------
// C2 — refund_stuck_submitting
// ---------------------------------------------------------------------------

async function checkC2(ctx: Ctx): Promise<CheckOutcome> {
  const out = baseOutcome("C2");
  const f = await fetchAll(
    ctx.client.from("payment_refunds").select("*").eq("refund_status", "submitting")
      .order("updated_at", { ascending: true }).limit(ctx.cap + 1),
    ctx.cap
  );
  if (f.error) return failedOutcome("C2", f.error);
  out.truncated = f.truncated;

  const warn = ctx.thresholds.refundSubmittingWarnMin;
  const crit = ctx.thresholds.refundSubmittingCritMin;
  for (const r of f.rows) {
    const age = minutesSince(r.updated_at, ctx.now);
    let severity: Severity | null = null;
    if (age >= crit) severity = "critical";
    else if (age >= warn) severity = "warning";
    if (!severity) continue;
    out.findings.push({
      checkCode: out.checkCode,
      severity,
      subjectType: "refund",
      subjectId: r.id,
      summary: `Refund ${r.id} stuck in submitting for ${Math.round(age)}m (gateway outcome uncertain)`,
      details: {
        refundStatus: r.refund_status,
        ageMinutes: Math.round(age),
        thresholds: { warnMin: warn, critMin: crit },
        amount: r.amount,
        paymentTransactionId: r.payment_transaction_id,
        gateway_refund_id: r.gateway_refund_id ?? null,
        updatedAt: r.updated_at,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// C3 — refund_stuck_other (pending / processing tiers)
// ---------------------------------------------------------------------------

async function checkC3(ctx: Ctx): Promise<CheckOutcome> {
  const out = baseOutcome("C3");
  const f = await fetchAll(
    ctx.client.from("payment_refunds").select("*").in("refund_status", ["pending", "processing"])
      .order("updated_at", { ascending: true }).limit(ctx.cap + 1),
    ctx.cap
  );
  if (f.error) return failedOutcome("C3", f.error);
  out.truncated = f.truncated;

  const pendingWarn = ctx.thresholds.refundPendingWarnMin;
  const processingWarnH = ctx.thresholds.refundProcessingWarnHours;
  const processingCritH = processingWarnH * 3;

  for (const r of f.rows) {
    const age = minutesSince(r.updated_at, ctx.now);
    let severity: Severity | null = null;
    if (r.refund_status === "pending") {
      if (age >= pendingWarn) severity = "warning";
    } else if (r.refund_status === "processing") {
      if (age >= processingCritH * 60) severity = "critical";
      else if (age >= processingWarnH * 60) severity = "warning";
    }
    if (!severity) continue;
    out.findings.push({
      checkCode: out.checkCode,
      severity,
      subjectType: "refund",
      subjectId: r.id,
      summary: `Refund ${r.id} in ${r.refund_status} for ${Math.round(age)}m`,
      details: {
        refundStatus: r.refund_status,
        ageMinutes: Math.round(age),
        pendingWarnMin: pendingWarn,
        processingWarnHours: processingWarnH,
        processingCritHours: processingCritH,
        amount: r.amount,
        paymentTransactionId: r.payment_transaction_id,
        gateway_refund_id: r.gateway_refund_id ?? null,
        updatedAt: r.updated_at,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// C4 — payment_stuck_uncertain
// ---------------------------------------------------------------------------

const UNCERTAIN_STATUSES = ["creating", "created", "pending", "authorized"];

async function checkC4(ctx: Ctx): Promise<CheckOutcome> {
  const out = baseOutcome("C4");
  const warn = ctx.thresholds.paymentStuckWarnMin;
  const critMin = ctx.thresholds.paymentStuckCritHours * 60;

  const uncertain = await fetchAll(
    ctx.client.from("payment_transactions").select("*").in("payment_status", UNCERTAIN_STATUSES)
      .order("created_at", { ascending: true }).limit(ctx.cap + 1),
    ctx.cap
  );
  if (uncertain.error) return failedOutcome("C4", uncertain.error);
  out.truncated = uncertain.truncated;

  for (const p of uncertain.rows) {
    const age = minutesSince(p.updated_at || p.created_at, ctx.now);
    let severity: Severity | null = null;
    if (age >= critMin) severity = "critical";
    else if (age >= warn) severity = "warning";
    if (!severity) continue;
    out.findings.push({
      checkCode: out.checkCode,
      severity,
      subjectType: "payment",
      subjectId: p.id,
      summary: `Payment ${p.id} stuck in ${p.payment_status} for ${Math.round(age)}m (gateway outcome uncertain)`,
      details: {
        paymentStatus: p.payment_status,
        ageMinutes: Math.round(age),
        thresholds: { warnMin: warn, critMin: critMin },
        amount: p.amount,
        currency: p.currency ?? null,
        gateway: p.gateway ?? null,
        transactionPurpose: p.transaction_purpose ?? null,
        gateway_order_id: p.gateway_order_id ?? null,
        gateway_payment_id: p.gateway_payment_id ?? null,
        walletTransactionId: p.wallet_transaction_id ?? null,
        updatedAt: p.updated_at || p.created_at,
      },
    });
  }

  // Captured wallet_topup rows that never created a wallet credit — critical
  // regardless of gateway verify flags (user paid, wallet may not reflect it).
  const missing = await fetchAll(
    ctx.client.from("payment_transactions").select("*").eq("payment_status", "captured")
      .eq("transaction_purpose", "wallet_topup").is("wallet_transaction_id", null).limit(ctx.cap + 1),
    ctx.cap
  );
  if (missing.error) return failedOutcome("C4", missing.error);
  if (missing.truncated) out.truncated = true;
  for (const p of missing.rows) {
    out.findings.push({
      checkCode: out.checkCode,
      severity: "critical",
      subjectType: "payment",
      subjectId: p.id,
      summary: `Captured wallet top-up ${p.id} has no wallet credit row (ledger may under-credit)`,
      details: {
        paymentStatus: p.payment_status,
        transactionPurpose: p.transaction_purpose ?? null,
        amount: p.amount,
        currency: p.currency ?? null,
        gateway_order_id: p.gateway_order_id ?? null,
        gateway_payment_id: p.gateway_payment_id ?? null,
        walletTransactionId: null,
        gatewaySignatureVerified: p.gateway_signature_verified ?? false,
        gatewayCaptureVerified: p.gateway_capture_verified ?? false,
        updatedAt: p.updated_at || p.created_at,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// C5 — ledger_payment_mismatch (captured payments vs wallet ledger rows)
// ---------------------------------------------------------------------------
// Direction: payment -> ledger. Every captured payment that involves the
// wallet must have a consistent linked wallet_transactions row. The reverse
// direction (orphan ledger rows) is covered by C8's balance arithmetic.
//
// Known intentional asymmetries (NOT findings):
//   - captured wallet_topup with wallet_transaction_id IS NULL is C4's
//     critical finding (we do not duplicate it here).
//   - captured gateway order payments (gateway='razorpay') have no wallet
//     ledger row and are skipped.

async function checkC5(ctx: Ctx): Promise<CheckOutcome> {
  const out = baseOutcome("C5");

  const pt = await fetchAll(
    ctx.client.from("payment_transactions").select("*").eq("payment_status", "captured")
      .order("created_at", { ascending: true }).limit(ctx.cap + 1),
    ctx.cap
  );
  if (pt.error) return failedOutcome("C5", pt.error);
  out.truncated = pt.truncated;

  const linkedIds = Array.from(new Set(
    pt.rows.map((p: any) => p.wallet_transaction_id).filter((v: any) => typeof v === "string" && v.length > 0)
  ));

  const walletById = new Map<string, any>();
  if (linkedIds.length > 0) {
    const wt = await fetchAll(
      ctx.client.from("wallet_transactions").select("*").in("id", linkedIds).limit(ctx.cap + 1),
      ctx.cap
    );
    if (wt.error) return failedOutcome("C5", wt.error);
    if (wt.truncated) out.truncated = true;
    for (const w of wt.rows) walletById.set(w.id, w);
  }

  for (const p of pt.rows) {
    const issues: string[] = [];

    if (p.transaction_purpose === "wallet_topup" && !p.wallet_transaction_id) {
      continue; // owned by C4 (critical)
    }
    if (p.gateway === "wallet" && !p.wallet_transaction_id) {
      issues.push("wallet-sourced payment is captured but has no ledger debit");
    }

    if (p.wallet_transaction_id) {
      const w = walletById.get(p.wallet_transaction_id);
      if (!w) {
        issues.push(`linked wallet ledger row ${p.wallet_transaction_id} is missing`);
      } else {
        if (w.status !== "success") issues.push(`ledger row status is ${w.status}`);
        if (Number(w.amount) !== Number(p.amount)) {
          issues.push(`ledger amount ${w.amount} != payment amount ${p.amount}`);
        }
        if (w.user_id && p.user_id && w.user_id !== p.user_id) {
          issues.push("ledger row belongs to a different user");
        }
        const expectedType =
          p.transaction_purpose === "wallet_topup" ? "credit" :
          p.gateway === "wallet" ? "debit" : null;
        if (expectedType && w.type !== expectedType) {
          issues.push(`ledger row type is ${w.type}, expected ${expectedType}`);
        }
      }
    }

    if (issues.length === 0) continue;

    out.findings.push({
      checkCode: out.checkCode,
      severity: "warning",
      subjectType: "payment",
      subjectId: p.id,
      summary: `Payment ${p.id}: ${issues.join("; ")}`,
      details: {
        paymentStatus: p.payment_status,
        transactionPurpose: p.transaction_purpose ?? null,
        gateway: p.gateway ?? null,
        amount: p.amount,
        gateway_order_id: p.gateway_order_id ?? null,
        gateway_payment_id: p.gateway_payment_id ?? null,
        walletTransactionId: p.wallet_transaction_id ?? null,
        issues,
        updatedAt: p.updated_at || p.created_at,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// C6 — gateway-vs-DB reconciliation (read-only Razorpay GETs)
// ---------------------------------------------------------------------------
// Candidates are exactly this run's C1-C4 subjects. Every lookup is a single
// GET with a remaining-budget timeout: any failure or 429 fails the whole
// check (zero owned-code writes), cap/budget exhaustion truncates it, and a
// gateway "id does not exist" answer is evidence (not a failure). Razorpay
// encodes that answer asymmetrically: GET /v1/payments/{unknown} -> 400 +
// BAD_REQUEST_ERROR "The id provided does not exist", while
// GET /v1/refunds/{unknown} -> 404. Both classify as not_found. A wait
// clipped by our remaining time budget is exhaustion (truncated), never a
// failure — the gateway never got its full timeout.

// Classifies a non-2xx Razorpay response into a lookup result.
// Returns null for statuses that stay generic failures.
export function razorpayErrorResult(status: number, body: unknown): GatewayLookupResult | null {
  if (status === 404) return { kind: "not_found", status };
  if (status === 400) {
    const err: any = (body as any)?.error;
    const desc = String(err?.description ?? err?.message ?? "");
    if (err?.code === "BAD_REQUEST_ERROR" && /does not exist/i.test(desc)) {
      return { kind: "not_found", status };
    }
    return {
      kind: "failure",
      status,
      error: `gateway responded 400${desc ? `: ${desc.slice(0, 200)}` : ""}`,
    };
  }
  if (status === 429) {
    return { kind: "failure", status, rateLimited: true, error: "rate limited (429)" };
  }
  return null;
}

class RazorpayGatewayClient implements GatewayClient {
  constructor(private readonly keyId: string, private readonly keySecret: string) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
  }

  private async get(url: string, timeoutMs: number): Promise<GatewayLookupResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Authorization: this.authHeader() },
        signal: controller.signal,
      });
      if (response.ok) {
        let data: any;
        try {
          data = await response.json();
        } catch {
          return { kind: "failure", status: response.status, error: "gateway response was not valid JSON" };
        }
        return { kind: "ok", status: response.status, data };
      }
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const classified = razorpayErrorResult(response.status, body);
      if (classified) return classified;
      return { kind: "failure", status: response.status, error: `gateway responded ${response.status}` };
    } catch (e: any) {
      const aborted = e?.name === "AbortError" || /abort/i.test(String(e?.message ?? ""));
      if (aborted) {
        return { kind: "failure", timeout: true, error: `gateway lookup timed out after ${timeoutMs}ms` };
      }
      return { kind: "failure", error: `gateway request failed: ${String(e?.message ?? e)}` };
    } finally {
      clearTimeout(timer);
    }
  }

  getPayment(gatewayPaymentId: string, timeoutMs: number): Promise<GatewayLookupResult> {
    return this.get(`https://api.razorpay.com/v1/payments/${encodeURIComponent(gatewayPaymentId)}`, timeoutMs);
  }

  getRefund(gatewayRefundId: string, timeoutMs: number): Promise<GatewayLookupResult> {
    return this.get(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(gatewayRefundId)}`, timeoutMs);
  }
}

async function loadRowsIn(client: any, table: string, ids: string[], chunkSize = 500): Promise<{ rows: any[]; error?: string }> {
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const f = await fetchAll(client.from(table).select("*").in("id", slice), slice.length);
    if (f.error) return { rows: [], error: f.error };
    rows.push(...f.rows);
  }
  return { rows };
}

function paymentGatewayDetails(db: any, gw: any): Record<string, unknown> {
  return {
    paymentStatus: db.payment_status,
    dbAmount: db.amount,
    dbAmountRefunded: db.amount_refunded ?? 0,
    dbCurrency: db.currency ?? null,
    db_gateway_order_id: db.gateway_order_id ?? null,
    gateway_status: gw.status ?? null,
    gateway_refund_status: gw.refund_status ?? null,
    gateway_amount: gw.amount ?? null,
    gateway_amount_refunded: gw.amount_refunded ?? 0,
    gateway_currency: gw.currency ?? null,
    gateway_payment_id: gw.id ?? db.gateway_payment_id ?? null,
    gateway_order_id: gw.order_id ?? null,
    updatedAt: db.updated_at || db.created_at,
  };
}

export function compareGatewayPayment(db: any, gw: any): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  const base = paymentGatewayDetails(db, gw);
  const dbAmountRefunded = db.amount_refunded ?? 0;
  const gwAmountRefunded = gw.amount_refunded ?? 0;
  const gwRefundStatus = gw.refund_status ?? null;

  const unknownStatus = typeof gw.status !== "string" || !GATEWAY_PAYMENT_STATUSES.includes(gw.status);
  const unknownRefundStatus = gwRefundStatus !== null && !["partial", "full"].includes(String(gwRefundStatus));

  if (unknownStatus || unknownRefundStatus) {
    findings.push({
      checkCode: "gateway_payment_unknown_status",
      severity: "warning",
      subjectType: "payment",
      subjectId: db.id,
      summary: `Payment ${db.id} has unclassifiable gateway state (status=${String(gw.status)}, refund_status=${String(gwRefundStatus)})`,
      details: {
        ...base,
        unknownField: unknownStatus && unknownRefundStatus ? "status+refund_status" : unknownStatus ? "status" : "refund_status",
      },
    });
  }

  const amountFields: string[] = [];
  if (gw.amount !== db.amount * 100) amountFields.push("amount");
  if (gwAmountRefunded !== dbAmountRefunded * 100) amountFields.push("amount_refunded");
  if (gw.currency !== db.currency) amountFields.push("currency");
  if (amountFields.length > 0) {
    findings.push({
      checkCode: "gateway_payment_amount_mismatch",
      severity: "critical",
      subjectType: "payment",
      subjectId: db.id,
      summary: `Payment ${db.id} amount disagrees with gateway on: ${amountFields.join(", ")}`,
      details: { ...base, fields: amountFields },
    });
  }

  if (db.gateway_order_id && gw.order_id && gw.order_id !== db.gateway_order_id) {
    findings.push({
      checkCode: "gateway_payment_order_mismatch",
      severity: "critical",
      subjectType: "payment",
      subjectId: db.id,
      summary: `Payment ${db.id} sits on gateway order ${gw.order_id} but DB expects ${db.gateway_order_id}`,
      details: base,
    });
  }

  // Status matrix only when the gateway state is classifiable and the
  // refunded-amount comparison did not already explain the divergence.
  const refundedAmountMismatch = gwAmountRefunded !== dbAmountRefunded * 100;
  if (!unknownStatus && !unknownRefundStatus && !refundedAmountMismatch) {
    const dbStatus = db.payment_status;
    const gwStatus = gw.status as string;
    const uncertain = ["creating", "created", "pending", "authorized"].includes(dbStatus);
    let statusOk: boolean;
    let note: string;
    if (uncertain) {
      statusOk = gwStatus === "created" || gwStatus === "authorized" || gwStatus === "failed";
      note = `DB payment in ${dbStatus} but gateway reports ${gwStatus}`;
    } else if (dbStatus === "captured") {
      statusOk = gwStatus === "captured" && gwRefundStatus === null;
      note = `DB payment captured but gateway reports status=${gwStatus}, refund_status=${String(gwRefundStatus)}`;
    } else if (dbStatus === "partially_refunded") {
      statusOk = gwStatus === "captured";
      note = `DB payment partially_refunded but gateway reports ${gwStatus}`;
    } else if (dbStatus === "refunded") {
      statusOk = gwStatus === "refunded";
      note = `DB payment refunded but gateway reports ${gwStatus}`;
    } else if (dbStatus === "failed") {
      statusOk = gwStatus === "failed" || gwStatus === "created" || gwStatus === "authorized";
      note = `DB payment failed but gateway reports ${gwStatus}`;
    } else if (dbStatus === "cancelled") {
      statusOk = gwStatus !== "captured" && gwStatus !== "refunded";
      note = `DB payment cancelled but gateway reports ${gwStatus}`;
    } else {
      statusOk = true;
      note = "";
    }
    if (!statusOk) {
      findings.push({
        checkCode: "gateway_payment_status_mismatch",
        severity: "critical",
        subjectType: "payment",
        subjectId: db.id,
        summary: `Payment ${db.id}: ${note}`,
        details: base,
      });
    }
  }
  return findings;
}

export function compareGatewayRefund(db: any, linkedTxn: any | null, gw: any): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  const base = {
    refundStatus: db.refund_status,
    dbAmount: db.amount,
    dbGatewayRefundAmount: db.gateway_refund_amount ?? null,
    paymentTransactionId: db.payment_transaction_id ?? null,
    db_gateway_refund_id: db.gateway_refund_id ?? null,
    gateway_status: gw.status ?? null,
    gateway_amount: gw.amount ?? null,
    gateway_refund_id: gw.id ?? db.gateway_refund_id ?? null,
    gateway_payment_id: gw.payment_id ?? null,
    updatedAt: db.updated_at,
  };

  const unknownStatus = typeof gw.status !== "string" || !GATEWAY_REFUND_STATUSES.includes(gw.status);

  if (typeof db.gateway_refund_amount === "number" && gw.amount !== db.gateway_refund_amount * 100) {
    findings.push({
      checkCode: "gateway_refund_amount_mismatch",
      severity: "critical",
      subjectType: "refund",
      subjectId: db.id,
      summary: `Refund ${db.id} gateway amount ${String(gw.amount)} paise disagrees with DB gateway_refund_amount ${db.gateway_refund_amount}`,
      details: { ...base, fields: ["amount"] },
    });
  }

  if (gw.payment_id && linkedTxn?.gateway_payment_id && gw.payment_id !== linkedTxn.gateway_payment_id) {
    findings.push({
      checkCode: "gateway_refund_payment_mismatch",
      severity: "critical",
      subjectType: "refund",
      subjectId: db.id,
      summary: `Refund ${db.id} sits on gateway payment ${gw.payment_id} but DB links ${linkedTxn.gateway_payment_id}`,
      details: base,
    });
  }

  if (unknownStatus) {
    findings.push({
      checkCode: "gateway_refund_unknown_status",
      severity: "warning",
      subjectType: "refund",
      subjectId: db.id,
      summary: `Refund ${db.id} has unclassifiable gateway status ${String(gw.status)}`,
      details: { ...base, unknownField: "status" },
    });
    return findings;
  }

  const mismatchRules: Record<string, { severity: Severity; note: string }> = {
    "pending|processed": { severity: "critical", note: "gateway refund processed but DB refund still pending" },
    "pending|failed": { severity: "warning", note: "gateway refund failed but DB refund still pending" },
    "submitting|processed": { severity: "critical", note: "gateway refund processed but DB refund still submitting" },
    "submitting|failed": { severity: "warning", note: "gateway refund failed but DB refund still submitting" },
    "processing|processed": { severity: "critical", note: "gateway refund processed but DB refund still processing" },
    "processing|failed": { severity: "warning", note: "gateway refund failed but DB refund still processing" },
    "completed|pending": { severity: "critical", note: "DB refund completed but gateway refund still pending" },
    "completed|failed": { severity: "critical", note: "DB refund completed but gateway refund failed" },
    "failed|processed": { severity: "critical", note: "gateway refund processed but DB refund marked failed" },
    "failed|pending": { severity: "warning", note: "DB refund failed but gateway refund still pending" },
    "reconciliation_required|failed": { severity: "critical", note: "gateway refund failed but DB refund expects gateway success" },
    "reconciliation_required|pending": { severity: "warning", note: "reconciliation-required DB refund still pending at gateway" },
  };
  const rule = mismatchRules[`${db.refund_status}|${gw.status}`];
  if (rule) {
    findings.push({
      checkCode: "gateway_refund_status_mismatch",
      severity: rule.severity,
      subjectType: "refund",
      subjectId: db.id,
      summary: `Refund ${db.id}: ${rule.note} (gateway status ${gw.status})`,
      details: base,
    });
  }
  return findings;
}

function paymentNotFoundFinding(db: any): FindingCandidate {
  return {
    checkCode: "gateway_payment_not_found",
    severity: "critical",
    subjectType: "payment",
    subjectId: db.id,
    summary: `Gateway payment ${db.gateway_payment_id} not found at Razorpay for payment ${db.id}`,
    details: {
      paymentStatus: db.payment_status,
      dbAmount: db.amount,
      dbAmountRefunded: db.amount_refunded ?? 0,
      gateway_payment_id: db.gateway_payment_id,
      gateway_order_id: db.gateway_order_id ?? null,
      updatedAt: db.updated_at || db.created_at,
    },
  };
}

function refundNotFoundFinding(db: any): FindingCandidate {
  return {
    checkCode: "gateway_refund_not_found",
    severity: "critical",
    subjectType: "refund",
    subjectId: db.id,
    summary: `Gateway refund ${db.gateway_refund_id} not found at Razorpay for refund ${db.id}`,
    details: {
      refundStatus: db.refund_status,
      dbAmount: db.amount,
      dbGatewayRefundAmount: db.gateway_refund_amount ?? null,
      gateway_refund_id: db.gateway_refund_id,
      paymentTransactionId: db.payment_transaction_id ?? null,
      updatedAt: db.updated_at,
    },
  };
}

async function checkC6(
  ctx: Ctx,
  sourceOutcomes: CheckOutcome[],
  gateway: GatewayClient | null,
  gatewayError: string | null,
  sleep: (ms: number) => Promise<void>
): Promise<CheckOutcome> {
  const meta = emptyC6Meta();
  const out: CheckOutcome = {
    checkId: "C6",
    checkCode: C6_OWNED_CODES[0],
    completed: true,
    truncated: false,
    findings: [],
    meta,
  };

  const failedSource = sourceOutcomes.find((o) => !o.completed);
  if (failedSource) {
    out.completed = false;
    out.error = `source check ${failedSource.checkId} failed - gateway comparison input incomplete`;
    return out;
  }
  const truncatedSource = sourceOutcomes.find((o) => o.truncated);
  if (truncatedSource) {
    out.truncated = true;
    out.error = `source check ${truncatedSource.checkId} truncated - gateway comparison input incomplete`;
    return out;
  }

  const paymentIds = new Set<string>();
  const refundIds = new Set<string>();
  for (const o of sourceOutcomes) {
    for (const c of dedupeFindings(o.findings)) {
      if (c.subjectType === "payment") paymentIds.add(c.subjectId);
      else if (c.subjectType === "refund") refundIds.add(c.subjectId);
    }
  }
  meta.candidateCount = paymentIds.size + refundIds.size;
  if (meta.candidateCount === 0) return out;

  const paymentRes = await loadRowsIn(ctx.client, "payment_transactions", [...paymentIds]);
  if (paymentRes.error) {
    out.completed = false;
    out.error = `failed to reload payment candidates: ${paymentRes.error}`;
    return out;
  }
  const refundRes = await loadRowsIn(ctx.client, "payment_refunds", [...refundIds]);
  if (refundRes.error) {
    out.completed = false;
    out.error = `failed to reload refund candidates: ${refundRes.error}`;
    return out;
  }
  const paymentRows = new Map<string, any>(paymentRes.rows.map((r) => [r.id, r]));
  const refundRows = new Map<string, any>(refundRes.rows.map((r) => [r.id, r]));
  if (paymentRows.size + refundRows.size < meta.candidateCount) {
    out.completed = false;
    out.error = `candidate rows missing after reload: ${paymentRows.size + refundRows.size}/${meta.candidateCount}`;
    return out;
  }

  interface C6Work {
    kind: "payment" | "refund";
    row: any;
    gatewayId: string;
  }
  const work: C6Work[] = [];
  for (const row of paymentRows.values()) {
    if (!row.gateway_payment_id) meta.skippedNoGatewayId++;
    else work.push({ kind: "payment", row, gatewayId: row.gateway_payment_id });
  }
  for (const row of refundRows.values()) {
    if (!row.gateway_refund_id) meta.skippedNoGatewayId++;
    else work.push({ kind: "refund", row, gatewayId: row.gateway_refund_id });
  }

  // Credentials only matter when there is something to look up: an all-skip
  // run is fully explained by meta and must not fail for a missing gateway.
  if (work.length > 0 && (gatewayError || !gateway)) {
    out.completed = false;
    out.error = gatewayError ?? "gateway not configured";
    return out;
  }

  if (work.length > ctx.thresholds.gatewayMaxLookupsPerRun) {
    out.truncated = true;
    out.error = `gateway lookup cap exceeded: ${work.length} lookups > cap ${ctx.thresholds.gatewayMaxLookupsPerRun}`;
    return out;
  }

  // Refund -> payment linkage for gateway refund payment_id comparison.
  const linkedPayments = new Map<string, any>(paymentRows);
  const needLinked = [...new Set(
    [...refundRows.values()].map((r) => r.payment_transaction_id).filter(Boolean)
  )].filter((id) => !linkedPayments.has(id));
  if (needLinked.length > 0) {
    const linked = await loadRowsIn(ctx.client, "payment_transactions", needLinked);
    if (linked.error) {
      out.completed = false;
      out.error = `failed to reload linked payment rows: ${linked.error}`;
      return out;
    }
    for (const r of linked.rows) linkedPayments.set(r.id, r);
  }

  const budgetMs = ctx.thresholds.gatewayTimeBudgetMs;
  const delayMs = ctx.thresholds.gatewayLookupDelayMs;
  const baseTimeout = ctx.thresholds.gatewayLookupTimeoutMs;
  const started = Date.now();

  for (let i = 0; i < work.length; i++) {
    const item = work[i];
    const remaining = budgetMs - (Date.now() - started);
    if (remaining <= 0) {
      meta.budgetExhausted = true;
      break;
    }
    const timeoutMs = Math.min(baseTimeout, remaining);
    meta.attempted++;
    // The guard above proves the client exists whenever work is non-empty,
    // and this loop only runs while work items remain.
    const gw = gateway as GatewayClient;
    const res =
      item.kind === "payment"
        ? await gw.getPayment(item.gatewayId, timeoutMs)
        : await gw.getRefund(item.gatewayId, timeoutMs);
    if (res.kind === "failure") {
      // A wait clipped by OUR remaining time budget is budget exhaustion
      // (truncated, zero writes), not a gateway failure: the gateway never
      // got its full timeout.
      if (res.timeout && timeoutMs < baseTimeout) {
        meta.budgetExhausted = true;
        break;
      }
      if (res.rateLimited) meta.rateLimited = true;
      out.completed = false;
      out.error = `gateway ${item.kind} lookup failed for ${item.gatewayId} after ${meta.attempted} attempt(s): ${res.error}${res.rateLimited ? " [rate limited]" : ""}`;
      return out;
    }
    meta.succeeded++;
    if (res.kind === "not_found") {
      out.findings.push(
        item.kind === "payment" ? paymentNotFoundFinding(item.row) : refundNotFoundFinding(item.row)
      );
    } else if (item.kind === "payment") {
      out.findings.push(...compareGatewayPayment(item.row, res.data));
    } else {
      out.findings.push(
        ...compareGatewayRefund(item.row, linkedPayments.get(item.row.payment_transaction_id) ?? null, res.data)
      );
    }
    const isLast = i === work.length - 1;
    if (!isLast) {
      const afterRemaining = budgetMs - (Date.now() - started);
      if (afterRemaining <= delayMs + Math.min(baseTimeout, 1)) {
        meta.budgetExhausted = true;
        break;
      }
      await sleep(delayMs);
    }
  }

  if (meta.budgetExhausted) {
    out.truncated = true;
    out.error = `gateway time budget ${budgetMs}ms exhausted after ${meta.attempted} of ${work.length} lookup(s)`;
    return out;
  }

  // Tripwire: a zero-attempt success is only legal when every candidate was
  // skipped for a missing gateway id. Anything else fails with zero writes.
  if (meta.candidateCount > 0 && meta.attempted === 0 && meta.skippedNoGatewayId < meta.candidateCount) {
    out.completed = false;
    out.error = `zero gateway attempts without explanation (candidateCount=${meta.candidateCount}, skippedNoGatewayId=${meta.skippedNoGatewayId})`;
    return out;
  }
  return out;
}

// ---------------------------------------------------------------------------
// C7 — webhook_processing_anomaly
// ---------------------------------------------------------------------------
// Severity: warning by default for every anomaly type. Escalated to critical
// ONLY via applyCorrelation() when a candidate's gateway ids match a critical
// C4/C5 financial finding (correlated financial impact).
//
// Anomaly types:
//   1. status='failed'                       -> warning (age via processed_at)
//   2. status='pending' older than
//      webhookPendingWarnMin (created_at)    -> warning
//   3. status='processed' whose payload gateway ids match a critical C4/C5
//      finding                              -> warning (then escalated by
//                                              correlation to critical)
// Type 3 scans only the most recent `cap` processed events; the payload
// window is noted in details. It never sets `truncated` (it is an
// additive signal — failing to re-find an event there must not block
// stale resolution of genuinely cleared failed/pending anomalies).

function extractGatewayIds(payload: any): {
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_refund_id: string | null;
} {
  const p = payload?.payment;
  const r = payload?.refund;
  const o = payload?.order;
  return {
    gateway_order_id: (typeof p?.order_id === "string" && p.order_id) ||
      (typeof o?.id === "string" && o.id) || null,
    gateway_payment_id: (typeof p?.id === "string" && p.id) ||
      (typeof r?.payment_id === "string" && r.payment_id) || null,
    gateway_refund_id: (typeof r?.id === "string" && r.id) || null,
  };
}

function webhookCandidate(
  out: CheckOutcome,
  row: any,
  source: "failed" | "pending_stale" | "processed_correlated",
  ageMinutes: number | null,
  ids: { gateway_order_id: string | null; gateway_payment_id: string | null; gateway_refund_id: string | null }
): void {
  const summaries: Record<string, string> = {
    failed: `Webhook event ${row.event_id} (${row.event_type}) is stuck in failed state`,
    pending_stale: `Webhook event ${row.event_id} (${row.event_type}) pending for ${ageMinutes}m`,
    processed_correlated: `Processed webhook event ${row.event_id} (${row.event_type}) references an entity with a critical financial finding`,
  };
  out.findings.push({
    checkCode: out.checkCode,
    severity: "warning",
    subjectType: "webhook_event",
    subjectId: row.event_id,
    summary: summaries[source],
    details: {
      source,
      gateway: row.gateway ?? null,
      eventType: row.event_type ?? null,
      status: row.status,
      ageMinutes,
      processedAt: row.processed_at ?? null,
      createdAt: row.created_at ?? null,
      ...ids,
    },
  });
}

async function checkC7(ctx: Ctx, criticalFinancialKeys: Set<string>): Promise<CheckOutcome> {
  const out = baseOutcome("C7");
  const warnMin = ctx.thresholds.webhookPendingWarnMin;

  const failed = await fetchAll(
    ctx.client.from("payment_webhook_events").select("*").eq("status", "failed")
      .order("processed_at", { ascending: true }).limit(ctx.cap + 1),
    ctx.cap
  );
  if (failed.error) return failedOutcome("C7", failed.error);
  if (failed.truncated) out.truncated = true;
  for (const row of failed.rows) {
    webhookCandidate(out, row, "failed", minutesSince(row.processed_at, ctx.now), extractGatewayIds(row.payload));
  }

  const cutoff = new Date(ctx.now.getTime() - warnMin * 60000).toISOString();
  const pending = await fetchAll(
    ctx.client.from("payment_webhook_events").select("*").eq("status", "pending")
      .lt("created_at", cutoff).order("created_at", { ascending: true }).limit(ctx.cap + 1),
    ctx.cap
  );
  if (pending.error) return failedOutcome("C7", pending.error);
  if (pending.truncated) out.truncated = true;
  for (const row of pending.rows) {
    webhookCandidate(out, row, "pending_stale", minutesSince(row.created_at, ctx.now), extractGatewayIds(row.payload));
  }

  if (criticalFinancialKeys.size > 0) {
    const processed = await fetchAll(
      ctx.client.from("payment_webhook_events").select("*").eq("status", "processed")
        .order("processed_at", { ascending: false }).limit(ctx.cap + 1),
      ctx.cap
    );
    if (processed.error) return failedOutcome("C7", processed.error);
    for (const row of processed.rows) {
      const ids = extractGatewayIds(row.payload);
      const correlated = [ids.gateway_order_id, ids.gateway_payment_id, ids.gateway_refund_id]
        .some((v) => v !== null && criticalFinancialKeys.has(v));
      if (correlated) {
        webhookCandidate(out, row, "processed_correlated", minutesSince(row.processed_at, ctx.now), ids);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// C8 — wallet_ledger_inconsistency
// ---------------------------------------------------------------------------
// Corrected methodology (per plan):
//   1. latest balance_after per user == user_profiles.wallet_balance
//   2. chain continuity: balance_after(i) == balance_before(i+1), skipping
//      rows with null balance fields and transitions between equal timestamps
//      (order is ambiguous there)
//   3. per-row arithmetic: credit -> after == before + amount,
//      debit -> after == before - amount
//   4. negative balances
//   5. sum(credits) - sum(debits) == final balance, ONLY if the earliest row
//      starts from balance_before == 0 and the scan was not truncated
// Scan beyond LEDGER_SCAN_LIMIT rows marks the whole check truncated, which
// (per run rules) disables stale resolution for C8 findings.

async function checkC8(ctx: Ctx): Promise<CheckOutcome> {
  const out = baseOutcome("C8");

  const lt = await fetchAll(
    ctx.client.from("wallet_transactions").select("*")
      .order("created_at", { ascending: true }).limit(LEDGER_SCAN_LIMIT + 1),
    LEDGER_SCAN_LIMIT
  );
  if (lt.error) return failedOutcome("C8", lt.error);
  out.truncated = lt.truncated;
  const rows = lt.rows;

  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));

  const profilesById = new Map<string, any>();
  let profilesTruncated = false;
  if (userIds.length > 0) {
    const prof = await fetchAll(
      ctx.client.from("user_profiles").select("id, wallet_balance").in("id", userIds).limit(ctx.cap + 1),
      ctx.cap
    );
    if (prof.error) return failedOutcome("C8", prof.error);
    if (prof.truncated) {
      out.truncated = true;
      profilesTruncated = true;
    }
    for (const u of prof.rows) profilesById.set(u.id, u);
  }

  // Nonzero balances with no ledger history at all.
  const nonzero = await fetchAll(
    ctx.client.from("user_profiles").select("id, wallet_balance").neq("wallet_balance", 0).limit(ctx.cap + 1),
    ctx.cap
  );
  if (nonzero.error) return failedOutcome("C8", nonzero.error);
  if (nonzero.truncated) out.truncated = true;
  const ledgerUserSet = new Set(userIds);
  for (const u of nonzero.rows) {
    if (ledgerUserSet.has(u.id)) continue;
    out.findings.push({
      checkCode: out.checkCode,
      severity: "critical",
      subjectType: "wallet_user",
      subjectId: u.id,
      summary: `Wallet balance ${u.wallet_balance} exists with no ledger history`,
      details: { issue: "balance_without_ledger", walletBalance: u.wallet_balance },
    });
  }

  const byUser = new Map<string, any[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  for (const [userId, userRows] of byUser) {
    const issues: Array<{ issue: string; [k: string]: any }> = [];

    // 1. latest ledger balance vs profile balance
    const last = userRows[userRows.length - 1];
    const profile = profilesById.get(userId);
    if (!profile) {
      // Only trustworthy when the profile fetch covered every ledger user;
      // a truncated fetch could simply have missed this profile.
      if (!profilesTruncated) {
        issues.push({ issue: "missing_profile", latestBalanceAfter: last.balance_after ?? null });
      }
    } else if (last.balance_after !== null && last.balance_after !== undefined &&
      Number(profile.wallet_balance) !== Number(last.balance_after)) {
      issues.push({
        issue: "profile_ledger_mismatch",
        walletBalance: profile.wallet_balance,
        latestLedgerBalance: last.balance_after,
        latestTxnId: last.id,
      });
    }

    // 2 + 3. chain continuity and per-row arithmetic
    let chainBreaks = 0;
    let arithmeticErrors = 0;
    let firstBadTxn: string | null = null;
    let negativeBalance: string | null = null;
    let earliestStartZero = false;
    let sumDelta = 0;
    let sumUsable = false;

    for (let i = 0; i < userRows.length; i++) {
      const r = userRows[i];
      const before = r.balance_before;
      const after = r.balance_after;
      const amount = Number(r.amount ?? 0);

      if (r.status === "success") {
        sumDelta += r.type === "credit" ? amount : -amount;
      }

      if (i === 0 && Number(before) === 0 && before !== null && before !== undefined) earliestStartZero = true;

      if (after !== null && after !== undefined && Number(after) < 0 && !negativeBalance) {
        negativeBalance = r.id;
      }

      if (before !== null && before !== undefined && after !== null && after !== undefined) {
        const expected = r.type === "credit"
          ? Number(before) + amount
          : Number(before) - amount;
        if (Number(after) !== expected) {
          arithmeticErrors++;
          if (!firstBadTxn) firstBadTxn = r.id;
        }
      }

      const next = userRows[i + 1];
      if (!next) continue;
      const sameInstant = String(r.created_at) === String(next.created_at);
      if (sameInstant) continue; // ambiguous order — skip transition
      if (after !== null && after !== undefined &&
        next.balance_before !== null && next.balance_before !== undefined &&
        Number(after) !== Number(next.balance_before)) {
        chainBreaks++;
        if (!firstBadTxn) firstBadTxn = next.id;
      }
    }

    sumUsable = earliestStartZero && !out.truncated;
    const latestBalance = last.balance_after;
    const sumMismatch = sumUsable && latestBalance !== null && latestBalance !== undefined &&
      sumDelta !== Number(latestBalance);

    if (chainBreaks > 0 || arithmeticErrors > 0) {
      issues.push({
        issue: "chain_inconsistency",
        chainBreaks,
        arithmeticErrors,
        firstBadTxnId: firstBadTxn,
        rowsScanned: userRows.length,
      });
    }
    if (negativeBalance) {
      issues.push({ issue: "negative_balance", firstNegativeTxnId: negativeBalance, walletBalance: profile?.wallet_balance ?? null });
    }
    if (sumMismatch) {
      issues.push({
        issue: "sum_mismatch",
        sumCreditsMinusDebits: sumDelta,
        latestLedgerBalance: latestBalance,
        earliestStartedFromZero: earliestStartZero,
      });
    }

    for (const iss of issues) {
      // Every C8 inconsistency is a financial-consistency failure → critical.
      const isNegative = iss.issue === "negative_balance";
      out.findings.push({
        checkCode: out.checkCode,
        severity: "critical",
        subjectType: "wallet_user",
        subjectId: userId,
        summary: isNegative
          ? `Wallet for user ${userId} has a negative balance (${iss.issue})`
          : `Wallet ledger for user ${userId} inconsistent: ${iss.issue}`,
        details: iss,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Correlation: escalate C7 candidates to critical only when their gateway ids
// match a critical C4/C5 financial finding (correlated financial impact).
// ---------------------------------------------------------------------------

function buildCriticalFinancialKeys(candidates: FindingCandidate[]): Set<string> {
  const keys = new Set<string>();
  for (const c of candidates) {
    if (c.severity !== "critical") continue;
    for (const k of CORRELATION_KEYS) {
      const v = c.details?.[k];
      if (typeof v === "string" && v.length > 0) keys.add(v);
    }
  }
  return keys;
}

function applyCorrelation(c7Candidates: FindingCandidate[], keys: Set<string>): void {
  if (keys.size === 0) return;
  for (const c of c7Candidates) {
    const hit = CORRELATION_KEYS.some((k) => {
      const v = c.details?.[k];
      return typeof v === "string" && v.length > 0 && keys.has(v);
    });
    if (hit) c.severity = "critical";
  }
}

// ---------------------------------------------------------------------------
// Merge — persist candidates into reconciliation_findings (the ONLY table
// this service writes besides reconciliation_runs).
// ---------------------------------------------------------------------------
// Per-identity behavior (identity = check_code + subject_type + subject_id):
//   new candidate, no row            -> insert (status open, occurrence 1)
//   candidate matches open row       -> occurrence++, refresh severity/summary/details
//   candidate matches acknowledged   -> occurrence++, keep acknowledged status
//   candidate matches resolved row   -> REOPEN (status open, occurrence++,
//                                       resolved_at/note cleared)
//   open/ack row without candidate   -> stale resolve (only reachable when the
//                                       owning check completed untruncated)
// Failure anywhere throws; the run is then recorded as failed.

const RESOLVE_NOTE = "stale: condition cleared in automated scan";

interface MergeCounts {
  inserted: number;
  resolved: number;
  reopened: number;
}

function findingKey(subjectType: string, subjectId: string): string {
  return `${subjectType}|${subjectId}`;
}

// Deterministic alert identity: findingId:transition:runId. Never a timestamp.
function makeAlert(
  findingId: string,
  transition: AlertTransition,
  runId: string,
  checkCode: string,
  cand: FindingCandidate
): AlertCandidate {
  return {
    findingId,
    transition,
    runId,
    checkCode,
    severity: "critical",
    subjectType: cand.subjectType,
    subjectId: cand.subjectId,
    summary: cand.summary,
    eventKey: `${findingId}:${transition}:${runId}`,
  };
}

function insertRow(checkCode: string, c: FindingCandidate, iso: string) {
  return {
    check_code: checkCode,
    severity: c.severity,
    subject_type: c.subjectType,
    subject_id: c.subjectId,
    summary: c.summary,
    details: c.details,
    status: "open",
    first_detected_at: iso,
    last_detected_at: iso,
    occurrence_count: 1,
  };
}

async function insertOrReopen(
  client: any,
  checkCode: string,
  cand: FindingCandidate,
  iso: string,
  counts: MergeCounts,
  runId: string,
  alerts: AlertCandidate[]
): Promise<void> {
  const { data: insertedData, error } = await client.from("reconciliation_findings")
    .insert(insertRow(checkCode, cand, iso)).select("id");
  if (!error) {
    counts.inserted++;
    const insertedRow = Array.isArray(insertedData) ? insertedData[0] : insertedData;
    if (cand.severity === "critical" && insertedRow?.id) {
      alerts.push(makeAlert(insertedRow.id, "new", runId, checkCode, cand));
    }
    return;
  }
  if ((error as any).code !== "23505") {
    throw new Error(`finding insert failed: ${error.message}`);
  }
  // Identity exists but was outside the preloaded scan — fetch and reopen.
  const { data, error: qErr } = await client.from("reconciliation_findings").select("*")
    .eq("check_code", checkCode)
    .eq("subject_type", cand.subjectType)
    .eq("subject_id", cand.subjectId)
    .single();
  if (qErr || !data) {
    throw new Error(`finding conflict but lookup failed: ${qErr?.message}`);
  }
  // Capture persisted prior state BEFORE the update so the alert transition
  // is derived from old state → new state, never from the new row alone.
  const prevStatus = (data as any).status as string;
  const prevSeverity = (data as any).severity as Severity;
  const { error: upErr } = await client.from("reconciliation_findings").update({
    status: "open",
    severity: cand.severity,
    summary: cand.summary,
    details: cand.details,
    last_detected_at: iso,
    occurrence_count: ((data as any).occurrence_count ?? 1) + 1,
    resolved_at: null,
    resolution_note: null,
  }).eq("id", (data as any).id).select("id");
  if (upErr) throw new Error(`finding reopen failed: ${upErr.message}`);
  counts.reopened++;
  if (cand.severity === "critical" && (data as any).id) {
    if (prevStatus === "resolved") {
      alerts.push(makeAlert((data as any).id, "reopened", runId, checkCode, cand));
    } else if (prevSeverity === "warning" || prevSeverity === "info") {
      alerts.push(makeAlert((data as any).id, "escalated", runId, checkCode, cand));
    }
    // prev critical while open/acknowledged → repeat detection: no alert
  }
}

async function mergeCheck(
  client: any,
  checkCode: string,
  candidates: FindingCandidate[],
  existingForCheck: any[],
  now: Date,
  runId: string,
  alerts: AlertCandidate[]
): Promise<MergeCounts> {
  const counts: MergeCounts = { inserted: 0, resolved: 0, reopened: 0 };
  const iso = now.toISOString();

  const candMap = new Map<string, FindingCandidate>();
  for (const c of candidates) candMap.set(findingKey(c.subjectType, c.subjectId), c);

  const staleIds: string[] = [];

  for (const row of existingForCheck) {
    const key = findingKey(row.subject_type, row.subject_id);
    const cand = candMap.get(key);
    if (!cand) {
      if (row.status === "open" || row.status === "acknowledged") staleIds.push(row.id);
      continue;
    }
    candMap.delete(key);

    if (row.status === "resolved") {
      const { error } = await client.from("reconciliation_findings").update({
        status: "open",
        severity: cand.severity,
        summary: cand.summary,
        details: cand.details,
        last_detected_at: iso,
        occurrence_count: (row.occurrence_count ?? 1) + 1,
        resolved_at: null,
        resolution_note: null,
      }).eq("id", row.id).select("id");
      if (error) throw new Error(`finding reopen failed: ${error.message}`);
      counts.reopened++;
      if (cand.severity === "critical") {
        alerts.push(makeAlert(row.id, "reopened", runId, checkCode, cand));
      }
    } else {
      // open or acknowledged: condition persists; acknowledged stays
      // acknowledged. Capture persisted prior severity BEFORE the update so
      // escalation is derived from old state → new state.
      const prevSeverity = row.severity as Severity;
      const { error } = await client.from("reconciliation_findings").update({
        severity: cand.severity,
        summary: cand.summary,
        details: cand.details,
        last_detected_at: iso,
        occurrence_count: (row.occurrence_count ?? 1) + 1,
      }).eq("id", row.id).select("id");
      if (error) throw new Error(`finding update failed: ${error.message}`);
      if (
        cand.severity === "critical" &&
        (prevSeverity === "warning" || prevSeverity === "info")
      ) {
        // warning|info → critical while still open/acknowledged: one alert.
        // critical remains critical → nothing; critical → warning → nothing.
        alerts.push(makeAlert(row.id, "escalated", runId, checkCode, cand));
      }
    }
  }

  if (staleIds.length > 0) {
    const { error } = await client.from("reconciliation_findings").update({
      status: "resolved",
      resolved_at: iso,
      resolution_note: RESOLVE_NOTE,
    }).in("id", staleIds).select("id");
    if (error) throw new Error(`stale resolve failed: ${error.message}`);
    counts.resolved = staleIds.length;
  }

  const remaining = Array.from(candMap.values());
  if (remaining.length > 0) {
    const rows = remaining.map((c) => insertRow(checkCode, c, iso));
    const { data: insertedRows, error } = await client.from("reconciliation_findings")
      .insert(rows).select("id,subject_type,subject_id");
    if (!error) {
      counts.inserted += remaining.length;
      for (const r of Array.isArray(insertedRows) ? insertedRows : []) {
        const c = candMap.get(findingKey(r.subject_type, r.subject_id));
        if (c && c.severity === "critical") {
          alerts.push(makeAlert(r.id, "new", runId, checkCode, c));
        }
      }
    } else if ((error as any).code === "23505") {
      for (const c of remaining) await insertOrReopen(client, checkCode, c, iso, counts, runId, alerts);
    } else {
      throw new Error(`finding insert failed: ${error.message}`);
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// runReconciliation — orchestrate one full scan
// ---------------------------------------------------------------------------
// Guarantees:
//   - writes only reconciliation_runs + reconciliation_findings
//     (alertCandidates is in-memory only; dispatch writes happen later in
//      reconciliation-alerts.ts and are isolated from this guarantee)
//   - a check that failed or was truncated produces NO finding writes at all
//     (its pre-existing findings stay exactly as they were)
//   - check_results records per-check success/failed/truncated so partial
//     scans are observable
//   - failed/truncated checks also emit NO alert candidates (merge never
//     runs for them)

const CHECK_IDS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];
const FINDING_SCAN_LIMIT = 10000;

export async function runReconciliation(opts: RunReconciliationOptions): Promise<RunSummary> {
  const client = opts.client;
  const now = opts.now ?? new Date();
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let gateway: GatewayClient | null = opts.gateway ?? null;
  let gatewayError: string | null = null;
  if (!gateway) {
    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    if (keyId && keySecret) gateway = new RazorpayGatewayClient(keyId, keySecret);
    else gatewayError = "gateway not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)";
  }
  const summary: RunSummary = {
    runId: null,
    status: "success",
    trigger: opts.trigger,
    checkResults: {},
    findingsOpen: 0,
    findingsNew: 0,
    findingsResolved: 0,
    findingsReopened: 0,
    failedChecks: [],
    truncatedChecks: [],
    alertCandidates: [],
  };

  const thresholds = await loadThresholds(client);
  const ctx: Ctx = { client, thresholds, cap: thresholds.maxFindingsPerCheck, now };

  const { data: runRow, error: runErr } = await client.from("reconciliation_runs")
    .insert({
      trigger_source: opts.trigger,
      started_at: now.toISOString(),
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !runRow) {
    summary.status = "failed";
    summary.error = `failed to insert run: ${runErr?.message ?? "no row returned"}`;
    return summary;
  }
  summary.runId = runRow.id;

  try {
    const outcomes: CheckOutcome[] = [];
    outcomes.push(await checkC1(ctx));
    outcomes.push(await checkC2(ctx));
    outcomes.push(await checkC3(ctx));
    outcomes.push(await checkC4(ctx));
    outcomes.push(await checkC5(ctx));

    // C6 subjects are this run's C1-C4 candidates.
    outcomes.push(
      await checkC6(ctx, [outcomes[0], outcomes[1], outcomes[2], outcomes[3]], gateway, gatewayError, sleep)
    );

    // Correlation keys come from critical C4/C5 candidates (post-dedupe).
    const c4c5 = [
      ...dedupeFindings(outcomes[3].findings),
      ...dedupeFindings(outcomes[4].findings),
    ];
    const criticalKeys = buildCriticalFinancialKeys(c4c5);
    const c7Outcome = await checkC7(ctx, criticalKeys);
    applyCorrelation(c7Outcome.findings, criticalKeys);
    outcomes.push(c7Outcome);

    outcomes.push(await checkC8(ctx));

    const candidatesByCode = new Map<string, FindingCandidate[]>();
    for (const o of outcomes) {
      for (const c of dedupeFindings(o.findings)) {
        const arr = candidatesByCode.get(c.checkCode) ?? [];
        arr.push(c);
        candidatesByCode.set(c.checkCode, arr);
      }
    }

    const existingRes = await fetchAll(
      client.from("reconciliation_findings").select("*")
        .in("check_code", [...Object.values(CHECK_CODES), ...C6_OWNED_CODES])
        .limit(FINDING_SCAN_LIMIT + 1),
      FINDING_SCAN_LIMIT
    );
    if (existingRes.error) throw new Error(`failed to load existing findings: ${existingRes.error}`);
    const existingByCheck = new Map<string, any[]>();
    for (const row of existingRes.rows) {
      if (!existingByCheck.has(row.check_code)) existingByCheck.set(row.check_code, []);
      existingByCheck.get(row.check_code)!.push(row);
    }

    for (const o of outcomes) {
      const codes = o.checkId === "C6" ? [...C6_OWNED_CODES] : [o.checkCode];
      const status: CheckStatus = !o.completed ? "failed" : o.truncated ? "truncated" : "success";
      let findingCount = 0;
      for (const code of codes) findingCount += (candidatesByCode.get(code) ?? []).length;
      summary.checkResults[o.checkId] = {
        status,
        findings: findingCount,
        ...(o.error ? { error: o.error } : {}),
        ...(o.meta ? { meta: o.meta } : {}),
      };
      if (status !== "success") continue; // failed/truncated: zero writes across all owned codes

      for (const code of codes) {
        const cands = candidatesByCode.get(code) ?? [];
        const counts = await mergeCheck(
          client, code, cands, existingByCheck.get(code) ?? [], now,
          summary.runId ?? "", summary.alertCandidates
        );
        summary.findingsNew += counts.inserted;
        summary.findingsResolved += counts.resolved;
        summary.findingsReopened += counts.reopened;
      }
    }

    const openRes: any = await client.from("reconciliation_findings")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    if (openRes && !openRes.error && typeof openRes.count === "number") {
      summary.findingsOpen = openRes.count;
    }

    const allFailed = outcomes.every((o) => !o.completed);
    if (allFailed) {
      summary.status = "failed";
      summary.error = summary.error ?? "all checks failed";
    }
  } catch (e: any) {
    summary.status = "failed";
    summary.error = String(e?.message ?? e);
  }

  // Derived operator-facing view of partial outcomes — set on every path so a
  // completed run can never be mistaken for "all checks succeeded".
  summary.failedChecks = CHECK_IDS.filter((id) => summary.checkResults[id]?.status === "failed");
  summary.truncatedChecks = CHECK_IDS.filter((id) => summary.checkResults[id]?.status === "truncated");

  const { error: finErr } = await client.from("reconciliation_runs").update({
    finished_at: new Date().toISOString(),
    status: summary.status,
    checks_run: CHECK_IDS,
    findings_open: summary.findingsOpen,
    findings_new: summary.findingsNew,
    findings_resolved: summary.findingsResolved,
    check_results: summary.checkResults,
    error: summary.error ?? null,
  }).eq("id", summary.runId);
  if (finErr) {
    summary.status = "failed";
    summary.error = summary.error ?? `failed to finalize run: ${finErr.message}`;
  }

  return summary;
}
