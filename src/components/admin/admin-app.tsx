
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Headphones,
  IndianRupee,
  Megaphone,
  Package,
  Percent,
  Search,
  Settings2,
  Shield,
  Smile,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  XCircle,
  UserCheck,
  FileSpreadsheet,
  Brain,
  Target,
  Zap,
  Bell,
  Mail,
  MessageSquare,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/client";
import { useFetch } from "@/lib/hooks/use-fetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { StatCard } from "@/components/shared/stat-card";
import { useOrders, useVendors, useAdminKpis, useAdminAnalytics, useSupportTickets, useCampaigns, useReports } from "@/lib/hooks";
import { useRealtime } from "@/lib/hooks/useRealtime";
import type { Vendor } from "@/lib/types";
import { AdminOrderDetail } from "@/components/admin/admin-order-detail";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

const NAV_GROUPS: NavGroup[] = [
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
      { id: "ai", label: "AI Features", icon: "Sparkles", badge: "AI" },
    ],
  },
];

export function AdminApp() {
  const [view, setView] = useState("dashboard");

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
      actions={
        view === "reports" ? (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("Export started", { description: "Your report is being exported as PDF." })}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Report generated", { description: "Custom report has been created and saved." })}>
              <FileText className="h-4 w-4 mr-1.5" />
              Generate Report
            </Button>
          </>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <AdminDashboard key="d" />}
        {view === "vendors" && <AdminVendors key="v" />}
        {view === "orders" && <AdminOrders key="o" />}
        {view === "commission" && <AdminCommission key="c" />}
        {view === "support" && <AdminSupport key="s" />}
        {view === "marketing" && <AdminMarketing key="m" />}
        {view === "reports" && <AdminReports key="r" />}
        {view === "ai" && <AdminAI key="a" />}
      </AnimatePresence>
    </AppShell>
  );
}

function pageTitle(view: string) {
  return {
    dashboard: "Operations Dashboard",
    vendors: "Vendor Management",
    orders: "Order Monitoring",
    commission: "Commission Management",
    support: "Customer Support",
    marketing: "Marketing & Campaigns",
    reports: "Reports & Analytics",
    ai: "AI Features",
  }[view] || "Dashboard";
}
function pageSubtitle(view: string) {
  return {
    dashboard: "Centralised view of the entire Laundry Home ecosystem",
    vendors: "Onboard, verify and manage vendor partners",
    orders: "Monitor every order in real time across all cities",
    commission: "Configure commission rules and track settlements",
    support: "Handle complaints, refunds and disputes",
    marketing: "Coupons, campaigns and customer engagement",
    reports: "Generate and export business reports",
    ai: "AI-powered automation and insights",
  }[view];
}

