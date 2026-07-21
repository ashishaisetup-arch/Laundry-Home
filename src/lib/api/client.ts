import { convertKeys } from "@/lib/utils";

const BASE = "";

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: async <T>(url: string) => convertKeys(await request<T>(url)),
  post: async <T>(url: string, body?: unknown) => convertKeys(await request<T>(url, { method: "POST", body: JSON.stringify(body) })),
  patch: async <T>(url: string, body?: unknown) => convertKeys(await request<T>(url, { method: "PATCH", body: JSON.stringify(body) })),
  delete: async <T>(url: string) => convertKeys(await request<T>(url, { method: "DELETE" })),
};
