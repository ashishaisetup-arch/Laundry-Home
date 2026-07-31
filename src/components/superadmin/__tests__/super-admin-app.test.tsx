import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuperAdminApp } from "../super-admin-app";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ role: "superadmin" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/superadmin/dashboard" }),
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

vi.mock("@/lib/hooks", () => ({
  useUsers: () => ({ data: [] }),
  useVendors: () => ({ data: [] }),
}));

vi.mock("../superadmin-helpers", () => ({
  pageTitle: (v: string) => v === "dashboard" ? "Control Center" : v,
  pageSubtitle: (v: string) => v === "dashboard" ? "Super Admin · Full platform access" : v,
  NAV_GROUPS: [{ label: "Super Admin", items: [] }],
}));

vi.mock("../superadmin-overview", () => ({
  SuperAdminOverview: () => <div data-testid="superadmin-overview" />,
}));

vi.mock("../superadmin-vendors", () => ({
  SuperAdminVendors: () => <div data-testid="superadmin-vendors" />,
}));

vi.mock("../superadmin-rbac", () => ({
  RbacMatrix: () => <div data-testid="superadmin-rbac" />,
}));

vi.mock("../superadmin-users", () => ({
  UserManagement: () => <div data-testid="superadmin-users" />,
}));

vi.mock("../superadmin-audit", () => ({
  AuditLogs: () => <div data-testid="superadmin-audit" />,
}));

vi.mock("../superadmin-features", () => ({
  FeatureFlags: () => <div data-testid="superadmin-features" />,
}));

vi.mock("../superadmin-integrations", () => ({
  Integrations: () => <div data-testid="superadmin-integrations" />,
}));

vi.mock("../superadmin-system-config", () => ({
  SystemConfig: () => <div data-testid="superadmin-system-config" />,
}));

vi.mock("../vendor-onboarding", () => ({
  VendorOnboarding: ({ open }: any) => open ? <div data-testid="vendor-onboarding" /> : null,
}));

describe("SuperAdminApp", () => {
  it("renders dashboard view by default", () => {
    render(<SuperAdminApp />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("superadmin-overview")).toBeInTheDocument();
  });

  it("shows correct page title for dashboard", () => {
    render(<SuperAdminApp />);
    expect(screen.getByTestId("page-title")).toHaveTextContent("Control Center");
  });

  it("shows correct page subtitle for dashboard", () => {
    render(<SuperAdminApp />);
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("Full platform access");
  });
});
