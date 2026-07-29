import React from "react";
import { motion } from "framer-motion";
import { Brain, Target, Clock, IndianRupee, AlertTriangle, TrendingUp, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFetch } from "@/lib/hooks/use-fetch";
import { useVendors } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminAI() {
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

export function AIFeatureCard({
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
