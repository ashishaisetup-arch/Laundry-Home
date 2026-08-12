import type { Order, OrderStage } from "@/lib/types";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import { formatDateTime } from "@/lib/utils";

// ─── Customer milestone layer ─────────────────────────────────────────────
// Single source of truth for all customer-facing order progress. The internal
// 18-stage operational workflow (ORDER_STAGE_FLOW) is untouched; every
// customer-facing component (CustomerOrderTimeline, OrderCard, OrderTracking)
// derives progress from this module so the journey is always consistent.

export type CustomerMilestoneId =
  | "confirmed"
  | "pickup_scheduled"
  | "picked_up"
  | "processing"
  | "ready"
  | "out_for_delivery"
  | "delivered";

export const CANCELLED_MILESTONE_INDEX = 7;

export interface CustomerMilestone {
  id: CustomerMilestoneId;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const CUSTOMER_MILESTONES: CustomerMilestone[] = [
  { id: "confirmed", label: "Order Confirmed", shortLabel: "Confirmed", icon: "ClipboardCheck", description: "Your order has been placed and confirmed." },
  { id: "pickup_scheduled", label: "Pickup Scheduled", shortLabel: "Pickup", icon: "CalendarClock", description: "A pickup slot has been scheduled for your order." },
  { id: "picked_up", label: "Picked Up", shortLabel: "Picked Up", icon: "PackageCheck", description: "Your laundry has been collected and is on its way." },
  { id: "processing", label: "Being Processed", shortLabel: "Processing", icon: "WashingMachine", description: "Your laundry is being cleaned and prepared." },
  { id: "ready", label: "Ready for Delivery", shortLabel: "Ready", icon: "Package", description: "Your laundry is packed and ready for delivery." },
  { id: "out_for_delivery", label: "Out for Delivery", shortLabel: "Out for Del.", icon: "Bike", description: "Your order is on its way to you." },
  { id: "delivered", label: "Delivered", shortLabel: "Delivered", icon: "Home", description: "Your order has been delivered." },
];

// Status-first mapping. currentStageIndex is only a fallback when the status
// is unknown or temporarily out of sync with the index during updates.
const STATUS_TO_MILESTONE: Partial<Record<OrderStage, CustomerMilestoneId>> = {
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

const MILESTONE_IDS = CUSTOMER_MILESTONES.map((m) => m.id);
const MILESTONE_ID_TO_INDEX = new Map<CustomerMilestoneId, number>(
  MILESTONE_IDS.map((id, i) => [id, i])
);

// Internal stages grouped by milestone, used for milestone timestamps.
const STAGE_GROUPS: { milestone: CustomerMilestoneId; stages: OrderStage[] }[] = [
  { milestone: "confirmed", stages: ["placed", "vendor_assigned", "vendor_accepted"] },
  { milestone: "pickup_scheduled", stages: ["pickup_scheduled"] },
  { milestone: "picked_up", stages: ["pickup_completed"] },
  {
    milestone: "processing",
    stages: ["laundry_received", "sorting", "tagging", "washing", "drying", "ironing", "dry_cleaning", "quality_inspection"],
  },
  { milestone: "ready", stages: ["packing", "ready_for_dispatch"] },
  { milestone: "out_for_delivery", stages: ["out_for_delivery"] },
  { milestone: "delivered", stages: ["delivered", "completed"] },
];

export function isOrderCancelled(order: Pick<Order, "status">): boolean {
  return order.status === "cancelled";
}

export function milestoneIdForStage(stage: OrderStage): CustomerMilestoneId | undefined {
  return STATUS_TO_MILESTONE[stage];
}

export function customerMilestoneIndex(order: Pick<Order, "status" | "currentStageIndex">): number {
  if (isOrderCancelled(order)) return CANCELLED_MILESTONE_INDEX;

  const byStatus = STATUS_TO_MILESTONE[order.status];
  if (byStatus) {
    const idx = MILESTONE_ID_TO_INDEX.get(byStatus);
    if (idx !== undefined) return idx;
  }

  // Fallback: currentStageIndex → ORDER_STAGE_FLOW stage → milestone.
  const flowStage = ORDER_STAGE_FLOW[order.currentStageIndex]?.stage;
  if (flowStage) {
    const byIndex = STATUS_TO_MILESTONE[flowStage];
    const idx = byIndex ? MILESTONE_ID_TO_INDEX.get(byIndex) : undefined;
    if (idx !== undefined) return idx;
  }

  // Neither usable: keep the customer UI deterministic (Order Confirmed).
  return 0;
}

export function customerMilestone(order: Pick<Order, "status" | "currentStageIndex">): CustomerMilestone {
  const idx = customerMilestoneIndex(order);
  return CUSTOMER_MILESTONES[Math.min(idx, CUSTOMER_MILESTONES.length - 1)];
}

// Skipped milestones count as complete: an order that jumps from placement
// straight to "Picked Up" shows all prior milestones as done.
export function isMilestoneComplete(order: Pick<Order, "status" | "currentStageIndex">, index: number): boolean {
  return index < customerMilestoneIndex(order);
}

// Latest internal stage event timestamp within the milestone's stage group,
// so the journey reads as a real sequence rather than seven computed values.
export function milestoneTimestamp(order: Pick<Order, "stages">, index: number): string | undefined {
  const milestone = CUSTOMER_MILESTONES[index];
  if (!milestone) return undefined;
  const group = STAGE_GROUPS.find((g) => g.milestone === milestone.id);
  if (!group) return undefined;
  const stageSet = new Set(group.stages);
  let latest: string | undefined;
  for (const event of order.stages || []) {
    if (stageSet.has(event.stage)) latest = event.timestamp;
  }
  return latest;
}

export function getMilestoneEta(
  order: Pick<Order, "status" | "currentStageIndex" | "estimatedDeliveryAt" | "pickupDate" | "pickupSlot" | "deliveryDate" | "deliverySlot">,
  liveEta?: string
): string | undefined {
  const milestone = customerMilestone(order);
  switch (milestone.id) {
    case "confirmed":
      return "Pickup will be scheduled shortly";
    case "pickup_scheduled":
      return order.pickupDate && order.pickupSlot
        ? `${order.pickupDate}, ${order.pickupSlot}`
        : "Pickup window to be confirmed";
    case "picked_up":
      return order.deliveryDate
        ? `Expected delivery ${order.deliveryDate}`
        : "Delivery date to be confirmed";
    case "processing":
      return order.estimatedDeliveryAt
        ? `Estimated completion ${formatDateTime(order.estimatedDeliveryAt)}`
        : "Estimated completion to be confirmed";
    case "ready":
      return "Delivery partner pickup expected shortly";
    case "out_for_delivery":
      return liveEta || "Your order is on the way";
    case "delivered":
      return "Delivered";
  }
  return undefined;
}
