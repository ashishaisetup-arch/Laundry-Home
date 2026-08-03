import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthLanding, resetErrorMessage } from "../landing";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  signInWithEmail: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      signInWithOAuth: vi.fn(),
      signInWithPhone: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithEmail: mocks.signInWithEmail,
      signUp: mocks.signUp,
      resetPassword: vi.fn(),
      authLoading: false,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/components/shared/brand", () => ({
  BrandLockup: () => <div data-testid="brand-lockup" />,
  GradientOrb: () => <div data-testid="gradient-orb" />,
}));

vi.mock("../data", () => ({
  FEATURES: [
    { title: "Feature 1", desc: "Desc 1", icon: () => <svg /> },
    { title: "Feature 2", desc: "Desc 2", icon: () => <svg /> },
  ],
  SERVICES: [
    { name: "Wash & Fold", icon: "🧺", price: "₹99/kg" },
    { name: "Dry Cleaning", icon: "👔", price: "₹199/item" },
  ],
}));

vi.mock("../auth-modal", () => ({
  AuthModal: () => <div data-testid="auth-modal" />,
}));

vi.mock("../phone-mockup", () => ({
  PhoneMockup: () => <div data-testid="phone-mockup" />,
}));

vi.mock("../vendor-dashboard-preview", () => ({
  VendorDashboardPreview: () => <div data-testid="vendor-dashboard-preview" />,
}));

describe("AuthLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the landing page with hero section", () => {
    render(<AuthLanding />);
    expect(screen.getByText(/picked up, washed/i)).toBeInTheDocument();
    expect(screen.getByText(/Book premium laundry services/i)).toBeInTheDocument();
  });

  it("renders sign in and get started buttons", () => {
    render(<AuthLanding />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("renders features section", () => {
    render(<AuthLanding />);
    expect(screen.getByText("Feature 1")).toBeInTheDocument();
    expect(screen.getByText("Feature 2")).toBeInTheDocument();
  });

  it("renders services section", () => {
    render(<AuthLanding />);
    expect(screen.getByText("Wash & Fold")).toBeInTheDocument();
    expect(screen.getByText("Dry Cleaning")).toBeInTheDocument();
  });

  it("renders vendor section", () => {
    render(<AuthLanding />);
    expect(screen.getByText(/1,284\+ verified vendors/i)).toBeInTheDocument();
    expect(screen.getByText("Register your business")).toBeInTheDocument();
  });

  it("renders final CTA section", () => {
    render(<AuthLanding />);
    expect(screen.getByText(/never do laundry again/i)).toBeInTheDocument();
    expect(screen.getByText("Get started free")).toBeInTheDocument();
  });

  it("renders footer", () => {
    render(<AuthLanding />);
    expect(screen.getByText(/Bengaluru/)).toBeInTheDocument();
  });

  it("auth modal is not visible by default", () => {
    render(<AuthLanding />);
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
  });
});

describe("resetErrorMessage", () => {
  it("maps a 429 rate-limit error to a friendly message", () => {
    expect(resetErrorMessage({ status: 429, message: "Email rate limit exceeded" })).toBe(
      "Too many reset requests — try again in about an hour."
    );
  });

  it("falls back to the raw error message otherwise", () => {
    expect(resetErrorMessage({ message: "Invalid credentials" })).toBe("Invalid credentials");
  });

  it("falls back to a generic message when no message is present", () => {
    expect(resetErrorMessage(undefined)).toBe("Failed to send reset link");
  });
});
