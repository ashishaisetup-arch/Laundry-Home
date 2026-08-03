
import { useEffect, Component, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { AuthLanding } from "@/components/auth/landing";
import { ResetPasswordPage } from "@/components/auth/reset-password";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

// ── Lazy-loaded role apps ──
const CustomerApp = lazy(() => import("@/components/customer/customer-app").then(m => ({ default: m.CustomerApp })));
const VendorApp = lazy(() => import("@/components/vendor/vendor-app").then(m => ({ default: m.VendorApp })));
const DeliveryApp = lazy(() => import("@/components/delivery/delivery-app").then(m => ({ default: m.DeliveryApp })));
const AdminApp = lazy(() => import("@/components/admin/admin-app").then(m => ({ default: m.AdminApp })));
const SuperAdminApp = lazy(() => import("@/components/superadmin/super-admin-app").then(m => ({ default: m.SuperAdminApp })));

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

function RoleAppWrapper() {
  const { role } = useParams<{ role: string }>();
  const storeRole = useAppStore((s) => s.role);

  const apps: Record<string, React.ComponentType> = {
    customer: CustomerApp,
    vendor: VendorApp,
    delivery: DeliveryApp,
    admin: AdminApp,
    superadmin: SuperAdminApp,
  };

  if (role && role !== storeRole) {
    return <Navigate to={`/${storeRole}/dashboard`} replace />;
  }

  const App = apps[role || storeRole];
  if (!App) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <App />
    </Suspense>
  );
}

function AuthenticatedApp() {
  const { role } = useAppStore();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${role}/dashboard`} replace />} />
      <Route path="/:role/*" element={<RoleAppWrapper />} />
      <Route path="*" element={<Navigate to={`/${role}/dashboard`} replace />} />
    </Routes>
  );
}

function AuthGate() {
  const { role, isAuthenticated, authLoading, initializeAuth } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const forceLanding = new URLSearchParams(location.search).has("landing") || new URLSearchParams(location.search).has("clear");
  const isAuthRoute = location.pathname.startsWith("/auth/");

  useEffect(() => {
    if (isAuthRoute) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("clear")) {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        const eq = c.indexOf("=");
        const name = eq > -1 ? c.substring(0, eq).trim() : c.trim();
        document.cookie = `${name}=; path=/; max-age=0; domain=${window.location.hostname};`;
      });
    }
    initializeAuth();
    const dirty = ["clear", "landing", "code", "state"].filter((p) => url.searchParams.has(p));
    if (dirty.length > 0) {
      dirty.forEach((p) => url.searchParams.delete(p));
      navigate(`${url.pathname}${url.search}`, { replace: true });
    }
  }, []);

  if (authLoading && !isAuthRoute) {
    return (
      <div className="flex h-screen items-center justify-center bg-aurora">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !forceLanding && !isAuthRoute && location.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  return (
    <AppErrorBoundary>
      {isAuthRoute ? (
        <>
          <ResetPasswordPage />
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </>
      ) : (
        <>
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
                <AuthenticatedApp />
              </motion.div>
            )}
          </AnimatePresence>
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </>
      )}
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}
