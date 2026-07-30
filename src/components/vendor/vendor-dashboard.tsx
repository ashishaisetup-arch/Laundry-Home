import { useEffect } from "react";
import { motion } from "framer-motion";
import { Package, IndianRupee, Clock, Star, TrendingUp, Repeat, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { useOrders } from "@/lib/hooks";
import { useVendorWeeklyRevenue, useVendorServiceRevenue } from "@/lib/hooks/useVendorAnalytics";
import { useAppStore } from "@/lib/store";
import { useFetch } from "@/lib/hooks/use-fetch";
import { api } from "@/lib/api/client";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useMyVendorId } from "./vendor-helpers";

export function VendorDashboard() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  const { data: weeklyRevenue } = useVendorWeeklyRevenue(vid);
  const { data: serviceRevenue } = useVendorServiceRevenue(vid);
  const userId = useAppStore((s) => s.userId);
  const { data: vendorInfo } = useFetch<{ name: string; rating: number; logoColor: string }[]>(
    userId ? `/api/vendors?owner_id=${userId}` : null
  );
  const vendorName = vendorInfo?.[0]?.name || "Vendor";
  const vendorRating = vendorInfo?.[0]?.rating || 0;

  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const orderList = orders || [];
  const pendingOrders = orderList.filter((o) => ["placed", "vendor_assigned"].includes(o.status));
  const todayOrders = orderList.filter((o) => o.createdAt?.startsWith(todayStr));
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingCount = pendingOrders.length;
  const todayOrderCount = todayOrders.length;

  const wr = weeklyRevenue || [];
  const sr = serviceRevenue || [];
  const weeklyTotal = wr.reduce((s, d) => s + (d.revenue || 0), 0);
  const maxDaily = Math.max(...wr.map((d) => d.orders || 0), 1);
  const capacityUsed = Math.min(Math.round((todayOrderCount / maxDaily) * 100), 100);
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0">● Online</Badge>
                <Badge className="bg-white/20 text-white border-0">Verified Vendor</Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Good afternoon, {vendorName}! 👋
              </h2>
              <p className="text-sm text-white/80 mt-1">
                You have <strong>{pendingCount} new order{pendingCount !== 1 ? "s" : ""}</strong> waiting · Today&apos;s revenue: <strong>{formatINR(todayRevenue)}</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Today&apos;s Revenue</p>
                <p className="text-xl font-bold mt-0.5">{formatINR(todayRevenue)}</p>
                <p className="text-[10px] text-emerald-200">{todayOrderCount} order{todayOrderCount !== 1 ? "s" : ""} today</p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Capacity Used</p>
                <p className="text-xl font-bold mt-0.5">{capacityUsed}%</p>
                <p className="text-[10px] text-white/70">{100 - capacityUsed}% available</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Orders" value={String(todayOrderCount)} change={0} trend="up" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Today's Revenue" value={formatINR(todayRevenue)} change={0} trend="up" icon={IndianRupee} accent="from-emerald-500 to-green-600" />
        <StatCard label="Pending Acceptance" value={String(pendingCount)} icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Avg Rating" value={`${vendorRating}★`} change={0} trend="up" icon={Star} accent="from-violet-500 to-purple-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Weekly Revenue</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · {formatINR(weeklyTotal)} total</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={wr} margin={{ left: -16, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6B9C8E" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6B9C8E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }}
                formatter={(v: number) => [formatINR(v), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6B9C8E" strokeWidth={2.5} fill="url(#rev-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-1">Revenue by Service</h3>
          <p className="text-xs text-muted-foreground mb-3">This month</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sr}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
              >
                {sr.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }}
                formatter={(v: number) => formatINR(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {sr.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1">{s.name}</span>
                <span className="font-semibold">{formatINR(s.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Pending Orders</h3>
            <Button variant="ghost" size="sm" className="text-xs">View all</Button>
          </div>
          <div className="space-y-2">
            {(orders || []).filter((o) => ["placed", "vendor_assigned", "vendor_accepted", "pickup_scheduled"].includes(o.status)).map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-muted text-xs font-semibold">{o.customerAvatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{o.code}</p>
                    {o.express && <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600">Express</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{o.customerName} · {o.garmentCount} items</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatINRDecimal(o.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{o.pickupSlot}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                    onClick={async () => {
                      try {
                        await api.post(`/api/orders/${o.id}/reject`);
                        toast.success(`Order ${o.code} rejected`, { description: "Reassigned to next available vendor." });
                        refetchOrders();
                      } catch (e: any) { toast.error("Failed to reject order", { description: e.message }); }
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-primary hover:bg-primary/90"
                    onClick={async () => {
                      try {
                        await api.patch(`/api/orders/${o.id}`, { status: "vendor_accepted", currentStageIndex: 2 });
                        toast.success(`Order ${o.code} accepted`, { description: "Customer has been notified." });
                        refetchOrders();
                      } catch (e: any) { toast.error("Failed to accept order", { description: e.message }); }
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <StatCard label="Avg Turnaround" value="22 hrs" change={-6.2} trend="down" invertTrend icon={Clock} accent="from-lime-500 to-emerald-600" />
          <StatCard label="Repeat Customers" value="78%" change={4.5} trend="up" icon={Repeat} accent="from-violet-500 to-purple-600" />
          <StatCard label="Monthly Revenue" value={formatINR(428000)} change={15.8} trend="up" icon={TrendingUp} accent="from-amber-500 to-orange-600" />
        </div>
      </div>
    </div>
  );
}
