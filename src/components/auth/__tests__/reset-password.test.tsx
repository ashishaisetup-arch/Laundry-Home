import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResetPasswordPage } from "../reset-password";
import { createClient } from "@/lib/supabase";

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
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function mockClient(getSessionResult: { session: any } | null = null) {
  mockedCreateClient.mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: getSessionResult ?? { session: null },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as any);
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/auth/reset-password");
  });

  it("shows an invalid-link state when no code is present", async () => {
    render(<ResetPasswordPage />);
    expect(await screen.findByText("Invalid or expired link")).toBeInTheDocument();
    expect(screen.getByText("Back to sign in")).toBeInTheDocument();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("shows an invalid-link state when the URL carries a server error", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    render(<ResetPasswordPage />);
    expect(await screen.findByText("Invalid or expired link")).toBeInTheDocument();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("shows an invalid-link state when the URL fragment carries a server error", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb="
    );
    render(<ResetPasswordPage />);
    expect(await screen.findByText("Invalid or expired link")).toBeInTheDocument();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("shows the password form when a recovery session was established", async () => {
    mockClient({ session: { user: { email: "test@example.com" } } });
    window.history.replaceState({}, "", "/auth/reset-password?code=abc123&state=xyz789");
    render(<ResetPasswordPage />);
    expect(await screen.findByText("Set a new password")).toBeInTheDocument();
    expect(screen.getByText("Update password")).toBeInTheDocument();
  });

  it("shows an invalid-link state when no session could be recovered", async () => {
    mockClient();
    window.history.replaceState({}, "", "/auth/reset-password?code=abc123&state=xyz789");
    render(<ResetPasswordPage />);
    expect(await screen.findByText("Invalid or expired link")).toBeInTheDocument();
  });
});
