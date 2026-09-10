import type { PaymentTransactionFilters } from "./hooks/usePayments";

export const queryKeys = {
  orders: {
    all: ["orders"] as const,
    list: (url: string) => ["orders", "list", url] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    list: (url: string) => ["vendors", "list", url] as const,
    detail: (id: string) => ["vendors", "detail", id] as const,
  },
  services: { all: ["services"] as const },
  serviceItems: { byService: (id: string) => ["service-items", id] as const },
  vendorServicePrices: { byVendor: (id: string) => ["vendor-service-prices", id] as const },
  addresses: { all: ["addresses"] as const },
  reviews: { all: ["reviews"] as const, list: (url: string) => ["reviews", "list", url] as const },
  coupons: { all: ["coupons"] as const },
  slots: { all: ["slots"] as const },
  notifications: { all: ["notifications"] as const },
  wallet: { details: ["wallet"] as const },
  payments: {
    all: ["payments"] as const,
    summary: ["payments", "summary"] as const,
    transactionsAll: ["payments", "transactions"] as const,
    transactions: (filters: PaymentTransactionFilters) =>
      ["payments", "transactions", filters] as const,
    invoicesAll: ["payments", "invoices"] as const,
    invoices: (page: number) =>
      ["payments", "invoices", page] as const,
  },
  subscriptions: { plans: ["subscriptions", "plans"] as const, user: ["subscriptions", "user"] as const },
  deliveryTasks: { all: ["delivery-tasks"] as const },
  admin: { kpis: ["admin", "kpis"] as const, analytics: ["admin", "analytics"] as const },
  vendorAnalytics: {
    weeklyRevenue: (vid: string | null) => ["vendor-analytics", "weekly-revenue", vid] as const,
    serviceRevenue: (vid: string | null) => ["vendor-analytics", "service-revenue", vid] as const,
    inventory: (vid: string | null) => ["vendor-analytics", "inventory", vid] as const,
    stats: (vid: string | null) => ["vendor-analytics", "stats", vid] as const,
  },
  staff: { all: ["staff"] as const },
  garments: { all: ["garments"] as const, byVendor: (vid: string | null) => ["garments", "vendor", vid] as const },
  favorites: { all: ["favorites"] as const },
  users: { all: ["users"] as const },
  auditLogs: { all: ["audit-logs"] as const },
  featureFlags: { all: ["feature-flags"] as const },
  systemConfig: { all: ["system-config"] as const },
  rbac: { all: ["rbac"] as const },
  reports: { all: ["reports"] as const },
};
