import { useFetch } from "./use-fetch";

export function useAdminKpis() {
  return useFetch<any[]>("/api/admin/kpis");
}

export interface AdminAnalytics {
  revenue: any[];
  areaDemand: any[];
  serviceDemand: { name: string; value: number; color: string }[];
  weeklyTrend: { day: string; pickups: number; deliveries: number }[];
}

export function useAdminAnalytics() {
  return useFetch<AdminAnalytics>("/api/admin/analytics");
}
