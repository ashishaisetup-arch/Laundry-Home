import { Navigation, Package, Bike, Store, CheckCircle2 } from "lucide-react";
import type { DeliveryTask } from "@/lib/types";

export const STATUS_ORDER = [
  "pending",
  "heading_to_pickup",
  "picked_up",
  "heading_to_vendor",
  "reached_vendor",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
] as const;

export const PICKUP_STEPS = [
  { id: "heading_to_pickup", label: "Heading to pickup", icon: Navigation },
  { id: "picked_up", label: "Picked up", icon: Package },
  { id: "heading_to_vendor", label: "Heading to vendor", icon: Bike },
  { id: "reached_vendor", label: "Reached vendor", icon: Store },
  { id: "ready_for_delivery", label: "Handover to vendor", icon: CheckCircle2 },
];

export const DELIVERY_STEPS = [
  { id: "out_for_delivery", label: "Out for delivery", icon: Bike },
  { id: "delivered", label: "Delivered", icon: CheckCircle2 },
];

export function statusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as typeof STATUS_ORDER[number]);
}

export function filterSortTasks(tasks: DeliveryTask[], type: "pickup" | "delivery") {
  return tasks
    .filter((t) => t.type === type)
    .sort((a, b) => {
      const orderA = statusIndex(a.status);
      const orderB = statusIndex(b.status);
      if (orderA !== orderB) return orderA - orderB;
      return (a.slot || "").localeCompare(b.slot || "");
    });
}
