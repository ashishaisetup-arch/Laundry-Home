import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerApp } from "../customer-app";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ role: "customer" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/customer/dashboard" }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/store", () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      userId: "user-1",
      walletBalance: 500,
      loyaltyPoints: 200,
      orders: [],
      setOrders: vi.fn(),
      patchOrder: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/lib/hooks", () => ({
  useOrders: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  api: { post: vi.fn() },
}));

vi.mock("@/components/shared/app-shell", () => ({
  AppShell: ({ children, pageTitle, pageSubtitle }: any) => (
    <div data-testid="app-shell">
      <span data-testid="page-title">{pageTitle}</span>
      <span data-testid="page-subtitle">{pageSubtitle}</span>
      {children}
    </div>
  ),
}));

vi.mock("@/components/shared/error-state", () => ({
  ErrorState: ({ message, onRetry }: any) => (
    <div data-testid="error-state">
      <span>{message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

vi.mock("@/components/shared/skeleton-card", () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
  OrderCardSkeleton: () => <div data-testid="order-card-skeleton" />,
}));

vi.mock("@/components/shared/settings-page", () => ({
  SettingsPage: () => <div data-testid="settings-page" />,
}));

vi.mock("../customer-helpers", () => ({
  pageTitle: (v: string) => v === "dashboard" ? "Dashboard" : v,
  pageSubtitle: (v: string, area?: string | null) => v === "dashboard" ? "Your laundry at a glance" : area ? `${area}` : v,
}));

vi.mock("../customer-dashboard", () => ({
  CustomerDashboard: () => <div data-testid="customer-dashboard" />,
}));

vi.mock("../customer-discover", () => ({
  CustomerDiscover: () => <div data-testid="customer-discover" />,
}));

vi.mock("../customer-orders", () => ({
  CustomerOrders: () => <div data-testid="customer-orders" />,
}));

vi.mock("../customer-payments", () => ({
  CustomerPayments: () => <div data-testid="customer-payments" />,
}));

vi.mock("../customer-coupons", () => ({
  CustomerCoupons: () => <div data-testid="customer-coupons" />,
}));

vi.mock("../customer-favorites", () => ({
  CustomerFavorites: () => <div data-testid="customer-favorites" />,
}));

vi.mock("../customer-reviews", () => ({
  CustomerReviews: () => <div data-testid="customer-reviews" />,
}));

vi.mock("../customer-subscriptions", () => ({
  CustomerSubscriptions: () => <div data-testid="customer-subscriptions" />,
}));

vi.mock("../customer-profile", () => ({
  CustomerProfile: () => <div data-testid="customer-profile" />,
}));

vi.mock("../booking-flow", () => ({
  BookingFlow: ({ open }: any) => open ? <div data-testid="booking-flow" /> : null,
}));

vi.mock("../order-tracking", () => ({
  OrderTracking: ({ orderId }: any) => orderId ? <div data-testid="order-tracking" /> : null,
}));

describe("CustomerApp", () => {
  it("renders dashboard view by default", () => {
    render(<CustomerApp />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("customer-dashboard")).toBeInTheDocument();
  });

  it("shows correct page title for dashboard", () => {
    render(<CustomerApp />);
    expect(screen.getByTestId("page-title")).toHaveTextContent("Dashboard");
  });

  it("has booking flow and order tracking modals hidden by default", () => {
    render(<CustomerApp />);
    expect(screen.queryByTestId("booking-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-tracking")).not.toBeInTheDocument();
  });
});
