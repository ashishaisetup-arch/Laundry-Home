
import { useState, useEffect } from "react";
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
  PenLine,
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
import { LeafletMap } from "@/components/shared/leaflet-map";
import { useOrder } from "@/lib/hooks";
import { useLiveLocation } from "@/lib/hooks/useLiveLocation";
import { api } from "@/lib/api/client";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import { cn, formatINRDecimal, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { ReviewDialog } from "./review-dialog";

interface OrderTrackingProps {
  orderId: string | null;
  onClose: () => void;
  onCancel?: () => void;
}

export function OrderTracking({ orderId, onClose, onCancel }: OrderTrackingProps) {
  const [cancelled, setCancelled] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { data: order, loading } = useOrder(orderId || "");
  const liveLoc = useLiveLocation(order?.deliveryExecutiveId || null);
  const [route, setRoute] = useState<{ coordinates: [number, number][]; distance: number; duration: number } | null>(null);

  const patchOrder = useAppStore((s) => s.patchOrder);

  useEffect(() => {
    if (!orderId || loading || !order) return;
    const origin = liveLoc?.lat != null ? { lat: liveLoc.lat, lng: liveLoc.lng } : null;
    const dest = order.deliveryLat != null ? { lat: order.deliveryLat, lng: order.deliveryLng } : null;
    if (!origin || !dest) { setRoute(null); return; }
    let cancelledFetch = false;
    fetch(`/api/routing/directions?start_lat=${origin.lat}&start_lng=${origin.lng}&end_lat=${dest.lat}&end_lng=${dest.lng}&profile=driving-car`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelledFetch) return;
        const coords = data?.features?.[0]?.geometry?.coordinates;
        if (coords && coords.length >= 2) {
          const summary = data.features[0].properties?.summary;
          setRoute({
            coordinates: coords.map((c: number[]) => [c[1], c[0]] as [number, number]),
            distance: summary?.distance || 0,
            duration: summary?.duration || 0,
          });
        }
      })
      .catch(() => {});
    return () => { cancelledFetch = true; };
  }, [orderId, loading, order, liveLoc?.lat, liveLoc?.lng, order?.deliveryLat, order?.deliveryLng]);

  if (!orderId || loading || !order) return null;

  const currentStage = ORDER_STAGE_FLOW[order.currentStageIndex];
  const hasPickup = order.pickupLat != null && order.pickupLng != null;
  const hasDelivery = order.deliveryLat != null && order.deliveryLng != null;
  const hasExec = liveLoc?.lat != null && liveLoc?.lng != null;
  const isCancellable = !["completed", "cancelled", "delivered", "out_for_delivery"].includes(order.status) && !cancelled;
  const isCompleted = ["completed", "delivered"].includes(order.status) && !cancelled;
  const milestoneIndices = [0, Math.floor(ORDER_STAGE_FLOW.length / 3), Math.floor(ORDER_STAGE_FLOW.length * 2 / 3), ORDER_STAGE_FLOW.length - 1];

  const handleCancel = async () => {
    try {
      await api.post(`/api/orders/${orderId}/cancel`);
      setCancelled(true);
      // Immediately update the shared store so all views reflect cancellation
      patchOrder(orderId, { status: "cancelled", paymentStatus: "refunded" });
      onCancel?.();
      toast.success(`Order ${order.code || order.id?.slice(0, 8)} cancelled`, {
        description: `Refund of ${formatINRDecimal(order.total || 0)} will be processed in 3-5 business days.`,
      });
    } catch (err: any) {
      toast.error("Cancel failed", { description: err.message });
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Track order {order.code || order.id?.slice(0, 8)}</DialogTitle>

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
                  {order.code || `Order #${order.id?.slice(0, 8)}`}
                </h2>
                <p className="text-sm text-white/80 mt-0.5">{order.vendorName || "Vendor assigned"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/80">Current stage</p>
                <p className="text-lg font-semibold">{currentStage?.label || order.status}</p>
                <p className="text-xs text-white/80 mt-0.5">
                  <Clock className="inline h-3 w-3 mr-0.5" />
                  ETA {order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "Calculating..."}
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
                {milestoneIndices.map((i) => (
                  <span key={i}>{ORDER_STAGE_FLOW[i]?.label}</span>
                ))}
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

            {/* Map */}
            <Card className="p-0 overflow-hidden shadow-soft">
              {(hasPickup || hasDelivery) ? (
                <LeafletMap
                  markers={[
                    ...(hasPickup ? [{ lat: order.pickupLat!, lng: order.pickupLng!, label: "Pickup", color: "#14b8a6", type: "pickup" as const }] : []),
                    ...(hasDelivery ? [{ lat: order.deliveryLat!, lng: order.deliveryLng!, label: order.vendorName || "Vendor", color: order.vendorLogoColor || "#8b5cf6", type: "vendor" as const }] : []),
                    ...(hasExec ? [{ lat: liveLoc!.lat, lng: liveLoc!.lng, label: order.deliveryExecutiveName || "Exec", color: "#10b981", type: "exec" as const }] : []),
                  ]}
                  center={hasPickup ? [order.pickupLat!, order.pickupLng!] : hasDelivery ? [order.deliveryLat!, order.deliveryLng!] : [12.9719, 77.6413]}
                  zoom={13}
                  height="h-48"
                  route={route ? { coordinates: route.coordinates, color: "#10b981", dashArray: "6 4" } : undefined}
                />
              ) : (
                <div className="h-48 bg-muted/20 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Navigation className="h-3.5 w-3.5 text-primary" />
                  {hasExec && route ? (
                    <span className="font-medium">
                      {order.deliveryExecutiveName} · {(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} mins
                    </span>
                  ) : (
                    <span className="font-medium">
                      {order.deliveryExecutiveName ? `${order.deliveryExecutiveName} is on the way` : "Waiting for delivery partner"}
                    </span>
                  )}
                </div>
                {(hasPickup || hasDelivery) && (
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => {
                      const lat = order.pickupLat || order.deliveryLat!;
                      const lng = order.pickupLng || order.deliveryLng!;
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
                    }}
                  >
                    Open in Maps
                  </Button>
                )}
              </div>
            </Card>

              {/* Items */}
            <Card className="p-5 shadow-soft">
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
              {order.deliveryExecutiveName ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
                      {order.deliveryExecutiveName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{order.deliveryExecutiveName}</p>
                    <p className="text-xs text-muted-foreground">{order.pickupArea ? `${order.pickupArea} · ` : ""}Delivery partner</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-muted-foreground">
                  <Truck className="h-8 w-8 mx-auto mb-1 opacity-40" />
                  <p className="text-sm">Not yet assigned</p>
                  <p className="text-xs mt-0.5">A delivery partner will be assigned soon</p>
                </div>
              )}
              {order.deliveryExecutiveName && (
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
              )}
            </Card>

            {/* Vendor */}
            <Card className="p-4 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vendor</p>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white text-sm font-bold",
                  order.vendorLogoColor || "bg-primary"
                )}>
                  {order.vendorLogoInitials || "LH"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{order.vendorName || "Assigning vendor..."}</p>
                  <p className="text-xs text-muted-foreground">{order.pickupArea || "—"}</p>
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
              {isCompleted && (
                <Button
                  variant="default"
                  className="w-full mt-3"
                  onClick={() => setReviewOpen(true)}
                >
                  <PenLine className="h-4 w-4 mr-1.5" />
                  Write a Review
                </Button>
              )}
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

        <ReviewDialog
          order={order}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
