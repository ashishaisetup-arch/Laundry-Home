import type { Order } from "@/lib/types";

export const ORDER_STAGE_FLOW: { stage: Order["status"]; label: string; icon: string }[] = [
  { stage: "placed", label: "Order Placed", icon: "ClipboardCheck" },
  { stage: "vendor_assigned", label: "Vendor Assigned", icon: "Store" },
  { stage: "vendor_accepted", label: "Vendor Accepted", icon: "BadgeCheck" },
  { stage: "pickup_scheduled", label: "Pickup Scheduled", icon: "CalendarClock" },
  { stage: "pickup_completed", label: "Pickup Completed", icon: "PackageCheck" },
  { stage: "laundry_received", label: "Laundry Received", icon: "Boxes" },
  { stage: "sorting", label: "Sorting", icon: "ListTree" },
  { stage: "tagging", label: "Tagging", icon: "Tag" },
  { stage: "washing", label: "Washing", icon: "WashingMachine" },
  { stage: "drying", label: "Drying", icon: "Wind" },
  { stage: "ironing", label: "Ironing", icon: "Shirt" },
  { stage: "dry_cleaning", label: "Dry Cleaning", icon: "Sparkles" },
  { stage: "quality_inspection", label: "Quality Inspection", icon: "SearchCheck" },
  { stage: "packing", label: "Packing", icon: "Package" },
  { stage: "ready_for_dispatch", label: "Ready for Dispatch", icon: "Truck" },
  { stage: "out_for_delivery", label: "Out for Delivery", icon: "Bike" },
  { stage: "delivered", label: "Delivered", icon: "Home" },
  { stage: "completed", label: "Completed", icon: "CircleCheck" },
];
