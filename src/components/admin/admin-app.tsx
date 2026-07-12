"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import {
  VENDORS,
  ORDERS,
  ADMIN_KPIS,
  REVENUE_CHART,
  SERVICE_DEMAND,
  AREA_DEMAND,
  WEEKLY_TREND,
} from "@/lib/mock-data";
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
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
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
                <strong>642 live orders</strong> · <strong>₹62.4L</strong> monthly revenue · <strong>4.78★</strong> avg satisfaction
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Active", value: "642", color: "bg-white/15" },
                { label: "Completed", value: "20.8K", color: "bg-white/15" },
                { label: "Cancelled", value: "2.1%", color: "bg-rose-500/30" },
              ].map((s) => (
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
        {ADMIN_KPIS.slice(0, 4).map((kpi) => {
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
        {ADMIN_KPIS.slice(4).map((kpi) => {
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
              +18.9% MoM
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={REVENUE_CHART} margin={{ left: -16, right: 8 }}>
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
              <Pie data={SERVICE_DEMAND} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                {SERVICE_DEMAND.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-3">
            {SERVICE_DEMAND.map((s) => (
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
            {AREA_DEMAND.map((a) => (
              <div key={a.area} className="flex items-center gap-3">
                <span className="text-sm w-28 truncate">{a.area}</span>
                <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-md bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(a.orders / 3120) * 100}%` }}
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
            <LineChart data={WEEKLY_TREND} margin={{ left: -16, right: 8 }}>
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
            {[...VENDORS].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue).slice(0, 5).map((v, i) => (
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
            <Badge variant="outline" className="text-amber-600 border-amber-300">3 active</Badge>
          </div>
          <div className="space-y-2">
            {[
              { type: "delay", title: "LH-2849 medium delay risk", desc: "Vendor capacity at 78% · consider reassigning", color: "amber", icon: Clock },
              { type: "complaint", title: "Refund pending — LH-2812", desc: "Customer reported missing item · ₹220", color: "rose", icon: AlertTriangle },
              { type: "kyc", title: "Vendor KYC pending", desc: "UrbanFresh Laundry awaiting verification", color: "violet", icon: Shield },
            ].map((a, i) => (
              <div key={i} className={cn(
                "flex items-start gap-3 rounded-lg border-l-2 p-3",
                a.color === "amber" && "border-amber-400 bg-amber-50 dark:bg-amber-950/20",
                a.color === "rose" && "border-rose-400 bg-rose-50 dark:bg-rose-950/20",
                a.color === "violet" && "border-violet-400 bg-violet-50 dark:bg-violet-950/20",
              )}>
                <a.icon className={cn("h-4 w-4 mt-0.5 shrink-0", a.color === "amber" && "text-amber-600", a.color === "rose" && "text-rose-600", a.color === "violet" && "text-violet-600")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs">Resolve</Button>
              </div>
            ))}
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
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search vendors by name, area, city…" className="flex-1 bg-transparent px-2 py-2 outline-none text-sm" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">KYC pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-primary hover:bg-primary/90">
          <UserCheck className="h-4 w-4 mr-1.5" />
          Onboard Vendor
        </Button>
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
              {VENDORS.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white text-xs font-bold", v.logoColor)}>
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
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                    {v.kycStatus === "pending" && (
                      <Button size="sm" variant="outline" className="h-7 ml-1 text-xs" onClick={() => toast.success(`Vendor ${v.name} approved`, { description: "Welcome email sent." })}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
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
  const [filter, setFilter] = useState("all");
  const allOrders = [...ORDERS];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Orders", count: allOrders.length },
          { id: "active", label: "Active", count: allOrders.filter(o => !["completed", "cancelled"].includes(o.status)).length },
          { id: "delayed", label: "Delayed Risk", count: 1 },
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
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Total</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">AI Risk</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.map((o) => (
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Admin Commission
// ============================================================================
function AdminCommission() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Commission (Month)" value={formatINR(624000)} change={18.9} trend="up" icon={Percent} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Pending Settlements" value={formatINR(84200)} icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Settled This Month" value={formatINR(539800)} change={22.1} trend="up" icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Commission Rate" value="10.0%" icon={IndianRupee} accent="from-violet-500 to-purple-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Commission rules */}
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Commission Rules</h3>
          <div className="space-y-2">
            {[
              { type: "Fixed", label: "Standard rate", value: "10%", desc: "Applies to all vendors by default" },
              { type: "Percentage", label: "Premium vendor rate", value: "8%", desc: "Vendors with rating > 4.7" },
              { type: "Percentage", label: "New vendor rate", value: "5%", desc: "First 3 months after onboarding" },
              { type: "Promotional", label: "Weekend promo", value: "7%", desc: "Fri-Sun, until 31 Jul" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                </div>
                <p className="text-lg font-bold text-primary">{r.value}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Add new rule
          </Button>
        </Card>

        {/* Settlements */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Settlements</h3>
            <Button variant="ghost" size="sm" className="text-xs">View all</Button>
          </div>
          <div className="space-y-2">
            {VENDORS.slice(0, 5).map((v, i) => {
              const revenue = v.monthlyRevenue;
              const commission = revenue * 0.1;
              const settlement = revenue - commission;
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white text-xs font-bold", v.logoColor)}>
                    {v.logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">Commission: {formatINR(commission)} · Settled: {formatINR(settlement)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                    {i < 3 ? "settled" : "pending"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Admin Support
// ============================================================================
function AdminSupport() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Tickets" value="7" icon={Headphones} accent="from-amber-500 to-orange-600" />
        <StatCard label="Pending Refunds" value="3" value2="" icon={IndianRupee} accent="from-rose-500 to-pink-600" />
        <StatCard label="Avg Response" value="4 mins" change={-12} trend="down" invertTrend icon={Clock} accent="from-emerald-500 to-green-600" />
        <StatCard label="Resolution Rate" value="94.2%" change={2.1} trend="up" icon={CheckCircle2} accent="from-teal-500 to-cyan-600" />
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open Tickets <Badge variant="secondary" className="ml-1.5 text-[10px]">7</Badge></TabsTrigger>
          <TabsTrigger value="refunds">Refunds <Badge variant="secondary" className="ml-1.5 text-[10px]">3</Badge></TabsTrigger>
          <TabsTrigger value="escalated">Escalated <Badge variant="secondary" className="ml-1.5 text-[10px]">1</Badge></TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4">
          <div className="space-y-2">
            {[
              { id: "t1", code: "LH-2812", customer: "Priya Sharma", issue: "Missing item from delivery", priority: "high", time: "12 mins ago", assigned: false },
              { id: "t2", code: "LH-2810", customer: "Rohan Gupta", issue: "Stain not removed", priority: "medium", time: "1 hour ago", assigned: true, agent: "Ananya" },
              { id: "t3", code: "LH-2808", customer: "Sneha Reddy", issue: "Late delivery refund request", priority: "medium", time: "2 hours ago", assigned: true, agent: "Vikram" },
              { id: "t4", code: "LH-2805", customer: "Aarav Mehta", issue: "Wrong service charged", priority: "high", time: "3 hours ago", assigned: false },
              { id: "t5", code: "LH-2801", customer: "Karthik R", issue: "Garment damaged during wash", priority: "high", time: "5 hours ago", assigned: true, agent: "Ananya" },
            ].map((t) => (
              <Card key={t.id} className="p-4 shadow-soft hover:shadow-lift transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    t.priority === "high" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30"
                  )}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold">{t.code}</span>
                      <Badge variant="outline" className={cn(
                        "text-[9px] py-0 h-4",
                        t.priority === "high" ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                      )}>
                        {t.priority}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mt-0.5">{t.issue}</p>
                    <p className="text-xs text-muted-foreground">{t.customer} · {t.time}</p>
                  </div>
                  <div className="text-right">
                    {t.assigned ? (
                      <Badge variant="secondary" className="text-[10px]">{t.agent}</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs">Assign</Button>
                    )}
                  </div>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 h-7">
                    Resolve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Admin Marketing
// ============================================================================
function AdminMarketing() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value="6" icon={Megaphone} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Coupons Redeemed" value="2,840" change={14.2} trend="up" icon={Percent} accent="from-emerald-500 to-green-600" />
        <StatCard label="Email Open Rate" value="42.8%" change={3.1} trend="up" icon={Mail} accent="from-violet-500 to-purple-600" />
        <StatCard label="Push CTR" value="8.4%" change={1.2} trend="up" icon={Bell} accent="from-amber-500 to-orange-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Active Campaigns</h3>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              New Campaign
            </Button>
          </div>
          <div className="space-y-2">
            {[
              { name: "Weekend Special — 25% off", type: "Coupon", reach: "12.4K", redeemed: 842, status: "active" },
              { name: "FRESH50 — First order", type: "Coupon", reach: "4.2K", redeemed: 1240, status: "active" },
              { name: "Monsoon loyalty rewards", type: "Loyalty", reach: "8.1K", redeemed: 320, status: "active" },
              { name: "Refer & earn ₹100", type: "Referral", reach: "48K", redeemed: 186, status: "active" },
              { name: "Independence Day offer", type: "Festival", reach: "—", redeemed: 0, status: "scheduled" },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.type} · Reach: {c.reach} · Redeemed: {c.redeemed}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px]", c.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30")}>
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Notification Channels</h3>
          <div className="space-y-2">
            {[
              { channel: "Push Notification", icon: Bell, sent: "12.4K", delivered: "98.2%", color: "bg-teal-50 text-teal-600 dark:bg-teal-950/30" },
              { channel: "Email", icon: Mail, sent: "8.2K", delivered: "94.1%", color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30" },
              { channel: "SMS", icon: MessageSquare, sent: "6.8K", delivered: "97.8%", color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" },
              { channel: "WhatsApp", icon: MessageSquare, sent: "4.2K", delivered: "96.4%", color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30" },
            ].map((c) => (
              <div key={c.channel} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", c.color)}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.channel}</p>
                  <p className="text-[11px] text-muted-foreground">{c.sent} sent · {c.delivered} delivered</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs">Compose</Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Admin Reports
// ============================================================================
function AdminReports() {
  const reports = [
    { name: "Revenue Report", desc: "Monthly revenue by vendor, area and service", icon: IndianRupee, color: "from-teal-500 to-cyan-600" },
    { name: "Commission Report", desc: "Commission earned, settlements and outstanding", icon: Percent, color: "from-violet-500 to-purple-600" },
    { name: "Vendor Performance", desc: "Vendor ratings, turnaround time and capacity", icon: Store, color: "from-emerald-500 to-green-600" },
    { name: "Customer Growth", desc: "New signups, retention and churn analysis", icon: Users, color: "from-amber-500 to-orange-600" },
    { name: "Orders Report", desc: "Order volume, AOV and completion rate", icon: Package, color: "from-rose-500 to-pink-600" },
    { name: "Service Demand", desc: "Service-wise demand trends and forecasts", icon: BarChart3, color: "from-sky-500 to-cyan-600" },
    { name: "Refunds & Complaints", desc: "Refund volume, complaint types and resolution", icon: Headphones, color: "from-orange-500 to-red-600" },
    { name: "Tax Report (GST)", desc: "GST collected, paid and net liability", icon: FileText, color: "from-lime-500 to-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map((r) => (
          <motion.div key={r.name} whileHover={{ y: -2 }}>
            <Card className="p-5 shadow-soft hover:shadow-lift transition-shadow cursor-pointer">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-3", r.color)}>
                <r.icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm">{r.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.desc}</p>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-border/60">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
                  <FileText className="h-3 w-3 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
                  <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs">
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
          {[
            { name: "Weekly Revenue Digest", schedule: "Every Monday at 9 AM", recipients: 3, lastSent: "5 days ago" },
            { name: "Monthly Vendor Performance", schedule: "1st of every month", recipients: 5, lastSent: "12 days ago" },
            { name: "Daily Operations Summary", schedule: "Every day at 11 PM", recipients: 4, lastSent: "14 hours ago" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">{r.schedule} · {r.recipients} recipients · Last sent: {r.lastSent}</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs">Edit</Button>
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
            { label: "Orders auto-assigned today", value: "412" },
            { label: "Avg match confidence", value: "92%" },
            { label: "Reassignments avoided", value: "38" },
          ]}
        />

        {/* Delivery Time Prediction */}
        <AIFeatureCard
          title="Delivery Time Prediction"
          desc="ML model predicts accurate completion times using historical data, vendor capacity and traffic."
          icon={Clock}
          color="from-emerald-500 to-green-600"
          stats={[
            { label: "Predictions made today", value: "642" },
            { label: "Avg accuracy", value: "94.2%" },
            { label: "MAE (mean abs error)", value: "1.8 hrs" },
          ]}
        />

        {/* Price Estimation */}
        <AIFeatureCard
          title="Price Estimation"
          desc="Real-time price estimation for customers before booking, factoring in services, express, and dynamic pricing."
          icon={IndianRupee}
          color="from-amber-500 to-orange-600"
          stats={[
            { label: "Estimates generated", value: "2.4K" },
            { label: "Conversion rate", value: "68%" },
            { label: "Avg estimate accuracy", value: "98.1%" },
          ]}
        />

        {/* Delay Prediction */}
        <AIFeatureCard
          title="Delay Prediction"
          desc="Predicts delayed orders 4+ hours in advance and alerts vendor, customer and admin with mitigation actions."
          icon={AlertTriangle}
          color="from-rose-500 to-pink-600"
          stats={[
            { label: "Delay predictions today", value: "28" },
            { label: "True positive rate", value: "89%" },
            { label: "Avg lead time", value: "4.2 hrs" },
          ]}
        />

        {/* Demand Forecasting */}
        <AIFeatureCard
          title="Demand Forecasting"
          desc="Forecasts demand by area, day, season and festival to help vendors plan capacity and staffing."
          icon={TrendingUp}
          color="from-violet-500 to-purple-600"
          stats={[
            { label: "7-day forecast accuracy", value: "91%" },
            { label: "Areas monitored", value: "48" },
            { label: "Peak demand predicted", value: "Sat 6 PM" },
          ]}
        />

        {/* Personalized Recommendations */}
        <AIFeatureCard
          title="Personalized Recommendations"
          desc="Recommends vendors, services, subscription plans and offers personalized to each customer."
          icon={Sparkles}
          color="from-sky-500 to-cyan-600"
          stats={[
            { label: "Recommendations served", value: "12.4K" },
            { label: "Click-through rate", value: "24.8%" },
            { label: "Conversion uplift", value: "+18.2%" },
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
              <Button size="sm" variant="outline" className="h-7 text-xs">{insight.action}</Button>
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
