import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, MapPin, Package, Sparkles, Star, Store, Truck, Plus, Minus, Wallet, Tag, AlertTriangle, ShoppingBag, Shirt, Layers, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ServiceIcon } from "@/components/shared/service-icon";
import { useServiceCatalog, useVendors, useAddresses, useOrders } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import type { Address } from "@/lib/types";
import type { Slot } from "@/lib/hooks/useSlots";
import { cn, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useUserSubscriptions } from "@/lib/hooks/useUserSubscriptions";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { useGoogleMapsAvailable } from "@/lib/hooks/useGoogleMaps";
import { ItemCatalog } from "./item-catalog";
import { BookingTypeSelector } from "./booking-type-selector";

interface PricingBreakdown {
  subtotal: number;
  couponDiscount: number;
  couponCode?: string;
  subscriptionDiscount: number;
  rewardPointsUsed: number;
  rewardDiscount: number;
  walletUsed: number;
  taxes: number;
  platformFee: number;
  deliveryFee: number;
  expressSurcharge: number;
  surgeCharge: number;
  total: number;
  breakdown: { label: string; amount: number }[];
}

const PICKUP_SLOTS: Slot[] = [
  { id: "p1", slot: "7:00 AM - 9:00 AM", available: true, premium: false },
  { id: "p2", slot: "9:00 AM - 11:00 AM", available: true, premium: false },
  { id: "p3", slot: "11:00 AM - 1:00 PM", available: true, premium: false },
  { id: "p4", slot: "1:00 PM - 3:00 PM", available: true, premium: true },
  { id: "p5", slot: "3:00 PM - 5:00 PM", available: true, premium: false },
  { id: "p6", slot: "5:00 PM - 7:00 PM", available: true, premium: false },
];

const DELIVERY_SLOTS: Slot[] = [
  { id: "d1", slot: "7:00 AM - 9:00 AM", available: true },
  { id: "d2", slot: "9:00 AM - 11:00 AM", available: true },
  { id: "d3", slot: "11:00 AM - 1:00 PM", available: true },
  { id: "d4", slot: "1:00 PM - 3:00 PM", available: true },
  { id: "d5", slot: "3:00 PM - 5:00 PM", available: true },
  { id: "d6", slot: "5:00 PM - 7:00 PM", available: true },
];

interface BookingFlowProps {
  open: boolean;
  onClose: () => void;
  location?: { lat: number; lng: number } | null;
}

type BookingType = "count_items" | "laundry_bag" | "mixed";
type StepV2 = "category" | "serviceType" | "inventory" | "addons" | "schedule" | "vendor" | "review" | "confirmed";

interface ItemQty {
  itemId: string;
  qty: number;
  instructions: string[];
}

