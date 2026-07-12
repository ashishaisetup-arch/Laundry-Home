"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Sparkles,
  Star,
  Store,
  Truck,
  Zap,
  Camera,
  Plus,
  Minus,
  Wallet,
  Tag,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ServiceIcon, getServiceMeta } from "@/components/shared/service-icon";
import { SERVICES, VENDORS, ADDRESSES, PICKUP_SLOTS, DELIVERY_SLOTS } from "@/lib/mock-data";
import type { ServiceKey } from "@/lib/types";
import { cn, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

interface BookingFlowProps {
  open: boolean;
  onClose: () => void;
}

type Step = "services" | "schedule" | "vendor" | "review" | "confirmed";

export function BookingFlow({ open, onClose }: BookingFlowProps) {
  const [step, setStep] = useState<Step>("services");
  const [selectedServices, setSelectedServices] = useState<Record<ServiceKey, { qty: number; express: boolean }>>({} as never);
  const [pickupAddr, setPickupAddr] = useState("a1");
  const [pickupDate, setPickupDate] = useState("Today");
  const [pickupSlot, setPickupSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("Tomorrow");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [vendorMode, setVendorMode] = useState<"auto" | "manual">("auto");
  const [selectedVendor, setSelectedVendor] = useState("v1");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const steps: { id: Step; label: string; icon: typeof Package }[] = [
    { id: "services", label: "Services", icon: Package },
    { id: "schedule", label: "Schedule", icon: Calendar },
    { id: "vendor", label: "Vendor", icon: Store },
    { id: "review", label: "Review", icon: Check },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  const reset = () => {
    setStep("services");
    setSelectedServices({} as never);
    setPickupSlot("");
    setDeliverySlot("");
    setNotes("");
    setCouponCode("");
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const selectedServiceList = Object.entries(selectedServices).filter(([, v]) => v.qty > 0) as [ServiceKey, { qty: number; express: boolean }][];

  // Calculate pricing
  let subtotal = 0;
  selectedServiceList.forEach(([key, v]) => {
    const meta = getServiceMeta(key);
    let price = meta.basePrice * v.qty;
    if (v.express) price *= meta.expressMultiplier;
    subtotal += price;
  });
  const taxes = subtotal * 0.18;
  const platformFee = 25;
  const deliveryFee = 40;
  const expressSurcharge = selectedServiceList.some(([, v]) => v.express) ? 50 : 0;
  let discount = 0;
  if (couponCode === "FRESH50") discount = Math.min(150, subtotal * 0.5);
  else if (couponCode === "WEEKEND25") discount = Math.min(100, subtotal * 0.25);
  const total = subtotal + taxes + platformFee + deliveryFee + expressSurcharge - discount;

  const canProceed = () => {
    if (step === "services") return selectedServiceList.length > 0;
    if (step === "schedule") return !!pickupSlot && !!deliverySlot;
    if (step === "vendor") return vendorMode === "auto" || !!selectedVendor;
    return true;
  };

  const handleNext = () => {
    if (step === "services") setStep("schedule");
    else if (step === "schedule") setStep("vendor");
    else if (step === "vendor") setStep("review");
    else if (step === "review") {
      setStep("confirmed");
      toast.success("Booking confirmed!", {
        description: `Order LH-2853 placed. Pickup scheduled for ${pickupDate}, ${pickupSlot}.`,
      });
    }
  };

  const handleBack = () => {
    if (step === "schedule") setStep("services");
    else if (step === "vendor") setStep("schedule");
    else if (step === "review") setStep("vendor");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Book a pickup</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "confirmed" ? (
            <BookingConfirmed
              key="confirmed"
              total={total}
              pickupDate={pickupDate}
              pickupSlot={pickupSlot}
              deliveryDate={deliveryDate}
              deliverySlot={deliverySlot}
              vendorName={vendorMode === "auto" ? "AI-assigned (FreshFold Laundry Co.)" : VENDORS.find((v) => v.id === selectedVendor)?.name || ""}
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
                        i === stepIndex ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {s.label}
                      </span>
                      {i < steps.length - 1 && (
                        <div className={cn("flex-1 h-0.5 mx-2 rounded", i < stepIndex ? "bg-primary" : "bg-muted")} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-4 min-h-[400px]">
                {/* === STEP 1: SERVICES === */}
                {step === "services" && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold">Select laundry services</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Choose services and quantities. Toggle Express for faster delivery.</p>
                    </div>
                    <div className="space-y-3">
                      {SERVICES.map((s) => {
                        const selected = selectedServices[s.key]?.qty || 0;
                        const express = selectedServices[s.key]?.express || false;
                        return (
                          <Card key={s.key} className={cn("p-4 transition-all", selected > 0 && "ring-1 ring-primary")}>
                            <div className="flex items-center gap-3">
                              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shrink-0", s.gradient)}>
                                <ServiceIcon serviceKey={s.key} className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{s.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>
                                <p className="text-xs font-medium text-primary mt-0.5">
                                  ₹{s.basePrice}{s.pricingType === "per_kg" ? "/kg" : "/piece"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={selected === 0}
                                  onClick={() => {
                                    setSelectedServices((prev) => {
                                      const next = { ...prev };
                                      const cur = next[s.key]?.qty || 0;
                                      if (cur <= 1) delete next[s.key];
                                      else next[s.key] = { ...next[s.key], qty: cur - 1 };
                                      return next;
                                    });
                                  }}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span className="w-8 text-center text-sm font-semibold">{selected}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelectedServices((prev) => ({
                                      ...prev,
                                      [s.key]: { qty: (prev[s.key]?.qty || 0) + 1, express: prev[s.key]?.express || false },
                                    }));
                                  }}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {selected > 0 && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-border/60">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={express}
                                    onCheckedChange={(v) => {
                                      setSelectedServices((prev) => ({
                                        ...prev,
                                        [s.key]: { ...prev[s.key], express: !!v },
                                      }));
                                    }}
                                  />
                                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                                  Express delivery ({s.expressMultiplier}× price)
                                </label>
                              </motion.div>
                            )}
                          </Card>
                        );
                      })}
                    </div>

                    {/* Notes & photos */}
                    <div className="rounded-lg border border-dashed border-border p-4">
                      <Label className="text-xs font-semibold">Special instructions (optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Use mild detergent for baby clothes. Stain on collar of white shirt."
                        className="mt-1.5 resize-none"
                        rows={2}
                      />
                      <button className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border">
                          <Camera className="h-4 w-4" />
                        </div>
                        Add garment photos (optional)
                      </button>
                    </div>
                  </>
                )}

                {/* === STEP 2: SCHEDULE === */}
                {step === "schedule" && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold">Schedule pickup & delivery</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Pick a time that works for you.</p>
                    </div>

                    {/* Pickup address */}
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">Pickup Address</Label>
                      <RadioGroup value={pickupAddr} onValueChange={setPickupAddr}>
                        <div className="space-y-2">
                          {ADDRESSES.map((a) => (
                            <label key={a.id} htmlFor={a.id} className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                              pickupAddr === a.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                            )}>
                              <RadioGroupItem value={a.id} id={a.id} className="mt-1" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                  <p className="text-sm font-semibold">{a.label}</p>
                                  {a.isDefault && <Badge variant="secondary" className="text-[10px] py-0 h-4">Default</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{a.line}</p>
                                <p className="text-xs text-muted-foreground">{a.area}, {a.city} - {a.pincode}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Pickup slot */}
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">Pickup Date & Slot</Label>
                      <div className="flex gap-2 mb-2">
                        {["Today", "Tomorrow", "Mon, 14 Jul"].map((d) => (
                          <button
                            key={d}
                            onClick={() => setPickupDate(d)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                              pickupDate === d ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PICKUP_SLOTS.map((s) => (
                          <button
                            key={s.id}
                            disabled={!s.available}
                            onClick={() => setPickupSlot(s.label)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                              !s.available && "opacity-40 cursor-not-allowed line-through",
                              pickupSlot === s.label ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/30"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Delivery slot */}
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">Delivery Date & Slot</Label>
                      <div className="flex gap-2 mb-2">
                        {["Tomorrow", "Wed, 15 Jul", "Thu, 16 Jul"].map((d) => (
                          <button
                            key={d}
                            onClick={() => setDeliveryDate(d)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                              deliveryDate === d ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {DELIVERY_SLOTS.map((s) => (
                          <button
                            key={s.id}
                            disabled={!s.available}
                            onClick={() => setDeliverySlot(s.label)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                              !s.available && "opacity-40 cursor-not-allowed line-through",
                              deliverySlot === s.label ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/30"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* === STEP 3: VENDOR === */}
                {step === "vendor" && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold">Choose vendor</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Let AI pick the best vendor, or choose manually.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => setVendorMode("auto")}
                        className={cn(
                          "text-left rounded-xl border p-4 transition-all",
                          vendorMode === "auto" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Automatic Assignment</p>
                            <p className="text-[11px] text-muted-foreground">AI-optimized</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Our AI picks the best vendor based on distance, capacity, ratings, and current workload.
                        </p>
                        {vendorMode === "auto" && (
                          <div className="mt-3 rounded-lg bg-teal-50 dark:bg-teal-950/30 p-2.5">
                            <p className="text-[11px] font-semibold text-primary">✨ Recommended: FreshFold Laundry Co.</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">94% match · 1.2km · 24h delivery · 62% capacity</p>
                          </div>
                        )}
                      </button>

                      <button
                        onClick={() => setVendorMode("manual")}
                        className={cn(
                          "text-left rounded-xl border p-4 transition-all",
                          vendorMode === "manual" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                            <Store className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Manual Selection</p>
                            <p className="text-[11px] text-muted-foreground">You choose</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Browse and pick from verified vendors near you.
                        </p>
                      </button>
                    </div>

                    {vendorMode === "manual" && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                        {VENDORS.filter((v) => v.isOpen).map((v) => (
                          <label
                            key={v.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                              selectedVendor === v.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                            )}
                          >
                            <RadioGroupItem
                              value={v.id}
                              checked={selectedVendor === v.id}
                              onClick={() => setSelectedVendor(v.id)}
                              onChange={() => setSelectedVendor(v.id)}
                            />
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white text-xs font-bold",
                              v.logoColor
                            )}>
                              {v.logoInitials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{v.name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  {v.rating}
                                </span>
                                <span>·</span>
                                <span>{v.distanceKm} km</span>
                                <span>·</span>
                                <span>{v.estimatedDeliveryHrs}h delivery</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </motion.div>
                    )}
                  </>
                )}

                {/* === STEP 4: REVIEW === */}
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
                            const meta = getServiceMeta(key);
                            const linePrice = meta.basePrice * v.qty * (v.express ? meta.expressMultiplier : 1);
                            return (
                              <div key={key} className="flex items-start gap-2 text-sm">
                                <ServiceIcon serviceKey={key} className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="font-medium">{meta.name} <span className="text-muted-foreground">× {v.qty}</span></p>
                                  {v.express && <Badge variant="outline" className="text-[9px] py-0 h-4 mt-0.5 border-amber-400 text-amber-600 bg-amber-50">Express</Badge>}
                                </div>
                                <p className="font-semibold">{formatINRDecimal(linePrice)}</p>
                              </div>
                            );
                          })}
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINRDecimal(subtotal)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Taxes (18% GST)</span><span>{formatINRDecimal(taxes)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span>{formatINRDecimal(platformFee)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>{formatINRDecimal(deliveryFee)}</span></div>
                          {expressSurcharge > 0 && (
                            <div className="flex justify-between"><span className="text-muted-foreground">Express surcharge</span><span>{formatINRDecimal(expressSurcharge)}</span></div>
                          )}
                          {discount > 0 && (
                            <div className="flex justify-between text-emerald-600"><span>Discount ({couponCode})</span><span>−{formatINRDecimal(discount)}</span></div>
                          )}
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold text-base">
                            <span>Total</span>
                            <span>{formatINRDecimal(total)}</span>
                          </div>
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
                                <p className="text-xs text-muted-foreground">{ADDRESSES.find(a => a.id === pickupAddr)?.line}</p>
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
                          <p className="text-sm font-medium">
                            {vendorMode === "auto" ? "AI-assigned (FreshFold Laundry Co.)" : VENDORS.find(v => v.id === selectedVendor)?.name}
                          </p>
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
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="Enter code"
                              className="text-sm font-mono"
                            />
                            <Button variant="outline" size="sm">Apply</Button>
                          </div>
                          {couponCode && discount > 0 && (
                            <p className="text-xs text-emerald-600 mt-2">✓ {formatINRDecimal(discount)} discount applied!</p>
                          )}
                        </Card>

                        <Card className="p-4 shadow-soft">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment Method</p>
                          <RadioGroup defaultValue="upi">
                            <div className="space-y-1.5">
                              {[
                                { id: "upi", label: "UPI", icon: "📱" },
                                { id: "card", label: "Credit/Debit Card", icon: "💳" },
                                { id: "wallet", label: "Wallet (₹1,250)", icon: "👛" },
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
              {step !== "confirmed" && (
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
                      disabled={!canProceed()}
                      onClick={handleNext}
                    >
                      {step === "review" ? "Confirm Booking" : "Continue"}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Booking Confirmed
// ============================================================================
function BookingConfirmed({
  total,
  pickupDate,
  pickupSlot,
  deliveryDate,
  deliverySlot,
  vendorName,
  onClose,
}: {
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
      <p className="text-sm text-muted-foreground mt-1">Order <span className="font-mono font-semibold text-foreground">LH-2853</span> has been placed successfully.</p>

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
