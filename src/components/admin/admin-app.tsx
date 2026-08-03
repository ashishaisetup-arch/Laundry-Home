import { AnimatePresence } from "framer-motion";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/shared/app-shell";
import { useRouterView } from "@/lib/hooks/use-router-view";
import { ProfilePage } from "@/components/shared/profile-page";
import { SettingsPage } from "@/components/shared/settings-page";
import { toast } from "sonner";
import { pageTitle, pageSubtitle, NAV_GROUPS } from "./admin-helpers";
import { AdminDashboard } from "./admin-dashboard";
import { AdminVendors } from "./admin-vendors";
import { AdminOrders } from "./admin-orders";
import { AdminCommission } from "./admin-commission";
import { AdminSupport } from "./admin-support";
import { AdminMarketing } from "./admin-marketing";
import { AdminReports } from "./admin-reports";
import { AdminLiveMap } from "./admin-live-map";
import { AdminAI } from "./admin-ai";

export function AdminApp() {
  const [view, setView, handleNavigate] = useRouterView("dashboard");

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={handleNavigate}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
      actions={
        view === "reports" ? (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("Export started", { description: "Your report is being exported as PDF." })}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Report generated", { description: "Custom report has been created and saved." })}>
              <FileText className="h-4 w-4 mr-1.5" />
              Generate Report
            </Button>
          </>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <AdminDashboard key="d" />}
        {view === "vendors" && <AdminVendors key="v" />}
        {view === "orders" && <AdminOrders key="o" />}
        {view === "commission" && <AdminCommission key="c" />}
        {view === "support" && <AdminSupport key="s" />}
        {view === "marketing" && <AdminMarketing key="m" />}
        {view === "reports" && <AdminReports key="r" />}
        {view === "livemap" && <AdminLiveMap key="lm" />}
        {view === "ai" && <AdminAI key="a" />}
        {view === "profile" && <ProfilePage key="profile" />}
        {view === "settings" && <SettingsPage key="settings" />}
      </AnimatePresence>
    </AppShell>
  );
}
