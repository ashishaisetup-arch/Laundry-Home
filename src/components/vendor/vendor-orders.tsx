import { useState, useEffect } from "react";
import { Package, Clock, IndianRupee, Eye, XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrders } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import type { Order } from "@/lib/types";
import { VendorOrderDetail } from "./vendor-order-detail";
import { useMyVendorId } from "./vendor-helpers";

export function VendorOrders() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);
  const allVendorOrders = orders || [];

  const tabFilters: Record<string, string[]> = {
    pending: ["placed", "vendor_assigned"],
    accepted: ["vendor_accepted", "pickup_scheduled"],
    processing: [
      "pickup_completed", "laundry_received", "sorting", "tagging",
      "washing", "drying", "ironing", "dry_cleaning",
      "quality_inspection", "packing", "ready_for_dispatch",
    ],
    completed: ["delivered", "completed"],
  };

  const counts = Object.fromEntries(
    Object.entries(tabFilters).map(([tab, statuses]) => [
      tab, allVendorOrders.filter(o => statuses.includes(o.status)).length,
    ])
  );

  return (
    <>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.pending}</Badge></TabsTrigger>
          <TabsTrigger value="accepted">Accepted <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.accepted}</Badge></TabsTrigger>
          <TabsTrigger value="processing">Processing <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.processing}</Badge></TabsTrigger>
          <TabsTrigger value="completed">Completed <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.completed}</Badge></TabsTrigger>
        </TabsList>

        {(["pending", "accepted", "processing", "completed"] as const).map((tab) => {
          const filtered = allVendorOrders.filter((o) => tabFilters[tab].includes(o.status));
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((o) => (
                  <VendorOrderCard key={o.id} order={o} onView={setDetailOrderId} />
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <VendorOrderDetail orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </>
  );
}

function VendorOrderCard({ order, onView }: { order: Order; onView?: (id: string) => void }) {
  const stage = ORDER_STAGE_FLOW[order.currentStageIndex];
  const itemCount = order.garmentCount || (order.items || []).reduce((sum, i: any) => sum + (i.qty || 0), 0);
  return (
    <Card className="p-4 shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted text-[10px] font-semibold">{order.customerAvatar || order.customerName?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{order.code}</p>
            <p className="text-[11px] text-muted-foreground">{order.customerName}</p>
          </div>
        </div>
        {order.express && (
          <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
            Express
          </Badge>
        )}
      </div>

      <div className="space-y-1 mb-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-3 w-3" />
          {itemCount} items · {order.items.length} services
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Pickup: {order.pickupSlot}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <IndianRupee className="h-3 w-3" />
          {formatINRDecimal(order.total)} · {order.paymentMethod}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <Badge variant="secondary" className="text-[10px]">{stage?.label}</Badge>
        <span className="text-muted-foreground">{order.pickupArea}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onView?.(order.id)}>
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
        {["placed", "vendor_assigned"].includes(order.status) && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 text-rose-600"
              onClick={async () => {
                try {
                  await api.post(`/api/orders/${order.id}/reject`);
                  toast.success(`Order ${order.code} rejected`);
                } catch (e: any) { toast.error("Failed to reject order", { description: e.message }); }
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 bg-primary hover:bg-primary/90"
              onClick={async () => {
                try {
                  await api.patch(`/api/orders/${order.id}`, { status: "vendor_accepted", currentStageIndex: 2 });
                  toast.success(`Order ${order.code} accepted`);
                } catch (e: any) { toast.error("Failed to accept order", { description: e.message }); }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Accept
            </Button>
          </>
        )}
        {!["placed", "vendor_assigned", "delivered", "completed"].includes(order.status) && (
          <Button size="sm" className="flex-1 h-8 bg-primary hover:bg-primary/90" onClick={async () => {
            const idx = ORDER_STAGE_FLOW.findIndex(s => s.stage === order.status);
            const nextStage = ORDER_STAGE_FLOW[idx + 1];
            if (!nextStage) return;
            try {
              await api.patch(`/api/orders/${order.id}`, { status: nextStage.stage, currentStageIndex: idx + 1 });
              toast.success(`Status updated to ${nextStage.label}`);
            } catch (e: any) { toast.error("Update failed", { description: e.message }); }
          }}>
            Update Status
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}
