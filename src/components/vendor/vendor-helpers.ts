import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useFetch } from "@/lib/hooks/use-fetch";

export function useMyVendorId(): string | null {
  const userId = useAppStore((s) => s.userId);
  const { data } = useFetch<{ id: string }[]>(userId ? `/api/vendors?owner_id=${userId}` : null);
  const vendors = data || [];
  const [vid, setVid] = useState<string | null>(null);
  useEffect(() => { if (vendors.length > 0) setVid(vendors[0].id); }, [vendors]);
  return vid;
}

export function pageTitle(view: string) {
  return {
    dashboard: "Vendor Dashboard",
    orders: "Order Management",
    processing: "Laundry Processing",
    inventory: "Garment Inventory",
    staff: "Staff Management",
    services: "Service Management",
    analytics: "Analytics & Reports",
    profile: "My Profile",
    settings: "Settings",
  }[view] || "Dashboard";
}

export function pageSubtitle(view: string) {
  return {
    dashboard: "FreshFold Laundry Co. · Indiranagar, Bengaluru",
    profile: "Manage your account details",
    settings: "Account and app preferences",
    orders: "Accept, schedule and manage incoming orders",
    processing: "Update each garment through the laundry workflow",
    inventory: "Track every garment with photos and condition notes",
    staff: "Manage your laundry staff and assignments",
    services: "Configure your offerings, pricing and availability",
    analytics: "Revenue, ratings and operational insights",
  }[view];
}
