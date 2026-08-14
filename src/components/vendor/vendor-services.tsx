import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Settings2, CheckCircle2, Layers, Package, Tags, ChevronDown, ChevronRight, RotateCcw, Clock, MapPin, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useFetch } from "@/lib/hooks/use-fetch";
import { useVendor } from "@/lib/hooks";
import { useVendorServicePrices } from "@/lib/hooks/useVendorServicePrices";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { CatalogCategory } from "@/lib/types";
import { api } from "@/lib/api/client";
import { cn, formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { useMyVendorId } from "./vendor-helpers";

interface CatalogItem {
  id: string;
  itemName: string;
  itemCategory?: string;
  unit: string;
  defaultPrice: number;
  estimatedTime?: string | null;
}

interface VendorService {
  id: string;
  name: string;
  description: string;
  unit: string;
  slug?: string;
  pricingType: string;
  bagPrice: number;
  items: CatalogItem[];
  categoryId: string;
  categoryName: string;
}

interface VendorCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  grouping: string;
  isActive: boolean;
  services: VendorService[];
}

// Catalog-style price entry for one item; null = untouched, "" = reset to default.
type PriceDraft = string | null;

export function VendorServices() {
  const vid = useMyVendorId();
  const { data: catalog } = useFetch<CatalogCategory[]>("/api/services/catalog?includeInactive=true");
  const { data: vendorData, refetch: refetchVendor } = useVendor(vid || "");
  const { data: vendorPrices } = useVendorServicePrices(vid || null);
  const queryClient = useQueryClient();
  const vendor = vendorData || null;

  const categories = useMemo<VendorCategory[]>(() => {
    return (catalog || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      grouping: cat.grouping || "main",
      isActive: cat.isActive !== false,
      services: (cat.services || [])
        .filter((s) => s.isActive !== false)
        .map((svc) => ({
          id: svc.id,
          name: svc.name,
          description: svc.description || "",
          unit: svc.unit || "item",
          slug: svc.slug,
          pricingType: svc.pricingType || "ITEM",
          bagPrice: svc.bagPrice ?? 0,
          items: (svc.items || []).filter((i) => i.isActive !== false).map((i) => ({
            id: i.id,
            itemName: i.itemName,
            itemCategory: i.itemCategory,
            unit: i.unit || "item",
            defaultPrice: i.defaultPrice || 0,
            estimatedTime: i.estimatedTime,
          })),
          categoryId: cat.id,
          categoryName: cat.name,
        })),
    }));
  }, [catalog]);

  // Flattened view used by toggles, bulk edit and price saving.
  const allServices = useMemo(() => categories.flatMap((c) => c.services), [categories]);

  // Lowest positive item price per service; vendor overrides take precedence.
  const overrideByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of vendorPrices || []) {
      const cur = map.get(p.serviceId);
      if (p.price > 0 && (cur === undefined || p.price < cur)) map.set(p.serviceId, p.price);
    }
    return map;
  }, [vendorPrices]);

  // Per-item override map (itemId -> price).
  const overrideByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of vendorPrices || []) {
      if (p.itemId && p.price > 0) map.set(p.itemId, p.price);
    }
    return map;
  }, [vendorPrices]);

  const servicePrice = useCallback((id: string, items: CatalogItem[]) => {
    const override = overrideByService.get(id);
    if (override !== undefined) return override;
    const prices = (items || [])
      .map((i) => i.defaultPrice)
      .filter((p) => typeof p === "number" && p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [overrideByService]);

  // service_ids is authoritative; services_offered is a compatibility mirror.
  const offeredSlugs = (svc: { id: string; slug?: string }) => svc.slug || svc.id;

  // Optimistic offered-set: toggles apply instantly and PATCH in the background.
  // offeredWorkingRef is the synchronous source of truth so rapid toggles chain
  // correctly; the state mirrors it for rendering.
  const [offeredSet, setOfferedSet] = useState<Set<string>>(() => new Set(vendor?.serviceIds || []));
  const offeredWorkingRef = useRef(new Set(vendor?.serviceIds || []));
  const toggleInFlight = useRef(0);

  // Sync from server when no toggle is in flight (a refetch after a failed
  // toggle would otherwise clobber the optimistic state).
  useEffect(() => {
    if (toggleInFlight.current > 0) return;
    const synced = new Set(vendor?.serviceIds || []);
    offeredWorkingRef.current = synced;
    setOfferedSet(synced);
  }, [vendor?.serviceIds]);

  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expandedSvc, setExpandedSvc] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());

  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const unitLabel = (unit?: string) => (unit === "kg" ? "/kg" : unit === "item" ? "/pc" : "");

  // Save one item's price override immediately (row-level, no global save bar).
  const saveItemPrice = async (item: CatalogItem, serviceId: string) => {
    if (!vid) return;
    const draft = priceDrafts[item.id] ?? null;
    if (draft === null || draft === "") return;
    const v = parseInt(draft);
    if (isNaN(v) || v <= 0) return;
    const def = item.defaultPrice || 0;
    setSavingItem(item.id);
    try {
      if (v === def) {
        // Back at the catalog default → drop the override so the badge clears.
        if (overrideByItem.has(item.id)) {
          await api.delete(`/api/vendor-service-prices/${vid}/${serviceId}/${item.id}`);
        }
      } else {
        await api.post("/api/vendor-service-prices", {
          vendor_id: vid,
          service_id: serviceId,
          item_id: item.id,
          price: v,
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorServicePrices.byVendor(vid) });
      setPriceDrafts((d) => { const { [item.id]: _removed, ...rest } = d; return rest; });
      toast.success("Price saved — overrides apply to new orders");
    } catch (e: any) {
      toast.error("Failed to save price", { description: e.message });
    } finally {
      setSavingItem(null);
    }
  };

  const [editingRadius, setEditingRadius] = useState(false);
  const [radiusInput, setRadiusInput] = useState(String(vendor?.serviceRadiusKm ?? 5));
  const [editingMinOrder, setEditingMinOrder] = useState(false);
  const [minOrderInput, setMinOrderInput] = useState(String(vendor?.minOrderValue ?? 150));

  useEffect(() => {
    setRadiusInput(String(vendor?.serviceRadiusKm ?? 5));
    setMinOrderInput(String(vendor?.minOrderValue ?? 150));
  }, [vendor?.serviceRadiusKm, vendor?.minOrderValue]);

  const toggleService = useCallback(async (id: string, enabled: boolean) => {
    if (!vendor?.id) return;
    const prev = new Set(offeredWorkingRef.current);
    const next = new Set(prev);
    if (enabled) next.add(id); else next.delete(id);
    const payload = {
      service_ids: Array.from(next),
      services_offered: allServices.filter((s) => next.has(s.id)).map((s) => offeredSlugs(s)),
    };
    offeredWorkingRef.current = next;
    setOfferedSet(next);
    toggleInFlight.current++;
    try {
      await api.patch(`/api/vendors/${vendor.id}`, payload);
      toast.success(enabled ? "Service enabled" : "Service disabled");
    } catch (e: any) {
      // Roll back to the exact snapshot captured before this toggle, not the
      // latest state, so rapid toggle clicks don't revert incorrectly.
      offeredWorkingRef.current = prev;
      setOfferedSet(prev);
      toast.error("Failed to update services", { description: e.message });
    } finally {
      toggleInFlight.current--;
      refetchVendor();
    }
  }, [vendor, allServices, refetchVendor]);

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
    setBulkSelection(new Set(offeredWorkingRef.current));
    setBulkOpen(true);
  };

  const applyBulk = async () => {
    if (!vendor?.id) return;
    const prev = new Set(offeredWorkingRef.current);
    const next = new Set(bulkSelection);
    const payload = {
      service_ids: Array.from(next),
      services_offered: allServices.filter((s) => next.has(s.id)).map((s) => offeredSlugs(s)),
    };
    offeredWorkingRef.current = next;
    setOfferedSet(next);
    toggleInFlight.current++;
    try {
      await api.patch(`/api/vendors/${vendor.id}`, payload);
      toast.success("Bulk update applied");
      setBulkOpen(false);
    } catch (e: any) {
      offeredWorkingRef.current = prev;
      setOfferedSet(prev);
      toast.error("Failed to bulk update", { description: e.message });
    } finally {
      toggleInFlight.current--;
      refetchVendor();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Offered Services</h2>
          <p className="text-sm text-muted-foreground">Toggle services on/off and configure pricing</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={openBulk}>
          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
          Bulk edit
        </Button>
      </div>

      {/* Category list — mirrors the service catalog layout */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const catOpen = expandedCat === cat.id;
          const offeredCount = cat.services.filter((s) => offeredSet.has(s.id)).length;
          return (
            <Card key={cat.id} className="shadow-soft overflow-hidden">
              {/* Category header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCat(catOpen ? null : cat.id)}
              >
                <button className="text-muted-foreground" aria-label={catOpen ? "Collapse" : "Expand"}>
                  {catOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Layers className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.description || ""}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{cat.services.length} services</Badge>
                <Badge variant="outline" className="text-[10px]">{offeredCount}/{cat.services.length} offered</Badge>
                {!cat.isActive && (
                  <Badge variant="destructive" className="text-[9px]">Inactive</Badge>
                )}
              </div>

              {/* Services within category */}
              {catOpen && (
                <div className="border-t">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</p>
                    </div>

                    {cat.services.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">No services in this category</p>
                    )}

                    {cat.services.map((svc) => {
                      const svcOpen = expandedSvc === svc.id;
                      const offered = offeredSet.has(svc.id);
                      const price = servicePrice(svc.id, svc.items);
                      const hasOverride = overrideByService.has(svc.id);
                      return (
                        <div key={svc.id} className={cn("rounded-lg border", !offered && "opacity-70")}>
                          {/* Service header */}
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedSvc(svcOpen ? null : svc.id)}
                          >
                            <button className="text-muted-foreground" aria-label={svcOpen ? "Collapse" : "Expand"}>
                              {svcOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                            <Package className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{svc.name}</p>
                              <p className="text-[11px] text-muted-foreground">{svc.description || ""}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{svc.pricingType || svc.unit}</Badge>
                            {svc.pricingType === "BAG" && svc.bagPrice > 0 && (
                              <Badge variant="secondary" className="text-[10px]">₹{svc.bagPrice}</Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px]">{svc.items.length} items</Badge>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Base price</p>
                              <p className="text-sm font-semibold">
                                ₹{price}{unitLabel(svc.unit)}
                                {svc.unit === "flat" && <span className="ml-1 text-[10px] text-muted-foreground font-normal">flat</span>}
                                {hasOverride && <Badge variant="secondary" className="ml-1.5 text-[10px]">Custom</Badge>}
                              </p>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Switch checked={offered} onCheckedChange={(chk) => toggleService(svc.id, chk)} />
                            </div>
                          </div>

                          {/* Items within service */}
                          {svcOpen && (
                            <div className="border-t p-3 space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
                              </div>

                              {svc.items.length === 0 && (
                                <p className="text-[11px] text-muted-foreground py-1 text-center">No items — defaults to base service price</p>
                              )}

                              {svc.items.map((item) => {
                                const def = item.defaultPrice || 0;
                                const override = overrideByItem.get(item.id);
                                const draft: PriceDraft = priceDrafts[item.id] ?? null;
                                const draftNum = draft === null || draft === "" ? NaN : parseInt(draft);
                                const validNum = !isNaN(draftNum) && draftNum > 0;
                                const invalid = draft !== null && draft !== "" && !validNum;
                                const draftVal = validNum ? draftNum : null;
                                const custom = draftVal === null
                                  ? override !== undefined
                                  : draftVal !== def;
                                const dirty = draft !== null && (
                                  draft === ""
                                    ? override !== undefined
                                    : validNum && draftNum !== (override ?? def)
                                );
                                const saving = savingItem === item.id;
                                return (
                                  <div key={item.id} className="space-y-1">
                                    <div className={cn(
                                      "flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs",
                                      custom && "bg-primary/5"
                                    )}>
                                      <Tags className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="flex-1 font-medium">{item.itemName}</span>
                                      <Badge variant="outline" className="text-[9px]">{item.itemCategory || "—"}</Badge>
                                      <span className="text-muted-foreground">
                                        Default <span className="font-semibold text-foreground tabular-nums">{formatINR(def)}</span>{unitLabel(item.unit)}
                                      </span>
                                      {item.estimatedTime && (
                                        <span className="text-muted-foreground hidden sm:inline">~{item.estimatedTime}min</span>
                                      )}
                                      {custom && (
                                        <Badge variant="secondary" className="text-[9px]">Custom</Badge>
                                      )}
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number" min={1}
                                          value={draft ?? ""}
                                          placeholder={`₹${override ?? def}`}
                                          onChange={(e) => setPriceDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" && dirty && validNum && !saving) saveItemPrice(item, svc.id);
                                          }}
                                          className={cn("h-7 w-20 text-xs", invalid && "border-destructive")}
                                        />
                                        {draft !== null && (dirty || invalid) && (
                                          <Button
                                            size="icon"
                                            className="h-6 w-6 p-0"
                                            disabled={!dirty || invalid || saving}
                                            title="Save price"
                                            onClick={() => saveItemPrice(item, svc.id)}
                                          >
                                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                          </Button>
                                        )}
                                        <Button
                                          size="icon" variant="ghost" className="h-6 w-6 p-0"
                                          disabled={draft === null && override === undefined}
                                          title="Reset to default"
                                          onClick={() => setPriceDrafts((d) => ({ ...d, [item.id]: "" }))}
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    {invalid && (
                                      <p className="pl-3 text-[10px] text-destructive">Enter a price of ₹1 or more</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Business Hours</h3>
            <p className="text-xs text-muted-foreground">Days you accept pickups and deliveries</p>
          </div>
          <div className="p-3 space-y-1.5">
            {DAY_LABELS.map((day) => {
              const key = DAY_MAP[day];
              const dayHours = hours[key] || { open: "08:00", close: "21:00", active: key !== "sunday" };
              return (
                <div key={day} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 font-medium">{day}</span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{dayHours.open} – {dayHours.close}</span>
                  </span>
                  <Switch checked={dayHours.active !== false} onCheckedChange={(chk) => toggleDay(key, chk)} className="scale-75" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="shadow-soft overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Service Area & Settings</h3>
            <p className="text-xs text-muted-foreground">Delivery radius, order minimums and options</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service Radius</p>
                  <p className="text-[11px] text-muted-foreground">How far you deliver</p>
                </div>
              </div>
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
                  <p className="text-sm font-semibold tabular-nums">{vendor?.serviceRadiusKm ?? 5} km</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingRadius(true)}>Edit</Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Minimum Order Value</p>
                <p className="text-[11px] text-muted-foreground">Lowest order you accept</p>
              </div>
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
                  <p className="text-sm font-semibold tabular-nums">₹{vendor?.minOrderValue ?? 150}</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingMinOrder(true)}>Edit</Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Express Service</p>
                <p className="text-[11px] text-muted-foreground">1.5× pricing · 12hr delivery</p>
              </div>
              <Switch
                checked={vendor?.expressEnabled !== false}
                onCheckedChange={(chk) => saveSetting("express_enabled", chk, "Express service")}
                className="scale-75"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Holiday Calendar</p>
              <div className="flex items-center gap-2">
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
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {allServices.map((s) => {
              const selected = bulkSelection.has(s.id);
              const price = servicePrice(s.id, s.items);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    const next = new Set(bulkSelection);
                    if (selected) next.delete(s.id); else next.add(s.id);
                    setBulkSelection(next);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs transition-all",
                    selected ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.categoryName} · ₹{price}{unitLabel(s.unit)}
                    </p>
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkSelection(new Set(allServices.map((s) => s.id)))}>Select All</Button>
              <Button variant="outline" size="sm" onClick={() => setBulkSelection(new Set())}>Deselect All</Button>
            </div>
            <Button onClick={applyBulk}>Apply ({bulkSelection.size} services)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}