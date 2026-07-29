import { motion } from "framer-motion";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { StatCard } from "@/components/shared/stat-card";
import { useVendors, useAdminKpis, useAdminAnalytics } from "@/lib/hooks";
import { cn, formatINR } from "@/lib/utils";
import { ICONS } from "./admin-helpers";

export function AdminDashboard() {
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
