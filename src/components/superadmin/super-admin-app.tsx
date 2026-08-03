import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Store, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/shared/app-shell";
import { VendorOnboarding } from "./vendor-onboarding";
import { toast } from "sonner";
import { useUsers, useVendors } from "@/lib/hooks";
import { useRouterView } from "@/lib/hooks/use-router-view";
import { ProfilePage } from "@/components/shared/profile-page";
import { SettingsPage } from "@/components/shared/settings-page";
import { NAV_GROUPS, pageTitle, pageSubtitle } from "./superadmin-helpers";
import { SuperAdminOverview } from "./superadmin-overview";
import { SuperAdminVendors } from "./superadmin-vendors";
import { RbacMatrix } from "./superadmin-rbac";
import { UserManagement } from "./superadmin-users";
import { AuditLogs } from "./superadmin-audit";
import { FeatureFlags } from "./superadmin-features";
import { ServiceCatalogManager } from "./service-catalog-manager";
import { Integrations } from "./superadmin-integrations";
import { SystemConfig } from "./superadmin-system-config";

export function SuperAdminApp() {
  const [view, setView, handleNavigateFromRouter] = useRouterView("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: users } = useUsers();
  const { data: vendorsList } = useVendors();

  const handleNavigate = (v: string) => {
    if (v === "onboard") {
      setShowOnboarding(true);
      return;
    }
    handleNavigateFromRouter(v);
  };

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={handleNavigate}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
      actions={
        view === "dashboard" ? (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowOnboarding(true)}>
            <Store className="h-4 w-4 mr-1.5" />
            Onboard Vendor
          </Button>
        ) : view === "system" ? (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Settings saved", { description: "All system configurations updated." })}>
            <Save className="h-4 w-4 mr-1.5" />
            Save Changes
          </Button>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <SuperAdminOverview key="dashboard" onOnboard={() => setShowOnboarding(true)} onNavigate={setView} totalUsers={users?.length || 0} totalVendors={vendorsList?.length || 0} />}
        {view === "vendors" && <SuperAdminVendors key="vendors" />}
        {view === "rbac" && <RbacMatrix key="rbac" />}
        {view === "users" && <UserManagement key="users" />}
        {view === "audit" && <AuditLogs key="audit" />}
        {view === "features" && <FeatureFlags key="features" />}
        {view === "catalog" && <ServiceCatalogManager key="catalog" />}
        {view === "integrations" && <Integrations key="integrations" />}
        {view === "system" && <SystemConfig key="system" />}
        {view === "profile" && <ProfilePage key="profile" />}
        {view === "settings" && <SettingsPage key="settings" />}
      </AnimatePresence>

      <VendorOnboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </AppShell>
  );
}
