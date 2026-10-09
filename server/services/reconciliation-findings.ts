// ============================================================================
// Reconciliation findings admin service — Phase 3B-5a
// ============================================================================
// Read/transition operations for reconciliation_findings + run summaries:
//   - listFindings      whitelist filters, exact RPC-backed counts (degrades
//                       to total:null/counts:null on RPC failure — the
//                       paginated list is the primary operation), camelCase rows
//   - transitionFinding acknowledge/resolve/reopen with optimistic CAS,
//                       idempotent re-acknowledge (original attribution
//                       preserved, no audit row), lifecycle audits
//   - listRuns          recent reconciliation_runs for the ops strip
//
// Server-mediated only (tables are service-role RLS, no policies). No
// financial-table access of any kind; audits follow the 3B-4 pattern where
// audit failure never alters the response.
// ============================================================================

export const FINDING_STATUSES = ["open", "acknowledged", "resolved"] as const;
export const FINDING_SEVERITIES = ["info", "warning", "critical"] as const;
export const FINDING_SUBJECT_TYPES = [
  "payment",
  "refund",
  "order",
  "webhook_event",
  "wallet_user",
] as const;

export const MAX_NOTE_LEN = 500;
export const MAX_Q_LEN = 200;
export const MAX_FINDINGS_LIMIT = 100;
export const DEFAULT_FINDINGS_LIMIT = 50;
export const DEFAULT_RUNS_LIMIT = 10;
export const MAX_RUNS_LIMIT = 50;

export type TransitionAction = "acknowledge" | "resolve" | "reopen";

export const FINDING_AUDIT_ACTIONS: Record<TransitionAction, string> = {
  acknowledge: "reconciliation.finding_acknowledged",
  resolve: "reconciliation.finding_resolved",
  reopen: "reconciliation.finding_reopened",
};

