
import { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { useOrders } from "@/lib/hooks";
import { useRouterView } from "@/lib/hooks/use-router-view";
import { ProfilePage } from "@/components/shared/profile-page";
import { SettingsPage } from "@/components/shared/settings-page";
import { useMyVendorId, pageTitle, pageSubtitle } from "./vendor-helpers";
import { VendorDashboard } from "./vendor-dashboard";
import { VendorOrders } from "./vendor-orders";
import { VendorProcessing } from "./vendor-processing";
import { VendorInventory } from "./vendor-inventory";
import { VendorServices } from "./vendor-services";
import { VendorAnalytics } from "./vendor-analytics";
import { VendorStaff } from "./vendor-staff";

export function VendorApp() {
  const [view, setView, handleNavigate] = useRouterView("dashboard");
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const vid = useMyVendorId();
  const { data: orders } = useOrders({ vendorId: vid });
  const pendingCount = (orders || []).filter((o) => ["placed", "vendor_assigned"].includes(o.status)).length;

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: "Vendor",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
        { id: "orders", label: "Order Management", icon: "ClipboardList", badge: pendingCount },
        { id: "processing", label: "Laundry Processing", icon: "WashingMachine" },
        { id: "inventory", label: "Garment Inventory", icon: "Boxes" },
        { id: "staff", label: "Staff Management", icon: "Users" },
        { id: "services", label: "Service Management", icon: "Settings2" },
        { id: "analytics", label: "Analytics", icon: "BarChart3" },
      ],
    },
  ], [pendingCount]);

  return (
    <>
      <AppShell
        groups={navGroups}
        activeView={view}
        onNavigate={handleNavigate}
        pageTitle={pageTitle(view)}
        pageSubtitle={pageSubtitle(view)}
        actions={
          view === "orders" ? (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setManualOrderOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Manual Order
            </Button>
          ) : undefined
        }
      >
        <AnimatePresence mode="wait">
          {view === "dashboard" && <VendorDashboard key="dashboard" />}
          {view === "orders" && <VendorOrders key="orders" />}
          {view === "processing" && <VendorProcessing key="processing" />}
          {view === "inventory" && <VendorInventory key="inventory" />}
          {view === "staff" && <VendorStaff key="staff" />}
          {view === "services" && <VendorServices key="services" />}
          {view === "analytics" && <VendorAnalytics key="analytics" />}
          {view === "profile" && <ProfilePage key="profile" />}
          {view === "settings" && <SettingsPage key="settings" />}
        </AnimatePresence>
      </AppShell>

      <Dialog open={manualOrderOpen} onOpenChange={setManualOrderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Manual Order</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Manual order creation coming soon. Please use the customer app to place orders.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
