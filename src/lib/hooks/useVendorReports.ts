import { useFetch } from "./use-fetch";

export interface ReportParams {
  startDate?: string;
  endDate?: string;
  service?: string;
  status?: string;
}

function qs(params: ReportParams) {
  const parts: string[] = [];
  if (params.startDate) parts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) parts.push(`endDate=${encodeURIComponent(params.endDate)}`);
  if (params.service) parts.push(`service=${encodeURIComponent(params.service)}`);
  if (params.status) parts.push(`status=${encodeURIComponent(params.status)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export interface ReportOverview {
  totalOrders: number;
  totalRevenue: number;
  aov: number;
  avgTurnaroundHrs: number | null;
  repeatRate: number;
  onTimeRate: number | null;
  cancellationRate: number;
  avgRating: number;
  totalReviews: number;
  revenueChange: number;
  ordersChange: number;
  delayedCount: number;
  topService: { name: string; revenue: number } | null;
  bestDay: { day: string; revenue: number } | null;
  mostActiveCustomer: { name: string; orderCount: number } | null;
  revenueTrend: { day: string; revenue: number }[];
  ordersTrend: { day: string; count: number }[];
}

export interface ReportSalesRevenue {
  subtotal: number;
  couponDiscount: number;
  subscriptionDiscount: number;
  netOrderValue: number;
  refunds: number;
  platformFees: number;
  deliveryFees: number;
  expressSurcharges: number;
  surgeCharges: number;
  taxes: number;
  grossRevenue: number;
  estimatedCommission: number;
  estimatedVendorEarnings: number;
  dailyRevenue: { day: string; revenue: number; orders: number }[];
  revenueByService: { name: string; revenue: number; percentage: number; color: string }[];
  revenueByPaymentMethod: { method: string; revenue: number; percentage: number }[];
  revenueByDayOfWeek: { day: string; revenue: number; orders: number }[];
  topDay: { day: string; revenue: number; orders: number } | null;
  worstDay: { day: string; revenue: number; orders: number } | null;
  revenueGrowth: number;
}

export interface ReportOrdersOperations {
  totalOrders: number;
  completedOrders: number;
  avgTurnaroundHrs: number | null;
  onTimeRate: number | null;
  delayedCount: number;
  expressOrders: number;
  funnelStages: {
    stage: string;
    count: number;
    conversionRate: number | null;
    avgTimeHours: number | null;
  }[];
  statusDistribution: { status: string; count: number }[];
  ordersByDay: { day: string; count: number }[];
  turnaroundHistogram: { bucket: string; count: number }[];
  expressVsRegular: {
    express: { count: number; revenue: number };
    regular: { count: number; revenue: number };
  };
  attentionCategories: {
    pendingPickup: number;
    delayedInProgress: number;
    qualityIssues: number;
    failedCancelled: number;
  };
  delayedDrillDown: { status: string; delayed: boolean; startDate: string; endDate: string; service?: string; orderStatus?: string };
  topDelayedOrders: { id: string; code: string; customerName: string; total: number; createdAt: string }[];
}

export interface ReportServices {
  topRevenueService: { name: string; revenue: number } | null;
  mostOrderedService: { name: string; orderCount: number } | null;
  highestRatedService: { name: string; avgRating: number } | null;
  fastestService: { name: string; avgTurnaroundHrs: number | null } | null;
  revenueByService: { name: string; revenue: number; color: string }[];
  orderVolumeByService: { name: string; count: number; color: string }[];
  services: {
    name: string;
    orderCount: number;
    revenue: number;
    aov: number;
    avgTurnaroundHrs: number | null;
    avgRating: number;
    revenueShare: number;
    cancellationRate: number;
    repeatRate: number;
  }[];
}

export interface ReportCustomers {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  avgSpendPerCustomer: number;
  historicalCustomerValue: number;
  repeatVsNew: { repeat: number; new: number };
  repeatTrend: { period: string; repeatRate: number }[];
  orderFrequencyDistribution: { orderCount: number; customerCount: number }[];
  customerSegments: { label: string; count: number; percentage: number }[];
  topCustomers: {
    id: string;
    name: string;
    orderCount: number;
    totalSpend: number;
    avgOrder: number;
    lastOrder: string;
  }[];
}

export interface SettlementItem {
  id: string;
  settlement_id: string;
  order_id: string;
  gross_amount: number;
  commission_rate_bps: number;
  commission_amount: number;
  refund_amount: number;
  adjustment_amount: number;
  net_amount: number;
  orders?: { code: string; customer_name: string };
}

export interface Settlement {
  id: string;
  vendor_id: string;
  period_start: string;
  period_end: string;
  gross_order_value: number;
  commission_rate_bps: number;
  commission_amount: number;
  tax_amount: number;
  refunds_amount: number;
  adjustments_amount: number;
  net_payout: number;
  status: string;
  payout_reference: string | null;
  settled_at: string | null;
  created_at: string;
  items: SettlementItem[];
}

export interface ReportSettlements {
  pendingPayout: number;
  settledTotal: number;
  totalGross: number;
  totalCommission: number;
  totalRefunds: number;
  totalAdjustments: number;
  settlements: Settlement[];
  commissionRateBps: number;
}

export interface ReportRatingsIssues {
  avgOverall: number;
  avgVendor: number;
  avgPickup: number;
  avgLaundry: number;
  avgDelivery: number;
  openIssues: number | null;
  distribution: Record<number, number>;
  ratingTrend: { week: string; avg: number; count: number }[];
  issueCategories: { category: string; count: number }[];
  recentNegative: {
    id: string;
    customerName: string;
    overall: number;
    comment: string;
    createdAt: string;
    orderCode: string | null;
    status: string | null;
  }[];
  totalReviews: number;
}

export interface ReportCancellations {
  cancelledOrders: number;
  vendorRejections: number;
  customerCancellations: number;
  cancelRate: number;
  refundTotal: number;
  estimatedLostRevenue: number;
  cancellationTrend: { week: string; count: number }[];
  cancellationByType: { type: string; count: number }[];
  reasonsBreakdown: {
    reason: string;
    count: number;
    percentage: number;
    lostRevenue: number;
  }[];
  cancelDrillDown: { status: string; startDate: string; endDate: string };
  topCancelledOrders: {
    id: string;
    code: string;
    customerName: string;
    total: number;
    createdAt: string;
    notes: string;
    cancelledBy: string | null;
  }[];
}

export function useReportOverview(params: ReportParams) {
  return useFetch<ReportOverview>(`/api/vendor/reports/overview${qs(params)}`);
}

export function useReportSalesRevenue(params: ReportParams) {
  return useFetch<ReportSalesRevenue>(`/api/vendor/reports/sales-revenue${qs(params)}`);
}

export function useReportOrdersOperations(params: ReportParams) {
  return useFetch<ReportOrdersOperations>(`/api/vendor/reports/orders-operations${qs(params)}`);
}

export function useReportServices(params: ReportParams) {
  return useFetch<ReportServices>(`/api/vendor/reports/services${qs(params)}`);
}

export function useReportCustomers(params: ReportParams) {
  return useFetch<ReportCustomers>(`/api/vendor/reports/customers${qs(params)}`);
}

export function useReportSettlements(params: ReportParams) {
  return useFetch<ReportSettlements>(`/api/vendor/reports/settlements${qs(params)}`);
}

export function useReportRatingsIssues(params: ReportParams) {
  return useFetch<ReportRatingsIssues>(`/api/vendor/reports/ratings-issues${qs(params)}`);
}

export function useReportCancellations(params: ReportParams) {
  return useFetch<ReportCancellations>(`/api/vendor/reports/cancellations${qs(params)}`);
}
