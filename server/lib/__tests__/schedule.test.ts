import { describe, it, expect } from "vitest";
import {
  validateSchedule,
  parseSlot,
  dateDiffDays,
  todayISO,
  expressAvailable,
  EXPRESS_PICKUP_SLOT,
} from "../schedule";

const base = {
  pickupDate: "2026-08-10",
  pickupSlot: "9:00 AM - 11:00 AM",
  deliveryDate: "2026-08-12",
  deliverySlot: "9:00 AM - 11:00 AM",
  pickupMode: "scheduled",
  deliverySpeed: "standard",
};

const now = new Date(2026, 7, 10, 10, 0);

describe("parseSlot", () => {
  it("parses start and end times", () => {
    expect(parseSlot("7:00 AM - 9:00 AM")).toEqual({
      start: { hours: 7, minutes: 0 },
      end: { hours: 9, minutes: 0 },
    });
    expect(parseSlot("1:00 PM - 3:00 PM")).toEqual({
      start: { hours: 13, minutes: 0 },
      end: { hours: 15, minutes: 0 },
    });
    expect(parseSlot("Express Pickup (within 30 mins)")).toBeNull();
  });
});

describe("date helpers", () => {
  it("computes whole-day differences on YYYY-MM-DD", () => {
    expect(dateDiffDays("2026-08-11", "2026-08-10")).toBe(1);
    expect(dateDiffDays("2026-08-10", "2026-08-11")).toBe(-1);
    expect(dateDiffDays("2026-08-10", "2026-08-10")).toBe(0);
  });

  it("formats today as local YYYY-MM-DD", () => {
    expect(todayISO(new Date(2026, 7, 10, 10, 0))).toBe("2026-08-10");
  });
});

describe("validateSchedule — standard", () => {
  it("accepts a valid standard schedule", () => {
    expect(validateSchedule({ ...base, now })).toEqual({ ok: true });
  });

  it("rejects an unknown pickup slot", () => {
    const check = validateSchedule({ ...base, pickupSlot: "2:00 AM - 3:00 AM", now });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error).toBe("SCHEDULE_SLOT_UNAVAILABLE");
  });

  it("rejects an unknown delivery slot", () => {
    const check = validateSchedule({ ...base, deliverySlot: "Midnight", now });
    expect(check.ok).toBe(false);
  });

  it("rejects missing dates", () => {
    expect(validateSchedule({ ...base, pickupDate: null, now }).ok).toBe(false);
    expect(validateSchedule({ ...base, deliveryDate: null, now }).ok).toBe(false);
  });

  it("rejects delivery before pickup", () => {
    const check = validateSchedule({ ...base, deliveryDate: "2026-08-09", now });
    expect(check.ok).toBe(false);
  });

  it("rejects delivery under 48 hours after pickup", () => {
    const check = validateSchedule({ ...base, deliveryDate: "2026-08-11", now });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain("48 hours");
  });
});

describe("validateSchedule — same day", () => {
  const sameDay = { pickupMode: "scheduled", deliverySpeed: "same_day" } as const;

  it("accepts same-day delivery with a slot after the pickup window", () => {
    expect(validateSchedule({
      ...base,
      ...sameDay,
      deliveryDate: "2026-08-10",
      deliverySlot: "11:00 AM - 1:00 PM",
      now,
    })).toEqual({ ok: true });
  });

  it("rejects delivery on a different date", () => {
    const check = validateSchedule({ ...base, ...sameDay, deliveryDate: "2026-08-11", now });
    expect(check.ok).toBe(false);
  });

  it("rejects a delivery slot starting before the pickup window ends", () => {
    const check = validateSchedule({
      ...base,
      ...sameDay,
      deliveryDate: "2026-08-10",
      deliverySlot: "7:00 AM - 9:00 AM",
      now,
    });
    expect(check.ok).toBe(false);
  });
});

describe("validateSchedule — 24 hour", () => {
  const twentyFour = { pickupMode: "scheduled", deliverySpeed: "24_hour" } as const;

  it("accepts delivery the day after pickup within the equivalent window", () => {
    expect(validateSchedule({ ...base, ...twentyFour, deliveryDate: "2026-08-11", now })).toEqual({ ok: true });
  });

  it("rejects delivery beyond the next day", () => {
    const check = validateSchedule({ ...base, ...twentyFour, deliveryDate: "2026-08-12", now });
    expect(check.ok).toBe(false);
  });

  it("rejects a delivery slot ending after the pickup window end", () => {
    const check = validateSchedule({
      ...base,
      ...twentyFour,
      deliveryDate: "2026-08-11",
      deliverySlot: "1:00 PM - 3:00 PM",
      now,
    });
    expect(check.ok).toBe(false);
  });

  it("accepts a delivery slot ending exactly at the pickup window end", () => {
    expect(validateSchedule({
      ...base,
      ...twentyFour,
      deliveryDate: "2026-08-11",
      deliverySlot: "9:00 AM - 11:00 AM",
      now,
    })).toEqual({ ok: true });
  });
});

describe("validateSchedule — express pickup", () => {
  const express = { pickupMode: "express", pickupSlot: EXPRESS_PICKUP_SLOT } as const;

  it("accepts express pickup today before the cutoff", () => {
    expect(validateSchedule({ ...base, ...express, pickupDate: "2026-08-10", now })).toEqual({ ok: true });
  });

  it("rejects express pickup on a future day", () => {
    const check = validateSchedule({ ...base, ...express, pickupDate: "2026-08-11", now });
    expect(check.ok).toBe(false);
  });

  it("rejects express pickup after the 6:30 PM cutoff", () => {
    const late = new Date(2026, 7, 10, 19, 0);
    const check = validateSchedule({ ...base, ...express, pickupDate: "2026-08-10", now: late });
    expect(check.ok).toBe(false);
  });

  it("is available exactly at the cutoff boundary", () => {
    expect(expressAvailable(new Date(2026, 7, 10, 18, 30))).toBe(false);
    expect(expressAvailable(new Date(2026, 7, 10, 18, 29))).toBe(true);
  });
});