// ============================================================================
// Admin Dashboard
// ============================================================================
function AdminDashboard() {
  const { data: vendorsList } = useVendors();
  const { data: kpis } = useAdminKpis();
  const { data: analytics } = useAdminAnalytics();

  const kpiData = kpis || [];
  const revenueChart = analytics?.revenue || [];
  const serviceDemand = analytics?.serviceDemand || [];
  const areaDemand = analytics?.areaDemand || [];
  const weeklyTrend = analytics?.weeklyTrend || [];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Badge className="bg-white/20 text-white border-0 mb-2">● Live · All systems operational</Badge>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Welcome, Ananya! 🚀
              </h2>
              <p className="text-sm text-white/80 mt-1">
                <strong>{kpiData[2]?.value || "0"} live orders</strong> · <strong>{kpiData[3]?.value || "₹0"}</strong> revenue · <strong>{kpiData[4]?.value || "0★"}</strong> avg satisfaction
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                kpiData[2] && { label: "Active", value: kpiData[2].value, color: "bg-white/15" },
                kpiData[5] && { label: "Completed", value: kpiData[5].value, color: "bg-white/15" },
                kpiData[6] && { label: "Cancelled", value: kpiData[6].value, color: "bg-rose-500/30" },
              ].filter(Boolean).map((s: any) => (
                <div key={s.label} className={cn("rounded-xl backdrop-blur p-3 text-center", s.color)}>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[10px] text-white/80">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiData.slice(0, 4).map((kpi) => {
          const Icon = (ICONS as any)[kpi.icon] || Activity;
          return (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              change={kpi.change}
              trend={kpi.trend as "up" | "down" | "flat"}
              icon={Icon}
              accent={kpi.accent}
              spark={kpi.spark}
              invertTrend={kpi.label.includes("Cancellation") || kpi.label.includes("Turnaround")}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiData.slice(4).map((kpi) => {
          const Icon = (ICONS as any)[kpi.icon] || Activity;
          return (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              change={kpi.change}
              trend={kpi.trend as "up" | "down" | "flat"}
              icon={Icon}
              accent={kpi.accent}
              spark={kpi.spark}
              invertTrend={kpi.label.includes("Cancellation") || kpi.label.includes("Turnaround")}
            />
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Revenue & Commission Trend</h3>
              <p className="text-xs text-muted-foreground">Last 7 months · in ₹ Lakhs</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              {kpiData[3]?.change > 0 ? `+${kpiData[3].change}%` : `${kpiData[3]?.change}%`} MoM
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChart} margin={{ left: -16, right: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6B9C8E" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6B9C8E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="com" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v}L`} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} formatter={(v: number) => `₹${v}L`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue (₹L)" stroke="#6B9C8E" strokeWidth={2.5} fill="url(#rev)" />
              <Area type="monotone" dataKey="commission" name="Commission (₹L)" stroke="#A89B7B" strokeWidth={2.5} fill="url(#com)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Service demand */}
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-1">Service Demand</h3>
          <p className="text-xs text-muted-foreground mb-3">By service type</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={serviceDemand} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                {serviceDemand.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-3">
            {serviceDemand.map((s: any) => (
              <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="font-semibold">{s.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Area demand + Live orders */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Demand by Area (Bengaluru)</h3>
          <div className="space-y-2">
            {areaDemand.map((a: any) => (
              <div key={a.area} className="flex items-center gap-3">
                <span className="text-sm w-28 truncate">{a.area}</span>
                <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-md bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(a.orders / Math.max(...areaDemand.map((x: any) => x.orders))) * 100}%` }}
                    transition={{ duration: 0.6 }}
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold">
                    {a.orders.toLocaleString()}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                  +{a.growth}%
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Weekly Pickup & Delivery Trend</h3>
            <Badge variant="secondary">Last 7 days</Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyTrend} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="pickups" name="Pickups" stroke="#6B9C8E" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="deliveries" name="Deliveries" stroke="#A89B7B" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top vendors + alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Top Performing Vendors</h3>
            <Button variant="ghost" size="sm" className="text-xs">View all</Button>
          </div>
          <div className="space-y-2">
            {(vendorsList || []).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue).slice(0, 5).map((v, i) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white text-xs font-bold", v.logoColor)}>
                  {v.logoInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{v.name}</p>
                  <p className="text-[11px] text-muted-foreground">{v.area} · {v.rating}★ · {v.totalOrders.toLocaleString()} orders</p>
                </div>
                <p className="text-sm font-bold">{formatINR(v.monthlyRevenue)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Active Alerts
            </h3>
            <Badge variant="outline" className="text-amber-600 border-amber-300">0 active</Badge>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center py-4">No active alerts</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Store,
  Activity,
  IndianRupee,
  Percent,
  Smile,
  Clock,
  XCircle,
};

// ============================================================================
// Admin Vendors
// ============================================================================
function AdminVendors() {
  const { data: vendorsList } = useVendors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendors, setVendors] = useState<Vendor[]>(() => vendorsList || []);

  useEffect(() => {
    if (vendorsList) setVendors(vendorsList);
  }, [vendorsList]);

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.area.toLowerCase().includes(search.toLowerCase()) ||
      v.city.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && v.kycStatus === "approved") ||
      (statusFilter === "pending" && v.kycStatus === "pending") ||
      (statusFilter === "suspended" && v.kycStatus === "rejected");
    return matchesSearch && matchesStatus;
  });

  const handleApprove = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    setVendors((prev) => prev.map((v) => v.id === vendorId ? { ...v, kycStatus: "approved" as const } : v));
    toast.success(`Vendor ${vendor?.name} approved`, { description: "Welcome email sent." });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, area, city…"
            className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">KYC pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Onboarding form opened", { description: "Use the Super Admin panel to onboard new vendors." })}>
          <UserCheck className="h-4 w-4 mr-1.5" />
          Onboard Vendor
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{filteredVendors.length}</strong> of {vendors.length} vendors
        {(search || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="ml-2 text-primary hover:underline">Clear filters</button>
        )}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Vendor</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Location</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Rating</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Orders</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Monthly Revenue</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">KYC</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">No vendors match your filters.</td></tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-semibold", v.logoColor)}>
                          {v.logoInitials}
                        </div>
                        <div>
                          <p className="font-medium">{v.name}</p>
                          <p className="text-[11px] text-muted-foreground">Joined {new Date(v.joinedDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{v.area}, {v.city}</td>
                    <td className="p-3 text-center">
                      <span className="font-semibold">{v.rating}★</span>
                      <p className="text-[10px] text-muted-foreground">{v.reviewCount}</p>
                    </td>
                    <td className="p-3 text-center font-medium">{v.totalOrders.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">{formatINR(v.monthlyRevenue)}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        v.kycStatus === "approved" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                        v.kycStatus === "pending" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                        v.kycStatus === "rejected" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                      )}>
                        {v.kycStatus}
                      </Badge>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.info(`Viewing ${v.name}`, { description: `${v.area}, ${v.city} · ${v.totalOrders.toLocaleString()} orders · ${v.rating}★` })}>View</Button>
                      {v.kycStatus === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 ml-1 text-xs" onClick={() => handleApprove(v.id)}>
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Admin Orders
// ============================================================================
function AdminOrders() {
  const { data: orders, refetch } = useFetch<import("@/lib/types").Order[]>("/api/admin/orders");
  const { data: executives, refetch: refetchExecs } = useFetch<{ id: string; name: string; isAvailable: boolean; assignedOrders: number; maxDailyOrders: number; distanceKm?: number }[]>("/api/delivery-executives");
  const [filter, setFilter] = useState("all");
  const allOrders = orders || [];
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  useRealtime("orders", undefined, refetch, true);

  const refetchAll = () => { refetch(); refetchExecs(); };

  const handleAssignDelivery = async (orderId: string, execId: string) => {
    try {
      await api.post(`/api/orders/${orderId}/assign-delivery`, { delivery_executive_id: execId });
      toast.success("Delivery partner assigned");
      setAssigningOrderId(null);
      refetchAll();
    } catch (e: any) {
      toast.error("Assignment failed", { description: e.message });
    }
  };

  const filteredOrders = allOrders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return !["completed", "cancelled"].includes(o.status);
    if (filter === "completed") return o.status === "completed";
    if (filter === "delayed") return o.aiPrediction?.delayRisk === "medium" || o.aiPrediction?.delayRisk === "high";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Orders", count: allOrders.length },
          { id: "active", label: "Active", count: allOrders.filter(o => !["completed", "cancelled"].includes(o.status)).length },
          { id: "delayed", label: "Delayed Risk", count: allOrders.filter(o => o.aiPrediction?.delayRisk === "medium" || o.aiPrediction?.delayRisk === "high").length },
          { id: "completed", label: "Completed", count: allOrders.filter(o => o.status === "completed").length },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {f.label} <span className="ml-1 opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Order</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Vendor</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Delivery</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Total</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">AI Risk</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">No orders match this filter.</td></tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-mono text-xs font-semibold">{o.code}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-muted text-[10px]">{o.customerAvatar}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{o.customerName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{o.vendorName}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-[10px] capitalize">{o.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{o.deliveryExecutiveName || "—"}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold">{formatINRDecimal(o.total)}</td>
                    <td className="p-3 text-center">
                      {o.aiPrediction && (
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          o.aiPrediction.delayRisk === "low" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                          o.aiPrediction.delayRisk === "medium" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                          o.aiPrediction.delayRisk === "high" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                        )}>
                          {o.aiPrediction.delayRisk}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewOrderId(o.id)}>View</Button>
                        {assigningOrderId === o.id ? (
                          <Select onValueChange={(execId) => handleAssignDelivery(o.id, execId)}>
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(executives || [])
                                .sort((a, b) => {
                                  if (a.isAvailable && !b.isAvailable) return -1;
                                  if (!a.isAvailable && b.isAvailable) return 1;
                                  return (a.assignedOrders || 0) - (b.assignedOrders || 0);
                                })
                                .map((ex) => (
                                <SelectItem
                                  key={ex.id}
                                  value={ex.id}
                                  className="text-xs"
                                  disabled={!ex.isAvailable}
                                >
                                  {ex.name} ({ex.assignedOrders || 0}/{ex.maxDailyOrders || 10})
                                  {!ex.isAvailable ? " (busy)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setAssigningOrderId(o.id)}
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            {o.deliveryExecutiveName ? "Change" : "Assign"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AdminOrderDetail orderId={viewOrderId} onClose={() => setViewOrderId(null)} onUpdated={refetchAll} />
    </div>
  );
}

// ============================================================================
// Admin Commission
// ============================================================================
function AdminCommission() {
  const { data: rules, refetch: refetchRules } = useFetch<CommissionRule[]>("/api/admin/commission/rules");
  const { data: summary, refetch: refetchSummary } = useFetch<CommissionSummary>("/api/admin/commission/summary");
  const { data: settlements, refetch: refetchSettlements } = useFetch<Settlement[]>("/api/admin/commission/settlements");
  const [addingRule, setAddingRule] = useState(false);
  const [creatingSettlement, setCreatingSettlement] = useState(false);
  const [newRule, setNewRule] = useState({ type: "fixed", label: "", description: "", rate: 10 });
  const [selVendor, setSelVendor] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState(0);

  const refetchAll = () => { refetchRules(); refetchSummary(); refetchSettlements(); };

  const handleAddRule = async () => {
    try {
      await api.post("/api/admin/commission/rules", newRule);
      toast.success("Rule added");
      setAddingRule(false);
      setNewRule({ type: "fixed", label: "", description: "", rate: 10 });
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to add rule", { description: e.message });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.delete(`/api/admin/commission/rules/${id}`);
      toast.success("Rule removed");
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to delete", { description: e.message });
    }
  };

  const handleEditRule = async (id: string) => {
    try {
      await api.patch(`/api/admin/commission/rules/${id}`, { rate: editRate });
      toast.success("Rate updated");
      setEditingRuleId(null);
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to update", { description: e.message });
    }
  };

  const startEditing = (r: CommissionRule) => {
    setEditRate(r.rate);
    setEditingRuleId(r.id);
  };

  const handleCreateSettlement = async () => {
    if (!selVendor) { toast.error("Select a vendor"); return; }
    const v = (s.vendors || []).find((x: any) => x.id === selVendor);
    if (!v) return;
    const month = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
    try {
      await api.post("/api/admin/commission/settlements", {
        vendorId: v.id, vendorName: v.name, period: month,
        grossRevenue: v.revenue, commission: v.commission, netAmount: v.netAmount,
      });
      toast.success("Settlement record created");
      setCreatingSettlement(false);
      setSelVendor("");
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to create settlement", { description: e.message });
    }
  };

  const handleSettle = async (id: string) => {
    try {
      await api.patch(`/api/admin/commission/settlements/${id}/settle`);
      toast.success("Settlement completed");
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to settle", { description: e.message });
    }
  };

  const s = summary || { totalCommission: 0, pendingSettlements: 0, settled: 0, avgRate: 10, vendors: [] };
  const allSettlements = settlements || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Commission (Month)" value={formatINR(s.totalCommission)} icon={Percent} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Pending Settlements" value={formatINR(s.pendingSettlements)} icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Settled This Month" value={formatINR(s.settled)} icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Commission Rate" value={`${s.avgRate}%`} icon={IndianRupee} accent="from-violet-500 to-purple-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Commission rules */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Commission Rules</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAddingRule(!addingRule)}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              {addingRule ? "Cancel" : "Add rule"}
            </Button>
          </div>

          {addingRule && (
            <div className="mb-3 p-3 rounded-lg border border-border/60 space-y-2">
              <input value={newRule.label} onChange={(e) => setNewRule({ ...newRule, label: e.target.value })} placeholder="Rule label" className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none" />
              <input value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} placeholder="Description" className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none" />
              <div className="flex gap-2">
                <select value={newRule.type} onChange={(e) => setNewRule({ ...newRule, type: e.target.value })} className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none">
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                  <option value="promotional">Promotional</option>
                </select>
                <input type="number" value={newRule.rate} onChange={(e) => setNewRule({ ...newRule, rate: +e.target.value })} className="w-20 rounded border border-input bg-background px-2 py-1.5 text-sm outline-none" />
                <Button size="sm" onClick={handleAddRule}>Save</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(rules || []).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <Badge variant="outline" className="text-[10px] capitalize">{r.type}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground">{r.description}</p>
                </div>
                {editingRuleId === r.id ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={editRate} onChange={(e) => setEditRate(+e.target.value)} className="w-16 rounded border border-input bg-background px-1.5 py-1 text-sm text-center outline-none" />
                    <span className="text-sm font-bold text-primary">%</span>
                    <button onClick={() => handleEditRule(r.id)} className="text-emerald-600 hover:text-emerald-700"><CheckCircle2 className="h-4 w-4" /></button>
                    <button onClick={() => setEditingRuleId(null)} className="text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-bold text-primary cursor-pointer hover:text-primary/70" onClick={() => startEditing(r)} title="Click to edit">{r.rate}%</p>
                    <button onClick={() => handleDeleteRule(r.id)} className="text-muted-foreground hover:text-rose-600 transition-colors">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Settlements */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Settlements</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreatingSettlement(!creatingSettlement)}>
                <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
                {creatingSettlement ? "Cancel" : "Create settlement"}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => toast.info("Export", { description: "Download as CSV" })}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {creatingSettlement && (
            <div className="mb-3 p-3 rounded-lg border border-border/60 space-y-2">
              <select value={selVendor} onChange={(e) => setSelVendor(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none">
                <option value="">Select vendor…</option>
                {(s.vendors || []).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} — {formatINR(v.commission)}</option>
                ))}
              </select>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreateSettlement}>Create record</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {allSettlements.length === 0 ? (
              (s.vendors || []).slice(0, 5).map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-bold">
                    {v.name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">Commission: {formatINR(v.commission)} · Net: {formatINR(v.netAmount)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">pending</Badge>
                </div>
              ))
            ) : (
              allSettlements.map((st) => (
                <div key={st.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-bold">
                    {st.vendorName?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{st.vendorName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {st.period ? `${st.period} · ` : ""}Commission: {formatINR(st.commission)} · Net: {formatINR(st.netAmount)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    st.status === "settled" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                    st.status === "pending" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                  )}>
                    {st.status}
                  </Badge>
                  {st.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSettle(st.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Settle
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

interface CommissionRule {
  id: string;
  type: string;
  label: string;
  description: string;
  rate: number;
  priority: number;
  active: boolean;
}

interface CommissionSummary {
  totalCommission: number;
  pendingSettlements: number;
  settled: number;
  avgRate: number;
  vendors: Array<{ id: string; name: string; revenue: number; commission: number; netAmount: number; status: string }>;
}

interface Settlement {
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

// ============================================================================
// Admin Support
// ============================================================================
function AdminSupport() {
  const { data: tickets } = useSupportTickets();
  const [activeTab, setActiveTab] = useState("open");

  const all = tickets || [];
  const openTickets = all.filter((t) => t.status === "open");
  const refundTickets = all.filter((t) => (t.description || "").toLowerCase().includes("refund"));
  const escalatedTickets = all.filter((t) => t.status === "escalated");
  const resolvedTickets = all.filter((t) => t.status === "resolved");

  const handleAssign = async (ticketId: string) => {
    try {
      await api.patch(`/api/support/tickets/${ticketId}`, { assignedTo: "Admin" });
      toast.success("Ticket assigned to Admin");
    } catch (err: any) {
      toast.error("Failed to assign", { description: err.message });
    }
  };

  const handleResolve = async (ticketId: string) => {
    try {
      await api.patch(`/api/support/tickets/${ticketId}`, { status: "resolved" });
      toast.success("Ticket resolved");
    } catch (err: any) {
      toast.error("Failed to resolve", { description: err.message });
    }
  };

  const renderTicket = (t: NonNullable<typeof tickets>[0]) => (
    <Card key={t.id} className="p-4 shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
          t.priority === "high" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30" :
          t.priority === "medium" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30" :
          "bg-muted text-muted-foreground"
        )}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold">#{t.id.slice(0, 8)}</span>
            <Badge variant="outline" className={cn(
              "text-[9px] py-0 h-4",
              t.priority === "high" ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30" :
              t.priority === "medium" ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30" :
              "border-border"
            )}>
              {t.priority}
            </Badge>
            {t.status === "escalated" && (
              <Badge variant="outline" className="text-[9px] py-0 h-4 border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-950/30">
                escalated
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium mt-0.5">{t.subject}</p>
          <p className="text-xs text-muted-foreground">{t.assignedTo || "Unassigned"} · {new Date(t.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {t.assignedTo ? (
            <Badge variant="secondary" className="text-[10px]">{t.assignedTo}</Badge>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAssign(t.id)}>
              Assign
            </Button>
          )}
          {t.status !== "resolved" && (
            <Button size="sm" className="bg-primary hover:bg-primary/90 h-7" onClick={() => handleResolve(t.id)}>
              Resolve
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Tickets" value={openTickets.length.toString()} icon={Headphones} accent="from-amber-500 to-orange-600" />
        <StatCard label="Pending Refunds" value={refundTickets.length.toString()} icon={IndianRupee} accent="from-rose-500 to-pink-600" />
        <StatCard label="Avg Response" value="4 mins" change={-12} trend="down" invertTrend icon={Clock} accent="from-emerald-500 to-green-600" />
        <StatCard label="Resolution Rate" value="94.2%" change={2.1} trend="up" icon={CheckCircle2} accent="from-teal-500 to-cyan-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open">Open Tickets <Badge variant="secondary" className="ml-1.5 text-[10px]">{openTickets.length}</Badge></TabsTrigger>
          <TabsTrigger value="refunds">Refunds <Badge variant="secondary" className="ml-1.5 text-[10px]">{refundTickets.length}</Badge></TabsTrigger>
          <TabsTrigger value="escalated">Escalated <Badge variant="secondary" className="ml-1.5 text-[10px]">{escalatedTickets.length}</Badge></TabsTrigger>
          <TabsTrigger value="resolved">Resolved <Badge variant="secondary" className="ml-1.5 text-[10px]">{resolvedTickets.length}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4 space-y-2">
          {openTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No open tickets. All caught up!</Card>
          ) : openTickets.map(renderTicket)}
        </TabsContent>
        <TabsContent value="refunds" className="mt-4 space-y-2">
          {refundTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No refund requests.</Card>
          ) : refundTickets.map(renderTicket)}
        </TabsContent>
        <TabsContent value="escalated" className="mt-4 space-y-2">
          {escalatedTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No escalated tickets.</Card>
          ) : escalatedTickets.map(renderTicket)}
        </TabsContent>
        <TabsContent value="resolved" className="mt-4 space-y-2">
          {resolvedTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No resolved tickets yet.</Card>
          ) : resolvedTickets.map(renderTicket)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Admin Marketing
// ============================================================================
function AdminMarketing() {
  const { data: campaigns } = useCampaigns();
  const c = campaigns || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={c.length.toString()} icon={Megaphone} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Coupons Redeemed" value={c.reduce((s, x) => s + (x.conversions || 0), 0).toLocaleString()} icon={Percent} accent="from-emerald-500 to-green-600" />
        <StatCard label="Email Open Rate" value="42.8%" change={3.1} trend="up" icon={Mail} accent="from-violet-500 to-purple-600" />
        <StatCard label="Push CTR" value="8.4%" change={1.2} trend="up" icon={Bell} accent="from-amber-500 to-orange-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Active Campaigns</h3>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => toast.success("New campaign", { description: "Campaign builder opened." })}>
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              New Campaign
            </Button>
          </div>
          <div className="space-y-2">
            {c.map((camp) => (
              <div key={camp.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{camp.title}</p>
                  <p className="text-[11px] text-muted-foreground">{camp.type} · Reach: {(camp.reach || 0).toLocaleString()} · Conversions: {(camp.conversions || 0).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px]", camp.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30")}>
                  {camp.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Notification Channels</h3>
          <p className="text-sm text-muted-foreground text-center py-4">No channel data available</p>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Admin Reports
// ============================================================================
function AdminReports() {
  const { data: reportData } = useReports();
  const r = reportData || { reports: [], scheduled: [] };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {r.reports.map((rep) => (
          <motion.div key={rep.id} whileHover={{ y: -2 }}>
            <Card className="p-5 shadow-soft hover:shadow-lift transition-shadow cursor-pointer">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br bg-primary text-white mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm">{rep.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rep.type}</p>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-border/60">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => toast.success(`${rep.name} exported`, { description: "Downloaded as PDF." })}>
                  <FileText className="h-3 w-3 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => toast.success(`${rep.name} exported`, { description: "Downloaded as Excel." })}>
                  <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => toast.success(`${rep.name} exported`, { description: "Downloaded as CSV." })}>
                  CSV
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Scheduled Reports</h3>
        <div className="space-y-2">
          {r.scheduled.map((sr) => (
            <div key={sr.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{sr.report?.name || "Scheduled Report"}</p>
                <p className="text-[11px] text-muted-foreground">{sr.schedule} · {(sr.recipients || []).length} recipients</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info("Editing scheduled report")}>Edit</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Admin AI Features
// ============================================================================
function AdminAI() {
  const { data: orders } = useFetch<import("@/lib/types").Order[]>("/api/admin/orders");
  const { data: vendors } = useVendors();
  const allOrders = orders || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = allOrders.filter((o) => o.createdAt?.startsWith(todayStr));
  const deliveredToday = todayOrders.filter((o) => o.status === "delivered" || o.status === "completed");
  const totalToday = todayOrders.length;
  const totalVendors = (vendors || []).length;
  const avgOrdersPerVendor = totalVendors > 0 ? Math.round(totalToday / totalVendors) : 0;
  const reAssignments = Math.max(0, Math.round(totalToday * 0.08));
  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="relative overflow-hidden p-6 bg-tonal text-foreground border-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center gap-4">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Brain className="h-7 w-7 text-white" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI Features
            </h2>
            <p className="text-sm text-white/80 mt-1">
              5 AI-powered systems optimising your laundry ecosystem in real time
            </p>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Smart Vendor Assignment */}
        <AIFeatureCard
          title="Smart Vendor Assignment"
          desc="AI auto-assigns orders to the best vendor based on distance, capacity, ratings, workload and ETA."
          icon={Target}
          color="from-teal-500 to-cyan-600"
          stats={[
            { label: "Orders auto-assigned today", value: String(totalToday) },
            { label: "Avg orders per vendor", value: String(avgOrdersPerVendor) },
            { label: "Reassignments avoided", value: String(reAssignments) },
          ]}
        />

        {/* Delivery Time Prediction */}
        <AIFeatureCard
          title="Delivery Time Prediction"
          desc="ML model predicts accurate completion times using historical data, vendor capacity and traffic."
          icon={Clock}
          color="from-emerald-500 to-green-600"
          stats={[
            { label: "Deliveries today", value: String(deliveredToday.length) },
            { label: "On-time rate", value: deliveredToday.length > 0 ? `${Math.round((deliveredToday.filter(o => o.status === "delivered").length / Math.max(deliveredToday.length, 1)) * 100)}%` : "—" },
            { label: "Avg turnaround", value: totalToday > 0 ? `${Math.round(totalToday / Math.max(deliveredToday.length, 1))} hrs` : "—" },
          ]}
        />

        {/* Price Estimation */}
        <AIFeatureCard
          title="Price Estimation"
          desc="Real-time price estimation for customers before booking, factoring in services, express, and dynamic pricing."
          icon={IndianRupee}
          color="from-amber-500 to-orange-600"
          stats={[
            { label: "Orders today", value: String(totalToday) },
            { label: "Avg order value", value: totalToday > 0 ? `₹${Math.round(todayOrders.reduce((s, o) => s + (o.total || 0), 0) / totalToday)}` : "—" },
            { label: "Express orders", value: String(todayOrders.filter((o) => o.express).length) },
          ]}
        />

        {/* Delay Prediction */}
        <AIFeatureCard
          title="Delay Prediction"
          desc="Predicts delayed orders 4+ hours in advance and alerts vendor, customer and admin with mitigation actions."
          icon={AlertTriangle}
          color="from-rose-500 to-pink-600"
          stats={[
            { label: "Pending orders", value: String(allOrders.filter((o) => !["delivered", "completed", "cancelled"].includes(o.status)).length) },
            { label: "Delayed today", value: String(Math.max(0, totalToday - deliveredToday.length)) },
            { label: "Vendors available", value: String(totalVendors) },
          ]}
        />

        {/* Demand Forecasting */}
        <AIFeatureCard
          title="Demand Forecasting"
          desc="Forecasts demand by area, day, season and festival to help vendors plan capacity and staffing."
          icon={TrendingUp}
          color="from-violet-500 to-purple-600"
          stats={[
            { label: "Total orders (all time)", value: String(allOrders.length) },
            { label: "Active vendors", value: String(totalVendors) },
            { label: "Daily avg", value: allOrders.length > 0 ? String(Math.round(allOrders.length / 30)) : "—" },
          ]}
        />

        {/* Personalized Recommendations */}
        <AIFeatureCard
          title="Personalized Recommendations"
          desc="Recommends vendors, services, subscription plans and offers personalized to each customer."
          icon={Sparkles}
          color="from-sky-500 to-cyan-600"
          stats={[
            { label: "Customers served", value: String(new Set(allOrders.map((o) => o.customerId)).size) },
            { label: "Vendors active", value: String(new Set(allOrders.map((o) => o.vendorId)).size) },
            { label: "Repeat rate", value: "—" },
          ]}
        />
      </div>

      {/* AI Insights feed */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Live AI Insights
          </h3>
          <Badge variant="secondary" className="text-xs">Updated 2 mins ago</Badge>
        </div>
        <div className="space-y-2">
          {[
            { text: "Demand in HSR Layout will spike +28% this Saturday. Recommend onboarding 2 more vendors.", action: "Plan capacity", color: "teal" },
            { text: "Order LH-2849 has medium delay risk. QuickClean Express has 45% capacity — recommend reassignment.", action: "Reassign", color: "amber" },
            { text: "Customer Aarav Mehta is a high-value customer (top 5%). Send personalized offer to retain.", action: "Send offer", color: "violet" },
            { text: "Vendor Sparkle Laundry Studio at 88% capacity — suggest temporary halt on new assignments.", action: "Pause", color: "rose" },
          ].map((insight, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border-l-2 p-3",
              insight.color === "teal" && "border-teal-400 bg-teal-50 dark:bg-teal-950/20",
              insight.color === "amber" && "border-amber-400 bg-amber-50 dark:bg-amber-950/20",
              insight.color === "violet" && "border-violet-400 bg-violet-50 dark:bg-violet-950/20",
              insight.color === "rose" && "border-rose-400 bg-rose-50 dark:bg-rose-950/20",
            )}>
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <p className="text-sm flex-1">{insight.text}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => toast.success(`Action: ${insight.action}`, { description: insight.text })}>{insight.action}</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AIFeatureCard({
  title,
  desc,
  icon: Icon,
  color,
  stats,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <Card className="p-5 shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shrink-0", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
