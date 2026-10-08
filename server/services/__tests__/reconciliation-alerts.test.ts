import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { dispatchReconciliationAlerts } from "../reconciliation-alerts";
import type { AlertCandidate } from "../reconciliation-service";

// ============================================================================
// Dispatcher-only harness (Phase 3B-3)
// ============================================================================
// Purpose-built fake for the exact query surface dispatchReconciliationAlerts
// uses: select+in, insert+select, update+eq+select, thenable resolution.
// Unique on reconciliation_alerts.alert_event_key (23505), and per-table
// failure injection with an optional op filter so a single channel can fail
// without taking the whole table down.

type Row = Record<string, any>;

class Ddb {
  tables = new Map<string, Row[]>();
  failures = new Map<string, { message: string; code?: string; op?: string }>();

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  fail(table: string, message = "injected query failure", code = "XX000", op?: string) {
    this.failures.set(table, { message, code, op });
  }
}

type DFilter = { type: "eq" | "in"; col: string; val: any };

class DQuery implements PromiseLike<any> {
  private op: "select" | "insert" | "update" = "select";
  private filters: DFilter[] = [];
  private payload: any = null;

  constructor(private db: Ddb, private table: string) {}

  select(_cols?: string) { return this; }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = rows; return this; }
  update(patch: Row) { this.op = "update"; this.payload = patch; return this; }
  eq(col: string, val: any) { this.filters.push({ type: "eq", col, val }); return this; }
  in(col: string, val: any[]) { this.filters.push({ type: "in", col, val }); return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    for (const f of this.filters) {
      const v = row[f.col];
      if (f.type === "eq" && v !== f.val) return false;
      if (f.type === "in" && (!Array.isArray(f.val) || !f.val.includes(v))) return false;
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
      if (this.table === "reconciliation_alerts") {
        for (const r of incoming) {
          if (rows.some((e) => e.alert_event_key === r.alert_event_key)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
        }
      }
      const inserted = incoming.map((r) => {
        const row = { id: randomUUID(), dispatched_at: this.table === "reconciliation_alerts" ? new Date().toISOString() : undefined, ...r };
        rows.push(row);
        return row;
      });
      return { data: inserted, error: null };
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.matches(r));
      for (const r of matched) Object.assign(r, this.payload);
      return { data: matched, error: null };
    }

    return { data: rows.filter((r) => this.matches(r)), error: null };
  }
}

function ddbClient(db: Ddb) {
  return { from: (table: string) => new DQuery(db, table) };
}

function makeCand(overrides: Partial<AlertCandidate> = {}): AlertCandidate {
  const findingId = overrides.findingId ?? randomUUID();
  const runId = overrides.runId ?? randomUUID();
  const transition = overrides.transition ?? "new";
  return {
    findingId,
    transition,
    runId,
    checkCode: "payment_stuck_uncertain",
    severity: "critical",
    subjectType: "payment",
    subjectId: randomUUID(),
    summary: "Payment x stuck in created for 1500m",
    ...overrides,
    eventKey: overrides.eventKey ?? `${findingId}:${transition}:${runId}`,
  };
}

const WEBHOOK_URL = "https://hooks.test/recon-alerts";
const WEBHOOK_SECRET = "whsec_unit_test_value";

function withEnv(
  url: string | undefined,
  secret: string | undefined,
  fn: () => Promise<void>
): Promise<void> {
  const savedUrl = process.env.RECON_ALERT_WEBHOOK_URL;
  const savedSecret = process.env.RECON_ALERT_WEBHOOK_SECRET;
  if (url === undefined) delete process.env.RECON_ALERT_WEBHOOK_URL;
  else process.env.RECON_ALERT_WEBHOOK_URL = url;
  if (secret === undefined) delete process.env.RECON_ALERT_WEBHOOK_SECRET;
  else process.env.RECON_ALERT_WEBHOOK_SECRET = secret;
  return fn().finally(() => {
    if (savedUrl === undefined) delete process.env.RECON_ALERT_WEBHOOK_URL;
    else process.env.RECON_ALERT_WEBHOOK_URL = savedUrl;
    if (savedSecret === undefined) delete process.env.RECON_ALERT_WEBHOOK_SECRET;
    else process.env.RECON_ALERT_WEBHOOK_SECRET = savedSecret;
  });
}

