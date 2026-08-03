import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";
import { createClient } from "@/lib/supabase";

const mocks = vi.hoisted(() => {
  const storeState: Record<string, any> = {
    role: "guest",
    isAuthenticated: false,
    authLoading: true,
    userName: "",
    userEmail: "",
    userAvatar: "",
    userPhone: "",
    userId: null,
    authError: null,
    initializeAuth: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
    signInWithEmail: vi.fn(),
    signInWithPhone: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signUp: vi.fn(),
    setProfile: vi.fn(),
    theme: "light",
    sidebarOpen: false,
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    setSidebar: vi.fn(),
    notifications: [],
    unreadCount: 0,
    fetchNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllRead: vi.fn(),
    setupRealtimeNotifications: vi.fn(),
    aiChat: [],
    aiOpen: false,
    toggleAi: vi.fn(),
    setAiOpen: vi.fn(),
    sendAiMessage: vi.fn(),
    clearAiChat: vi.fn(),
    walletBalance: 0,
    loyaltyPoints: 0,
    fetchWallet: vi.fn(),
    orders: [],
    setOrders: vi.fn(),
    patchOrder: vi.fn(),
    markOrderCancelled: vi.fn(),
    pendingSearchQuery: null,
    setPendingSearchQuery: vi.fn(),
  };
  const setStore = (partial: Record<string, any>) => Object.assign(storeState, partial);
  return { storeState, setStore };
});

vi.mock("@/lib/store", () => ({
  useAppStore: (selector?: any) => (selector ? selector(mocks.storeState) : mocks.storeState),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));

vi.mock("@/components/auth/auth-modal", () => ({ AuthModal: () => null }));
vi.mock("@/components/auth/phone-mockup", () => ({ PhoneMockup: () => null }));
vi.mock("@/components/auth/vendor-dashboard-preview", () => ({ VendorDashboardPreview: () => null }));

vi.mock("@/components/customer/customer-app", () => ({ CustomerApp: () => <div>CustomerApp</div> }));
vi.mock("@/components/vendor/vendor-app", () => ({ VendorApp: () => <div>VendorApp</div> }));
vi.mock("@/components/delivery/delivery-app", () => ({ DeliveryApp: () => <div>DeliveryApp</div> }));
vi.mock("@/components/admin/admin-app", () => ({ AdminApp: () => <div>AdminApp</div> }));
vi.mock("@/components/superadmin/super-admin-app", () => ({ SuperAdminApp: () => <div>SuperAdminApp</div> }));

const mockedCreateClient = vi.mocked(createClient);

describe("AuthGate routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setStore({ authLoading: true, isAuthenticated: false, role: "guest" });
    window.history.replaceState({}, "", "/");
  });

  it("renders the reset page (not the loading screen) on /auth/reset-password with no session", async () => {
    window.history.replaceState({}, "", "/auth/reset-password?code=abc123");
    mockedCreateClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    } as any);
    render(<App />);
    expect(await screen.findByText("Invalid or expired link")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders the password form on /auth/reset-password when a recovery session exists", async () => {
    window.history.replaceState({}, "", "/auth/reset-password?code=abc123");
    mockedCreateClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { email: "test@example.com" } } },
          error: null,
        }),
      },
    } as any);
    render(<App />);
    expect(await screen.findByText("Set a new password")).toBeInTheDocument();
  });

  it("shows the loading screen on protected routes while auth is initializing", () => {
    window.history.replaceState({}, "", "/customer/dashboard");
    render(<App />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows the login landing on protected routes when unauthenticated", async () => {
    mocks.setStore({ authLoading: false, isAuthenticated: false, role: "guest" });
    window.history.replaceState({}, "", "/customer/dashboard");
    render(<App />);
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("redirects an authenticated admin away from a /superadmin URL", async () => {
    mocks.setStore({ authLoading: false, isAuthenticated: true, role: "admin" });
    window.history.replaceState({}, "", "/superadmin/dashboard");
    render(<App />);
    expect(await screen.findByText("AdminApp")).toBeInTheDocument();
    expect(screen.queryByText("SuperAdminApp")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin/dashboard");
  });

  it("renders the app matching the session role on its own URL", async () => {
    mocks.setStore({ authLoading: false, isAuthenticated: true, role: "admin" });
    window.history.replaceState({}, "", "/admin/orders");
    render(<App />);
    expect(await screen.findByText("AdminApp")).toBeInTheDocument();
    expect(screen.queryByText("SuperAdminApp")).not.toBeInTheDocument();
  });
});