function resolveDate(label: string): string {
  const d = new Date();
  if (label === "Tomorrow") d.setDate(d.getDate() + 1);
  else if (label === "Day after") d.setDate(d.getDate() + 2);
  else if (label === "3 days") d.setDate(d.getDate() + 3);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingFlowV2({ open, onClose: _onClose, location: externalLocation }: BookingFlowProps) {
  const { data: catalog } = useServiceCatalog();
  const [detectedLocation, setDetectedLocation] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => {
    if (externalLocation) return;
    if (!open) return;
    if (detectedLocation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await api.get<{ lat: number; lng: number }>(
            `/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (result?.lat) setDetectedLocation({ lat: result.lat, lng: result.lng });
          else setDetectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
          setDetectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [open, externalLocation, detectedLocation]);

  const activeLocation = externalLocation || detectedLocation;
  const { data: vendorsList } = useVendors(activeLocation ? { lat: activeLocation.lat, lng: activeLocation.lng, radiusKm: 5 } : undefined);
  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const { refetch: refetchOrders } = useOrders();

  const servicesData = (catalog || []).flatMap((cat) =>
    (cat.services || []).map((s) => ({
      ...s,
      categoryName: cat.name,
      categorySlug: cat.slug,
    }))
  );
  const addrList = addresses || [];

  // ─── State ──────────────────────────────────────────────
  const [step, setStep] = useState<StepV2>("category");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [bookingType, setBookingType] = useState<BookingType>("count_items");
  const [laundryBagQty, setLaundryBagQty] = useState(0);
  const [itemQtys, setItemQtys] = useState<Record<string, ItemQty>>({});
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>({});
  const [selectedAddonCat, setSelectedAddonCat] = useState<string | null>(null);

  const [pickupAddr, setPickupAddr] = useState("");
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [pickupDate, setPickupDate] = useState("Today");
  const [pickupSlot, setPickupSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("Tomorrow");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [vendorMode, setVendorMode] = useState<"auto" | "manual">("auto");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", line: "", flatNo: "", area: "", city: "", pincode: "", place_id: "" });
  const [placing, setPlacing] = useState(false);
  const [pricingResult, setPricingResult] = useState<PricingBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const loyaltyPoints = useAppStore((s) => s.loyaltyPoints);
  const fetchWallet = useAppStore((s) => s.fetchWallet);
  const { data: userSubscriptions } = useUserSubscriptions();
  const activeSubscription = (userSubscriptions || []).find((s) => s.status === "active");

  const resetState = useCallback(() => {
    setSelectedCategoryIds([]);
    setSelectedServiceIds([]);
    setBookingType("count_items");
    setItemQtys({});
    setAddonQtys({});
    setLaundryBagQty(0);
    setCouponCode("");
    setRedeemPoints(0);
    setPickupSlot("");
    setDeliverySlot("");
    setPickupDate("");
    setDeliveryDate("");
    setPickupAddr("");
    setNotes("");
    setStep("category");
    setPricingResult(null);
  }, []);
  const onClose = useCallback(() => {
    resetState();
    _onClose();
  }, [_onClose, resetState]);

  const [confirmedOrder, setConfirmedOrder] = useState<{
    code: string; total: number; pickupDate: string; pickupSlot: string;
    deliveryDate: string; deliverySlot: string; vendorName: string;
  } | null>(null);

  // ─── Derived ────────────────────────────────────────────
  const mainCategories = (catalog || []).filter((c) => c.grouping !== "addon");
  const addonCategories = (catalog || []).filter((c) => c.grouping === "addon");
  const addonServices = addonCategories.flatMap((c) => (c.services || []).filter((s: any) => s.isActive !== false));
  const selectedCategoryObjs = (catalog || []).filter((c) => selectedCategoryIds.includes(c.id));
  const selectedServiceObjs = servicesData.filter((s) => selectedServiceIds.includes(s.id));
  const catalogItems = selectedServiceObjs.flatMap((s) => (s as any).items || []);
  const weightMap: Record<string, number> = {};
  for (const item of catalogItems) {
    if (item.itemMasterId) weightMap[item.itemMasterId] = item.estimatedWeightKg || 0;
  }
  const totalItems = Object.values(itemQtys).reduce((sum, i) => sum + i.qty, 0);
  const totalAddonItems = Object.values(addonQtys).reduce((sum, q) => sum + q, 0);
  const totalWeight = Object.entries(itemQtys).reduce((sum, [id, q]) => {
    return sum + (weightMap[id] || 0) * q.qty;
  }, 0);

  // Build price map: itemMasterId → defaultPrice from service catalog
  const defaultPrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const svc of selectedServiceObjs) {
      for (const si of (svc as any).items || []) {
        if (si.itemMasterId) map[si.itemMasterId] = si.defaultPrice || 0;
      }
    }
    return map;
  }, [selectedServiceObjs]);
  const totalPrice = Object.entries(itemQtys).reduce((sum, [id, q]) => {
    return sum + (defaultPrices[id] || 0) * q.qty;
  }, 0);
  const canContinue =
    step === "category" ? selectedCategoryIds.length > 0
    : step === "serviceType" ? selectedServiceIds.length > 0
    : step === "inventory" ? (bookingType === "laundry_bag" ? laundryBagQty > 0 : totalItems > 0) || (bookingType === "mixed" && (laundryBagQty > 0 || totalItems > 0))
    : step === "addons" ? true
    : step === "schedule" ? !!pickupAddr && !!pickupSlot && !!deliveryAddr && !!deliverySlot
    : step === "vendor" ? vendorMode === "auto" || !!selectedVendor
    : true;

  const STEPS = [
    { id: "category" as const, label: "Category" },
    { id: "serviceType" as const, label: "Service" },
    { id: "inventory" as const, label: "Items" },
    { id: "addons" as const, label: "Add-ons" },
    { id: "schedule" as const, label: "Schedule" },
    { id: "vendor" as const, label: "Vendor" },
    { id: "review" as const, label: "Review" },
  ];

  // ─── Helpers ────────────────────────────────────────────
  function buildOrderItemsPayload() {
    const items: any[] = [];
    if (bookingType === "count_items" || bookingType === "mixed") {
      for (const iq of Object.values(itemQtys)) {
        if (iq.qty <= 0) continue;
        const svc = selectedServiceObjs.find((s) =>
          s.items?.some((si: any) => si.itemMasterId === iq.itemId)
        );
        items.push({
          itemId: iq.itemId, // itemMasterId → valid FK to item_master
          serviceId: svc?.id || selectedServiceIds[0],
          qty: iq.qty,
          specialInstructions: iq.instructions,
        });
      }
    }
    // Include add-on items
    for (const [svcId, qty] of Object.entries(addonQtys)) {
      if (qty <= 0) continue;
      const svc = servicesData.find((s) => s.id === svcId);
      if (!svc) continue;
      for (const addonItem of svc.items || []) {
        items.push({
          itemId: addonItem.itemMasterId || addonItem.id || svcId,
          serviceId: svcId,
          qty,
          specialInstructions: [],
        });
      }
      // If service has no items, push a placeholder
      if (!svc.items?.length) {
        items.push({
          itemId: svcId,
          serviceId: svcId,
          qty,
          specialInstructions: [],
        });
      }
    }
    return items;
  }

  // ─── Pricing ────────────────────────────────────────────
  useEffect(() => {
    if (step !== "review") return;
    if (!selectedServiceIds.length && !Object.values(addonQtys).some((q) => q > 0)) return;

    const orderItems = buildOrderItemsPayload();
    if (!orderItems.length && !laundryBagQty) return;

    setPricingLoading(true);
    const vendorId = vendorMode === "manual" && selectedVendor
      ? selectedVendor
      : (vendorsList?.[0]?.id);
    api.post<PricingBreakdown>("/api/orders/pricing", {
      items: orderItems,
      vendorId,
      couponCode,
      redeemPoints,
      useWalletAmount: useWallet ? walletBalance : 0,
    }).then(setPricingResult).catch(() => {
      toast.error("Failed to calculate pricing");
    }).finally(() => setPricingLoading(false));
  }, [step, selectedServiceIds, itemQtys, laundryBagQty, addonQtys, couponCode, redeemPoints, useWallet, vendorMode, selectedVendor, vendorsList]);

  // ─── Place Order ────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (placing) return;
    setPlacing(true);
    try {
      const selectedAddr = addrList.find((a) => a.id === pickupAddr);
      const selectedDelAddr = addrList.find((a) => a.id === deliveryAddr);
      const vendorId = vendorMode === "manual" && selectedVendor ? selectedVendor : (vendorsList?.[0]?.id || "00000000-0000-0000-0000-000000000001");

      const orderItems = buildOrderItemsPayload();

      const body: any = {
        orderItems,
        bookingType,
        laundryBagQty: (bookingType === "laundry_bag" || bookingType === "mixed") ? laundryBagQty : 0,
        estimatedWeightKg: Object.values(itemQtys).reduce((sum, i) => {
          return sum + (weightMap[i.itemId] || 0) * i.qty;
        }, 0),
        vendor_id: vendorId,
        pickup_address: selectedAddr?.line || "",
        pickup_area: selectedAddr?.area || "",
        pickup_date: resolveDate(pickupDate),
        pickup_slot: pickupSlot,
        delivery_date: resolveDate(deliveryDate),
        delivery_slot: deliverySlot,
        delivery_address: selectedDelAddr?.line || "",
        delivery_area: selectedDelAddr?.area || "",
        payment_method: "cod",
        notes,
        couponCode,
        redeemPoints,
        useWalletAmount: useWallet ? walletBalance : 0,
        express: false,
        garment_count: totalItems,
      };

      const order = await api.post<any>("/api/orders", body);
      setConfirmedOrder({
        code: order.code,
        total: order.total,
        pickupDate,
        pickupSlot,
        deliveryDate,
        deliverySlot,
        vendorName: order.vendor_name || "Vendor",
      });
      setStep("confirmed");
      fetchWallet();
      refetchOrders();
    } catch (err: any) {
      toast.error("Failed to place order", { description: err.message });
    } finally {
      setPlacing(false);
    }
  };

  // ─── Steps UI ───────────────────────────────────────────
  function renderCategory() {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>What do you need today?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select one or more service categories</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {mainCategories.map((cat) => {
            const selected = selectedCategoryIds.includes(cat.id);
            const svcCount = (cat.services || []).filter((s: any) => s.isActive !== false).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategoryIds((prev) =>
                    selected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                  );
                  setSelectedServiceIds([]);
                  setItemQtys({});
                }}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all flex flex-col gap-2",
                  selected ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" : "border-border/60 hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <ServiceIcon serviceKey={cat.slug} iconName={cat.icon} className="h-8 w-8 shrink-0 text-primary" />
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                  )}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">{cat.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{svcCount} services</p>
                </div>
              </button>
            );
          })}
        </div>
        {selectedCategoryIds.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"} selected
          </p>
        )}
      </div>
    );
  }

  function renderServiceType() {
    const servicesForCategories = servicesData.filter(
      (s) => s.isActive !== false && selectedCategoryIds.includes(s.categoryId)
    );
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Choose services</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select the services you need within the chosen categories</p>
        </div>
        {selectedCategoryObjs.map((cat) => {
          const catServices = servicesForCategories.filter((s) => s.categoryId === cat.id);
          if (!catServices.length) return null;
          return (
            <div key={cat.id}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ServiceIcon serviceKey={cat.slug} iconName={cat.icon} className="h-3.5 w-3.5" />
                {cat.name}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {catServices.map((svc) => {
                  const selected = selectedServiceIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceIds((prev) =>
                          selected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                        );
                        setItemQtys({});
                      }}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all flex items-center gap-3",
                        selected ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" : "border-border/60 hover:border-muted-foreground/30"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{svc.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{svc.description || svc.unit}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      )}>
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {selectedServiceIds.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {selectedServiceIds.length} service{selectedServiceIds.length === 1 ? "" : "s"} selected
          </p>
        )}

        <Separator className="my-3" />
        <BookingTypeSelector value={bookingType} onChange={setBookingType} />
      </div>
    );
  }

  function renderInventory() {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Step 3 of 7</p>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Laundry Inventory</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Add the items you're handing over</p>
          {selectedServiceObjs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedServiceObjs.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>
              ))}
            </div>
          )}
        </div>

        {(bookingType === "laundry_bag" || bookingType === "mixed") && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Laundry Bags</p>
            </div>
            <p className="text-xs text-muted-foreground">Number of laundry bags</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setLaundryBagQty(Math.max(0, laundryBagQty - 1))}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums">{laundryBagQty}</span>
              <button type="button" onClick={() => setLaundryBagQty(laundryBagQty + 1)}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </Card>
        )}

        {(bookingType === "count_items" || bookingType === "mixed") && (
          <ItemCatalog
            items={catalogItems}
            quantities={itemQtys}
            onChange={setItemQtys}
            defaultPrices={defaultPrices}
          />
        )}

        {totalItems > 0 && (
          <div className="border-t pt-4 mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{totalItems} Item{totalItems !== 1 ? "s" : ""}</span>
              <p className="text-sm font-semibold">Est. ₹{totalPrice}</p>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Service: {selectedServiceObjs.map((s) => s.name).join(", ")}</span>
              <span>Est. Weight: {totalWeight.toFixed(1)} kg</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAddons() {
    const activeAddonCats = addonCategories.filter((cat) =>
      (cat.services || []).some((s: any) => s.isActive !== false)
    );

    if (!activeAddonCats.length) {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Optional Add-ons</h2>
            <p className="text-xs text-muted-foreground mt-0.5">No add-on services available</p>
          </div>
        </div>
      );
    }

    const currentCat = activeAddonCats.find((c) => c.id === selectedAddonCat) || activeAddonCats[0];
    const catServices = (currentCat?.services || []).filter((s: any) => s.isActive !== false);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Optional Add-ons</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Enhance your order with extra services</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {activeAddonCats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedAddonCat(cat.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-medium transition-colors",
                (selectedAddonCat === cat.id || (!selectedAddonCat && activeAddonCats[0].id === cat.id))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {catServices.map((svc: any) => {
            const qty = addonQtys[svc.id] || 0;
            const minPrice = svc.items?.length ? Math.min(...svc.items.map((i: any) => i.defaultPrice)) : 0;
            return (
              <div key={svc.id} className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-all",
                qty > 0 ? "border-primary bg-primary/5" : "border-border/60"
              )}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{svc.name}</p>
                  <p className="text-[10px] text-muted-foreground">{svc.description || svc.unit === "flat" ? "Flat fee" : `From ₹${minPrice}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAddonQtys((prev) => ({ ...prev, [svc.id]: Math.max(0, qty - 1) }))}
                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-semibold hover:bg-muted/80">−</button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button type="button" onClick={() => setAddonQtys((prev) => ({ ...prev, [svc.id]: qty + 1 }))}
                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold hover:bg-primary/90">+</button>
                </div>
              </div>
            );
          })}
        </div>

        {totalAddonItems > 0 && (
          <p className="text-xs text-muted-foreground text-center">{totalAddonItems} add-on{totalAddonItems === 1 ? "" : "s"} selected</p>
        )}
      </div>
    );
  }

  function parseSlotEndHour(slot: string): number {
    const end = slot.split("-")[1]?.trim() || "";
    const match = end.match(/(\d+):?(\d*)?\s*(AM|PM)/i);
    if (!match) return 23;
    let h = parseInt(match[1]);
    if (match[3]?.toUpperCase() === "PM" && h !== 12) h += 12;
    if (match[3]?.toUpperCase() === "AM" && h === 12) h = 0;
    return h;
  }
  function isSlotExpired(slot: string, dateLabel: string): boolean {
    if (dateLabel !== "Today") return false;
    const now = new Date();
    const currentHour = now.getHours();
    return parseSlotEndHour(slot) <= currentHour;
  }
  function renderSchedule() {
    const pSlots = PICKUP_SLOTS;
    const dSlots = DELIVERY_SLOTS;
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Pickup & Delivery</h2>
          <p className="text-xs text-muted-foreground mt-0.5">When should we pick up and deliver?</p>
        </div>

        {/* Address */}
        <div>
          <Label className="text-xs">Pickup Address</Label>
          <div className="mt-1 space-y-2">
            {addrList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses. Add one first.</p>
            ) : (
              <RadioGroup value={pickupAddr} onValueChange={setPickupAddr}>
                {addrList.map((a) => (
                  <label key={a.id} className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    pickupAddr === a.id ? "border-primary bg-primary/5" : "border-border/60"
                  )}>
                    <RadioGroupItem value={a.id} />
                    <div>
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.flatNo ? a.flatNo + ', ' : ''}{a.line}, {a.area}, {a.city} - {a.pincode}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowAddAddr(true)} className="w-full gap-1">
              <Plus className="h-3.5 w-3.5" /> Add New Address
            </Button>
          </div>
        </div>

        {/* Pickup */}
        <div>
          <Label className="text-xs">Pickup Date</Label>
          <div className="flex gap-2 mt-1">
            {["Today", "Tomorrow", "Day after"].map((d) => (
              <button key={d} type="button" onClick={() => { setPickupDate(d); setPickupSlot(""); }}
                className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                  pickupDate === d ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                )}>{d}</button>
            ))}
          </div>
        </div>
        {pickupDate && (
          <div>
            <Label className="text-xs">Pickup Time</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {pSlots.map((s) => {
                const expired = isSlotExpired(s.slot, pickupDate);
                return (
                <button key={s.id} type="button" disabled={expired} onClick={() => setPickupSlot(s.slot)}
                  className={cn("rounded-lg border py-2 px-3 text-xs font-medium transition-colors text-left",
                    expired && "opacity-40 cursor-not-allowed line-through",
                    pickupSlot === s.slot ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30",
                    s.premium && "border-amber-200 bg-amber-50/30"
                  )}>
                  {s.slot}
                  {s.premium && <span className="ml-1 text-[10px] text-amber-600 font-semibold">Premium</span>}
                </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery */}
        <Separator />
        <div>
          <Label className="text-xs">Delivery Date</Label>
          <div className="flex gap-2 mt-1">
            {["Tomorrow", "Day after", "3 days"].map((d) => (
              <button key={d} type="button" onClick={() => { setDeliveryDate(d); setDeliverySlot(""); }}
                className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                  deliveryDate === d ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                )}>{d}</button>
            ))}
          </div>
        </div>
        {deliveryDate && (
          <div>
            <Label className="text-xs">Delivery Time</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {dSlots.map((s) => {
                const expired = isSlotExpired(s.slot, deliveryDate);
                return (
                <button key={s.id} type="button" disabled={expired} onClick={() => setDeliverySlot(s.slot)}
                  className={cn("rounded-lg border py-2 px-3 text-xs font-medium transition-colors text-left",
                    expired && "opacity-40 cursor-not-allowed line-through",
                    deliverySlot === s.slot ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                  )}>{s.slot}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery Address */}
        <Separator />
        <div>
          <Label className="text-xs">Delivery Address</Label>
          <div className="mt-1 space-y-2">
            {addrList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses. Add one first.</p>
            ) : (
              <RadioGroup value={deliveryAddr} onValueChange={setDeliveryAddr}>
                {addrList.map((a) => (
                  <label key={a.id} className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    deliveryAddr === a.id ? "border-primary bg-primary/5" : "border-border/60"
                  )}>
                    <RadioGroupItem value={a.id} />
                    <div>
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.flatNo ? a.flatNo + ', ' : ''}{a.line}, {a.area}, {a.city} - {a.pincode}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowAddAddr(true)} className="w-full gap-1">
              <Plus className="h-3.5 w-3.5" /> Add New Address
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs">Special Instructions (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Gate code, landmark, delivery instructions..."
            className="mt-1 h-20 resize-none text-sm" />
        </div>
      </div>
    );
  }

  function renderVendor() {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Assign vendor</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Choose how to assign your laundry vendor.</p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { setVendorMode("auto"); setSelectedVendor(""); }}
            className={cn(
              "w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3",
              vendorMode === "auto"
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border/60 hover:border-muted-foreground/30"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              vendorMode === "auto" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">AI Auto-Assign (Recommended)</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Our AI picks the best vendor based on distance, ratings, and availability.</p>
              {vendorMode === "auto" && vendorsList?.[0] && (
                <p className="text-[11px] text-primary mt-1 font-medium">
                  → {vendorsList[0].name} · {vendorsList[0].rating} ⭐ · {vendorsList[0].distanceKm} km
                </p>
              )}
            </div>
            <input type="radio" checked={vendorMode === "auto"} readOnly className="accent-primary mt-1" />
          </button>

          <button
            type="button"
            onClick={() => setVendorMode("manual")}
            className={cn(
              "w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3",
              vendorMode === "manual"
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border/60 hover:border-muted-foreground/30"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              vendorMode === "manual" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Choose manually</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pick from available vendors near you.</p>
            </div>
            <input type="radio" checked={vendorMode === "manual"} readOnly className="accent-primary mt-1" />
          </button>

          {vendorMode === "manual" && (
            <div className="grid md:grid-cols-2 gap-2 pl-2">
              {vendorsList?.map((v) => (
                <label
                  key={v.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    selectedVendor === v.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/30"
                  )}
                >
                  <input type="radio" name="vendor" checked={selectedVendor === v.id} onChange={() => setSelectedVendor(v.id)} className="accent-primary" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold shrink-0",
                      v.logoColor || "bg-primary"
                    )}>
                      {v.logoInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {v.rating} · {v.distanceKm}km
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderReview() {
    const pBreakdown = pricingResult || { subtotal: 0, taxes: 0, platformFee: 0, deliveryFee: 0, total: 0, breakdown: [] };
    const selectedAddonSvcs = addonServices.filter((s: any) => (addonQtys[s.id] || 0) > 0);
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Review & Confirm</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Please review your order before confirming</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Left — Items Summary */}
          <div className="space-y-3">
            <Card className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Order Summary
              </p>

              {selectedCategoryObjs.length > 0 && (
                <div className="flex flex-wrap gap-1 pb-2 border-b border-border/40">
                  {selectedCategoryObjs.map((cat) => (
                    <Badge key={cat.id} variant="secondary" className="text-[10px]">{cat.name}</Badge>
                  ))}
                </div>
              )}

              {selectedServiceObjs.map((svc) => {
                const svcItems = Object.values(itemQtys).filter((iq) => {
                  return svc.items?.some((si: any) => si.itemMasterId === iq.itemId);
                });
                if (!svcItems.length) return null;
                return (
                  <div key={svc.id}>
                    <p className="text-sm font-semibold mt-2 mb-1">{svc.name}</p>
                    {svcItems.map((iq) => {
                      const si = svc.items?.find((s: any) => s.itemMasterId === iq.itemId);
                      return (
                        <div key={iq.itemId} className="flex items-center justify-between text-sm py-0.5">
                          <span>{si?.itemName || iq.itemId}</span>
                          <span className="text-muted-foreground">× {iq.qty}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {laundryBagQty > 0 && (
                <div className="flex items-center justify-between text-sm py-0.5">
                  <span><ShoppingBag className="h-3.5 w-3.5 inline mr-1" />Laundry Bags</span>
                  <span className="text-muted-foreground">× {laundryBagQty}</span>
                </div>
              )}

              {selectedAddonSvcs.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Add-ons
                  </p>
                  {selectedAddonSvcs.map((svc: any) => (
                    <div key={svc.id} className="flex items-center justify-between text-sm py-0.5">
                      <span>{svc.name}</span>
                      <span className="text-muted-foreground">× {addonQtys[svc.id]}</span>
                    </div>
                  ))}
                </>
              )}

              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-semibold">{totalItems + (bookingType !== "count_items" ? laundryBagQty : 0) + totalAddonItems}</span>
              </div>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Schedule
              </p>
              {(() => { const a = addrList.find((x) => x.id === pickupAddr); return a ? (
                <p className="text-xs text-muted-foreground"><span className="font-medium">Pickup:</span> {a.label} — {a.flatNo ? a.flatNo + ', ' : ''}{a.line}, {a.area}, {a.city}</p>
              ) : null; })()}
              {(() => { const a = addrList.find((x) => x.id === deliveryAddr); return a ? (
                <p className="text-xs text-muted-foreground"><span className="font-medium">Delivery:</span> {a.label} — {a.flatNo ? a.flatNo + ', ' : ''}{a.line}, {a.area}, {a.city}</p>
              ) : null; })()}
              <p className="text-xs text-muted-foreground"><span className="font-medium">Pickup slot:</span> {pickupDate}, {pickupSlot}</p>
              <p className="text-xs text-muted-foreground"><span className="font-medium">Delivery slot:</span> {deliveryDate}, {deliverySlot}</p>
            </Card>

            <Card className="p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" /> Vendor
              </p>
              {vendorMode === "auto" && vendorsList?.[0] ? (
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0",
                    vendorsList[0].logoColor || "bg-primary"
                  )}>
                    {vendorsList[0].logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{vendorsList[0].name}</p>
                    <p className="text-xs text-muted-foreground truncate">{vendorsList[0].area} · {vendorsList[0].distanceKm} km</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {vendorsList[0].rating}
                    </div>
                  </div>
                </div>
              ) : vendorMode === "manual" && selectedVendor ? (
                <p className="text-sm font-medium">
                  {(vendorsList || []).find((v) => v.id === selectedVendor)?.name || "Selected Vendor"}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No vendor assigned</p>
              )}
            </Card>
          </div>

          {/* Right — Pricing */}
          <div className="space-y-3">
            <Card className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Price Estimate
              </p>
              {pricingLoading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Calculating...</p>
              ) : (
                <>
                  {(pBreakdown.breakdown || []).filter((b) => b.amount > 0).map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span>{formatINRDecimal(b.amount)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>{formatINRDecimal(pBreakdown.total)}</span>
                  </div>
                </>
              )}
            </Card>

            {/* Coupon */}
            <Card className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Coupon
              </p>
              <div className="flex gap-2">
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter code" className="text-sm uppercase flex-1" />
                <Button variant="outline" size="sm" onClick={() => setStep("review")}>Apply</Button>
              </div>
            </Card>

            {/* Wallet */}
            {walletBalance > 0 && (
              <label className="flex items-center gap-2 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} className="accent-primary" />
                <div>
                  <p className="text-sm font-medium">Use Wallet</p>
                  <p className="text-xs text-muted-foreground">Balance: {formatINRDecimal(walletBalance)}</p>
                </div>
              </label>
            )}

            {/* Points */}
            {loyaltyPoints >= 100 && (
              <Card className="p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reward Points</p>
                <div className="flex gap-2">
                  <Input type="number" value={redeemPoints || ""}
                    onChange={(e) => setRedeemPoints(Math.min(Number(e.target.value) || 0, loyaltyPoints))}
                    placeholder={`You have ${loyaltyPoints} pts`} className="text-sm flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setRedeemPoints(Math.min(loyaltyPoints, Math.floor(pBreakdown.total * 100)))}>
                    Max
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">100 pts = ₹1. {redeemPoints > 0 ? `${formatINRDecimal(redeemPoints / 100)} off` : ""}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderConfirmed() {
    if (!confirmedOrder) return null;
    const selAddr = addrList.find((a) => a.id === pickupAddr);
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Order Confirmed!</h2>
          <p className="text-sm text-muted-foreground mt-1">Your order code is <span className="font-mono font-bold text-foreground">{confirmedOrder.code}</span></p>
        </div>
        <Card className="max-w-sm mx-auto p-4 text-left space-y-1">
          <p className="text-sm">Pickup: <strong>{confirmedOrder.pickupDate}</strong>, <strong>{confirmedOrder.pickupSlot}</strong></p>
          <p className="text-sm">Delivery: <strong>{confirmedOrder.deliveryDate}</strong>, <strong>{confirmedOrder.deliverySlot}</strong></p>
          {selAddr && <p className="text-xs text-muted-foreground">{selAddr.line}, {selAddr.area}</p>}
          <p className="text-sm">Vendor: <strong>{confirmedOrder.vendorName}</strong></p>
          <p className="text-sm font-semibold">Total: {formatINRDecimal(confirmedOrder.total)}</p>
        </Card>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => { onClose(); }}>Track Order</Button>
        </div>
      </div>
    );
  }

  // ─── Step navigation ────────────────────────────────────
  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Book Laundry Service</DialogTitle>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 min-w-0">
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                i === currentIndex ? "bg-primary/10 text-primary font-semibold" :
                i < currentIndex ? "text-green-600" : "text-muted-foreground"
              )}>
                {i < currentIndex ? <Check className="h-3 w-3" /> : <span className="w-3 h-3 rounded-full border-2 inline-block" style={i === currentIndex ? { borderColor: 'currentColor', background: 'currentColor' } : {}} />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-4 bg-border shrink-0" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {step === "category" && renderCategory()}
            {step === "serviceType" && renderServiceType()}
            {step === "inventory" && renderInventory()}
            {step === "addons" && renderAddons()}
            {step === "schedule" && renderSchedule()}
            {step === "vendor" && renderVendor()}
            {step === "review" && renderReview()}
            {step === "confirmed" && renderConfirmed()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {step !== "confirmed" && (
          <div className="flex gap-2 pt-6">
            {currentIndex > 0 ? (
              <Button variant="outline" onClick={() => setStep(STEPS[currentIndex - 1].id)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose} className="gap-1">Cancel</Button>
            )}

            {step === "review" ? (
              <Button className="flex-1 gap-1" onClick={handlePlaceOrder} disabled={placing || pricingLoading}>
                {placing ? "Placing..." : `Confirm Order${pricingResult ? ` · ${formatINRDecimal(pricingResult.total)}` : ""}`}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="flex-1 gap-1" onClick={() => setStep(STEPS[currentIndex + 1].id)} disabled={!canContinue}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Add Address Dialog */}
        <Dialog open={showAddAddr} onOpenChange={setShowAddAddr}>
          <DialogContent className="max-w-md">
            <DialogTitle className="sr-only">Add New Address</DialogTitle>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add New Address</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Enter your pickup address details</p>
            </div>
            <div className="space-y-3">
              <Label className="text-xs">Label (e.g. Home, Work)</Label>
              <Input value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} placeholder="Home" />
              <div>
                <Label className="text-xs">Search Address</Label>
                <div className="mt-1">
                  {useGoogleMapsAvailable() ? (
                    <AddressAutocomplete
                      value={newAddr.line}
                      onChange={(place) => {
                        if (place) {
                          setNewAddr((prev) => ({ ...prev, line: place.streetAddress, area: place.area, city: place.city, pincode: place.pincode, place_id: place.placeId }));
                        }
                      }}
                      placeholder="Search your full address..."
                    />
                  ) : (
                    <Input value={newAddr.line} onChange={(e) => setNewAddr({ ...newAddr, line: e.target.value })} placeholder="Flat / House no, Street" />
                  )}
                </div>
              </div>
              <Input value={newAddr.flatNo} onChange={(e) => setNewAddr({ ...newAddr, flatNo: e.target.value })} placeholder="Flat 2B, Building name" />
              <div className="grid grid-cols-2 gap-3">
                <Input value={newAddr.area} onChange={(e) => setNewAddr({ ...newAddr, area: e.target.value })} placeholder="Area" />
                <Input value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="Pincode" />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddAddr(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!newAddr.label || !newAddr.line || !newAddr.area || !newAddr.city || newAddr.pincode.length < 6}
                onClick={async () => {
                  try {
                    const addr = await api.post<Address>("/api/addresses", newAddr);
                    refetchAddresses();
                    setPickupAddr(addr.id);
                    setShowAddAddr(false);
                    setNewAddr({ label: "", line: "", flatNo: "", area: "", city: "", pincode: "", place_id: "" });
                    toast.success("Address added");
                  } catch (err: any) {
                    toast.error("Failed to add address", { description: err.message });
                  }
                }}>
                Save Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
