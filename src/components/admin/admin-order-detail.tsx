import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  IndianRupee,
  MapPin,
  Phone,
  Truck,
  User,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { ServiceIcon } from "@/components/shared/service-icon";
import { useFetch } from "@/lib/hooks/use-fetch";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { api } from "@/lib/api/client";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import { cn, formatINRDecimal, formatDateTime } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { toast } from "sonner";

interface AdminOrderDetailProps {
  orderId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function AdminOrderDetail({ orderId, onClose, onUpdated }: AdminOrderDetailProps) {
  const { data: order, loading, refetch } = useFetch<Order>(orderId ? `/api/orders/${orderId}` : null);
  const { data: executives } = useFetch<{ id: string; name: string; isAvailable: boolean; assignedOrders: number; maxDailyOrders: number; distanceKm?: number }[]>("/api/delivery-executives");
  useRealtime("orders", orderId ? `id=eq.${orderId}` : undefined, refetch, !!orderId);
  const [assigning, setAssigning] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!orderId || loading || !order) return null;

  const currentStage = ORDER_STAGE_FLOW[order.currentStageIndex];
  const isCancelledOrDone = ["delivered", "completed", "cancelled"].includes(order.status);
  const deliveryName = order.deliveryExecutiveName;

  const handleAssignDelivery = async (execId: string) => {
    try {
      setAssigning(true);
      await api.post(`/api/orders/${orderId}/assign-delivery`, { delivery_executive_id: execId });
      toast.success("Delivery partner assigned");
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error("Assignment failed", { description: e.message });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    try {
      setAssigning(true);
      await api.post(`/api/orders/${orderId}/assign-delivery`, { delivery_executive_id: null });
      toast.success("Delivery partner unassigned");
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error("Failed", { description: e.message });
    } finally {
      setAssigning(false);
    }
  };

  const handleAdvance = async () => {
    const idx = ORDER_STAGE_FLOW.findIndex((s) => s.stage === order.status);
    const nextStage = ORDER_STAGE_FLOW[idx + 1];
    if (!nextStage) return;
    try {
      setAdvancing(true);
      await api.patch(`/api/orders/${orderId}`, { status: nextStage.stage, currentStageIndex: idx + 1 });
      toast.success(`Advanced to ${nextStage.label}`);
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error("Advance failed", { description: e.message });
    } finally {
      setAdvancing(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      await api.post(`/api/orders/${orderId}/cancel`);
      toast.success(`Order ${order.code} cancelled`);
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error("Cancel failed", { description: e.message });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Order {order.code || order.id?.slice(0, 8)}</DialogTitle>

        {/* Header */}
        <div className="relative overflow-hidden bg-primary-surface p-5 text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-white/80">ORDER</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </div>
              <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {order.code || `Order #${order.id?.slice(0, 8)}`}
              </h2>
              <p className="text-sm text-white/80 mt-0.5">{order.customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/80">Current stage</p>
              <p className="text-lg font-semibold">{currentStage?.label || order.status}</p>
              <p className="text-xs text-white/80 mt-0.5">
                <Clock className="inline h-3 w-3 mr-0.5" />
                Stage {order.currentStageIndex + 1}/{ORDER_STAGE_FLOW.length}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", isCancelledOrDone ? "bg-rose-300" : "bg-white")}
                initial={{ width: 0 }}
                animate={{ width: `${((order.currentStageIndex + 1) / ORDER_STAGE_FLOW.length) * 100}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 p-5">
          {/* Left — Timeline + Items */}
          <div className="md:col-span-2 space-y-4">
            <Card className="p-4 shadow-soft">
              <h3 className="font-semibold mb-1">Order Progress</h3>
              <p className="text-xs text-muted-foreground mb-4">{order.customerName} · {order.pickupArea}</p>
              <OrderTimeline order={order} />
            </Card>

            <Card className="p-4 shadow-soft">
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-2">
                {(order.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5">
                    <ServiceIcon serviceKey={item.serviceKey} className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.serviceName || "Item"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.qty || 0} {item.unit || "pc"} × ₹{item.unitPrice || 0}
                        {item.express && <Badge variant="outline" className="ml-1 text-[9px] py-0 h-3.5 border-amber-400 text-amber-600">Express</Badge>}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{formatINRDecimal((item.qty || 0) * (item.unitPrice || 0) * (item.express ? 1.5 : 1))}</p>
                  </div>
                ))}
              </div>
              {order.notes && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border-l-2 border-amber-400">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">NOTES</p>
                  <p className="text-xs text-foreground/80 mt-0.5">{order.notes}</p>
                </div>
              )}
            </Card>

            {/* Pickup / delivery info */}
            <Card className="p-4 shadow-soft">
              <h3 className="font-semibold mb-3">Schedule</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium">{order.pickupDate ? formatDateTime(order.pickupDate) : "—"}</p>
                  <p className="text-xs text-muted-foreground">{order.pickupSlot}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="font-medium">{order.deliveryDate ? formatDateTime(order.deliveryDate) : "—"}</p>
                  <p className="text-xs text-muted-foreground">{order.deliverySlot}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {order.pickupAddress || order.pickupArea || "—"}
              </div>
            </Card>
          </div>

          {/* Right — Customer, Payment, Actions */}
          <div className="space-y-4">
            {/* Customer info */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs">
                    {(order.customerName || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.pickupArea || "—"}</p>
                </div>
              </div>
            </Card>

            {/* Vendor info */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vendor</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs">
                    {(order.vendorName || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{order.vendorName || "—"}</p>
                </div>
              </div>
            </Card>

            {/* Delivery Partner */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Delivery Partner</p>
              {deliveryName ? (
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-600 text-white text-xs">
                      {deliveryName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{deliveryName}</p>
                    <p className="text-xs text-muted-foreground">Delivery partner</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-2">Not assigned</p>
              )}
              {!isCancelledOrDone && (
                <div className="flex gap-2">
                  <Select onValueChange={handleAssignDelivery} disabled={assigning}>
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue placeholder={deliveryName ? "Change" : "Assign"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(executives || [])
                        .sort((a, b) => {
                          if (a.isAvailable && !b.isAvailable) return -1;
                          if (!a.isAvailable && b.isAvailable) return 1;
                          return (a.assignedOrders || 0) - (b.assignedOrders || 0);
                        })
                        .map((ex) => (
                        <SelectItem
                          key={ex.id}
                          value={ex.id}
                          className="text-xs"
                          disabled={!ex.isAvailable}
                        >
                          {ex.name} ({ex.assignedOrders || 0}/{ex.maxDailyOrders || 10})
                          {ex.distanceKm ? ` · ${ex.distanceKm}km` : ""}
                          {!ex.isAvailable ? " (busy)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deliveryName && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={handleUnassign}
                      disabled={assigning}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Payment summary */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{formatINRDecimal(order.amount || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span>{formatINRDecimal(order.taxes || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span>{formatINRDecimal(order.platformFee || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatINRDecimal(order.deliveryFee || 0)}</span></div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatINRDecimal(order.total || 0)}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">{order.paymentMethod || "Wallet"}</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                    {order.paymentStatus || "pending"}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Actions */}
            {!isCancelledOrDone && (
              <Card className="p-4 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions</p>
                <div className="space-y-2">
                  {order.currentStageIndex < ORDER_STAGE_FLOW.length - 1 && (
                    <Button
                      size="sm"
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={handleAdvance}
                      disabled={advancing}
                    >
                      <ArrowRight className="h-4 w-4 mr-1.5" />
                      Advance to Next Stage
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Cancel Order
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard?.writeText(order.id || "");
                      toast.success("Order ID copied");
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    Copy Order ID
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
