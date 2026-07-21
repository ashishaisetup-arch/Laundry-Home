
import { useEffect, Component } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { AuthLanding } from "@/components/auth/landing";
import { CustomerApp } from "@/components/customer/customer-app";
import { VendorApp } from "@/components/vendor/vendor-app";
import { DeliveryApp } from "@/components/delivery/delivery-app";
import { AdminApp } from "@/components/admin/admin-app";
import { SuperAdminApp } from "@/components/superadmin/super-admin-app";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

// ── Error boundary ──
class AppErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-aurora p-8">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-bold text-rose-600">Something went wrong</h2>
            <p className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-lg">{this.state.error}</p>
            <Button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = "/?clear=1"; }}>
              Reset & Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { role, isAuthenticated, authLoading, initializeAuth } = useAppStore();
  const forceLanding = new URLSearchParams(window.location.search).has("landing") || new URLSearchParams(window.location.search).has("clear");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("clear")) {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        const eq = c.indexOf("=");
        const name = eq > -1 ? c.substring(0, eq).trim() : c.trim();
        document.cookie = `${name}=; path=/; max-age=0; domain=${window.location.hostname};`;
      });
      url.searchParams.delete("clear");
      window.history.replaceState(window.history.state, "", url.toString());
    }
    initializeAuth();
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-aurora">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <AnimatePresence mode="wait">
        {!isAuthenticated || forceLanding ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AuthLanding />
          </motion.div>
        ) : (
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {role === "customer" && <CustomerApp />}
            {role === "vendor" && <VendorApp />}
            {role === "delivery" && <DeliveryApp />}
            {role === "admin" && <AdminApp />}
            {role === "superadmin" && <SuperAdminApp />}
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
      <SonnerToaster position="top-right" richColors closeButton />
    </AppErrorBoundary>
  );
}
