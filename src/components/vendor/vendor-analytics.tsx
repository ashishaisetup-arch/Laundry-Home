import { useEffect } from "react";
import { motion } from "framer-motion";
import { Package, IndianRupee, TrendingUp, Repeat, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { useVendorWeeklyRevenue, useVendorServiceRevenue, useVendorDashboardStats } from "@/lib/hooks/useVendorAnalytics";
import { formatINR } from "@/lib/utils";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMyVendorId } from "./vendor-helpers";

export function VendorAnalytics() {
  const vid = useMyVendorId();
  const { data: weeklyRevenue, refetch: refetchWeekly } = useVendorWeeklyRevenue(vid);
  const { data: serviceRevenue, refetch: refetchService } = useVendorServiceRevenue(vid);
  const { data: stats, refetch: refetchStats } = useVendorDashboardStats(vid);
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(() => { refetchWeekly(); refetchService(); refetchStats(); }, 60000);
    return () => clearInterval(interval);
  }, [vid, refetchWeekly, refetchService, refetchStats]);
  const wr = weeklyRevenue || [];
  const sr = serviceRevenue || [];
  const s = stats || {
    totalOrdersThisWeek: 0, weeklyRevenue: 0, avgOrderValue: 0, repeatRate: 0,
    avgRating: 0, totalReviews: 0, ratingBuckets: {}, todayOrders: 0, todayRevenue: 0,
  };
  const totalReviews = s.totalReviews || 0;
  const ratingBuckets = s.ratingBuckets || {};
  const buckets = [5, 4, 3, 2, 1].map((star) => {
    const count = ratingBuckets[star] || 0;
    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { star, count, pct };
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Orders This Week" value={String(s.totalOrdersThisWeek)} change={0} trend="up" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Weekly Revenue" value={formatINR(s.weeklyRevenue)} change={0} trend="up" icon={IndianRupee} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Order Value" value={formatINR(s.avgOrderValue)} change={0} trend="up" icon={TrendingUp} accent="from-violet-500 to-purple-600" />
        <StatCard label="Repeat Customers" value={`${s.repeatRate}%`} change={0} trend="up" icon={Repeat} accent="from-amber-500 to-orange-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Orders & Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wr} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹)" fill="#6B9C8E" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#A89B7B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Service-wise Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={sr}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry: any) => `${entry.name}`}
                labelLine={false}
              >
                {sr.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Customer Ratings Breakdown</h3>
        <div className="space-y-2">
          {buckets.map((r) => (
            <div key={r.star} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-12">
                <span className="text-sm font-medium">{r.star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-amber-500"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${r.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">{r.count} reviews</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{s.avgRating}</p>
            <p className="text-xs text-muted-foreground">Average rating · {totalReviews} reviews</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
