import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorApp } from "../vendor-app";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ role: "vendor" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/vendor/dashboard" }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("@/lib/store", () => ({
  useAppStore: vi.fn((selector) => {
    const state = { userId: "vendor-1" };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/lib/hooks", () => ({
  useOrders: () => ({ data: [] }),
}));

vi.mock("@/lib/hooks/use-fetch", () => ({
  useFetch: () => ({ data: [{ id: "vendor-1" }] }),
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

vi.mock("@/components/shared/profile-page", () => ({
  ProfilePage: () => <div data-testid="profile-page" />,
}));

vi.mock("@/components/shared/settings-page", () => ({
  SettingsPage: () => <div data-testid="settings-page" />,
}));

vi.mock("../vendor-helpers", () => ({
  useMyVendorId: () => "vendor-1",
  pageTitle: (v: string) => v === "dashboard" ? "Vendor Dashboard" : v,
  pageSubtitle: (v: string) => v === "dashboard" ? "FreshFold Laundry Co." : v,
}));

vi.mock("../vendor-dashboard", () => ({
  VendorDashboard: () => <div data-testid="vendor-dashboard" />,
}));

vi.mock("../vendor-orders", () => ({
  VendorOrders: () => <div data-testid="vendor-orders" />,
}));

vi.mock("../vendor-processing", () => ({
  VendorProcessing: () => <div data-testid="vendor-processing" />,
}));

vi.mock("../vendor-inventory", () => ({
  VendorInventory: () => <div data-testid="vendor-inventory" />,
}));

vi.mock("../vendor-services", () => ({
  VendorServices: () => <div data-testid="vendor-services" />,
}));

vi.mock("../vendor-analytics", () => ({
  VendorAnalytics: () => <div data-testid="vendor-analytics" />,
}));

vi.mock("../vendor-staff", () => ({
  VendorStaff: () => <div data-testid="vendor-staff" />,
}));

describe("VendorApp", () => {
  it("renders dashboard view by default", () => {
    render(<VendorApp />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("vendor-dashboard")).toBeInTheDocument();
  });

  it("shows correct page title for dashboard", () => {
    render(<VendorApp />);
    expect(screen.getByTestId("page-title")).toHaveTextContent("Vendor Dashboard");
  });

  it("shows correct page subtitle for dashboard", () => {
    render(<VendorApp />);
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("FreshFold Laundry Co.");
  });
});
