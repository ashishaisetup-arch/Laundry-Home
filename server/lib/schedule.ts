// ─── Authoritative schedule validation for orders ─────────────────────────
// The server independently validates the pickup/delivery schedule against the
// selected time-based add-ons before an order is created or rescheduled, so
// stale or tampered client state can never commit an invalid SLA window.
//
// Business rules (mirrored in src/components/customer/booking/schedule-windows.ts):
//  - "Standard" (standard) = 48-hour turnaround: delivery date must be at
//    least 2 days after the pickup date.
//  - "24 Hour Delivery" (24_hour) = next-day equivalent window: delivery date
//    is exactly pickup date + 1 day and the delivery slot must end at or
//    before the pickup slot end (pickup Mon 4-6 PM -> delivery Tue by 6 PM).
//  - "Same Day Delivery" (same_day) = delivery on the pickup date with a slot
//    starting at or after the pickup slot end.
//  - "Express Pickup" (pickup_mode = express) = fulfillment mode, pickup today
//    within 30 minutes; unavailable after the 6:30 PM cutoff.

export const SCHEDULE_ADD_ON_SLUGS = {
  SAME_DAY: "same_day_delivery",
  TWENTY_FOUR_HOUR: "24_hour_delivery",
  EXPRESS_PICKUP: "express_pickup",
} as const;

export const EXPRESS_PICKUP_SLOT = "Express Pickup (within 30 mins)";
export const EXPRESS_PICKUP_CUTOFF = { hours: 18, minutes: 30 };

// Canonical slot sets (mirror of the pickup_slots / delivery_slots DB seeds)
export const PICKUP_SLOTS = [
  "7:00 AM - 9:00 AM",
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM",
];

export const DELIVERY_SLOTS = [...PICKUP_SLOTS];

export interface SlotTimes {
  start: { hours: number; minutes: number };
  end: { hours: number; minutes: number };
}

function toMinutes(t: { hours: number; minutes: number }): number {
  return t.hours * 60 + t.minutes;
}

export function parseSlot(slot: string): SlotTimes | null {
  const parts = slot.split(" - ");
  const parse = (t: string): { hours: number; minutes: number } | null => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    if (m[3]?.toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3]?.toUpperCase() === "AM" && h === 12) h = 0;
    return { hours: h, minutes: min };
  };
  const start = parse(parts[0]?.trim() || "");
  const end = parse(parts[1]?.trim() || "");
  if (!start || !end) return null;
  return { start, end };
}

function toMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

// a - b in whole days (a, b are YYYY-MM-DD)
export function dateDiffDays(a: string, b: string): number {
  return Math.round((toMs(a) - toMs(b)) / 86400000);
}

export function todayISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function expressAvailable(now: Date): boolean {
  return now.getHours() < EXPRESS_PICKUP_CUTOFF.hours ||
    (now.getHours() === EXPRESS_PICKUP_CUTOFF.hours && now.getMinutes() < EXPRESS_PICKUP_CUTOFF.minutes);
}

export interface ValidateScheduleInput {
  pickupDate: string | null;
  pickupSlot: string;
  deliveryDate: string | null;
  deliverySlot: string;
  pickupMode?: string | null;
  deliverySpeed?: string | null;
  now?: Date;
}

export type ScheduleValidation =
  | { ok: true }
  | { ok: false; error: "SCHEDULE_SLOT_UNAVAILABLE"; message: string };

export function validateSchedule(input: ValidateScheduleInput): ScheduleValidation {
  const now = input.now ?? new Date();
  const pickupDate = input.pickupDate;
  const deliveryDate = input.deliveryDate;
  const pickupMode = input.pickupMode || "scheduled";
  const deliverySpeed = input.deliverySpeed || "standard";

  if (!pickupDate || !deliveryDate) {
    return fail("Pickup and delivery dates are required.");
  }

  if (pickupMode === "express") {
    if (pickupDate !== todayISO(now)) {
      return fail("Express pickup is only available for today.");
    }
    if (!expressAvailable(now)) {
      return fail("Express pickup is no longer available today (cutoff is 6:30 PM).");
    }
    if (input.pickupSlot && input.pickupSlot !== EXPRESS_PICKUP_SLOT && !PICKUP_SLOTS.includes(input.pickupSlot)) {
      return fail("The selected pickup slot is not available.");
    }
  } else if (!PICKUP_SLOTS.includes(input.pickupSlot)) {
    return fail("The selected pickup slot is not available.");
  }

  if (!DELIVERY_SLOTS.includes(input.deliverySlot)) {
    return fail("The selected delivery slot is not available.");
  }

  if (dateDiffDays(deliveryDate, pickupDate) < 0) {
    return fail("Delivery cannot be scheduled before pickup.");
  }
  if (deliverySpeed === "standard" && dateDiffDays(deliveryDate, pickupDate) < 2) {
    return fail("Standard delivery requires delivery at least 48 hours after pickup.");
  }

  if (deliverySpeed === "same_day") {    if (dateDiffDays(deliveryDate, pickupDate) !== 0) {
      return fail("Same-day delivery requires delivery on the pickup date.");
    }
    const p = parseSlot(input.pickupSlot);
    const d = parseSlot(input.deliverySlot);
    if (p && d && toMinutes(d.start) < toMinutes(p.end)) {
      return fail("The same-day delivery slot must start after the pickup window ends.");
    }
  } else if (deliverySpeed === "24_hour") {
    if (dateDiffDays(deliveryDate, pickupDate) !== 1) {
      return fail("24-hour delivery requires delivery the day after pickup.");
    }
    const p = parseSlot(input.pickupSlot);
    const d = parseSlot(input.deliverySlot);
    if (p && d && toMinutes(d.end) > toMinutes(p.end)) {
      return fail("The 24-hour delivery window must end within 24 hours of the pickup window.");
    }
  }

  return { ok: true };
}

function fail(message: string): ScheduleValidation {
  return { ok: false, error: "SCHEDULE_SLOT_UNAVAILABLE", message };
}
