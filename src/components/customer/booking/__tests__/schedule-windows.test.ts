import { describe, it, expect } from "vitest";
import {
  SCHEDULE_ADD_ON_SLUGS,
  EXPRESS_PICKUP_SLOT,
  PICKUP_SLOTS,
  DELIVERY_SLOTS,
  getAddonKinds,
  getPickupDateOptions,
  getPickupSlotOptions,
  getDeliveryDateOptions,
  getDeliverySlotOptions,
  reconcileSchedule,
  selectDeliverySpeed,
  expressAvailable,
  hasAnyKind,
} from "../schedule-windows";

const addonServices = [
  { id: "a1", slug: SCHEDULE_ADD_ON_SLUGS.SAME_DAY },
  { id: "a2", slug: SCHEDULE_ADD_ON_SLUGS.TWENTY_FOUR_HOUR },
  { id: "a3", slug: SCHEDULE_ADD_ON_SLUGS.EXPRESS_PICKUP },
  { id: "a4" },
];

describe("getAddonKinds", () => {
  it("detects enabled time add-ons by slug only", () => {
    expect(getAddonKinds({}, addonServices)).toEqual({ sameDay: false, twentyFourHour: false, express: false });
    expect(getAddonKinds({ a1: true }, addonServices)).toEqual({ sameDay: true, twentyFourHour: false, express: false });
    expect(getAddonKinds({ a2: true }, addonServices)).toEqual({ sameDay: false, twentyFourHour: true, express: false });
    expect(getAddonKinds({ a3: true }, addonServices)).toEqual({ sameDay: false, twentyFourHour: false, express: true });
    expect(getAddonKinds({ a4: true }, addonServices)).toEqual({ sameDay: false, twentyFourHour: false, express: false });
  });

  it("ignores disabled add-ons", () => {
    expect(getAddonKinds({ a1: false }, addonServices)).toEqual({ sameDay: false, twentyFourHour: false, express: false });
  });
});

describe("pickup options", () => {
  it("express pickup limits the pickup date to today", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: true };
    expect(getPickupDateOptions(kinds)).toEqual(["Today"]);
    expect(getPickupSlotOptions(kinds, PICKUP_SLOTS)).toEqual([
      { id: "express", slot: EXPRESS_PICKUP_SLOT, available: true, premium: true },
    ]);
  });

  it("same-day delivery disables pickup slots that leave no later delivery window", () => {
    const kinds = { sameDay: true, twentyFourHour: false, express: false };
    const options = getPickupSlotOptions(kinds, PICKUP_SLOTS);
    expect(options.map((o) => o.slot)).not.toContain("5:00 PM - 7:00 PM");
    expect(options.map((o) => o.slot)).toContain("1:00 PM - 3:00 PM");
  });

  it("default options are unchanged without constraints", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: false };
    expect(getPickupDateOptions(kinds)).toEqual(["Today", "Tomorrow", "Day after"]);
    expect(getPickupSlotOptions(kinds, PICKUP_SLOTS)).toEqual(PICKUP_SLOTS);
  });
});

describe("delivery options", () => {
  const kindsSameDay = { sameDay: true, twentyFourHour: false, express: false };
  const kinds24h = { sameDay: false, twentyFourHour: true, express: false };

  it("same-day delivery offers only the pickup date", () => {
    expect(getDeliveryDateOptions("Today", kindsSameDay)).toEqual(["Today"]);
    expect(getDeliveryDateOptions("Tomorrow", kindsSameDay)).toEqual(["Tomorrow"]);
  });

  it("24-hour delivery offers only the day after pickup", () => {
    expect(getDeliveryDateOptions("Today", kinds24h)).toEqual(["Tomorrow"]);
    expect(getDeliveryDateOptions("Tomorrow", kinds24h)).toEqual(["Day after"]);
    expect(getDeliveryDateOptions("Day after", kinds24h)).toEqual(["3 days"]);
  });

  it("same-day delivery only allows slots starting after the pickup window ends", () => {
    const options = getDeliverySlotOptions(kindsSameDay, "Today", "9:00 AM - 11:00 AM", "Today", DELIVERY_SLOTS);
    expect(options.map((o) => o.slot)).toEqual([
      "11:00 AM - 1:00 PM",
      "1:00 PM - 3:00 PM",
      "3:00 PM - 5:00 PM",
      "5:00 PM - 7:00 PM",
    ]);
  });

  it("24-hour delivery only allows slots ending within the pickup window end", () => {
    const options = getDeliverySlotOptions(kinds24h, "Today", "9:00 AM - 11:00 AM", "Tomorrow", DELIVERY_SLOTS);
    expect(options.map((o) => o.slot)).toEqual(["7:00 AM - 9:00 AM", "9:00 AM - 11:00 AM"]);
  });

  it("express pickup leaves delivery unconstrained", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: true };
    expect(getDeliverySlotOptions(kinds, "Today", EXPRESS_PICKUP_SLOT, "Tomorrow", DELIVERY_SLOTS)).toEqual(DELIVERY_SLOTS);
  });

  it("standard delivery is at least 48 hours after pickup", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: false };
    expect(getDeliveryDateOptions("Today", kinds)).toEqual(["Day after", "3 days", "4 days", "5 days"]);
    expect(getDeliveryDateOptions("Tomorrow", kinds)).toEqual(["3 days", "4 days", "5 days"]);
    expect(getDeliveryDateOptions("Day after", kinds)).toEqual(["4 days", "5 days"]);
    expect(getDeliveryDateOptions("", kinds)).toEqual([]);
  });

  it("standard delivery slots are unconstrained", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: false };
    expect(getDeliverySlotOptions(kinds, "Today", "", "Day after", DELIVERY_SLOTS)).toEqual(DELIVERY_SLOTS);
  });
});

