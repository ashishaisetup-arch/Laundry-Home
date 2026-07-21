
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
  accent?: string;
  spark?: number[];
  className?: string;
  invertTrend?: boolean;
}

export function StatCard({
  label,
  value,
  change,
  trend = "up",
  icon: Icon,
  accent,
  spark,
  className,
  invertTrend = false,
}: StatCardProps) {
  const isGood = invertTrend ? trend === "down" : trend === "up";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="hover-lift"
    >
      <Card className={cn("relative overflow-hidden p-6 shadow-soft hover:shadow-lift transition-shadow duration-300", className)}>
        <div className="flex items-start justify-between gap-4 mb-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
            {label}
          </p>
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tonal text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <p className="text-[28px] font-semibold tracking-tight leading-tight mt-2" style={{ fontFamily: "var(--font-inter)" }}>
          {value}
        </p>

        <div className="flex items-center gap-3 mt-2">
          {change !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium",
              isGood ? "text-emerald-600 dark:text-emerald-400" :
              trend === "flat" ? "text-muted-foreground" :
              "text-rose-600 dark:text-rose-400"
            )}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(change)}%
            </div>
          )}
          {spark && spark.length > 0 && (
            <div className="flex-1 h-6 -mx-1 opacity-70">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark.map((v, i) => ({ i, v }))}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="oklch(0.50 0.052 165)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
