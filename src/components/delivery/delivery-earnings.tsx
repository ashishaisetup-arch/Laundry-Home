import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IndianRupee, Calendar, Bike, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export function DeliveryEarnings() {
  const [data, setData] = useState<{
    todayEarnings: number;
    weekEarnings: number;
    totalTrips: number;
    avgPerTrip: number;
    weekChart: { day: string; earnings: number }[];
    recentPayouts: { id: string; amount: number; method: string; status: string; date: string; description: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{
      todayEarnings: number;
      weekEarnings: number;
      totalTrips: number;
      avgPerTrip: number;
      weekChart: { day: string; earnings: number }[];
      recentPayouts: { id: string; amount: number; method: string; status: string; date: string; description: string }[];
    }>("/api/delivery-executives/earnings")
      .then(setData)
      .catch(() => toast.error("Failed to load earnings"))
      .finally(() => setLoading(false));
  }, []);

  const hasData = data && data.totalTrips > 0;
  const chartData = data?.weekChart || [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Earnings" value={data ? `₹${data.todayEarnings}` : "₹0"} icon={IndianRupee} accent="from-teal-500 to-cyan-600" />
        <StatCard label="This Week" value={data ? `₹${data.weekEarnings}` : "₹0"} icon={Calendar} accent="from-emerald-500 to-green-600" />
        <StatCard label="Total Trips" value={data ? String(data.totalTrips) : "0"} icon={Bike} accent="from-violet-500 to-purple-600" />
        <StatCard label="Avg Per Trip" value={data ? `₹${data.avgPerTrip}` : "₹0"} icon={TrendingUp} accent="from-amber-500 to-orange-600" />
      </div>

      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Weekly Earnings</h3>
            <p className="text-xs text-muted-foreground">
              {hasData ? `₹${data!.weekEarnings} this week` : "No earnings data yet"}
            </p>
          </div>
        </div>
        {hasData && chartData.length > 0 ? (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number) => [`₹${value}`, "Earnings"]}
                />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
            {loading ? "Loading..." : "Start completing deliveries to see your earnings"}
          </div>
        )}
      </Card>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Recent Payouts</h3>
        {hasData && data!.recentPayouts.length > 0 ? (
          <div className="space-y-2">
            {data!.recentPayouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">{p.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(p.date).toLocaleDateString("en-IN")} · {p.method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">₹{p.amount}</p>
                  <Badge variant={p.status === "completed" ? "secondary" : "outline"} className="text-[9px] py-0 h-4 capitalize">
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {loading ? "Loading..." : "No payouts yet"}
          </p>
        )}
      </Card>
    </motion.div>
  );
}