const admin = { id: randomUUID(), role: "admin" };
const superadmin = { id: randomUUID(), role: "superadmin" };
const customer = { id: randomUUID(), role: "customer" };

function persisted(db: Ddb): string {
  return JSON.stringify(db.rows("audit_logs")) + JSON.stringify(db.rows("reconciliation_alerts"));
}

describe("dispatchReconciliationAlerts", () => {
  it("zero candidates: zero stats, no writes, no recipients query", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      const client = ddbClient(db);

      const stats = await dispatchReconciliationAlerts({ client, candidates: [] });

      expect(stats).toEqual({
        candidates: 0,
        recipients: 0,
        inAppSent: 0,
        inAppFailed: 0,
        webhook: "disabled",
        webhookFailed: 0,
        skippedDuplicates: 0,
        dispatchErrors: [],
      });
      expect(db.rows("reconciliation_alerts")).toHaveLength(0);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs")).toHaveLength(0);
      expect(db.rows("user_profiles")).toHaveLength(0);
    });
  });

  it("resolves admin+superadmin only, dispatches in-app + audit with disabled webhook", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin, superadmin, customer, { id: randomUUID(), role: "vendor" });
      const ev = makeCand();

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [ev] });

      expect(stats).toMatchObject({
        candidates: 1,
        recipients: 2,
        inAppSent: 2,
        inAppFailed: 0,
        webhook: "disabled",
        webhookFailed: 0,
        skippedDuplicates: 0,
      });
      expect(stats.dispatchErrors).toEqual([]);

      const ledger = db.rows("reconciliation_alerts");
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({
        finding_id: ev.findingId,
        alert_event_key: ev.eventKey,
        transition: "new",
        run_id: ev.runId,
        check_code: ev.checkCode,
        severity: "critical",
        subject_type: ev.subjectType,
        subject_id: ev.subjectId,
      });
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
      expect(notes.map((n) => n.user_id).sort()).toEqual([admin.id, superadmin.id].sort());
      expect(notes[0]).toMatchObject({
        type: "recon_alert",
        channel: "push",
        title: "New critical reconciliation finding",
      });
      expect(notes[0].body).toContain("payment_stuck_uncertain");

      const audits = db.rows("audit_logs").filter((a) => a.action === "reconciliation.alert_dispatched");
      expect(audits).toHaveLength(1);
      expect(audits[0].user_id).toBeNull();
      expect(audits[0].details).toMatchObject({
        finding_id: ev.findingId,
        alert_event_key: ev.eventKey,
        recipients: 2,
        inAppSent: 2,
        inAppFailed: 0,
        webhook: "disabled",
      });
    });
  });

  it("multiple candidates: stats aggregate, one ledger row + one audit per event", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin, superadmin);
      const a = makeCand();
      const b = makeCand({ transition: "reopened" });

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [a, b] });

      expect(stats).toMatchObject({ candidates: 2, recipients: 2, inAppSent: 4, inAppFailed: 0, webhook: "disabled" });
      expect(db.rows("reconciliation_alerts")).toHaveLength(2);
      expect(db.rows("notifications")).toHaveLength(4);
      expect(db.rows("audit_logs").filter((x) => x.action === "reconciliation.alert_dispatched")).toHaveLength(2);
    });
  });

  it("duplicate ledger reservation (23505): skipped, zero downstream writes", async () => {
    await withEnv(WEBHOOK_URL, WEBHOOK_SECRET, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin, superadmin);
      const ev = makeCand();
      db.rows("reconciliation_alerts").push({ id: randomUUID(), alert_event_key: ev.eventKey });
      const fetchMock = vi.fn();

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [ev],
        fetchImpl: fetchMock as any,
      });

      expect(stats.skippedDuplicates).toBe(1);
      expect(stats.dispatchErrors).toEqual([]);
      expect(db.rows("reconciliation_alerts")).toHaveLength(1);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs")).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("non-critical candidate is filtered before the ledger", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [makeCand({ severity: "warning" })],
      });

      expect(stats).toMatchObject({ candidates: 1, recipients: 1, inAppSent: 0, skippedDuplicates: 0 });
      expect(stats.dispatchErrors).toEqual([]);
      expect(db.rows("reconciliation_alerts")).toHaveLength(0);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs")).toHaveLength(0);
    });
  });

  it("recipients query failure is surfaced, events still reserve + audit (webhook disabled)", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      db.fail("user_profiles", "role table unreachable");

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [makeCand()] });

      expect(stats.dispatchErrors.some((e) => e.includes("recipients query failed"))).toBe(true);
      expect(stats.recipients).toBe(0);
      expect(stats.inAppSent).toBe(0);
      expect(stats.inAppFailed).toBe(0);
      expect(db.rows("reconciliation_alerts")).toHaveLength(1);
      const audit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_dispatched");
      expect(audit?.details).toMatchObject({ recipients: 0, inAppSent: 0, webhook: "disabled" });
    });
  });

  it("ledger reserve failure (non-23505): error surfaced, zero downstream writes", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      db.fail("reconciliation_alerts", "constraint plumbing down", "XX000");

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [makeCand()] });

      expect(stats.dispatchErrors.some((e) => e.includes("ledger reserve failed"))).toBe(true);
      expect(db.rows("notifications")).toHaveLength(0);
      expect(db.rows("audit_logs")).toHaveLength(0);
    });
  });

  it("notifications batch failure: counted as inAppFailed, ledger + audit survive, never throws", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin, superadmin);
      db.fail("notifications", "push table down");

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [makeCand()] });

      expect(stats.inAppSent).toBe(0);
      expect(stats.inAppFailed).toBe(2);
      expect(stats.dispatchErrors).toEqual([]);
      expect(db.rows("reconciliation_alerts")).toHaveLength(1);
      expect(db.rows("reconciliation_alerts")[0].delivery).toMatchObject({ inAppFailed: 2 });
      const audit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_dispatched");
      expect(audit?.details).toMatchObject({ inAppSent: 0, inAppFailed: 2 });
    });
  });

  it("audit insert failure: surfaced in dispatchErrors, dispatch itself completed", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      db.fail("audit_logs", "audit sink down");

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [makeCand()] });

      expect(stats.dispatchErrors.some((e) => e.includes("dispatch audit failed"))).toBe(true);
      expect(stats.inAppSent).toBe(1);
      expect(db.rows("reconciliation_alerts")).toHaveLength(1);
      expect(db.rows("audit_logs")).toHaveLength(0);
    });
  });

  it("delivery update failure: surfaced, best-effort by design, never throws", async () => {
    await withEnv(undefined, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      db.fail("reconciliation_alerts", "update path down", "XX000", "update");

      const stats = await dispatchReconciliationAlerts({ client: ddbClient(db), candidates: [makeCand()] });

      expect(stats.dispatchErrors.some((e) => e.includes("delivery update failed"))).toBe(true);
      expect(stats.inAppSent).toBe(1);
      expect(db.rows("reconciliation_alerts")).toHaveLength(1);
      expect(db.rows("reconciliation_alerts")[0].delivery).toBeUndefined();
      const audit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_dispatched");
      expect(audit).toBeTruthy();
    });
  });

  it("webhook success: single attempt, HMAC signature, exact payload, no URL/secret persisted", async () => {
    await withEnv(WEBHOOK_URL, WEBHOOK_SECRET, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      const ev = makeCand();
      const fetchMock = vi.fn(async (_url: any, _init: any) => ({ ok: true, status: 200 }));

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [ev],
        fetchImpl: fetchMock as any,
      });

      expect(stats).toMatchObject({ webhook: "sent", webhookFailed: 0, inAppSent: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(WEBHOOK_URL);
      expect(init.method).toBe("POST");
      expect(init.headers["content-type"]).toBe("application/json");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      const expectedSig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(init.body).digest("hex");
      expect(init.headers["x-recon-alert-signature"]).toBe(expectedSig);
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        v: 1,
        eventKey: ev.eventKey,
        transition: "new",
        runId: ev.runId,
        findingId: ev.findingId,
        checkCode: ev.checkCode,
        severity: "critical",
        subjectType: "payment",
        subjectId: ev.subjectId,
        summary: ev.summary,
      });
      const audit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_dispatched");
      expect(audit?.details).toMatchObject({ webhook: "sent" });
      expect(db.rows("reconciliation_alerts")[0].delivery).toMatchObject({ webhook: "sent" });
      expect(persisted(db)).not.toContain(WEBHOOK_URL);
      expect(persisted(db)).not.toContain(WEBHOOK_SECRET);
    });
  });

  it("webhook without secret: sent with no signature header", async () => {
    await withEnv(WEBHOOK_URL, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      const fetchMock = vi.fn(async (_url: any, _init: any) => ({ ok: true, status: 200 }));

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [makeCand()],
        fetchImpl: fetchMock as any,
      });

      expect(stats.webhook).toBe("sent");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers["x-recon-alert-signature"]).toBeUndefined();
    });
  });

  it("webhook 500: exactly one attempt, http_5xx failure audit with exact metadata, never throws", async () => {
    await withEnv(WEBHOOK_URL, WEBHOOK_SECRET, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      const ev = makeCand();
      const fetchMock = vi.fn(async (_url: any, _init: any) => ({ ok: false, status: 500 }));

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [ev],
        fetchImpl: fetchMock as any,
      });

      expect(stats.webhook).toBe("failed");
      expect(stats.webhookFailed).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1); // no retries, ever

      const failAudit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_webhook_failed");
      expect(failAudit).toBeTruthy();
      expect(failAudit!.details).toMatchObject({
        finding_id: ev.findingId,
        alert_event_key: ev.eventKey,
        http_status: 500,
        error_class: "http_5xx",
      });
      expect(failAudit!.details.attempted_at).toBeTruthy();
      const dispatched = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_dispatched");
      expect(dispatched?.details).toMatchObject({ webhook: "failed" });
      expect(persisted(db)).not.toContain(WEBHOOK_URL);
      expect(persisted(db)).not.toContain(WEBHOOK_SECRET);
    });
  });

  it("webhook 404: classified http_4xx", async () => {
    await withEnv(WEBHOOK_URL, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      const fetchMock = vi.fn(async (_url: any, _init: any) => ({ ok: false, status: 404 }));

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [makeCand()],
        fetchImpl: fetchMock as any,
      });

      expect(stats.webhook).toBe("failed");
      const failAudit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_webhook_failed");
      expect(failAudit!.details).toMatchObject({ http_status: 404, error_class: "http_4xx" });
    });
  });

  it("webhook network error: classified network, http_status null, one attempt", async () => {
    await withEnv(WEBHOOK_URL, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      const fetchMock = vi.fn(async (_url: any, _init: any) => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:443");
      });

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [makeCand()],
        fetchImpl: fetchMock as any,
      });

      expect(stats.webhook).toBe("failed");
      expect(stats.webhookFailed).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const failAudit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_webhook_failed");
      expect(failAudit!.details).toMatchObject({ http_status: null, error_class: "network" });
    });
  });

  it("webhook abort (timeout classification): AbortError => timeout, still one attempt", async () => {
    await withEnv(WEBHOOK_URL, undefined, async () => {
      const db = new Ddb();
      db.rows("user_profiles").push(admin);
      const fetchMock = vi.fn((_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          // the 5s AbortController fires -> real fetch rejects with AbortError
          const err: any = new Error("The operation was aborted");
          err.name = "AbortError";
          if (init?.signal) init.signal.addEventListener("abort", () => reject(err));
          else reject(err);
        })
      );

      const stats = await dispatchReconciliationAlerts({
        client: ddbClient(db),
        candidates: [makeCand()],
        fetchImpl: fetchMock as any,
      });

      // dispatch resolves only after its 5s AbortController fires and the
      // AbortError is classified — no manual sleep needed
      expect(stats.webhook).toBe("failed");
      expect(stats.webhookFailed).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const failAudit = db.rows("audit_logs").find((a) => a.action === "reconciliation.alert_webhook_failed");
      expect(failAudit!.details).toMatchObject({ http_status: null, error_class: "timeout" });
    });
  }, 15000);

  it("client explosion: resolves with dispatchErrors, never throws", async () => {
    await withEnv(undefined, undefined, async () => {
      const exploding = { from: (_table: string) => { throw new Error("connection gone"); } };

      const stats = await dispatchReconciliationAlerts({ client: exploding, candidates: [makeCand()] });

      expect(stats.dispatchErrors.length).toBeGreaterThan(0);
      expect(stats.candidates).toBe(1);
    });
  });
});
