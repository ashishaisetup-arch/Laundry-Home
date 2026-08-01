import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResetPasswordPage } from "../reset-password";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/shared/brand", () => ({
  BrandLockup: () => <div data-testid="brand-lockup" />,
  LogoMark: () => <div data-testid="logo-mark" />,
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession: vi.fn() } }),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/auth/reset-password");
  });

  it("shows an invalid-link state when no code is present", async () => {
    render(<ResetPasswordPage />);
    expect(await screen.findByText("Invalid or expired link")).toBeInTheDocument();
    expect(screen.getByText("Back to sign in")).toBeInTheDocument();
  });
});
