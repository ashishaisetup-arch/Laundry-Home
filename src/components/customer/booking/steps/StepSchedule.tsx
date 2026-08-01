import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddAddressDialog } from "@/components/shared/add-address-dialog";
import type { Slot } from "@/lib/hooks/useSlots";
import { cn } from "@/lib/utils";
import { useBookingSelection } from "../use-booking";

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

function parseSlotEndTime(slot: string): { hours: number; minutes: number } {
  const parts = slot.split(" - ");
  const end = parts[1]?.trim() || "";
  const match = end.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return { hours: 0, minutes: 0 };
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3]?.toUpperCase() === "PM" && h !== 12) h += 12;
  if (match[3]?.toUpperCase() === "AM" && h === 12) h = 0;
  return { hours: h, minutes: m };
}

function isSlotExpired(dateLabel: string, slot: string): boolean {
  if (dateLabel !== "Today") return false;
  const { hours, minutes } = parseSlotEndTime(slot);
  const now = new Date();
  const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return now >= slotEnd;
}

export function StepSchedule() {
  const {
    addrList,
    pickupAddr,
    setPickupAddr,
    deliveryAddr,
    setDeliveryAddr,
    pickupDate,
    setPickupDate,
    pickupSlot,
    setPickupSlot,
    deliveryDate,
    setDeliveryDate,
    deliverySlot,
    setDeliverySlot,
    notes,
    setNotes,
    refetchAddresses,
  } = useBookingSelection();

  const [showAddAddr, setShowAddAddr] = useState(false);
  const [addrTarget, setAddrTarget] = useState<"pickup" | "delivery">("pickup");

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
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all active:scale-[0.98]",
                  pickupAddr === a.id ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm" : "border-border/60 hover:shadow-sm"
                )}>
                  <RadioGroupItem value={a.id} />
                  <div>
                    <p className="text-sm font-semibold">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.fullAddress || `${a.flatNo ? a.flatNo + ", " : ""}${a.line}, ${a.area}, ${a.city} - ${a.pincode}`}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
          <Button variant="outline" size="sm" onClick={() => { setAddrTarget("pickup"); setShowAddAddr(true); }} className="w-full gap-1">
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
              className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-all active:scale-[0.97]",
                pickupDate === d ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent text-primary shadow-sm" : "border-border/60 hover:bg-muted/30"
              )}>{d}</button>
          ))}
        </div>
      </div>
      {pickupDate && (
        <div>
          <Label className="text-xs">Pickup Time</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {pSlots.map((s) => {
              const expired = isSlotExpired(pickupDate, s.slot);
              return (
              <button key={s.id} type="button" disabled={expired} onClick={() => setPickupSlot(s.slot)}
                className={cn("rounded-lg border py-2 px-3 text-xs font-medium transition-all text-left active:scale-[0.97]",
                  expired && "opacity-40 cursor-not-allowed line-through",
                  pickupSlot === s.slot ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent text-primary shadow-sm" : "border-border/60 hover:bg-muted/30",
                  s.premium && !expired && "border-amber-200 bg-amber-50/30"
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
      <div className="divider-ornament"><span className="divider-dot" /></div>
      <div>
        <Label className="text-xs">Delivery Date</Label>
        <div className="flex gap-2 mt-1">
          {["Tomorrow", "Day after", "3 days"].map((d) => (
            <button key={d} type="button" onClick={() => { setDeliveryDate(d); setDeliverySlot(""); }}
              className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-all active:scale-[0.97]",
                deliveryDate === d ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent text-primary shadow-sm" : "border-border/60 hover:bg-muted/30"
              )}>{d}</button>
          ))}
        </div>
      </div>
      {deliveryDate && (
        <div>
          <Label className="text-xs">Delivery Time</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {dSlots.map((s) => {
              const expired = isSlotExpired(deliveryDate, s.slot);
              return (
              <button key={s.id} type="button" disabled={expired} onClick={() => setDeliverySlot(s.slot)}
                className={cn("rounded-lg border py-2 px-3 text-xs font-medium transition-all text-left active:scale-[0.97]",
                  expired && "opacity-40 cursor-not-allowed line-through",
                  deliverySlot === s.slot ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent text-primary shadow-sm" : "border-border/60 hover:bg-muted/30"
                )}>{s.slot}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Delivery Address */}
      <div className="divider-ornament"><span className="divider-dot" /></div>
      <div>
        <Label className="text-xs">Delivery Address</Label>
        <div className="mt-1 space-y-2">
          {addrList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved addresses. Add one first.</p>
          ) : (
            <RadioGroup value={deliveryAddr} onValueChange={setDeliveryAddr}>
              {addrList.map((a) => (
                <label key={a.id} className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all active:scale-[0.98]",
                  deliveryAddr === a.id ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm" : "border-border/60 hover:shadow-sm"
                )}>
                  <RadioGroupItem value={a.id} />
                  <div>
                    <p className="text-sm font-semibold">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.fullAddress || `${a.flatNo ? a.flatNo + ", " : ""}${a.line}, ${a.area}, ${a.city} - ${a.pincode}`}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
          <Button variant="outline" size="sm" onClick={() => { setAddrTarget("delivery"); setShowAddAddr(true); }} className="w-full gap-1">
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

      {/* Add Address Dialog */}
      <AddAddressDialog
        open={showAddAddr}
        onOpenChange={setShowAddAddr}
        onSaved={(addr) => {
          refetchAddresses();
          if (addrTarget === "delivery") setDeliveryAddr(addr.id);
          else setPickupAddr(addr.id);
        }}
      />
    </div>
  );
}
