import { motion } from "framer-motion";
import { Check, Circle, XCircle } from "lucide-react";
import {
  ClipboardCheck,
  CalendarClock,
  PackageCheck,
  WashingMachine,
  Package,
  Bike,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import {
  CUSTOMER_MILESTONES,
  customerMilestoneIndex,
  getMilestoneEta,
  isMilestoneComplete,
  isOrderCancelled,
  milestoneTimestamp,
} from "@/lib/data/customer-milestones";

const MILESTONE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  CalendarClock,
  PackageCheck,
  WashingMachine,
  Package,
  Bike,
  Home,
};

interface CustomerOrderTimelineProps {
  order: Order;
  /** Optional live ETA (e.g. "Arriving in ~18 min") shown on the Out for Delivery node. */
  liveEta?: string;
  className?: string;
}

export function CustomerOrderTimeline({ order, liveEta, className }: CustomerOrderTimelineProps) {
  if (isOrderCancelled(order)) {
    return (
      <div className={cn("rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-5", className)}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
            <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Order Cancelled</p>
            <p className="text-xs text-rose-600/80 dark:text-rose-300/70 mt-0.5">
              This order was cancelled. Any applicable refund will be processed to your original payment method.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = customerMilestoneIndex(order);

  return (
    <div className={cn("relative", className)}>
      <div className="relative pl-2">
        {CUSTOMER_MILESTONES.map((milestone, i) => {
          const done = isMilestoneComplete(order, i);
          const active = i === activeIndex;
          const Icon = MILESTONE_ICONS[milestone.icon] || Circle;
          const timestamp = milestoneTimestamp(order, i);
          const eta = active ? getMilestoneEta(order, liveEta) : undefined;

          return (
            <motion.div
              key={milestone.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {/* Vertical line */}
              {i < CUSTOMER_MILESTONES.length - 1 && (
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
                {done ? <Check data-testid="milestone-check" className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              {/* Label + details */}
              <div className="pt-1 flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    done && "text-foreground",
                    active && "text-primary font-semibold",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {milestone.label}
                </p>
                {timestamp && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(timestamp).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {active && (
                  <div className="mt-1">
                    <p className="text-[11px] text-muted-foreground">{milestone.description}</p>
                    {eta && (
                      <p className="text-[11px] font-medium text-primary mt-0.5 flex items-center gap-1">
                        <motion.span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        {eta}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
