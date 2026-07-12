"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Star,
  Truck,
  User,
  Clock,
  Sparkles,
  Shield,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { OrderTimeline } from "@/components/shared/order-timeline";
import { ServiceIcon } from "@/components/shared/service-icon";
import { ORDERS, ORDER_STAGE_FLOW } from "@/lib/mock-data";
import { cn, formatINRDecimal, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface OrderTrackingProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderTracking({ orderId, onClose }: OrderTrackingProps) {
  const [cancelled, setCancelled] = useState(false);
  const order = ORDERS.find((o) => o.id === orderId);
  if (!order) return null;

  const currentStage = ORDER_STAGE_FLOW[order.currentStageIndex];
  const isCancellable = !["completed", "cancelled", "delivered", "out_for_delivery"].includes(order.status) && !cancelled;

  const handleCancel = () => {
    setCancelled(true);
    toast.success(`Order ${order.code} cancelled`, {
      description: `Refund of ${formatINRDecimal(order.total)} will be processed in 3-5 business days.`,
    });
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Track order {order.code}</DialogTitle>

        {/* Header with live status */}
        <div className="relative overflow-hidden bg-primary-surface p-5 text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-white/80">LIVE ORDER</span>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {order.code}
                </h2>
                <p className="text-sm text-white/80 mt-0.5">{order.vendorName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/80">Current stage</p>
                <p className="text-lg font-semibold">{currentStage?.label}</p>
                <p className="text-xs text-white/80 mt-0.5">
                  <Clock className="inline h-3 w-3 mr-0.5" />
                  ETA {formatDateTime(order.estimatedDeliveryAt)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${((order.currentStageIndex + 1) / ORDER_STAGE_FLOW.length) * 100}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/80 mt-1">
                <span>Placed</span>
                <span>Processing</span>
                <span>Delivery</span>
                <span>Completed</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 p-5">
          {/* Timeline (left, 2 cols) */}
          <div className="md:col-span-2 space-y-4">
            <Card className="p-5 shadow-soft">
              <h3 className="font-semibold mb-1">Order Progress</h3>
              <p className="text-xs text-muted-foreground mb-4">Real-time updates from {order.vendorName}</p>
              <OrderTimeline order={order} />
            </Card>

            {/* Map placeholder */}
            <Card className="p-0 overflow-hidden shadow-soft">
              <div className="relative h-48 bg-gradient-to-br from-teal-100 via-emerald-100 to-cyan-100 dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-cyan-950/40">
                {/* Faux map grid */}
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: `
                    linear-gradient(oklch(0.62 0.13 180 / 0.15) 1px, transparent 1px),
                    linear-gradient(90deg, oklch(0.62 0.13 180 / 0.15) 1px, transparent 1px)
                  `,
                  backgroundSize: "30px 30px",
                }} />
                {/* Route line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <motion.path
                    d="M 60 150 Q 150 50 200 100 T 340 60"
                    stroke="oklch(0.62 0.13 180)"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  />
                </svg>
                {/* Pickup marker */}
                <div className="absolute bottom-12 left-12 flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg ring-4 ring-white">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold mt-1 bg-white/80 px-1.5 rounded">Pickup</span>
                </div>
                {/* Vendor marker */}
                <div className="absolute top-12 right-16 flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg ring-4 ring-white">
                    <span className="text-xs font-bold">{order.vendorLogoInitials}</span>
                  </div>
                  <span className="text-[10px] font-semibold mt-1 bg-white/80 px-1.5 rounded">Vendor</span>
                </div>
                {/* Delivery exec moving */}
                <motion.div
                  className="absolute flex flex-col items-center"
                  animate={{
                    left: ["15%", "40%", "60%", "80%"],
                    top: ["70%", "45%", "30%", "25%"],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-white">
                    <Bike className="h-4 w-4" />
                  </div>
                </motion.div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Navigation className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Rajesh is on the way</span>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Open in Maps
                </Button>
              </div>
            </Card>

            {/* Items */}
            <Card className="p-5 shadow-soft">
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5">
                    <ServiceIcon serviceKey={item.serviceKey} className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.qty} {item.unit} × ₹{item.unitPrice}
                        {item.express && <Badge variant="outline" className="ml-1 text-[9px] py-0 h-3.5 border-amber-400 text-amber-600">Express</Badge>}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{formatINRDecimal(item.qty * item.unitPrice * (item.express ? 1.5 : 1))}</p>
                  </div>
                ))}
              </div>
              {order.notes && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border-l-2 border-amber-400">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">YOUR NOTES</p>
                  <p className="text-xs text-foreground/80 mt-0.5">{order.notes}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Delivery exec */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Delivery Executive</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
                    RK
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{order.deliveryExecutiveName || "Rajesh Kumar"}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    4.9 · 1,240 deliveries
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button variant="outline" size="sm" className="h-9">
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Call
                </Button>
                <Button variant="outline" size="sm" className="h-9">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Chat
                </Button>
              </div>
            </Card>

            {/* Vendor */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vendor</p>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white text-sm font-bold",
                  order.vendorLogoColor
                )}>
                  {order.vendorLogoInitials}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{order.vendorName}</p>
                  <p className="text-xs text-muted-foreground">{order.pickupArea}</p>
                </div>
              </div>
            </Card>

            {/* AI prediction */}
            {order.aiPrediction && (
              <Card className="p-4 shadow-soft bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-primary">AI Prediction</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-semibold">{(order.aiPrediction.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. completion</span>
                    <span className="font-semibold">{order.aiPrediction.estimatedCompletionHrs}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Delay risk</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] py-0 h-4",
                        order.aiPrediction.delayRisk === "low" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                        order.aiPrediction.delayRisk === "medium" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                        order.aiPrediction.delayRisk === "high" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                      )}
                    >
                      {order.aiPrediction.delayRisk}
                    </Badge>
                  </div>
                  {order.aiPrediction.delayReason && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                      ⚠ {order.aiPrediction.delayReason}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Payment summary */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{formatINRDecimal(order.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span>{formatINRDecimal(order.taxes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span>{formatINRDecimal(order.platformFee)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatINRDecimal(order.deliveryFee)}</span></div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatINRDecimal(order.total)}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">{order.paymentMethod}</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                    {order.paymentStatus}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Support */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Need help?</p>
              <div className="space-y-1.5">
                <button className="w-full flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted/30 transition-colors">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Contact support
                </button>
                <button className="w-full flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted/30 transition-colors text-rose-600">
                  <Shield className="h-4 w-4" />
                  Report an issue
                </button>
              </div>
              {isCancellable && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full mt-3 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/30">
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Cancel this order
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
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
              {cancelled && (
                <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 border-l-2 border-rose-400">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Order Cancelled</p>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-300/70 mt-0.5">
                    Refund of {formatINRDecimal(order.total)} is being processed.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
