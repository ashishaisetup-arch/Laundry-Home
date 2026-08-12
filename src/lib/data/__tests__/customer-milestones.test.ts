import { describe, it, expect } from "vitest";
import {
  CUSTOMER_MILESTONES,
  CANCELLED_MILESTONE_INDEX,
  customerMilestone,
  customerMilestoneIndex,
  isMilestoneComplete,
  isOrderCancelled,
  milestoneIdForStage,
  milestoneTimestamp,
  getMilestoneEta,
} from "../customer-milestones";
import type { Order } from "@/lib/types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    code: "LH100",
    customerId: "c1",
    customerName: "Test",
    customerAvatar: "",
    vendorId: "v1",
    vendorName: "Vendor",
    vendorLogoInitials: "V",
    vendorLogoColor: "#8b5cf6",
    status: "placed",
    currentStageIndex: 0,
    stages: [],
    items: [],
    pickupLat: null,
    pickupLng: null,
    deliveryLat: null,
    deliveryLng: null,
    pickupAddress: "",
    pickupArea: "",
    pickupDate: "",
    pickupSlot: "",
    deliveryDate: "",
    deliverySlot: "",
    estimatedDeliveryAt: "",
    amount: 0,
    taxes: 0,
    platformFee: 0,
    deliveryFee: 0,
    total: 0,
    paymentMethod: "cod",
    paymentStatus: "pending",
    express: false,
    garmentCount: 0,
    createdAt: "",
    ...overrides,
  };
}

describe("milestoneIdForStage", () => {
  it("maps every internal status to the right customer milestone", () => {
    const expectations: Record<string, string> = {
      placed: "confirmed",
      vendor_assigned: "confirmed",
      vendor_accepted: "confirmed",
      pickup_scheduled: "pickup_scheduled",
      pickup_completed: "picked_up",
      laundry_received: "processing",
      sorting: "processing",
      tagging: "processing",
      washing: "processing",
      drying: "processing",
      ironing: "processing",
      dry_cleaning: "processing",
      quality_inspection: "processing",
      packing: "ready",
      ready_for_dispatch: "ready",
      out_for_delivery: "out_for_delivery",
      delivered: "delivered",
      completed: "delivered",
    };
    for (const [stage, milestone] of Object.entries(expectations)) {
      expect(milestoneIdForStage(stage as Order["status"])).toBe(milestone);
    }
  });

  it("does not map cancelled to a journey milestone", () => {
    expect(milestoneIdForStage("cancelled")).toBeUndefined();
  });
});

describe("customerMilestoneIndex", () => {
  it("uses status first", () => {
    const order = makeOrder({ status: "washing", currentStageIndex: 3 });
    expect(customerMilestoneIndex(order)).toBe(3);
  });

  it("falls back to currentStageIndex when status is unknown", () => {
    const order = makeOrder({ status: "mystery_status" as Order["status"], currentStageIndex: 15 });
    expect(customerMilestoneIndex(order)).toBe(5);
  });

  it("returns 0 when both status and index are unusable", () => {
    const order = makeOrder({ status: "mystery_status" as Order["status"], currentStageIndex: 99 });
    expect(customerMilestoneIndex(order)).toBe(0);
  });

  it("returns the cancelled sentinel for cancelled orders", () => {
    const order = makeOrder({ status: "cancelled", currentStageIndex: 8 });
    expect(customerMilestoneIndex(order)).toBe(CANCELLED_MILESTONE_INDEX);
  });

  it("maps each index boundary correctly", () => {
    expect(customerMilestoneIndex(makeOrder({ status: "placed", currentStageIndex: 0 }))).toBe(0);
    expect(customerMilestoneIndex(makeOrder({ status: "pickup_scheduled", currentStageIndex: 3 }))).toBe(1);
    expect(customerMilestoneIndex(makeOrder({ status: "pickup_completed", currentStageIndex: 4 }))).toBe(2);
    expect(customerMilestoneIndex(makeOrder({ status: "quality_inspection", currentStageIndex: 12 }))).toBe(3);
    expect(customerMilestoneIndex(makeOrder({ status: "ready_for_dispatch", currentStageIndex: 14 }))).toBe(4);
    expect(customerMilestoneIndex(makeOrder({ status: "out_for_delivery", currentStageIndex: 15 }))).toBe(5);
    expect(customerMilestoneIndex(makeOrder({ status: "completed", currentStageIndex: 17 }))).toBe(6);
  });
});

