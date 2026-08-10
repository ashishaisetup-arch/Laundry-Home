// ─── Schedule windows driven by time-based add-ons ────────────────────────
// Identifies time-based add-ons by service.slug (canonical machine key, never
// display names). Enforces delivery SLA windows in the booking UI while the
// server independently validates the same rules at order time.
//
// Business rules:
//  - "Standard" = delivery at least 48 hours after pickup: delivery date must
//    be at least 2 days after the pickup date (pickup Mon -> earliest delivery
//    Wed). Delivery date options are computed relative to the pickup date.
//  - "24 Hour Delivery" = next-day equivalent delivery window: delivery on the
//    day after pickup, delivery slot must end at or before the pickup slot end
//    (e.g. pickup Mon 4-6 PM -> delivery Tue by 6 PM).
//  - "Same Day Delivery" = delivery on the pickup date, delivery slot must
//    start at or after the pickup slot end. Pickup slots that leave no later
//    delivery window are unavailable.
//  - "Express Pickup" = fulfillment mode: pickup today within 30 minutes, not
//    a normal 2-hour slot. Unavailable after the 6:30 PM cutoff.

export const SCHEDULE_ADD_ON_SLUGS = {
  SAME_DAY: "same_day_delivery",
  TWENTY_FOUR_HOUR: "24_hour_delivery",
  EXPRESS_PICKUP: "express_pickup",
} as const;

export const EXPRESS_PICKUP_SLOT = "Express Pickup (within 30 mins)";
export const EXPRESS_PICKUP_CUTOFF = { hours: 18, minutes: 30 };

export interface ScheduleKinds {
  sameDay: boolean;
  twentyFourHour: boolean;
  express: boolean;
}

export const NO_KINDS: ScheduleKinds = { sameDay: false, twentyFourHour: false, express: false };

export function hasAnyKind(kinds: ScheduleKinds): boolean {
  return kinds.sameDay || kinds.twentyFourHour || kinds.express;
}

export interface ScheduleSelection {
  pickupDate: string;
  pickupSlot: string;
  deliveryDate: string;
  deliverySlot: string;
}

export interface WindowSlot {
  id: string;
  slot: string;
  available?: boolean;
  premium?: boolean;
}

const DATE_LABELS = ["Today", "Tomorrow", "Day after", "3 days", "4 days", "5 days"];

export function labelOffset(label: string): number {
  const idx = DATE_LABELS.indexOf(label);
  return idx === -1 ? 0 : idx;
}

export function nextDayLabel(label: string): string | undefined {
  return DATE_LABELS[labelOffset(label) + 1];
}

export interface SlotTimes {
  start: { hours: number; minutes: number };
  end: { hours: number; minutes: number };
}

function toMinutes(t: { hours: number; minutes: number }): number {
  return t.hours * 60 + t.minutes;
}

export function parseSlotTimes(slot: string): SlotTimes | null {
  const parts = slot.split(" - ");
  const startStr = parts[0]?.trim() || "";
  const endStr = parts[1]?.trim() || "";
  const parse = (t: string): { hours: number; minutes: number } | null => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    if (m[3]?.toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3]?.toUpperCase() === "AM" && h === 12) h = 0;
    return { hours: h, minutes: min };
  };
  const start = parse(startStr);
  const end = parse(endStr);
  if (!start || !end) return null;
  return { start, end };
}

export function expressAvailable(now: Date): boolean {
  return now.getHours() < EXPRESS_PICKUP_CUTOFF.hours ||
    (now.getHours() === EXPRESS_PICKUP_CUTOFF.hours && now.getMinutes() < EXPRESS_PICKUP_CUTOFF.minutes);
}

export function getAddonKinds(
  addonEnabled: Record<string, boolean>,
  addonServices: { id: string; slug?: string }[]
): ScheduleKinds {
  const kinds: ScheduleKinds = { ...NO_KINDS };
  for (const svc of addonServices) {
    if (!addonEnabled[svc.id] || !svc.slug) continue;
    if (svc.slug === SCHEDULE_ADD_ON_SLUGS.SAME_DAY) kinds.sameDay = true;
    if (svc.slug === SCHEDULE_ADD_ON_SLUGS.TWENTY_FOUR_HOUR) kinds.twentyFourHour = true;
    if (svc.slug === SCHEDULE_ADD_ON_SLUGS.EXPRESS_PICKUP) kinds.express = true;
  }
  return kinds;
}

// Standard windows (mirror of the pickup_slots / delivery_slots DB seeds)
export const PICKUP_SLOTS: WindowSlot[] = [
  { id: "p1", slot: "7:00 AM - 9:00 AM", available: true, premium: false },
  { id: "p2", slot: "9:00 AM - 11:00 AM", available: true, premium: false },
  { id: "p3", slot: "11:00 AM - 1:00 PM", available: true, premium: false },
  { id: "p4", slot: "1:00 PM - 3:00 PM", available: true, premium: true },
  { id: "p5", slot: "3:00 PM - 5:00 PM", available: true, premium: false },
  { id: "p6", slot: "5:00 PM - 7:00 PM", available: true, premium: false },
];

export const DELIVERY_SLOTS: WindowSlot[] = [
  { id: "d1", slot: "7:00 AM - 9:00 AM", available: true },
  { id: "d2", slot: "9:00 AM - 11:00 AM", available: true },
  { id: "d3", slot: "11:00 AM - 1:00 PM", available: true },
  { id: "d4", slot: "1:00 PM - 3:00 PM", available: true },
  { id: "d5", slot: "3:00 PM - 5:00 PM", available: true },
  { id: "d6", slot: "5:00 PM - 7:00 PM", available: true },
];

