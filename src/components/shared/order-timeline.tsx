"use client";

import { motion } from "framer-motion";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { ORDER_STAGE_FLOW } from "@/lib/mock-data";

// Lucide icon resolver for stage icons
import {
  ClipboardCheck,
  Store,
  BadgeCheck,
  CalendarClock,
  PackageCheck,
  Boxes,
  ListTree,
  Tag,
  WashingMachine,
  Wind,
  Shirt,
  Sparkles,
  SearchCheck,
  Package,
  Truck,
  Bike,
  Home,
  CircleCheck,
} from "lucide-react";

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  Store,
  BadgeCheck,
  CalendarClock,
  PackageCheck,
  Boxes,
  ListTree,
  Tag,
  WashingMachine,
  Wind,
  Shirt,
  Sparkles,
  SearchCheck,
  Package,
  Truck,
  Bike,
  Home,
  CircleCheck,
};

interface OrderTimelineProps {
  order: Order;
  variant?: "full" | "compact";
  className?: string;
}

export function OrderTimeline({ order, variant = "full", className }: OrderTimelineProps) {
  const currentIndex = order.currentStageIndex;
  const isCancelled = order.status === "cancelled";

  if (variant === "compact") {
    // Show only upcoming stages until completion
    const remaining = ORDER_STAGE_FLOW.slice(currentIndex + 1, 17);
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming Steps</p>
          <span className="text-xs text-muted-foreground">{remaining.length} remaining</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((stage, i) => {
            const Icon = STAGE_ICONS[stage.icon] || Circle;
            return (
              <div
                key={stage.stage}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon className="h-3 w-3" />
                {stage.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Order Progress</p>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {ORDER_STAGE_FLOW.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full bg-gradient-to-r",
              isCancelled ? "from-rose-400 to-rose-500" : "from-teal-400 via-emerald-500 to-cyan-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / ORDER_STAGE_FLOW.length) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="relative pl-2">
        {ORDER_STAGE_FLOW.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const Icon = STAGE_ICONS[stage.icon] || Circle;
          const event = order.stages[i];

          return (
            <motion.div
              key={stage.stage}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {/* Vertical line */}
              {i < ORDER_STAGE_FLOW.length - 1 && (
                <div
                  className={cn(
                    "absolute left-[15px] top-7 bottom-0 w-0.5",
                    done ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
              {/* Icon */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  done && "bg-primary border-primary text-primary-foreground",
                  active && "bg-background border-primary text-primary shadow-lift",
                  !done && !active && "bg-background border-muted text-muted-foreground"
                )}
              >
                {active && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/30"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              {/* Label */}
              <div className="pt-1 flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    done && "text-foreground",
                    active && "text-primary font-semibold",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </p>
                {event?.timestamp && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(event.timestamp).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {active && (
                  <p className="text-[11px] text-primary font-medium mt-0.5 flex items-center gap-1">
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    In progress…
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