describe("reconcileSchedule", () => {
  const base = { pickupDate: "Today", pickupSlot: "", deliveryDate: "Tomorrow", deliverySlot: "" };

  it("standard pushes an early delivery date to the 48-hour minimum", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: false };
    expect(reconcileSchedule(base, kinds)).toEqual({
      ...base,
      deliveryDate: "Day after",
    });
  });

  it("standard keeps a compliant delivery date", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: false };
    const picked = { ...base, deliveryDate: "3 days" };
    expect(reconcileSchedule(picked, kinds)).toEqual(picked);
  });

  it("standard does not invent a delivery date without a pickup date", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: false };
    const picked = { ...base, pickupDate: "", deliveryDate: "" };
    expect(reconcileSchedule(picked, kinds)).toEqual(picked);
  });

  it("express pickup forces today + the express slot and keeps standard delivery", () => {
    const kinds = { sameDay: false, twentyFourHour: false, express: true };
    expect(reconcileSchedule(base, kinds)).toEqual({
      ...base,
      pickupDate: "Today",
      pickupSlot: EXPRESS_PICKUP_SLOT,
      deliveryDate: "Day after",
    });
  });

  it("does not invent a delivery window before pickup is chosen", () => {
    const sameDay = { sameDay: true, twentyFourHour: false, express: false };
    const twentyFour = { sameDay: false, twentyFourHour: true, express: false };
    expect(reconcileSchedule(base, sameDay)).toEqual(base);
    expect(reconcileSchedule(base, twentyFour)).toEqual(base);
  });

  it("same-day auto-picks the earliest compliant delivery slot once pickup is chosen", () => {
    const kinds = { sameDay: true, twentyFourHour: false, express: false };
    const picked = { ...base, pickupSlot: "9:00 AM - 11:00 AM" };
    expect(reconcileSchedule(picked, kinds)).toEqual({
      ...picked,
      deliveryDate: "Today",
      deliverySlot: "11:00 AM - 1:00 PM",
    });
  });

  it("same-day moves an invalid last pickup slot to the earliest valid one", () => {
    const kinds = { sameDay: true, twentyFourHour: false, express: false };
    const picked = { ...base, pickupSlot: "5:00 PM - 7:00 PM" };
    const result = reconcileSchedule(picked, kinds);
    expect(result.pickupSlot).toBe("7:00 AM - 9:00 AM");
    expect(result.deliveryDate).toBe("Today");
    expect(result.deliverySlot).toBe("9:00 AM - 11:00 AM");
  });

  it("24-hour mirrors the pickup window on the next day", () => {
    const kinds = { sameDay: false, twentyFourHour: true, express: false };
    const picked = { ...base, pickupSlot: "9:00 AM - 11:00 AM" };
    expect(reconcileSchedule(picked, kinds)).toEqual({
      ...picked,
      deliveryDate: "Tomorrow",
      deliverySlot: "9:00 AM - 11:00 AM",
    });
  });

  it("24-hour with a late pickup keeps the earliest compliant window", () => {
    const kinds = { sameDay: false, twentyFourHour: true, express: false };
    const picked = { ...base, pickupSlot: "5:00 PM - 7:00 PM" };
    const result = reconcileSchedule(picked, kinds);
    expect(result.deliveryDate).toBe("Tomorrow");
    expect(result.deliverySlot).toBe("5:00 PM - 7:00 PM");
  });

  it("keeps an already compliant manual delivery choice", () => {
    const kinds = { sameDay: false, twentyFourHour: true, express: false };
    const picked = { ...base, pickupSlot: "9:00 AM - 11:00 AM", deliverySlot: "7:00 AM - 9:00 AM" };
    expect(reconcileSchedule(picked, kinds)).toEqual(picked);
  });
});

describe("selectDeliverySpeed", () => {
  const choices = [
    { id: "a1", slug: SCHEDULE_ADD_ON_SLUGS.SAME_DAY },
    { id: "a2", slug: SCHEDULE_ADD_ON_SLUGS.TWENTY_FOUR_HOUR },
  ];

  it("is mutually exclusive between delivery-speed add-ons", () => {
    expect(selectDeliverySpeed({ a2: true }, { id: "a1", slug: SCHEDULE_ADD_ON_SLUGS.SAME_DAY }, choices)).toEqual({
      a1: true,
      a2: false,
    });
  });

  it("standard clears all delivery-speed add-ons", () => {
    expect(selectDeliverySpeed({ a1: true, a2: true }, null, choices)).toEqual({ a1: false, a2: false });
  });

  it("leaves unrelated add-ons untouched", () => {
    expect(selectDeliverySpeed({ a3: true }, { id: "a1", slug: SCHEDULE_ADD_ON_SLUGS.SAME_DAY }, choices)).toEqual({
      a1: true,
      a2: false,
      a3: true,
    });
  });
});

describe("expressAvailable", () => {
  it("is available before the 6:30 PM cutoff", () => {
    expect(expressAvailable(new Date(2026, 0, 10, 18, 29))).toBe(true);
  });

  it("is unavailable at and after the 6:30 PM cutoff", () => {
    expect(expressAvailable(new Date(2026, 0, 10, 18, 30))).toBe(false);
    expect(expressAvailable(new Date(2026, 0, 10, 21, 0))).toBe(false);
  });
});

describe("hasAnyKind", () => {
  it("returns true when any time add-on is active", () => {
    expect(hasAnyKind({ sameDay: false, twentyFourHour: false, express: false })).toBe(false);
    expect(hasAnyKind({ sameDay: true, twentyFourHour: false, express: false })).toBe(true);
  });
});
