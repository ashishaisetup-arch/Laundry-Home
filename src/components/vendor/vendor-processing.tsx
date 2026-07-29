import { useState, useEffect } from "react";
import { ArrowUpRight, Camera, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrders } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SERVICE_ICONS } from "@/lib/data/service-icons";
import { ServiceIcon } from "@/components/shared/service-icon";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import { useMyVendorId } from "./vendor-helpers";

export function VendorProcessing() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);
  const allVendorOrders = orders || [];
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const processingOrders = allVendorOrders.filter(o =>
    ["pickup_completed", "laundry_received", "sorting", "tagging", "washing", "drying", "ironing", "dry_cleaning", "quality_inspection", "packing", "ready_for_dispatch"].includes(o.status)
  );
  const selectedOrder = processingOrders.find(o => o.id === selectedOrderId) || processingOrders[0];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="p-4 shadow-soft">
        <h3 className="font-semibold mb-3">In Processing</h3>
        <ScrollArea className="h-[600px] -mx-2 px-2">
          <div className="space-y-2">
            {processingOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-all",
                  selectedOrder?.id === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{o.code}</p>
                  {o.express && <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600">Express</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground">{o.customerName}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground">Stage {o.currentStageIndex + 1}/18:</span>
                  <span className="text-[10px] font-medium text-primary">{ORDER_STAGE_FLOW[o.currentStageIndex]?.label}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${((o.currentStageIndex + 1) / 18) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <div className="lg:col-span-2">
        {selectedOrder && (
          <Card className="p-5 shadow-soft">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedOrder.code}</h3>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerName} · {selectedOrder.garmentCount} items</p>
              </div>
              <Badge variant="secondary">{ORDER_STAGE_FLOW[selectedOrder.currentStageIndex]?.label}</Badge>
            </div>

            <OrderTimeline order={selectedOrder} />

            <Separator className="my-5" />

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={async () => {
                  const idx = ORDER_STAGE_FLOW.findIndex(s => s.stage === selectedOrder.status);
                  const nextStage = ORDER_STAGE_FLOW[idx + 1];
                  if (!nextStage) return;
                  try {
                    await api.patch(`/api/orders/${selectedOrder.id}`, { status: nextStage.stage, currentStageIndex: idx + 1 });
                    toast.success(`Stage updated to ${nextStage.label}`, { description: "Customer notified." });
                  } catch (e: any) { toast.error("Update failed", { description: e.message }); }
                }}
              >
                <ArrowUpRight className="h-4 w-4 mr-1.5" />
                Advance to next stage
              </Button>
              <Button variant="outline">
                <Camera className="h-4 w-4 mr-1.5" />
                Upload photo
              </Button>
              <Button variant="outline">
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Report issue
              </Button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
              <div className="space-y-1.5">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded-lg bg-muted/40 p-2">
                    <ServiceIcon serviceKey={item.serviceKey} className="h-4 w-4 text-primary" />
                    <span className="flex-1">{item.serviceName}</span>
                    <span className="text-muted-foreground">{item.qty} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
