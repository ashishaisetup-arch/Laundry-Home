import crypto from "crypto";
import {
  runReconciliation,
  RunReconciliationOptions,
  RunSummary,
  AlertCandidate,
  AlertTransition,
} from "./reconciliation-service";

// ============================================================================
// Reconciliation Alerts — Phase 3B-3
// ============================================================================
// Dispatches critical-finding alerts AFTER a reconciliation run completes.
// Hard invariants:
//   - the reconciliation_alerts ledger row is reserved FIRST; a 23505 on
//     unique (finding_id, transition, run_id) / unique (alert_event_key)
//     means already-dispatched → EVERY downstream channel is skipped
//   - only new / reopened / warning|info→critical escalated transitions are
//     delivered (candidates arrive critical-only from the service)
//   - single webhook attempt, 5s timeout, no retries, ever
//   - delivery failures are counted + audited, never thrown: they can never
//     change reconciliation status or the HTTP success code
//   - no webhook URL and no secret/header values in logs or audit metadata
//   - writes ONLY to reconciliation_alerts / notifications / audit_logs
// ============================================================================

export interface AlertDispatchStats {
  candidates: number;
  recipients: number;
  inAppSent: number;
  inAppFailed: number;
  webhook: "disabled" | "sent" | "failed";
  webhookFailed: number;
  skippedDuplicates: number;
  dispatchErrors: string[];
}

function emptyStats(): AlertDispatchStats {
  return {
    candidates: 0,
    recipients: 0,
    inAppSent: 0,
    inAppFailed: 0,
    webhook: "disabled",
    webhookFailed: 0,
    skippedDuplicates: 0,
    dispatchErrors: [],
  };
}

const TITLES: Record<AlertTransition, string> = {
  new: "New critical reconciliation finding",
  reopened: "Critical reconciliation finding reopened",
  escalated: "Reconciliation finding escalated to critical",
};

function alertBody(ev: AlertCandidate): string {
  return `${ev.checkCode} · ${ev.subjectType}:${ev.subjectId} — ${ev.summary}`;
}

interface WebhookOutcome {
  state: "sent" | "failed";
  httpStatus: number | null;
  errorClass: "http_4xx" | "http_5xx" | "timeout" | "network";
}

