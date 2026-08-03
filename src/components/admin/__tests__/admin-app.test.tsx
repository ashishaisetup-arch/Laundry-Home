import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminApp } from "../admin-app";

let mockPathname = "/admin/dashboard";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ role: "admin" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
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

vi.mock("../admin-helpers", () => ({
  pageTitle: (v: string) => v === "dashboard" ? "Operations Dashboard" : v,
  pageSubtitle: (v: string) => v === "dashboard" ? "Centralised view" : v,
  NAV_GROUPS: [{ label: "Control Center", items: [] }],
}));

vi.mock("../admin-dashboard", () => ({
  AdminDashboard: () => <div data-testid="admin-dashboard" />,
}));

vi.mock("../admin-vendors", () => ({
  AdminVendors: () => <div data-testid="admin-vendors" />,
}));

vi.mock("../admin-orders", () => ({
  AdminOrders: () => <div data-testid="admin-orders" />,
}));

vi.mock("../admin-commission", () => ({
  AdminCommission: () => <div data-testid="admin-commission" />,
}));

vi.mock("../admin-support", () => ({
  AdminSupport: () => <div data-testid="admin-support" />,
}));

vi.mock("../admin-marketing", () => ({
  AdminMarketing: () => <div data-testid="admin-marketing" />,
}));

vi.mock("../admin-reports", () => ({
  AdminReports: () => <div data-testid="admin-reports" />,
}));

vi.mock("../admin-live-map", () => ({
  AdminLiveMap: () => <div data-testid="admin-livemap" />,
}));

vi.mock("../admin-ai", () => ({
  AdminAI: () => <div data-testid="admin-ai" />,
}));

describe("AdminApp", () => {
  it("renders dashboard view by default", () => {
    render(<AdminApp />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
  });

  it("shows correct page title for dashboard", () => {
    render(<AdminApp />);
    expect(screen.getByTestId("page-title")).toHaveTextContent("Operations Dashboard");
  });

  it("shows correct page subtitle for dashboard", () => {
    render(<AdminApp />);
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Centralised view");
  });

  it("renders live map view when active", () => {
    mockPathname = "/admin/livemap";
    render(<AdminApp />);
    expect(screen.getByTestId("admin-livemap")).toBeInTheDocument();
  });
});
