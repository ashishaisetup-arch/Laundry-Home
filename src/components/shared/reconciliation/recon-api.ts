import { convertKeys } from "@/lib/utils";

// Local mutation helper for the reconciliation operations page.
//
// The shared `api` client collapses every failure to Error(body.error), which
// loses the status code and the extra 409/429 payload fields
// (currentStatus, finding, retryAfterSeconds) that this UI needs. Reads still
// go through useFetch/api.get; mutations use this helper so no shared-client
// changes are required (3B-5b is backend-frozen).

export type ReconMutationFailure = {
  ok: false;
  status: number;
  body: {
    error?: string;
    currentStatus?: string;
    finding?: Record<string, unknown>;
    retryAfterSeconds?: number;
    [key: string]: unknown;
  };
};

export type ReconMutationSuccess<T> = { ok: true; status: number; body: T };
export type ReconMutationResult<T> = ReconMutationSuccess<T> | ReconMutationFailure;

export async function reconPost<T>(url: string, body?: unknown): Promise<ReconMutationResult<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, body: parsed };
  }
  return { ok: true, status: res.status, body: convertKeys(parsed) as T };
}

export function transitionUrl(findingId: string, action: "acknowledge" | "resolve" | "reopen") {
  return `/api/admin/reconciliation/findings/${findingId}/${action}`;
}

export const MANUAL_RUN_URL = "/api/admin/reconciliation/run";
