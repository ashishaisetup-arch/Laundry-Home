import { useState, useEffect, useCallback } from "react";
import { Settings2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useServices, useVendor } from "@/lib/hooks";
import { ServiceIcon } from "@/components/shared/service-icon";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMyVendorId } from "./vendor-helpers";

export function VendorServices() {
  const vid = useMyVendorId();
  const { data: services } = useServices();
  const { data: vendorData, refetch: refetchVendor } = useVendor(vid || "");
  const svc = services || [];
  const vendor = vendorData || null;

  const offeredSet = new Set(vendor?.servicesOffered || []);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());

  const [editingRadius, setEditingRadius] = useState(false);
  const [radiusInput, setRadiusInput] = useState(String(vendor?.serviceRadiusKm ?? 5));
  const [editingMinOrder, setEditingMinOrder] = useState(false);
  const [minOrderInput, setMinOrderInput] = useState(String(vendor?.minOrderValue ?? 150));

  useEffect(() => {
    setRadiusInput(String(vendor?.serviceRadiusKm ?? 5));
    setMinOrderInput(String(vendor?.minOrderValue ?? 150));
  }, [vendor?.serviceRadiusKm, vendor?.minOrderValue]);

  const toggleService = useCallback(async (key: string, enabled: boolean) => {
    if (!vendor?.id) return;
    const updated = enabled
      ? [...(vendor.servicesOffered || []), key]
      : (vendor.servicesOffered || []).filter((k) => k !== key);
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { services_offered: updated });
      toast.success(enabled ? "Service enabled" : "Service disabled");
      refetchVendor();
    } catch (e: any) {
      toast.error("Failed to update services", { description: e.message });
    }
  }, [vendor, refetchVendor]);

  const saveSetting = useCallback(async (field: string, value: any, label: string) => {
    if (!vendor?.id) return;
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { [field]: value });
      toast.success(`${label} updated`);
      refetchVendor();
    } catch (e: any) {
      toast.error(`Failed to update ${label}`, { description: e.message });
    }
  }, [vendor, refetchVendor]);

  const toggleDay = useCallback(async (dayKey: string, active: boolean) => {
    if (!vendor?.id) return;
    const hours = { ...(vendor.businessHours || {}) };
    hours[dayKey] = { ...(hours[dayKey] || { open: "08:00", close: "21:00" }), active };
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { business_hours: hours });
      toast.success(active ? `${dayKey} enabled` : `${dayKey} disabled`);
      refetchVendor();
    } catch (e: any) {
      toast.error("Failed to update hours", { description: e.message });
    }
  }, [vendor, refetchVendor]);

  const openBulk = () => {
    setBulkSelection(new Set(vendor?.servicesOffered || []));
    setBulkOpen(true);
  };

  const applyBulk = async () => {
    if (!vendor?.id) return;
    try {
      await api.patch(`/api/vendors/${vendor.id}`, {
        services_offered: Array.from(bulkSelection),
      });
      toast.success("Bulk update applied");
      setBulkOpen(false);
      refetchVendor();
    } catch (e: any) {
      toast.error("Failed to bulk update", { description: e.message });
    }
  };

  const DAY_MAP: Record<string, string> = {
    Monday: "monday", Tuesday: "tuesday", Wednesday: "wednesday",
    Thursday: "thursday", Friday: "friday", Saturday: "saturday", Sunday: "sunday",
  };
  const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const hours = vendor?.businessHours || {};

  if (!vid) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading vendor profile…</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Offered Services</h3>
            <p className="text-xs text-muted-foreground">Toggle services on/off and configure pricing</p>
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={openBulk}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Bulk edit
          </Button>
        </div>
        <div className="space-y-2">
          {svc.map((s) => {
            const offered = offeredSet.has(s.key as any);
            return (
              <div key={s.key} className={cn("flex items-center gap-3 rounded-lg border p-3 transition-all", offered ? "border-border" : "border-dashed opacity-60")}>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shrink-0", s.gradient)}>
                  <ServiceIcon serviceKey={s.key} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Base price</p>
                    <p className="text-sm font-semibold">₹{s.basePrice}{s.pricingType === "per_kg" ? "/kg" : "/pc"}</p>
                  </div>
                  <Switch checked={offered} onCheckedChange={(chk) => toggleService(s.key, chk)} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Business Hours</h3>
          <div className="space-y-2">
            {DAY_LABELS.map((day) => {
              const key = DAY_MAP[day];
              const dayHours = hours[key] || { open: "08:00", close: "21:00", active: key !== "sunday" };
              return (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{day}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{dayHours.open} – {dayHours.close}</span>
                    <Switch checked={dayHours.active !== false} onCheckedChange={(chk) => toggleDay(key, chk)} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Service Area & Settings</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Service Radius (km)</p>
              {editingRadius ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={1} max={50}
                    value={radiusInput}
                    onChange={(e) => setRadiusInput(e.target.value)}
                    className="h-8 w-20 text-sm"
                  />
                  <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => { saveSetting("service_radius_km", parseInt(radiusInput) || 5, "Service radius"); setEditingRadius(false); }}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingRadius(false); setRadiusInput(String(vendor?.serviceRadiusKm ?? 5)); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{vendor?.serviceRadiusKm ?? 5} km</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingRadius(true)}>Edit</Button>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Minimum Order Value (₹)</p>
              {editingMinOrder ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} step={10}
                    value={minOrderInput}
                    onChange={(e) => setMinOrderInput(e.target.value)}
                    className="h-8 w-20 text-sm"
                  />
                  <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => { saveSetting("min_order_value", parseInt(minOrderInput) || 150, "Min order"); setEditingMinOrder(false); }}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingMinOrder(false); setMinOrderInput(String(vendor?.minOrderValue ?? 150)); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">₹{vendor?.minOrderValue ?? 150}</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingMinOrder(true)}>Edit</Button>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Express Service</p>
              <div className="flex items-center justify-between">
                <p className="text-sm">1.5× pricing · 12hr delivery</p>
                <Switch
                  checked={vendor?.expressEnabled !== false}
                  onCheckedChange={(chk) => saveSetting("express_enabled", chk, "Express service")}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Holiday Calendar</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">15 Aug — Independence Day</Badge>
                <Badge variant="outline" className="text-xs">2 Oct — Gandhi Jayanti</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Services</DialogTitle>
            <DialogDescription>Select all services you want to offer</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {svc.map((s) => {
              const selected = bulkSelection.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    const next = new Set(bulkSelection);
                    if (selected) next.delete(s.key); else next.add(s.key);
                    setBulkSelection(next);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    selected ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shrink-0", s.gradient)}>
                    <ServiceIcon serviceKey={s.key} className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">₹{s.basePrice}/{s.pricingType === "per_kg" ? "kg" : "pc"}</p>
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkSelection(new Set(svc.map((s) => s.key)))}>Select All</Button>
              <Button variant="outline" size="sm" onClick={() => setBulkSelection(new Set())}>Deselect All</Button>
            </div>
            <Button onClick={applyBulk}>Apply ({bulkSelection.size} services)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
