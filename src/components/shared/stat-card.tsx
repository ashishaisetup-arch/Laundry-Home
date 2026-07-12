"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  trend?: "up" | "down" | "flat";
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string; // gradient classes
  spark?: number[];
  className?: string;
  invertTrend?: boolean; // for metrics where down = good (e.g., cancellation rate)
}

export function StatCard({
  label,
  value,
  change,
  trend = "up",
  icon: Icon,
  accent = "from-teal-500 to-cyan-600",
  spark,
  className,
  invertTrend = false,
}: StatCardProps) {
  const isGood = invertTrend ? trend === "down" : trend === "up";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn("relative overflow-hidden p-5 shadow-soft hover:shadow-glow transition-shadow", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {value}
            </p>
            {change !== undefined && (
              <div className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                isGood ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                trend === "flat" ? "bg-muted text-muted-foreground" :
                "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
              )}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(change)}%
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft",
              accent
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {spark && spark.length > 0 && (
          <div className="mt-3 -mx-1 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark.map((v, i) => ({ i, v }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="oklch(0.62 0.13 180)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
