import { useFetch } from "./use-fetch";

export interface Report {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface ScheduledReport {
  id: string;
  reportId: string;
  report?: Report;
  schedule: string;
  recipients: string[];
  enabled: boolean;
}

export interface ReportsResponse {
  reports: Report[];
  scheduled: ScheduledReport[];
}

export function useReports() {
  return useFetch<ReportsResponse>("/api/admin/reports");
}
