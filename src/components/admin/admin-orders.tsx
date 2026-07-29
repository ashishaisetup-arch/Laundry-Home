import { useState } from "react";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { useFetch } from "@/lib/hooks/use-fetch";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { AdminOrderDetail } from "@/components/admin/admin-order-detail";
import { AdminOrderFilters, type OrderFilterValues } from "@/components/admin/admin-order-filters";
import { cn, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

export function AdminOrders() {
  const { data: vendors } = useFetch<{ id: string; name: string }[]>("/api/vendors");
  const { data: executives, refetch: refetchExecs } = useFetch<{ id: string; name: string; isAvailable: boolean; assignedOrders: number; maxDailyOrders: number; distanceKm?: number }[]>("/api/delivery-executives");
  const [filters, setFilters] = useState<OrderFilterValues>({
    search: "", status: "", vendorId: "", deliveryExecutiveId: "",
    paymentStatus: "", delayRisk: "", pickupArea: "", express: "",
    fromDate: "", toDate: "",
  });
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set("search", filters.search);
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.vendorId) queryParams.set("vendor_id", filters.vendorId);
  if (filters.deliveryExecutiveId) queryParams.set("delivery_executive_id", filters.deliveryExecutiveId);
  if (filters.paymentStatus) queryParams.set("payment_status", filters.paymentStatus);
  if (filters.delayRisk) queryParams.set("delay_risk", filters.delayRisk);
  if (filters.pickupArea) queryParams.set("pickup_area", filters.pickupArea);
  if (filters.express) queryParams.set("express", filters.express);
  if (filters.fromDate) queryParams.set("from_date", filters.fromDate);
  if (filters.toDate) queryParams.set("to_date", filters.toDate);

  const apiUrl = `/api/admin/orders${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const { data: orders, refetch } = useFetch<import("@/lib/types").Order[]>(apiUrl);
  const allOrders = orders || [];

  useRealtime("orders", undefined, refetch, true);

  const refetchAll = () => { refetch(); refetchExecs(); };

  const handleAssignDelivery = async (orderId: string, execId: string) => {
    try {
      await api.post(`/api/orders/${orderId}/assign-delivery`, { delivery_executive_id: execId });
      toast.success("Delivery partner assigned");
      setAssigningOrderId(null);
      refetchAll();
    } catch (e: any) {
      toast.error("Assignment failed", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <AdminOrderFilters
        filters={filters}
        onChange={setFilters}
        vendors={vendors || []}
        deliveryExecutives={executives || []}
      />

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Order</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Vendor</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Delivery</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Total</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">AI Risk</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">No orders match the current filters.</td></tr>
              ) : (
                allOrders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-mono text-xs font-semibold">{o.code}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-muted text-[10px]">{o.customerAvatar}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{o.customerName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{o.vendorName}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-[10px] capitalize">{o.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{o.deliveryExecutiveName || "—"}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold">{formatINRDecimal(o.total)}</td>
                    <td className="p-3 text-center">
                      {o.aiPrediction && (
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          o.aiPrediction.delayRisk === "low" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                          o.aiPrediction.delayRisk === "medium" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                          o.aiPrediction.delayRisk === "high" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                        )}>
                          {o.aiPrediction.delayRisk}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewOrderId(o.id)}>View</Button>
                        {assigningOrderId === o.id ? (
                          <Select onValueChange={(execId) => handleAssignDelivery(o.id, execId)}>
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue placeholder="Assign..." />
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
                                  {!ex.isAvailable ? " (busy)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setAssigningOrderId(o.id)}
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            {o.deliveryExecutiveName ? "Change" : "Assign"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AdminOrderDetail orderId={viewOrderId} onClose={() => setViewOrderId(null)} onUpdated={refetchAll} />
    </div>
  );
}