// q whitelist (admin search box): alphanumeric, space, underscore, dot, colon,
// slash, @, #, hyphen — covers gateway ids (evt_..., pay_..., re_...) and
// UUIDs. Anything else (PostgREST .or() structure chars, LIKE wildcards %*,
// backslash, parentheses, commas) is REJECTED, never silently stripped.
const Q_ALLOWED = /^[A-Za-z0-9 _./:@#-]+$/;
const CHECK_CODE_ALLOWED = /^[A-Za-z0-9_]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class FindingsError extends Error {
  code: string;
  status: number;
  extra?: Record<string, any>;

  constructor(code: string, status: number, extra?: Record<string, any>) {
    super(code);
    this.name = "FindingsError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

function fail(code: string, status: number, extra?: Record<string, any>): never {
  throw new FindingsError(code, status, extra);
}

// Identical escape chain to the frozen 00067 RPC (backslash first, then %,
// then _), so list-side PostgREST patterns and RPC-side SQL patterns match
// byte-for-byte — underscore-containing q (e.g. pay_...) means a LITERAL
// underscore on both paths.
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export interface FindingCounts {
  byStatus: { open: number; acknowledged: number; resolved: number };
  bySeverity: { info: number; warning: number; critical: number };
}

export interface FindingsListResult {
  items: any[];
  total: number | null;
  counts: FindingCounts | null;
}

export interface FindingsListParams {
  status?: string | number;
  severity?: string | number;
  checkCode?: string | number;
  subjectType?: string | number;
  q?: string | number;
  limit?: string | number;
  offset?: string | number;
}

interface ValidatedListParams {
  status?: string;
  severity?: string;
  checkCode?: string;
  subjectType?: string;
  q?: string;
  limit: number;
  offset: number;
}

function parseBoundedInt(raw: string | number | undefined, dflt: number, min: number, max: number): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") return dflt;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

function validateListParams(params: FindingsListParams): ValidatedListParams {
  const out: ValidatedListParams = {
    limit: parseBoundedInt(params.limit, DEFAULT_FINDINGS_LIMIT, 1, MAX_FINDINGS_LIMIT),
    offset: parseBoundedInt(params.offset, 0, 0, Number.MAX_SAFE_INTEGER),
  };

  const status = params.status === undefined || params.status === null ? undefined : String(params.status);
  if (status !== undefined && status !== "" && !(FINDING_STATUSES as readonly string[]).includes(status)) {
    fail("invalid_filter", 400);
  }
  if (status) out.status = status;

  const severity = params.severity === undefined || params.severity === null ? undefined : String(params.severity);
  if (severity !== undefined && severity !== "" && !(FINDING_SEVERITIES as readonly string[]).includes(severity)) {
    fail("invalid_filter", 400);
  }
  if (severity) out.severity = severity;

  const subjectType = params.subjectType === undefined || params.subjectType === null ? undefined : String(params.subjectType);
  if (subjectType !== undefined && subjectType !== "" && !(FINDING_SUBJECT_TYPES as readonly string[]).includes(subjectType)) {
    fail("invalid_filter", 400);
  }
  if (subjectType) out.subjectType = subjectType;

  const checkCode = params.checkCode === undefined || params.checkCode === null ? undefined : String(params.checkCode).trim();
  if (checkCode) {
    if (!CHECK_CODE_ALLOWED.test(checkCode)) fail("invalid_filter", 400);
    out.checkCode = checkCode;
  }

  const q = params.q === undefined || params.q === null ? "" : String(params.q).trim();
  if (q) {
    if (q.length > MAX_Q_LEN || !Q_ALLOWED.test(q)) fail("invalid_filter", 400);
    out.q = q;
  }

  return out;
}

export function mapFinding(row: any) {
  return {
    id: row.id,
    checkCode: row.check_code,
    severity: row.severity,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    summary: row.summary,
    details: row.details ?? {},
    status: row.status,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
    occurrenceCount: row.occurrence_count,
    resolvedAt: row.resolved_at ?? null,
    resolutionNote: row.resolution_note ?? null,
    acknowledgedAt: row.acknowledged_at ?? null,
    acknowledgedBy: row.acknowledged_by ?? null,
    resolvedBy: row.resolved_by ?? null,
    createdAt: row.created_at,
  };
}

export function mapRun(row: any) {
  const checkResults = row.check_results ?? {};
  const failedChecks: string[] = [];
  const truncatedChecks: string[] = [];
  for (const key of Object.keys(checkResults).sort()) {
    const st = checkResults[key]?.status;
    if (st === "failed") failedChecks.push(key);
    else if (st === "truncated") truncatedChecks.push(key);
  }
  return {
    id: row.id,
    trigger: row.trigger_source,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    failedChecks,
    truncatedChecks,
    findingsOpen: row.findings_open,
    findingsNew: row.findings_new,
    findingsResolved: row.findings_resolved,
    error: row.error ?? null,
  };
}

// ---------------------------------------------------------------------------
// listFindings — paginated rows + exact RPC counts
// ---------------------------------------------------------------------------
// Counts come from the service-role-only aggregate RPC (exact, never a
// truncation-prone row scan). The list is primary: if the RPC fails for any
// reason the endpoint still returns 200 with total:null / counts:null.
export async function listFindings(client: any, params: FindingsListParams): Promise<FindingsListResult> {
  const f = validateListParams(params);

  let query: any = client.from("reconciliation_findings").select("*");
  if (f.status) query = query.eq("status", f.status);
  if (f.severity) query = query.eq("severity", f.severity);
  if (f.checkCode) query = query.eq("check_code", f.checkCode);
  if (f.subjectType) query = query.eq("subject_type", f.subjectType);
  if (f.q) {
    const pattern = `*${escapeLike(f.q)}*`;
    query = query.or(`summary.ilike.${pattern},subject_id.ilike.${pattern}`);
  }
  query = query
    .order("last_detected_at", { ascending: false })
    .order("id", { ascending: false })
    .range(f.offset, f.offset + f.limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(`findings list failed: ${error.message}`);

  let total: number | null = null;
  let counts: FindingCounts | null = null;
  try {
    const { data: countRows, error: countErr } = await client.rpc("get_reconciliation_finding_counts", {
      p_status: f.status ?? null,
      p_severity: f.severity ?? null,
      p_check_code: f.checkCode ?? null,
      p_subject_type: f.subjectType ?? null,
      p_q: f.q ?? null,
    });
    if (!countErr && countRows) {
      const c = Array.isArray(countRows) ? countRows[0] : countRows;
      if (c && c.total !== undefined && c.total !== null) {
        total = Number(c.total);
        counts = {
          byStatus: {
            open: Number(c.open ?? 0),
            acknowledged: Number(c.acknowledged ?? 0),
            resolved: Number(c.resolved ?? 0),
          },
          bySeverity: {
            info: Number(c.info ?? 0),
            warning: Number(c.warning ?? 0),
            critical: Number(c.critical ?? 0),
          },
        };
      }
    }
  } catch {
    // Counts are best-effort: degrade to nulls, never fail the list.
    total = null;
    counts = null;
  }

  return { items: (data ?? []).map(mapFinding), total, counts };
}

// ---------------------------------------------------------------------------
// listRuns — recent run summaries for the ops strip
// ---------------------------------------------------------------------------
export async function listRuns(client: any, limitRaw?: string | number): Promise<{ items: any[] }> {
  const limit = parseBoundedInt(limitRaw, DEFAULT_RUNS_LIMIT, 1, MAX_RUNS_LIMIT);
  const { data, error } = await client
    .from("reconciliation_runs")
    .select(
      "id, trigger_source, status, started_at, finished_at, check_results, findings_open, findings_new, findings_resolved, error"
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`runs list failed: ${error.message}`);
  return { items: (data ?? []).map(mapRun) };
}

// ---------------------------------------------------------------------------
// transitionFinding — acknowledge / resolve / reopen (optimistic CAS)
// ---------------------------------------------------------------------------
export interface TransitionOpts {
  findingId: string;
  action: TransitionAction;
  initiatorId: string | null;
  note?: string | null;
}

export interface TransitionResult {
  finding: ReturnType<typeof mapFinding>;
  changed: boolean;
  fromStatus: string | null;
}

function normalizeNote(note: unknown, required: boolean): string | null {
  if (note === undefined || note === null) {
    if (required) fail("invalid_note", 400);
    return null;
  }
  if (typeof note !== "string") fail("invalid_note", 400);
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    if (required) fail("invalid_note", 400);
    return null;
  }
  if (trimmed.length > MAX_NOTE_LEN) fail("invalid_note", 400);
  return trimmed;
}

async function fetchFinding(client: any, id: string): Promise<any> {
  const { data, error } = await client
    .from("reconciliation_findings")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) fail("finding_not_found", 404);
  return data;
}

function conflictWith(current: any): never {
  fail("finding_state_conflict", 409, {
    currentStatus: current.status,
    finding: mapFinding(current),
  });
}

function pickUpdated(data: any): any | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

async function auditTransition(
  client: any,
  action: TransitionAction,
  fromStatus: string,
  row: any,
  initiatorId: string | null,
  note: string | null
): Promise<void> {
  // Audit failure never alters the response (3B-4 contract).
  try {
    const res = await client.from("audit_logs").insert({
      user_id: initiatorId ?? null,
      action: FINDING_AUDIT_ACTIONS[action],
      resource: "reconciliation_findings",
      details: {
        finding_id: row.id,
        from_status: fromStatus,
        to_status: row.status,
        check_code: row.check_code,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        ...(note ? { note } : {}),
      },
    });
    if (res?.error) {
      console.error(
        `[reconciliation-findings] ${action} audit failed:`,
        res.error.message
      );
    }
  } catch (e: any) {
    console.error(
      `[reconciliation-findings] ${action} audit failed:`,
      String(e?.message ?? e)
    );
  }
}

export async function transitionFinding(
  client: any,
  opts: TransitionOpts
): Promise<TransitionResult> {
  if (!UUID_RE.test(String(opts.findingId))) fail("invalid_id", 400);
  const id = String(opts.findingId);
  const note = normalizeNote(opts.note, opts.action === "resolve");
  const nowIso = new Date().toISOString();

  const current = await fetchFinding(client, id);

  if (opts.action === "acknowledge") {
    // Idempotent re-acknowledge: keep the FIRST acknowledgement attribution,
    // ignore the repeat note, write no audit row.
    if (current.status === "acknowledged") {
      return { finding: mapFinding(current), changed: false, fromStatus: null };
    }
    if (current.status !== "open") conflictWith(current);

    const { data, error } = await client
      .from("reconciliation_findings")
      .update({
        status: "acknowledged",
        acknowledged_at: nowIso,
        acknowledged_by: opts.initiatorId ?? null,
      })
      .eq("id", id)
      .eq("status", "open")
      .select("*");
    if (error) throw new Error(`acknowledge failed: ${error.message}`);
    const updated = pickUpdated(data);
    if (!updated) {
      // Lost a race: re-read and classify.
      const latest = await fetchFinding(client, id);
      if (latest.status === "acknowledged") {
        return { finding: mapFinding(latest), changed: false, fromStatus: null };
      }
      conflictWith(latest);
    }
    await auditTransition(client, "acknowledge", "open", updated, opts.initiatorId, note);
    return { finding: mapFinding(updated), changed: true, fromStatus: "open" };
  }

  if (opts.action === "resolve") {
    if (current.status === "resolved") conflictWith(current);
    const fromStatus = current.status;

    const { data, error } = await client
      .from("reconciliation_findings")
      .update({
        status: "resolved",
        resolved_at: nowIso,
        resolution_note: note,
        resolved_by: opts.initiatorId ?? null,
      })
      .eq("id", id)
      .in("status", ["open", "acknowledged"])
      .select("*");
    if (error) throw new Error(`resolve failed: ${error.message}`);
    const updated = pickUpdated(data);
    if (!updated) {
      const latest = await fetchFinding(client, id);
      conflictWith(latest);
    }
    await auditTransition(client, "resolve", fromStatus, updated, opts.initiatorId, note);
    return { finding: mapFinding(updated), changed: true, fromStatus };
  }

  // reopen
  if (current.status !== "resolved") conflictWith(current);

  const { data, error } = await client
    .from("reconciliation_findings")
    .update({
      status: "open",
      resolved_at: null,
      resolution_note: null,
      resolved_by: null,
      acknowledged_at: null,
      acknowledged_by: null,
    })
    .eq("id", id)
    .eq("status", "resolved")
    .select("*");
  if (error) throw new Error(`reopen failed: ${error.message}`);
  const updated = pickUpdated(data);
  if (!updated) {
    const latest = await fetchFinding(client, id);
    conflictWith(latest);
  }
  await auditTransition(client, "reopen", "resolved", updated, opts.initiatorId, note);
  return { finding: mapFinding(updated), changed: true, fromStatus: "resolved" };
}
