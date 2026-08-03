import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsPage } from "../settings-page";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockStore = {
  theme: "light",
  toggleTheme: vi.fn(),
  pushEnabled: true,
  orderUpdatesEnabled: true,
  promotionsEnabled: false,
  fetchSettings: vi.fn().mockResolvedValue(undefined),
  updateNotificationSettings: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/store", () => ({
  useAppStore: vi.fn((selector) => (selector ? selector(mockStore) : mockStore)),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

import { toast } from "sonner";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.pushEnabled = true;
    mockStore.orderUpdatesEnabled = true;
    mockStore.promotionsEnabled = false;
  });

  it("renders theme, notifications and security sections", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
    expect(screen.getByText("Account Security")).toBeInTheDocument();
    expect(screen.getByText("Change Password")).toBeInTheDocument();
  });

  it("fetches settings on mount", () => {
    render(<SettingsPage />);
    expect(mockStore.fetchSettings).toHaveBeenCalled();
  });

  it("toggles push notifications", async () => {
    render(<SettingsPage />);
    const toggle = screen.getByRole("switch", { name: "Push Notifications" });
    fireEvent.click(toggle);
    expect(mockStore.updateNotificationSettings).toHaveBeenCalledWith({ pushEnabled: false });
  });

  it("toggles promotions", async () => {
    render(<SettingsPage />);
    const toggle = screen.getByRole("switch", { name: "Promotions and offers notifications" });
    fireEvent.click(toggle);
    expect(mockStore.updateNotificationSettings).toHaveBeenCalledWith({ promotions: true });
  });

  it("changes password on valid submission", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByText("Change Password"));

    await waitFor(() => {
      expect(mockStore.changePassword).toHaveBeenCalledWith("oldpass", "newpass123");
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows an error when passwords do not match", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different" } });
    fireEvent.click(screen.getByText("Change Password"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Passwords do not match");
    });
    expect(mockStore.changePassword).not.toHaveBeenCalled();
  });

  it("shows an error when the new password is too short", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "oldpass" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "123" } });
    fireEvent.click(screen.getByText("Change Password"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("New password must be at least 6 characters");
    });
    expect(mockStore.changePassword).not.toHaveBeenCalled();
  });

  it("shows a toast when saving notification settings fails", async () => {
    mockStore.updateNotificationSettings.mockRejectedValueOnce(new Error("Network error"));
    render(<SettingsPage />);
    const toggle = screen.getByRole("switch", { name: "Push Notifications" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });
});
