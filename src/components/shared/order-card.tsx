"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Clock, MapPin, Package, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Order } from "@/lib/types";
import { ORDER_STAGE_FLOW } from "@/lib/mock-data";
import { ServiceIcon } from "./service-icon";
import { cn, formatINRDecimal, formatTime, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  className?: string;
  showVendor?: boolean;
  onCancel?: (orderId: string) => void;
}

export function OrderCard({ order, onClick, className, showVendor = true, onCancel }: OrderCardProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const currentStage = ORDER_STAGE_FLOW[order.currentStageIndex];
  const totalStages = ORDER_STAGE_FLOW.length;
  const progress = ((order.currentStageIndex + 1) / totalStages) * 100;

  const isCancellable = !["completed", "cancelled", "delivered", "out_for_delivery"].includes(order.status);

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelOpen(false);
    if (onCancel) {
      onCancel(order.id);
    } else {
      toast.success(`Order ${order.code} cancelled`, {
        description: "Refund will be processed within 3-5 business days.",
      });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "overflow-hidden p-0 cursor-pointer transition-all duration-300 hover:shadow-lift shadow-soft",
          order.status === "cancelled" && "opacity-70",
          className
        )}
        onClick={onClick}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-surface text-primary-foreground font-semibold text-sm shadow-soft",
                order.vendorLogoColor
              )}>
                {order.vendorLogoInitials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{order.code}</p>
                  {order.express && (
                    <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5 border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                      <Clock className="h-2.5 w-2.5" />
                      Express
                    </Badge>
                  )}
                  {order.status === "cancelled" && (
                    <Badge variant="outline" className="text-[10px] py-0 h-5 border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30">
                      Cancelled
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {showVendor ? order.vendorName : order.customerName}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-sm">{formatINRDecimal(order.total)}</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] py-0 h-5 mt-1",
                  order.paymentStatus === "paid" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                  order.paymentStatus === "pending" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                  order.paymentStatus === "refunded" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                )}
              >
                {order.paymentStatus}
              </Badge>
            </div>
          </div>

          {/* Items */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-[11px] font-medium">
                <ServiceIcon serviceKey={item.serviceKey} className="h-3 w-3" size={12} />
                {item.qty} {item.unit} · {item.serviceName}
              </div>
            ))}
          </div>

          {/* Stage progress — only show for active orders */}
          {order.status !== "cancelled" && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-medium text-primary">{currentStage?.label}</span>
                <span className="text-muted-foreground">
                  ETA {formatDate(order.estimatedDeliveryAt)} · {formatTime(order.estimatedDeliveryAt)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", order.status === "cancelled" ? "bg-rose-400" : "bg-primary")}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {order.garmentCount} items
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {order.pickupArea}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isCancellable && (
                <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel order {order.code}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The vendor will be notified and a full refund of {formatINRDecimal(order.total)} will be initiated to your original payment method within 3-5 business days.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Order</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        Yes, Cancel Order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Track
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
