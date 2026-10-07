// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import dotenv from "dotenv";
import { runReconciliation } from "../reconciliation-service";
import { createAdminClient } from "../../supabase";

// ============================================================================
// Real-DB immutability test — Phase 3B-1
// ============================================================================
// Invariant: runReconciliation writes ONLY to reconciliation_runs and
// reconciliation_findings. It must never mutate the five protected financial
// tables, regardless of what data those tables contain.
//
// Method:
//   1. hash + count an exact ordered projection of each protected table
//   2. run one reconciliation (trigger "test")
//   3. hash + count the SAME projections again and require byte equality
//
// Between steps 1 and 3 this test performs SELECTs only — no helper seeds,
// updates or deletes any protected table. Projection columns deliberately
// exclude created_at/updated_at (bumped by unrelated flows; including them
// would create false failures from concurrent activity that has nothing to
// do with reconciliation).
// ============================================================================

dotenv.config();

const hasEnv = Boolean(process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const PROJECTIONS: Array<{ table: string; cols: string }> = [
  {
    table: "payment_transactions",
    cols: [
      "id", "user_id", "order_id", "transaction_purpose", "amount", "currency",
      "gateway", "gateway_order_id", "gateway_payment_id",
      "gateway_signature_verified", "gateway_capture_verified", "payment_status",
      "wallet_transaction_id", "failure_reason", "idempotency_key",
    ].join(", "),
  },
  {
    table: "payment_refunds",
    cols: [
      "id", "payment_transaction_id", "order_id", "user_id", "amount",
      "gateway_refund_amount", "wallet_refund_amount", "refund_status",
      "refund_reason", "refund_source", "gateway_refund_id", "failure_reason",
      "idempotency_key",
    ].join(", "),
  },
  {
    table: "wallet_transactions",
    cols: [
      "id", "user_id", "type", "amount", "method", "description", "order_id",
      "status", "payment_transaction_id", "balance_before", "balance_after",
      "idempotency_key",
    ].join(", "),
  },
  {
    table: "user_profiles",
    cols: "id, wallet_balance",
  },
  {
    table: "payment_webhook_events",
    cols: "id, gateway, event_id, event_type, payload, processed_at, status",
  },
];

const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;

async function fetchAllOrdered(client: any, table: string, cols: string): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(cols)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
  throw new Error(`${table}: exceeded ${MAX_ROWS} rows — refusing to hash a partial projection`);
}

async function snapshot(client: any): Promise<Record<string, { count: number; hash: string }>> {
  const out: Record<string, { count: number; hash: string }> = {};
  for (const p of PROJECTIONS) {
    const rows = await fetchAllOrdered(client, p.table, p.cols);
    out[p.table] = {
      count: rows.length,
      hash: crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  return out;
}

async function countAll(client: any, table: string): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

describe.skipIf(!hasEnv)("reconciliation immutability (real DB)", () => {
  let client: any;

  beforeAll(() => {
    client = createAdminClient();
  });

  it(
    "mutates only reconciliation_runs / reconciliation_findings across a full run",
    async () => {
      // 1. before — protected tables + reconciliation table counts
      const before = await snapshot(client);
      const runsBefore = await countAll(client, "reconciliation_runs");
      const findingsBefore = await countAll(client, "reconciliation_findings");

      // 2. one full reconciliation against the real database
      const summary = await runReconciliation({ client, trigger: "test" });

      // 3. after — identical projections
      const after = await snapshot(client);
      const runsAfter = await countAll(client, "reconciliation_runs");
      const findingsAfter = await countAll(client, "reconciliation_findings");

      // run executed and was recorded
      expect(summary.runId).toBeTruthy();
      expect(summary.status).toBe("success");
      expect(Object.keys(summary.checkResults).sort()).toEqual(
        ["C1", "C2", "C3", "C4", "C5", "C7", "C8"].sort()
      );

      // every check — C7 in particular — must have succeeded untruncated now
      // that payment_webhook_events.created_at exists (migration 00062)
      expect(summary.checkResults.C7.status).toBe("success");
      expect(summary.failedChecks).toEqual([]);
      expect(summary.truncatedChecks).toEqual([]);
      for (const [id, result] of Object.entries(summary.checkResults)) {
        expect(`${id}=${result.status}`).toBe(`${id}=success`);
      }

      // the run itself wrote to reconciliation_runs (+1) ...
      expect(runsAfter).toBe(runsBefore + 1);
      const { data: runRow, error: runErr } = await client
        .from("reconciliation_runs")
        .select("*")
        .eq("id", summary.runId)
        .single();
      expect(runErr).toBeNull();
      expect(runRow.trigger_source).toBe("test");

      // ... and reconciliation_findings may only grow or be re-stated
      // (the service never deletes finding rows)
      expect(findingsAfter).toBeGreaterThanOrEqual(findingsBefore);

      // all five protected tables: identical count AND identical hash
      for (const p of PROJECTIONS) {
        expect(`${p.table} count ${after[p.table].count}`).toBe(
          `${p.table} count ${before[p.table].count}`
        );
        expect(`${p.table} hash ${after[p.table].hash}`).toBe(
          `${p.table} hash ${before[p.table].hash}`
        );
      }
    },
    60000
  );
});
