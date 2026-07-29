import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeliveryApp } from "../delivery-app";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ role: "delivery" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/delivery/dashboard" }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("@/lib/store", () => ({
  useAppStore: vi.fn((selector) => {
    const state = { userName: "John", userId: "del-1" };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/lib/hooks", () => ({
  useDeliveryTasks: () => ({ data: [] }),
  useOrders: () => ({}),
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

vi.mock("../delivery-dashboard", () => ({
  DeliveryDashboard: () => <div data-testid="delivery-dashboard" />,
}));

vi.mock("../delivery-tasks", () => ({
  DeliveryTasks: () => <div data-testid="delivery-tasks" />,
}));

vi.mock("../delivery-earnings", () => ({
  DeliveryEarnings: () => <div data-testid="delivery-earnings" />,
}));

describe("DeliveryApp", () => {
  it("renders dashboard view by default", () => {
    render(<DeliveryApp />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("delivery-dashboard")).toBeInTheDocument();
  });

  it("shows user name in page subtitle", () => {
    render(<DeliveryApp />);
    expect(screen.getByTestId("page-subtitle")).toHaveTextContent("John");
  });

  it("shows correct page title for dashboard", () => {
    render(<DeliveryApp />);
    expect(screen.getByTestId("page-title")).toHaveTextContent("Delivery Dashboard");
  });
});
