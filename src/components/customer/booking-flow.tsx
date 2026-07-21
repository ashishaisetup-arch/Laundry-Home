import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  MapPin,
  Package,
  Sparkles,
  Star,
  Store,
  Truck,
  Plus,
  Minus,
  Wallet,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { ServiceIcon } from "@/components/shared/service-icon";
import { useServices, useVendors, useAddresses, useOrders } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import type { ServiceKey, Address } from "@/lib/types";
import type { Slot } from "@/lib/hooks/useSlots";
import { cn, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useUserSubscriptions } from "@/lib/hooks/useUserSubscriptions";

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

type Step = "services" | "schedule" | "vendor" | "review" | "confirmed";

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

export function BookingFlow({ open, onClose, location: externalLocation }: BookingFlowProps) {
  const { data: services } = useServices();
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

  const { data: vendorsList } = useVendors(
    activeLocation ? { lat: activeLocation.lat, lng: activeLocation.lng, radiusKm: 5 } : undefined
  );
  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const { refetch: refetchOrders } = useOrders();

  const servicesData = services || [];
  const addrList = addresses || [];

  const [step, setStep] = useState<Step>("services");
  const [selectedServices, setSelectedServices] = useState<Partial<Record<ServiceKey, { qty: number; express: boolean }>>>({});
  const [pickupAddr, setPickupAddr] = useState("");
  const [pickupDate, setPickupDate] = useState("Today");
  const [pickupSlot, setPickupSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("Tomorrow");
  const [deliverySlot, setDeliverySlot] = useState("");

  const [vendorMode, setVendorMode] = useState<"auto" | "manual">("auto");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", line: "", area: "", city: "", pincode: "" });
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

  const [confirmedOrder, setConfirmedOrder] = useState<{
    code: string;
    total: number;
    pickupDate: string;
    pickupSlot: string;
    deliveryDate: string;
    deliverySlot: string;
    vendorName: string;
  } | null>(null);

  const steps: { id: Step; label: string }[] = [
    { id: "services", label: "Services" },
    { id: "schedule", label: "Schedule" },
    { id: "vendor", label: "Vendor" },
    { id: "review", label: "Review" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  useEffect(() => {
    if (open) fetchWallet();
  }, [open, fetchWallet]);

  const fetchPricing = useCallback(async (opts?: { coupon?: string; points?: number; walletAmt?: number }) => {
    const items = Object.entries(selectedServices)
      .filter(([, v]) => v.qty > 0)
      .map(([key, v]) => {
        const svc = servicesData.find((s) => s.key === key);
        return {
          serviceKey: key,
          serviceName: svc?.name || key,
          qty: v.qty,
          unit: svc?.pricingType === "per_kg" ? "kg" : "piece",
          unitPrice: svc?.basePrice || 0,
          express: v.express,
        };
      });
    if (items.length === 0) { setPricingResult(null); return; }
    setPricingLoading(true);
    try {
      const addr = addrList.find((a) => a.id === pickupAddr);
      const result = await api.post<PricingBreakdown>("/api/orders/pricing", {
        items,
        couponCode: opts?.coupon !== undefined ? opts.coupon : couponCode || undefined,
        redeemPoints: opts?.points !== undefined ? opts.points : redeemPoints || undefined,
        useWalletAmount: opts?.walletAmt !== undefined ? opts.walletAmt : (useWallet ? walletBalance : 0),
        pickupArea: addr?.area,
        pickupDate: resolveDate(pickupDate),
        pickupSlot,
      });
      setPricingResult(result);
    } catch {
      setPricingResult(null);
    } finally {
      setPricingLoading(false);
    }
  }, [selectedServices, servicesData, addrList, pickupAddr, couponCode, redeemPoints, useWallet, walletBalance, pickupDate, pickupSlot]);

  useEffect(() => {
    if (step === "review") fetchPricing();
  }, [step, fetchPricing]);

  const selectedServiceList = Object.entries(selectedServices).filter(([, v]) => v.qty > 0) as [ServiceKey, NonNullable<typeof selectedServices[ServiceKey]>][];

  const pricing = pricingResult;
  const subtotal = pricing?.subtotal ?? 0;
  const taxes = pricing?.taxes ?? 0;
  const platformFee = pricing?.platformFee ?? 0;
  const deliveryFee = pricing?.deliveryFee ?? 0;
  const expressSurcharge = pricing?.expressSurcharge ?? 0;
  const discount = (pricing?.couponDiscount ?? 0) + (pricing?.subscriptionDiscount ?? 0) + (pricing?.rewardDiscount ?? 0);
  const total = pricing?.total ?? 0;

  const DAY_OFFSET: Record<string, number> = { "Today": 0, "Tomorrow": 1, "Day after": 2, "3 days": 3 };
  function parseSlotStartHour(slot: string): number {
    const start = slot.split("–")[0]?.split("-")[0]?.trim() || "";
    const match = start.match(/(\d+):?(\d*)?\s*(AM|PM)/i);
    if (!match) return 0;
    let h = parseInt(match[1]);
    if (match[3]?.toUpperCase() === "PM" && h !== 12) h += 12;
    if (match[3]?.toUpperCase() === "AM" && h === 12) h = 0;
    return h;
  }
  function isDeliverySlotValid(pDate: string, pSlot: string, dDate: string, dSlot: string): boolean {
    if (!pSlot || !dSlot) return true;
    const po = DAY_OFFSET[pDate], doff = DAY_OFFSET[dDate];
    if (po === undefined || doff === undefined) return true;
    const dayGap = doff - po;
    if (dayGap > 1) return true;
    if (dayGap < 1) return false;
    const ph = parseSlotStartHour(pSlot);
    const dh = parseSlotStartHour(dSlot);
    return 24 + dh - ph >= 24;
  }
  const isExpress = selectedServiceList.some(([, v]) => v.express);
  const gapWarnings: string[] = [];
  if (!isExpress && pickupSlot && deliverySlot && deliveryDate && pickupDate) {
    if (!isDeliverySlotValid(pickupDate, pickupSlot, deliveryDate, deliverySlot)) {
      gapWarnings.push("A minimum 24-hour gap is required between pickup and delivery. Select a later delivery slot or enable Express delivery.");
    }
  }

  const canProceed = () => {
    if (step === "services") return selectedServiceList.length > 0;
    if (step === "schedule") return !!pickupAddr && !!pickupSlot && !!deliverySlot && gapWarnings.length === 0;
    if (step === "vendor") return vendorMode === "auto" || !!selectedVendor;
    return true;
  };

  const handleNext = async () => {
    if (step === "services") setStep("schedule");
    else if (step === "schedule") setStep("vendor");
    else if (step === "vendor") setStep("review");
    else if (step === "review") {
      setPlacing(true);
      try {
        const items = selectedServiceList.map(([key, v]) => {
          const svc = servicesData.find((s) => s.key === key);
          return {
            serviceKey: key,
            serviceName: svc?.name || key,
            qty: v.qty,
            unit: svc?.pricingType === "per_kg" ? "kg" : "piece",
            unitPrice: svc?.basePrice || 0,
            express: v.express,
          };
        });

        const chosenVendor = vendorMode === "auto"
          ? vendorsList?.[0]
          : vendorsList?.find((v) => v.id === selectedVendor);

        const addr = addrList.find((a) => a.id === pickupAddr);
        const orderPayload = {
          vendor_id: chosenVendor?.id || null,
          vendor_name: chosenVendor?.name || vendorMode === "auto" ? "AI-assigned Vendor" : "Selected Vendor",
          vendor_logo_initials: chosenVendor?.logoInitials || "LH",
          vendor_logo_color: chosenVendor?.logoColor || "bg-primary",
          items,
          pickup_address: addr?.line || "",
          pickup_area: addr?.area || "",
          pickup_date: resolveDate(pickupDate),
          pickup_slot: pickupSlot,
          delivery_date: resolveDate(deliveryDate),
          delivery_slot: deliverySlot,
          amount: subtotal,
          taxes,
          platform_fee: platformFee,
          delivery_fee: deliveryFee,
          total,
          express: selectedServiceList.some(([, v]) => v.express),
          notes,
          couponCode: couponCode || undefined,
          redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
          useWalletAmount: useWallet ? walletBalance : 0,
        };

        const newOrder = await api.post<{ code: string; total: number }>("/api/orders", orderPayload);

        setConfirmedOrder({
          code: newOrder.code,
          total: newOrder.total,
          pickupDate,
          pickupSlot,
          deliveryDate,
          deliverySlot,
          vendorName: chosenVendor?.name || "AI-assigned Vendor",
        });

        setStep("confirmed");
        refetchOrders();
        toast.success("Booking confirmed!", {
          description: `Order ${newOrder.code} placed. Pickup scheduled for ${pickupDate}, ${pickupSlot}.`,
        });
      } catch (err: any) {
        toast.error("Booking failed", { description: err.message });
      } finally {
        setPlacing(false);
      }
    }
  };

  const handleBack = () => {
    if (step === "schedule") setStep("services");
    else if (step === "vendor") setStep("schedule");
    else if (step === "review") setStep("vendor");
  };

  const handleClose = () => {
    setStep("services");
    setSelectedServices({} as never);
    setPickupAddr("");
    setPickupDate("Today");
    setPickupSlot("");
    setDeliveryDate("Tomorrow");
    setDeliverySlot("");
    setVendorMode("auto");
    setSelectedVendor("");
    setNotes("");
    setCouponCode("");
    setConfirmedOrder(null);
    setShowAddAddr(false);
    setNewAddr({ label: "", line: "", area: "", city: "", pincode: "" });
    onClose();
  };

  const handleAddAddress = async () => {
    try {
      const newAddress = await api.post<Address>("/api/addresses", newAddr);
      refetchAddresses();
      setPickupAddr(newAddress.id);
      setShowAddAddr(false);
      setNewAddr({ label: "", line: "", area: "", city: "", pincode: "" });
      toast.success("Address added");
    } catch (err: any) {
      toast.error("Failed to add address", { description: err.message });
    }
  };

  const toggleService = (key: ServiceKey) => {
    setSelectedServices((prev) => {
      const current = prev[key];
      if (!current || current.qty === 0) {
        return { ...prev, [key]: { qty: 1, express: false } };
      }
      return { ...prev, [key]: { ...current, qty: current.qty + 1 } };
    });
  };

  const updateQty = (key: ServiceKey, delta: number) => {
    setSelectedServices((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const newQty = Math.max(0, current.qty + delta);
      if (newQty === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { ...current, qty: newQty } };
    });
  };

  const toggleExpress = (key: ServiceKey) => {
    setSelectedServices((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return { ...prev, [key]: { ...current, express: !current.express } };
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Book a pickup</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "confirmed" && confirmedOrder ? (
            <BookingConfirmed
              key="confirmed"
              code={confirmedOrder.code}
              total={confirmedOrder.total}
              pickupDate={confirmedOrder.pickupDate}
              pickupSlot={confirmedOrder.pickupSlot}
              deliveryDate={confirmedOrder.deliveryDate}
              deliverySlot={confirmedOrder.deliverySlot}
              vendorName={confirmedOrder.vendorName}
              onClose={handleClose}
            />
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {/* Stepper header */}
              <div className="border-b border-border p-5 bg-tonal-accent">
                <div className="flex items-center justify-between">
                  {steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 flex-1">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all",
                        i < stepIndex && "bg-primary text-primary-foreground",
                        i === stepIndex && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                        i > stepIndex && "bg-muted text-muted-foreground"
                      )}>
                        {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={cn(
                        "text-sm font-medium hidden sm:inline",
                        i <= stepIndex ? "text-foreground" : "text-muted-foreground"
                      )}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {step === "services" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">Choose services</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Select quantity for each service needed.</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{selectedServiceList.length} selected</Badge>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {servicesData.map((s) => {
                        const sel = selectedServices[s.key as ServiceKey];
                        const count = sel?.qty || 0;
                        return (
                          <Card
                            key={s.key}
                            className={cn(
                              "p-4 shadow-soft cursor-pointer transition-all",
                              count > 0 && "ring-2 ring-primary bg-primary/5"
                            )}
                            onClick={() => toggleService(s.key as ServiceKey)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tonal-accent text-primary shrink-0">
                                <ServiceIcon serviceKey={s.key as ServiceKey} className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{s.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-xs font-semibold">₹{s.basePrice}<span className="text-[10px] text-muted-foreground">/{s.pricingType === "per_kg" ? "kg" : "piece"}</span></span>
                                  <span className="text-[10px] text-amber-600">×{s.expressMultiplier}x express</span>
                                </div>
                              </div>
                            </div>
                            {count > 0 && (
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); updateQty(s.key as ServiceKey, -1); }}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="text-sm font-semibold w-6 text-center">{count}</span>
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); updateQty(s.key as ServiceKey, 1); }}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleExpress(s.key as ServiceKey); }}
                                    className={cn(
                                      "text-[10px] font-medium px-2 py-0.5 rounded transition-colors",
                                      sel?.express
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                        : "text-muted-foreground hover:bg-muted"
                                    )}
                                  >
                                    {sel?.express ? "⚡ Express" : "Express?"}
                                  </button>
                                  <span className="text-xs font-semibold">₹{formatINRDecimal(
                                    s.basePrice * count * (sel?.express ? s.expressMultiplier : 1)
                                  )}</span>
                                </div>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === "schedule" && (
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Schedule pickup & delivery</h3>
                    <p className="text-sm text-muted-foreground mb-4">When should we pick up and deliver your laundry?</p>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Pickup Address */}
                      <Card className="p-4 shadow-soft col-span-full">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            Pickup Address
                          </p>
                          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowAddAddr(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </Button>
                        </div>
                        {addrList.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No saved addresses</p>
                            <p className="text-xs mt-0.5">Add an address to continue booking.</p>
                          </div>
                        ) : (
                        <div className="grid md:grid-cols-2 gap-2">
                          {addrList.map((a) => (
                            <label
                              key={a.id}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                pickupAddr === a.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/30"
                              )}
                              onClick={() => setPickupAddr(a.id)}
                            >
                              <input type="radio" name="pickupAddr" checked={pickupAddr === a.id} onChange={() => setPickupAddr(a.id)} className="mt-0.5 accent-primary" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{a.label}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{a.line}</p>
                                <p className="text-xs text-muted-foreground">{a.area}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                        )}
                      </Card>

                      {/* Pickup date */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Pickup Date</Label>
                        <div className="flex gap-2">
                          {["Today", "Tomorrow", "Day after"].map((d) => (
                            <button
                              key={d}
                              onClick={() => setPickupDate(d)}
                              className={cn(
                                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                pickupDate === d ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                              )}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pickup slot */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Pickup Time</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PICKUP_SLOTS.map((s) => (
                            <button
                              key={s.id}
                              disabled={!s.available}
                              onClick={() => setPickupSlot(s.slot)}
                              className={cn(
                                "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                                !s.available && "opacity-40 cursor-not-allowed line-through",
                                pickupSlot === s.slot ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                              )}
                            >
                              {s.slot}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Delivery date */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Delivery Date</Label>
                        <div className="flex gap-2">
                          {["Tomorrow", "Day after", "3 days"].map((d) => (
                            <button
                              key={d}
                              onClick={() => setDeliveryDate(d)}
                              className={cn(
                                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                deliveryDate === d ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                              )}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Delivery slot */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Delivery Time</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {DELIVERY_SLOTS.map((s) => {
                            const gapViolation = !!(!isExpress && pickupSlot && pickupDate && !isDeliverySlotValid(pickupDate, pickupSlot, deliveryDate, s.slot));
                            return (
                            <button
                              key={s.id}
                              disabled={!s.available || gapViolation}
                              onClick={() => setDeliverySlot(s.slot)}
                              className={cn(
                                "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                                !s.available && "opacity-40 cursor-not-allowed line-through",
                                gapViolation && "opacity-30 cursor-not-allowed",
                                deliverySlot === s.slot ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/30"
                              )}
                            >
                              {s.slot}
                            </button>
                          );
                          })}
                        </div>
                        {gapWarnings.length > 0 && (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{gapWarnings[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label className="text-xs font-semibold">Special Instructions (optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="E.g. fragile items, leave at door, etc."
                        className="mt-1 h-20 resize-none"
                      />
                    </div>
                  </div>
                )}

                {step === "vendor" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">Assign vendor</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Choose how to assign your laundry vendor.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Card
                        className={cn(
                          "p-4 shadow-soft cursor-pointer transition-all",
                          vendorMode === "auto" && "ring-2 ring-primary bg-primary/5"
                        )}
                        onClick={() => setVendorMode("auto")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">AI Auto-Assign (Recommended)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Our AI picks the best vendor based on distance, ratings, and availability.</p>
                          </div>
                          <input type="radio" checked={vendorMode === "auto"} readOnly className="accent-primary" />
                        </div>
                      </Card>

                      <Card
                        className={cn(
                          "p-4 shadow-soft cursor-pointer transition-all",
                          vendorMode === "manual" && "ring-2 ring-primary bg-primary/5"
                        )}
                        onClick={() => setVendorMode("manual")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tonal-accent text-primary">
                            <Store className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">Choose manually</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Pick from available vendors near you.</p>
                          </div>
                          <input type="radio" checked={vendorMode === "manual"} readOnly className="accent-primary" />
                        </div>
                      </Card>

                      {vendorMode === "manual" && (
                        <div className="grid md:grid-cols-2 gap-3 pl-2">
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
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-semibold shrink-0">
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
                )}

                {step === "review" && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold">Review & confirm</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Check the details before placing your order.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Order summary */}
                      <Card className="p-4 shadow-soft">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Order Summary</p>
                        <div className="space-y-2">
                          {selectedServiceList.map(([key, v]) => {
                            const svc = servicesData.find((s) => s.key === key);
                            if (!svc) return null;
                            const linePrice = svc.basePrice * v.qty * (v.express ? svc.expressMultiplier : 1);
                            return (
                              <div key={key} className="flex items-start gap-2 text-sm">
                                <ServiceIcon serviceKey={key} className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="font-medium">{svc.name} <span className="text-muted-foreground">× {v.qty}</span></p>
                                  {v.express && <Badge variant="outline" className="text-[9px] py-0 h-4 mt-0.5 border-amber-400 text-amber-600 bg-amber-50">Express</Badge>}
                                </div>
                                <p className="font-semibold">{formatINRDecimal(linePrice)}</p>
                              </div>
                            );
                          })}
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-1.5 text-sm">
                          {pricingLoading ? (
                            <div className="text-center py-4 text-muted-foreground text-xs">Calculating pricing...</div>
                          ) : pricing?.breakdown ? (
                            pricing.breakdown.map((item, i) => (
                              <div key={i} className={cn(
                                "flex justify-between",
                                item.amount < 0 && "text-emerald-600",
                                item.label === "Total" && "font-bold text-base pt-1 border-t border-border"
                              )}>
                                <span>{item.label}</span>
                                <span>{item.amount < 0 ? "−" : ""}{formatINRDecimal(Math.abs(item.amount))}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINRDecimal(subtotal)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Taxes (18% GST)</span><span>{formatINRDecimal(taxes)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span>{formatINRDecimal(platformFee)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>{formatINRDecimal(deliveryFee)}</span></div>
                              {expressSurcharge > 0 && (
                                <div className="flex justify-between"><span className="text-muted-foreground">Express surcharge</span><span>{formatINRDecimal(expressSurcharge)}</span></div>
                              )}
                              {discount > 0 && (
                                <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{formatINRDecimal(discount)}</span></div>
                              )}
                              <Separator className="my-2" />
                              <div className="flex justify-between font-bold text-base">
                                <span>Total</span>
                                <span>{formatINRDecimal(total)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </Card>

                      {/* Schedule + vendor + payment */}
                      <div className="space-y-3">
                        <Card className="p-4 shadow-soft">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Schedule</p>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-start gap-2">
                              <Package className="h-4 w-4 mt-0.5 text-primary" />
                              <div className="flex-1">
                                <p className="font-medium">Pickup: {pickupDate}, {pickupSlot}</p>
                                <p className="text-xs text-muted-foreground">{addrList.find((a) => a.id === pickupAddr)?.line}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Truck className="h-4 w-4 mt-0.5 text-primary" />
                              <div>
                                <p className="font-medium">Delivery: {deliveryDate}, {deliverySlot}</p>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-4 shadow-soft">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vendor</p>
                          {vendorMode === "auto" && vendorsList?.[0] ? (
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0",
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
                          ) : vendorMode === "manual" ? (
                            <p className="text-sm font-medium">
                              {(vendorsList || []).find((v) => v.id === selectedVendor)?.name || "Selected Vendor"}
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-muted-foreground">AI-assigned Vendor</p>
                          )}
                          {vendorMode === "auto" && (
                            <p className="text-xs text-emerald-600 mt-0.5">✨ 94% AI match confidence</p>
                          )}
                        </Card>

                        <Card className="p-4 shadow-soft">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coupon</p>
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={couponCode}
                              onChange={(e) => {
                                setCouponCode(e.target.value.toUpperCase());
                              }}
                              onBlur={(e) => {
                                const val = (e.target as HTMLInputElement).value.toUpperCase();
                                if (val) fetchPricing({ coupon: val });
                              }}
                              placeholder="Enter code"
                              className="text-sm font-mono"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchPricing({ coupon: couponCode })}
                            >
                              Apply
                            </Button>
                          </div>
                          {pricing?.couponDiscount ? (
                            <p className="text-xs text-emerald-600 mt-2">✓ {formatINRDecimal(pricing.couponDiscount)} discount applied!</p>
                          ) : couponCode && pricing?.couponDiscount === 0 ? (
                            <p className="text-xs text-rose-500 mt-2">✗ Invalid or expired coupon</p>
                          ) : null}
                        </Card>

                        {activeSubscription && (
                          <Card className="p-4 shadow-soft border-emerald-200 bg-emerald-50/50">
                            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">✨ Subscription Active</p>
                            <p className="text-xs text-emerald-600">You get {pricing?.subscriptionDiscount ? `${formatINRDecimal(pricing.subscriptionDiscount)} off` : "a discount"} on this order.</p>
                          </Card>
                        )}

                        <Card className="p-4 shadow-soft">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet</p>
                            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Balance: {formatINRDecimal(walletBalance)}</p>
                              <p className="text-xs text-muted-foreground">{loyaltyPoints} loyalty points</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-xs text-muted-foreground">Use wallet</span>
                              <input
                                type="checkbox"
                                checked={useWallet}
                                onChange={(e) => {
                                  setUseWallet(e.target.checked);
                                }}
                                className="accent-primary h-4 w-4"
                              />
                            </label>
                          </div>
                          {useWallet && walletBalance > 0 && (
                            <p className="text-xs text-emerald-600 mt-1.5">
                              {walletBalance >= total ? "Wallet covers the full amount!" : `${formatINRDecimal(walletBalance)} will be applied`}
                            </p>
                          )}
                        </Card>

                        <Card className="p-4 shadow-soft">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reward Points</p>
                            <Star className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          {loyaltyPoints > 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">{loyaltyPoints} pts available (100 pts = ₹1)</p>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={loyaltyPoints}
                                  step={100}
                                  value={redeemPoints || ""}
                                  onChange={(e) => {
                                    const val = Math.min(parseInt(e.target.value) || 0, loyaltyPoints);
                                    setRedeemPoints(val);
                                  }}
                                  onBlur={(e) => {
                                    const val = Math.min(parseInt((e.target as HTMLInputElement).value) || 0, loyaltyPoints);
                                    if (val > 0) fetchPricing({ points: val });
                                  }}
                                  placeholder="Enter points"
                                  className="text-sm font-mono"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setRedeemPoints(loyaltyPoints);
                                    fetchPricing({ points: loyaltyPoints });
                                  }}
                                >
                                  Max
                                </Button>
                              </div>
                              {pricing?.rewardDiscount ? (
                                <p className="text-xs text-emerald-600">✓ {formatINRDecimal(pricing.rewardDiscount)} discount applied</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No reward points available. Earn points with each order!</p>
                          )}
                        </Card>

                        <Card className="p-4 shadow-soft">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment Method</p>
                          <RadioGroup defaultValue="cod">
                            <div className="space-y-1.5">
                              {[
                                { id: "upi", label: "UPI", icon: "📱" },
                                { id: "card", label: "Credit/Debit Card", icon: "💳" },
                                { id: "wallet", label: `Wallet (${formatINRDecimal(walletBalance)})`, icon: "👛" },
                                { id: "cod", label: "Cash on Delivery", icon: "💵" },
                              ].map((p) => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/30">
                                  <RadioGroupItem value={p.id} id={p.id} />
                                  <span className="text-base">{p.icon}</span>
                                  <span className="text-sm">{p.label}</span>
                                </label>
                              ))}
                            </div>
                          </RadioGroup>
                        </Card>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 flex items-center justify-between bg-muted/30">
                  <div>
                    {selectedServiceList.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedServiceList.length} service(s) selected
                      </p>
                    )}
                    {step === "review" && (
                      <p className="text-sm font-bold">Total: {formatINRDecimal(total)}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {step !== "services" && (
                      <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Back
                      </Button>
                    )}
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      disabled={!canProceed() || placing}
                      onClick={handleNext}
                    >
                      {placing ? "Placing..." : step === "review" ? "Confirm Booking" : "Continue"}
                      {!placing && <ArrowRight className="ml-1.5 h-4 w-4" />}
                    </Button>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {/* Add Address Dialog */}
      <Dialog open={showAddAddr} onOpenChange={setShowAddAddr}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Add New Address</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add New Address</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enter your pickup address details</p>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Label (e.g. Home, Work)</Label>
              <Input value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} placeholder="Home" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Address Line</Label>
              <Input value={newAddr.line} onChange={(e) => setNewAddr({ ...newAddr, line: e.target.value })} placeholder="Flat / House no, Street" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Area</Label>
                <Input value={newAddr.area} onChange={(e) => setNewAddr({ ...newAddr, area: e.target.value })} placeholder="Indiranagar" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} placeholder="Bengaluru" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Pincode</Label>
              <Input value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="560038" className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowAddAddr(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!newAddr.label || !newAddr.line || !newAddr.area || !newAddr.city || newAddr.pincode.length < 6}
              onClick={handleAddAddress}
            >
              Save Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function BookingConfirmed({
  code,
  total,
  pickupDate,
  pickupSlot,
  deliveryDate,
  deliverySlot,
  vendorName,
  onClose,
}: {
  code: string;
  total: number;
  pickupDate: string;
  pickupSlot: string;
  deliveryDate: string;
  deliverySlot: string;
  vendorName: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 12, delay: 0.1 }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lift mb-4"
      >
        <CheckCircle2 className="h-9 w-9 text-white" />
      </motion.div>
      <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Booking Confirmed!</h2>
      <p className="text-sm text-muted-foreground mt-1">Order <span className="font-mono font-semibold text-foreground">{code}</span> has been placed successfully.</p>

      <Card className="mt-5 p-4 text-left shadow-soft">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pickup</span>
            <span className="font-medium">{pickupDate}, {pickupSlot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-medium">{deliveryDate}, {deliverySlot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vendor</span>
            <span className="font-medium">{vendorName}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold">
            <span>Total Paid</span>
            <span>{formatINRDecimal(total)}</span>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 mt-5">
        <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
        <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={onClose}>
          Track Order
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
