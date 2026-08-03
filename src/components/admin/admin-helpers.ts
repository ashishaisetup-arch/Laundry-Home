import React from "react";
import { Users, Store, Activity, IndianRupee, Percent, Smile, Clock, XCircle } from "lucide-react";
import type { NavGroup } from "@/components/shared/app-shell";

export function pageTitle(view: string) {
  return {
    dashboard: "Operations Dashboard",
    vendors: "Vendor Management",
    orders: "Order Monitoring",
    commission: "Commission Management",
    support: "Customer Support",
    marketing: "Marketing & Campaigns",
    reports: "Reports & Analytics",
    livemap: "Live Map",
    ai: "AI Features",
    profile: "My Profile",
    settings: "Settings",
  }[view] || "Dashboard";
}

export function pageSubtitle(view: string) {
  return {
    dashboard: "Centralised view of the entire Laundry Home ecosystem",
    profile: "Manage your account details",
    settings: "Account and app preferences",
    vendors: "Onboard, verify and manage vendor partners",
    orders: "Monitor every order in real time across all cities",
    commission: "Configure commission rules and track settlements",
    support: "Handle complaints, refunds and disputes",
    marketing: "Coupons, campaigns and customer engagement",
    reports: "Generate and export business reports",
    livemap: "Real-time tracking of vendors, orders and delivery partners",
    ai: "AI-powered automation and insights",
  }[view];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Control Center",
    items: [
      { id: "dashboard", label: "Operations Dashboard", icon: "LayoutDashboard" },
      { id: "vendors", label: "Vendor Management", icon: "Store", badge: 2 },
      { id: "orders", label: "Order Monitoring", icon: "Package" },
      { id: "commission", label: "Commission", icon: "Percent" },
      { id: "support", label: "Customer Support", icon: "Headphones", badge: 7 },
      { id: "marketing", label: "Marketing", icon: "Megaphone" },
      { id: "reports", label: "Reports", icon: "FileText" },
      { id: "livemap", label: "Live Map", icon: "MapPin" },
      { id: "ai", label: "AI Features", icon: "Sparkles", badge: "AI" },
    ],
  },
];

export const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Store,
  Activity,
  IndianRupee,
  Percent,
  Smile,
  Clock,
  XCircle,
};

export interface CommissionRule {
  id: string;
  type: string;
  label: string;
  description: string;
  rate: number;
  priority: number;
  active: boolean;
}

export interface CommissionSummary {
  totalCommission: number;
  pendingSettlements: number;
  settled: number;
  avgRate: number;
  vendors: Array<{ id: string; name: string; revenue: number; commission: number; netAmount: number; status: string }>;
}

export interface Settlement {
  id: string;
  vendorId: string;
  vendorName: string;
  period: string;
  grossRevenue: number;
  commission: number;
  netAmount: number;
  status: string;
  createdAt?: string;
  settledAt?: string;
}