// Single attempt. Never retries. Body is not read/persisted on non-2xx.
async function postWebhook(
  url: string,
  body: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<WebhookOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (res.ok) return { state: "sent", httpStatus: res.status, errorClass: "http_4xx" };
    return {
      state: "failed",
      httpStatus: res.status,
      errorClass: res.status >= 500 ? "http_5xx" : "http_4xx",
    };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError" || e?.name === "TimeoutError";
    return {
      state: "failed",
      httpStatus: null,
      errorClass: isAbort ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface DispatchOptions {
  client: any;
  candidates: AlertCandidate[];
  fetchImpl?: typeof fetch;
}

export async function dispatchReconciliationAlerts(
  opts: DispatchOptions
): Promise<AlertDispatchStats> {
  const { client, candidates } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const stats = emptyStats();
  stats.candidates = candidates.length;
  if (candidates.length === 0) return stats;

  const webhookUrl = process.env.RECON_ALERT_WEBHOOK_URL || "";
  const webhookSecret = process.env.RECON_ALERT_WEBHOOK_SECRET || "";
  let webhookAttempts = 0;

  // One recipients query for the whole dispatch (admin + superadmin only).
  let recipientIds: string[] = [];
  try {
    const recRes = await client
      .from("user_profiles")
      .select("id")
      .in("role", ["admin", "superadmin"]);
    if (recRes?.error) {
      stats.dispatchErrors.push(`recipients query failed: ${recRes.error.message}`);
    } else {
      recipientIds = (recRes.data ?? []).map((r: any) => r.id).filter(Boolean);
    }
  } catch (e: any) {
    stats.dispatchErrors.push(`recipients query failed: ${String(e?.message ?? e)}`);
  }
  stats.recipients = recipientIds.length;

  for (const ev of candidates) {
    try {
      // Defense-in-depth: only critical transitions are ever dispatchable
      // (the service already emits critical-only candidates).
      if (ev.severity !== "critical") continue;

      // ---- 1. Reserve the ledger row BEFORE any downstream channel --------
      const reserve = await client.from("reconciliation_alerts").insert({
        finding_id: ev.findingId,
        alert_event_key: ev.eventKey,
        transition: ev.transition,
        run_id: ev.runId,
        check_code: ev.checkCode,
        severity: ev.severity,
        subject_type: ev.subjectType,
        subject_id: ev.subjectId,
        dispatched_at: new Date().toISOString(),
      }).select("id");
      if (reserve?.error) {
        if (reserve.error.code === "23505") {
          stats.skippedDuplicates++;
          continue; // already dispatched: skip every downstream channel
        }
        stats.dispatchErrors.push(`ledger reserve failed: ${reserve.error.message}`);
        continue; // unreserved events must never dispatch
      }

      // ---- 2. In-app: one batch insert across recipients -------------------
      let evInAppSent = 0;
      let evInAppFailed = 0;
      if (recipientIds.length > 0) {
        const rows = recipientIds.map((uid) => ({
          user_id: uid,
          type: "recon_alert",
          title: TITLES[ev.transition],
          body: alertBody(ev),
          channel: "push",
        }));
        const nRes = await client.from("notifications").insert(rows).select("id");
        if (nRes?.error) {
          evInAppFailed = rows.length; // batch insert is atomic
        } else {
          evInAppSent = (nRes.data ?? []).length;
          evInAppFailed = rows.length - evInAppSent;
        }
      }
      stats.inAppSent += evInAppSent;
      stats.inAppFailed += evInAppFailed;

      // ---- 3. Optional external webhook: exactly one attempt ---------------
      let evWebhook: "sent" | "failed" | "disabled" = "disabled";
      let wh: WebhookOutcome | null = null;
      if (webhookUrl) {
        webhookAttempts++;
        const body = JSON.stringify({
          v: 1,
          eventKey: ev.eventKey,
          transition: ev.transition,
          runId: ev.runId,
          findingId: ev.findingId,
          checkCode: ev.checkCode,
          severity: ev.severity,
          subjectType: ev.subjectType,
          subjectId: ev.subjectId,
          summary: ev.summary,
          occurredAt: new Date().toISOString(),
        });
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (webhookSecret) {
          headers["x-recon-alert-signature"] = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");
        }
        wh = await postWebhook(webhookUrl, body, headers, fetchImpl);
        evWebhook = wh.state;
        if (wh.state === "failed") {
          stats.webhookFailed++;
          try {
            await client.from("audit_logs").insert({
              user_id: null,
              action: "reconciliation.alert_webhook_failed",
              resource: "reconciliation_alerts",
              details: {
                finding_id: ev.findingId,
                alert_event_key: ev.eventKey,
                http_status: wh.httpStatus,
                error_class: wh.errorClass,
                attempted_at: new Date().toISOString(),
              },
            });
          } catch (e: any) {
            stats.dispatchErrors.push(`webhook-failure audit failed: ${String(e?.message ?? e)}`);
          }
        }
      }

      // ---- 4. Audit the dispatch (after webhook so results are final) ------
      try {
        const aRes = await client.from("audit_logs").insert({
          user_id: null,
          action: "reconciliation.alert_dispatched",
          resource: "reconciliation_alerts",
          details: {
            finding_id: ev.findingId,
            alert_event_key: ev.eventKey,
            transition: ev.transition,
            run_id: ev.runId,
            check_code: ev.checkCode,
            severity: ev.severity,
            subject_type: ev.subjectType,
            subject_id: ev.subjectId,
            recipients: recipientIds.length,
            inAppSent: evInAppSent,
            inAppFailed: evInAppFailed,
            webhook: evWebhook,
          },
        });
        if (aRes?.error) {
          stats.dispatchErrors.push(`dispatch audit failed: ${aRes.error.message}`);
        }
      } catch (e: any) {
        stats.dispatchErrors.push(`dispatch audit failed: ${String(e?.message ?? e)}`);
      }

      // ---- 5. Best-effort ledger delivery update ---------------------------
      try {
        const dRes = await client.from("reconciliation_alerts").update({
          delivery: {
            recipients: recipientIds.length,
            inAppSent: evInAppSent,
            inAppFailed: evInAppFailed,
            webhook: evWebhook,
            webhookFailed: wh?.state === "failed" ? 1 : 0,
          },
        }).eq("alert_event_key", ev.eventKey).select("id");
        if (dRes?.error) {
          stats.dispatchErrors.push(`delivery update failed: ${dRes.error.message}`);
        }
      } catch (e: any) {
        stats.dispatchErrors.push(`delivery update failed: ${String(e?.message ?? e)}`);
      }
    } catch (e: any) {
      // Per-event isolation: one bad event can never abort the rest or throw.
      stats.dispatchErrors.push(`event dispatch failed: ${String(e?.message ?? e)}`);
    }
  }

  if (!webhookUrl || webhookAttempts === 0) stats.webhook = "disabled";
  else stats.webhook = stats.webhookFailed > 0 ? "failed" : "sent";
  return stats;
}

// Reusable orchestration for every trigger surface — the cron route today,
// POST /api/admin/reconciliation/run in 3B-4. Alert semantics can never be
// bypassed by a caller: dispatch runs here, after the run, and its failures
// are isolated from the reconciliation result.
export async function runReconciliationWithAlerts(
  opts: RunReconciliationOptions
): Promise<{ summary: RunSummary; alerts: AlertDispatchStats }> {
  const summary = await runReconciliation(opts);
  let alerts: AlertDispatchStats;
  try {
    alerts = await dispatchReconciliationAlerts({
      client: opts.client,
      candidates: summary.alertCandidates,
    });
  } catch (e: any) {
    alerts = emptyStats();
    alerts.candidates = summary.alertCandidates.length;
    alerts.dispatchErrors.push(`dispatch failed: ${String(e?.message ?? e)}`);
  }
  return { summary, alerts };
}