export function getPickupDateOptions(kinds: ScheduleKinds): string[] {
  if (kinds.express) return ["Today"];
  return ["Today", "Tomorrow", "Day after"];
}

export function getPickupSlotOptions(kinds: ScheduleKinds, pickupSlots: WindowSlot[]): WindowSlot[] {
  if (kinds.express) return [{ id: "express", slot: EXPRESS_PICKUP_SLOT, available: true, premium: true }];
  if (kinds.sameDay) {
    return pickupSlots.filter((s) => {
      const t = parseSlotTimes(s.slot);
      if (!t) return true;
      return DELIVERY_SLOTS.some((d) => {
        const dt = parseSlotTimes(d.slot);
        return !!dt && toMinutes(dt.start) >= toMinutes(t.end);
      });
    });
  }
  return pickupSlots;
}

export function getDeliveryDateOptions(pickupDate: string, kinds: ScheduleKinds): string[] {
  if (kinds.sameDay) return [pickupDate];
  if (kinds.twentyFourHour) {
    const next = nextDayLabel(pickupDate);
    return next ? [next] : [];
  }
  // Standard = 48-hour turnaround: delivery at least 2 days after pickup.
  const pickupOffset = labelOffset(pickupDate);
  if (!pickupOffset && pickupDate !== "Today") return [];
  const MIN_DELIVERY_OFFSET = pickupOffset + 2;
  return DATE_LABELS.filter((label) => labelOffset(label) >= MIN_DELIVERY_OFFSET);
}

export function getDeliverySlotOptions(
  kinds: ScheduleKinds,
  pickupDate: string,
  pickupSlot: string,
  deliveryDate: string,
  deliverySlots: WindowSlot[]
): WindowSlot[] {
  if (!kinds.sameDay && !kinds.twentyFourHour) return deliverySlots;
  if (!pickupSlot || pickupSlot === EXPRESS_PICKUP_SLOT) return deliverySlots;
  const pickupTimes = parseSlotTimes(pickupSlot);
  if (!pickupTimes) return deliverySlots;
  return deliverySlots.filter((s) => {
    const t = parseSlotTimes(s.slot);
    if (!t) return true;
    if (kinds.sameDay) return toMinutes(t.start) >= toMinutes(pickupTimes.end);
    return toMinutes(t.end) <= toMinutes(pickupTimes.end);
  });
}

// Conservative reconciliation: adjusts the schedule only when a constraint is
// violated. Never invents a delivery date/slot before the pickup is chosen.
export function reconcileSchedule(selection: ScheduleSelection, kinds: ScheduleKinds): ScheduleSelection {
  let next: ScheduleSelection = { ...selection };

  if (kinds.express) {
    next = { ...next, pickupDate: "Today", pickupSlot: EXPRESS_PICKUP_SLOT };
  }

  const pickupOptions = getPickupSlotOptions(kinds, PICKUP_SLOTS);
  if (kinds.sameDay && next.pickupSlot && !pickupOptions.some((o) => o.slot === next.pickupSlot)) {
    next = { ...next, pickupSlot: pickupOptions[0]?.slot || "" };
  }

  if (kinds.sameDay && next.pickupSlot) {
    const options = getDeliverySlotOptions(kinds, next.pickupDate, next.pickupSlot, next.pickupDate, DELIVERY_SLOTS);
    const deliverySlot = options.some((o) => o.slot === next.deliverySlot) ? next.deliverySlot : options[0]?.slot || "";
    next = { ...next, deliveryDate: next.pickupDate, deliverySlot };
  } else if (kinds.twentyFourHour && next.pickupSlot) {
    const date = nextDayLabel(next.pickupDate) || next.deliveryDate;
    const options = getDeliverySlotOptions(kinds, next.pickupDate, next.pickupSlot, date, DELIVERY_SLOTS);
    let deliverySlot = options.some((o) => o.slot === next.deliverySlot) ? next.deliverySlot : "";
    if (!deliverySlot) {
      deliverySlot = options.some((o) => o.slot === next.pickupSlot) ? next.pickupSlot : options[0]?.slot || "";
    }
    next = { ...next, deliveryDate: date, deliverySlot };
  } else if (!kinds.sameDay && !kinds.twentyFourHour) {
    // Standard = 48-hour turnaround: enforce delivery at least 2 days after
    // the pickup date once one is chosen. Delivery slots are unconstrained.
    const validDates = getDeliveryDateOptions(next.pickupDate, kinds);
    if (validDates.length > 0 && !validDates.includes(next.deliveryDate)) {
      next = { ...next, deliveryDate: validDates[0] };
    }
  }

  return next;
}

// Delivery-speed add-ons (Same Day / 24 Hour) are mutually exclusive; passing
// null as the choice selects "Standard" (clears all delivery-speed add-ons).
export function selectDeliverySpeed(
  prev: Record<string, boolean>,
  choice: { id: string; slug: string } | null,
  speedServices: { id: string; slug: string }[]
): Record<string, boolean> {
  const next = { ...prev };
  for (const s of speedServices) {
    next[s.id] = !!choice && s.id === choice.id;
  }
  return next;
}
