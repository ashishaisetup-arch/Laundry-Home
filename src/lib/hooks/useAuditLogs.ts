import { useFetch } from "./use-fetch";

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export function useAuditLogs(limit?: number) {
  const query = limit ? `?limit=${limit}` : "";
  return useFetch<AuditLog[]>(`/api/admin/audit-logs${query}`);
}
