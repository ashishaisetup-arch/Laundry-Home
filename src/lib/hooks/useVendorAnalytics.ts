import { useFetch } from "./use-fetch";

export function useVendorWeeklyRevenue(vendorId: string | null) {
  return useFetch<any[]>(vendorId ? `/api/vendor/analytics/weekly-revenue?vendorId=${vendorId}` : null);
}

export function useVendorServiceRevenue(vendorId: string | null) {
  return useFetch<any[]>(vendorId ? `/api/vendor/analytics/service-revenue?vendorId=${vendorId}` : null);
}

export function useVendorInventory(vendorId: string | null) {
  return useFetch<any[]>(vendorId ? `/api/vendor/analytics/inventory?vendorId=${vendorId}` : null);
}

export interface VendorDashboardStats {
  totalOrdersThisWeek: number;
  weeklyRevenue: number;
  avgOrderValue: number;
  repeatRate: number;
  avgRating: number;
  totalReviews: number;
  ratingBuckets: Record<number, number>;
  todayOrders: number;
  todayRevenue: number;
}

export function useVendorDashboardStats(vendorId: string | null) {
  return useFetch<VendorDashboardStats>(vendorId ? `/api/vendor/analytics/stats?vendorId=${vendorId}` : null);
}
