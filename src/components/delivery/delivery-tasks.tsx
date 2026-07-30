import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Navigation, Phone, Store, KeySquare, Signature, Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LeafletMap } from "@/components/shared/leaflet-map";
import { useDeliveryTasks } from "@/lib/hooks";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useDeliveryLocation } from "@/lib/hooks/useDeliveryLocation";
import type { DeliveryTask } from "@/lib/types";
import { api } from "@/lib/api/client";
import { cn, formatINRDecimal } from "@/lib/utils";
import { lookupAreaCoords } from "@/lib/geo";
import { toast } from "sonner";
import { filterSortTasks, statusIndex, PICKUP_STEPS, DELIVERY_STEPS } from "./delivery-data";
import { OtpDialog } from "./otp-dialog";
import { SignatureDialog } from "./signature-dialog";

export function DeliveryTasks({ type }: { type: "pickup" | "delivery" }) {
  const { data: allTasks, refetch: refetchTasks } = useDeliveryTasks();
  const tasks = useMemo(() => filterSortTasks(allTasks || [], type), [allTasks, type]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) setSelectedTaskId(tasks[0].id);
  }, [tasks, selectedTaskId]);

  const isActive = selectedTask != null && !["pending", "delivered"].includes(selectedTask.status);
  const geo = useGeolocation(true);
  useDeliveryLocation(isActive);

  function taskDest(task: DeliveryTask): { lat: number; lng: number } | null {
    const lat = task.type === "pickup" ? task.pickupLat : task.deliveryLat;
    const lng = task.type === "pickup" ? task.pickupLng : task.deliveryLng;
    if (lat != null && lng != null) return { lat, lng };
    return lookupAreaCoords(task.area);
  }
  const taskCoords = selectedTask ? taskDest(selectedTask) : null;
  const origin = geo.lat && geo.lng ? { lat: geo.lat, lng: geo.lng } : null;
  const dest = taskCoords;
  const [route, setRoute] = useState<{ coordinates: [number, number][]; distance: number; duration: number } | null>(null);

  useEffect(() => {
    if (!origin || !dest) { setRoute(null); return; }
    let cancelled = false;
    fetch(`/api/routing/directions?start_lat=${origin.lat}&start_lng=${origin.lng}&end_lat=${dest.lat}&end_lng=${dest.lng}&profile=driving-car`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
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
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lng, dest?.lat, dest?.lng]);

  const updateTaskStatus = async (taskId: string, status: string, label: string) => {
    try {
      await api.patch(`/api/delivery-tasks/${taskId}`, { status });
      toast.success(`Status updated: ${label}`);
      refetchTasks();
    } catch (e: any) {
      toast.error("Failed to update status", { description: e.message });
    }
  };

  const steps: (typeof PICKUP_STEPS[number] & { done: boolean; available: boolean })[] = useMemo(() => {
    const allSteps = type === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
    if (!selectedTask) return allSteps.map((s) => ({ ...s, done: false, available: false }));
    const currentIdx = statusIndex(selectedTask.status);
    return allSteps.map((s) => {
      const stepIdx = statusIndex(s.id);
      const done = stepIdx <= currentIdx && selectedTask.status !== "pending";
      const available = !done && stepIdx === currentIdx + 1;
      return { ...s, done, available };
    });
  }, [type, selectedTask]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await api.post(`/api/delivery-tasks/${selectedTask.id}/photo`, { photo_data: dataUrl });
        toast.success("Photo uploaded");
        refetchTasks();
      } catch (err: any) {
        toast.error("Failed to upload photo", { description: err.message });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="grid lg:grid-cols-3 gap-4">
      <Card className="p-4 shadow-soft">
        <h3 className="font-semibold mb-3 capitalize">{type} Tasks</h3>
        <div className="space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className={cn(
                "w-full text-left rounded-lg border p-3 transition-all",
                selectedTask?.id === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{t.orderCode}</p>
                <Badge variant="outline" className="text-[9px] py-0 h-4 capitalize">{t.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{t.customerName}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t.slot} · {t.area}</p>
            </button>
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No {type} tasks</p>}
        </div>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {selectedTask && (
          <>
            <Card className="p-0 overflow-hidden shadow-soft">
              <div className="relative">
                <LeafletMap
                  center={dest ? [dest.lat, dest.lng] : [12.9719, 77.6413]}
                  zoom={13}
                  height="h-56"
                  markers={[
                    ...(origin ? [{ lat: origin.lat, lng: origin.lng, label: "You", color: "#14b8a6", type: "exec" as const }] : []),
                    ...(dest ? [{ lat: dest.lat, lng: dest.lng, label: type === "pickup" ? "Pickup" : "Delivery", color: "#f43f5e", type: "pickup" as const }] : []),
                  ]}
                  route={route ? { coordinates: route.coordinates, color: "#14b8a6", dashArray: "8 6" } : undefined}
                />
                {dest && (
                  <Button
                    size="sm"
                    className="absolute bottom-3 right-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg z-[1000]"
                    onClick={() => {
                      const org = origin ? `&origin=${origin.lat},${origin.lng}` : "";
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${org}&travelmode=driving`, "_blank");
                    }}
                  >
                    <Navigation className="h-4 w-4 mr-1.5" />
                    Start
                  </Button>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="h-4 w-4 text-primary" />
                  {route ? (
                    <>
                      <span className="font-medium">{(route.distance / 1000).toFixed(1)} km</span>
                      <span className="text-muted-foreground">· ~{Math.round(route.duration / 60)} mins</span>
                    </>
                  ) : (
                    <span className="font-medium">{selectedTask.distanceKm} km away</span>
                  )}
                </div>
                {dest && (
                  <Button
                    size="sm" className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      const org = origin ? `&origin=${origin.lat},${origin.lng}` : "";
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${org}&travelmode=driving`, "_blank");
                    }}
                  >
                    <Navigation className="h-3.5 w-3.5 mr-1.5" />
                    Navigate
                  </Button>
                )}
              </div>
            </Card>

            <Card className="p-5 shadow-soft">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">{type === "pickup" ? "Pickup from" : "Deliver to"}</p>
                  <h3 className="text-lg font-semibold">{selectedTask.customerName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTask.address}</p>
                </div>
                <Badge variant="secondary">{selectedTask.slot}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground">Items</p>
                  <p className="text-sm font-medium">{selectedTask.items}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground">Payment</p>
                  <p className="text-sm font-medium">{selectedTask.paymentMode}</p>
                  {selectedTask.amount > 0 && <p className="text-xs text-muted-foreground">{formatINRDecimal(selectedTask.amount)} to collect</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-10" onClick={() => window.open(`tel:${selectedTask.customerPhone}`, "_blank")}>
                  <Phone className="h-4 w-4 mr-1.5" />
                  Call
                </Button>
                <Button variant="outline" className="h-10 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                  const lat = type === "pickup" ? selectedTask.pickupLat : selectedTask.deliveryLat;
                  const lng = type === "pickup" ? selectedTask.pickupLng : selectedTask.deliveryLng;
                  const org = origin ? `&origin=${origin.lat},${origin.lng}` : "";
                  if (lat != null && lng != null) {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${org}&travelmode=driving`, "_blank");
                  } else {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedTask.address || selectedTask.area)}${org}&travelmode=driving`, "_blank");
                  }
                }}>
                  <Navigation className="h-4 w-4 mr-1.5" />
                  Navigate
                </Button>
                <Button variant="outline" className="h-10">
                  <Store className="h-4 w-4 mr-1.5" />
                  Vendor
                </Button>
              </div>
            </Card>

            <Card className="p-5 shadow-soft">
              <h3 className="font-semibold mb-3">Status Updates</h3>
              <div className="space-y-2 mb-4">
                {steps.map((s) => (
                  <button
                    key={s.id}
                    disabled={s.done || !s.available}
                    onClick={() => selectedTask && updateTaskStatus(selectedTask.id, s.id, s.label)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                      s.done ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : s.available ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer" : "border-border opacity-50"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      s.done ? "bg-emerald-500 text-white" : s.available ? "bg-primary-surface text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      "text-sm flex-1",
                      s.done ? "font-medium text-emerald-700 dark:text-emerald-400" : s.available ? "font-medium text-primary" : ""
                    )}>{s.label}</span>
                    {s.available && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
                    {s.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>

              {type === "delivery" && (
                <>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-semibold mb-3">Proof of Delivery</h4>

                  {selectedTask.photos && selectedTask.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedTask.photos.map((photo, idx) => (
                        <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                          <img src={photo} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedTask.signature && (
                    <div className="mb-3 rounded-lg border border-border p-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Customer Signature</p>
                      <img src={selectedTask.signature} alt="Signature" className="h-16 object-contain" />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={selectedTask.otpVerified ? "default" : "outline"}
                      className={cn("flex-col h-20", selectedTask.otpVerified ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-muted/30")}
                      onClick={() => setOtpDialogOpen(true)}
                    >
                      <KeySquare className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">{selectedTask.otpVerified ? "OTP Verified" : "Customer OTP"}</span>
                    </Button>
                    <Button
                      variant={selectedTask.signature ? "default" : "outline"}
                      className={cn("flex-col h-20", selectedTask.signature ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-muted/30")}
                      onClick={() => setSignatureDialogOpen(true)}
                    >
                      <Signature className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">{selectedTask.signature ? "Signed" : "Signature"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-20 hover:bg-muted/30"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">{selectedTask.photos?.length ? `${selectedTask.photos.length} photo${selectedTask.photos.length > 1 ? "s" : ""}` : "Photo"}</span>
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                    </Button>
                  </div>

                  <Button
                    className="w-full mt-3"
                    disabled={selectedTask.status === "delivered"}
                    onClick={() => selectedTask && updateTaskStatus(selectedTask.id, "delivered", "Delivered")}
                  >
                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                    {selectedTask.status === "delivered" ? "Delivered" : "Complete Delivery"}
                  </Button>
                </>
              )}
            </Card>
          </>
        )}
      </div>

      {selectedTask && (
        <>
          <OtpDialog task={selectedTask} open={otpDialogOpen} onOpenChange={setOtpDialogOpen} />
          <SignatureDialog task={selectedTask} open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen} />
        </>
      )}
    </motion.div>
  );
}
