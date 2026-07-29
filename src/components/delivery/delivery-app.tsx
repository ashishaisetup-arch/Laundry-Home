
import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { useDeliveryTasks, useOrders } from "@/lib/hooks";
import { useRouterView } from "@/lib/hooks/use-router-view";
import { ProfilePage } from "@/components/shared/profile-page";
import { SettingsPage } from "@/components/shared/settings-page";
import { useAppStore } from "@/lib/store";
import { DeliveryDashboard } from "./delivery-dashboard";
import { DeliveryTasks } from "./delivery-tasks";
import { DeliveryEarnings } from "./delivery-earnings";

export function DeliveryApp() {
  const [view, setView, handleNavigate] = useRouterView("dashboard");
  const { userName, userId } = useAppStore();
  const { data: allTasks } = useDeliveryTasks(userId);
  useOrders(userId ? { deliveryExecutiveId: userId } : undefined);
  const tasks = allTasks || [];

  const pickupCount = useMemo(() => tasks.filter((t) => t.type === "pickup").length, [tasks]);
  const deliveryCount = useMemo(() => tasks.filter((t) => t.type === "delivery").length, [tasks]);

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: "Delivery",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
        { id: "pickups", label: "Today's Pickups", icon: "Package", badge: pickupCount },
        { id: "deliveries", label: "Today's Deliveries", icon: "Truck", badge: deliveryCount },
        { id: "earnings", label: "Earnings", icon: "IndianRupee" },
      ],
    },
  ], [pickupCount, deliveryCount]);

  const pageTitle = useMemo(() => ({
    dashboard: "Delivery Dashboard",
    pickups: "Today's Pickups",
    deliveries: "Today's Deliveries",
    earnings: "Earnings",
    profile: "My Profile",
    settings: "Settings",
  } as Record<string, string>), []);

  const pageSubtitle = useMemo(() => ({
    dashboard: `${userName || "Delivery Partner"} · Active now`,
    pickups: "Pickup tasks assigned to you today",
    deliveries: "Delivery tasks assigned to you today",
    earnings: "Track your earnings and payouts",
    profile: "Manage your account details",
    settings: "Account and app preferences",
  } as Record<string, string>), [userName]);

  return (
    <AppShell
      groups={navGroups}
      activeView={view}
      onNavigate={handleNavigate}
      pageTitle={pageTitle[view] || "Dashboard"}
      pageSubtitle={pageSubtitle[view] || ""}
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <DeliveryDashboard key="dashboard" tasks={tasks} />}
        {view === "pickups" && <DeliveryTasks key="pickups" type="pickup" />}
        {view === "deliveries" && <DeliveryTasks key="deliveries" type="delivery" />}
        {view === "earnings" && <DeliveryEarnings key="earnings" />}
        {view === "profile" && <ProfilePage key="profile" />}
        {view === "settings" && <SettingsPage key="settings" />}
      </AnimatePresence>
    </AppShell>
  );
}