describe("customerMilestone", () => {
  it("returns the active milestone object", () => {
    expect(customerMilestone(makeOrder({ status: "drying" }))).toEqual(CUSTOMER_MILESTONES[3]);
  });

  it("clamps to Delivered for cancelled orders", () => {
    expect(customerMilestone(makeOrder({ status: "cancelled" }))).toEqual(CUSTOMER_MILESTONES[6]);
  });
});

describe("isMilestoneComplete", () => {
  it("marks skipped milestones as complete", () => {
    const order = makeOrder({ status: "pickup_completed", currentStageIndex: 4 });
    expect(isMilestoneComplete(order, 0)).toBe(true);
    expect(isMilestoneComplete(order, 1)).toBe(true);
    expect(isMilestoneComplete(order, 2)).toBe(false);
    expect(isMilestoneComplete(order, 3)).toBe(false);
  });

  it("treats nothing as complete for a confirmed order", () => {
    const order = makeOrder({ status: "placed" });
    for (let i = 0; i < 7; i++) expect(isMilestoneComplete(order, i)).toBe(false);
  });

  it("treats everything as complete for a delivered order", () => {
    const order = makeOrder({ status: "delivered", currentStageIndex: 16 });
    for (let i = 0; i < 6; i++) expect(isMilestoneComplete(order, i)).toBe(true);
  });
});

describe("isOrderCancelled", () => {
  it("takes precedence over everything", () => {
    const order = makeOrder({ status: "cancelled", currentStageIndex: 10 });
    expect(isOrderCancelled(order)).toBe(true);
    expect(customerMilestoneIndex(order)).toBe(CANCELLED_MILESTONE_INDEX);
    expect(customerMilestoneIndex(order)).toBeGreaterThan(CUSTOMER_MILESTONES.length - 1);
  });
});

describe("milestoneTimestamp", () => {
  const stages = [
    { stage: "placed" as const, label: "x", timestamp: "2026-06-12T10:32:00Z", done: true },
    { stage: "vendor_assigned" as const, label: "x", timestamp: "2026-06-12T11:00:00Z", done: true },
    { stage: "pickup_scheduled" as const, label: "x", timestamp: "2026-06-12T14:15:00Z", done: true },
    { stage: "washing" as const, label: "x", timestamp: "2026-06-13T09:14:00Z", done: true },
  ];

  it("uses the latest event within the milestone's stage group", () => {
    const order = makeOrder({ stages });
    expect(milestoneTimestamp(order, 0)).toBe("2026-06-12T11:00:00Z");
    expect(milestoneTimestamp(order, 1)).toBe("2026-06-12T14:15:00Z");
    expect(milestoneTimestamp(order, 3)).toBe("2026-06-13T09:14:00Z");
    expect(milestoneTimestamp(order, 2)).toBeUndefined();
  });

  it("ignores events outside the group", () => {
    const order = makeOrder({ stages: stages.slice(2) });
    expect(milestoneTimestamp(order, 0)).toBeUndefined();
    expect(milestoneTimestamp(order, 1)).toBe("2026-06-12T14:15:00Z");
  });
});

describe("getMilestoneEta", () => {
  it("returns milestone-specific messaging", () => {
    const confirmed = makeOrder({ status: "placed" });
    expect(getMilestoneEta(confirmed)).toBe("Pickup will be scheduled shortly");

    const processing = makeOrder({ status: "washing", estimatedDeliveryAt: "2026-06-13T18:00:00" });
    expect(getMilestoneEta(processing)).toContain("Estimated completion");

    const ready = makeOrder({ status: "ready_for_dispatch" });
    expect(getMilestoneEta(ready)).toBe("Delivery partner pickup expected shortly");

    const otd = makeOrder({ status: "out_for_delivery" });
    expect(getMilestoneEta(otd)).toBe("Your order is on the way");
    expect(getMilestoneEta(otd, "Arriving in ~18 min")).toBe("Arriving in ~18 min");
  });
});
