import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthModal } from "../auth-modal";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("@/components/shared/brand", () => ({
  LogoMark: () => <div data-testid="logo-mark" />,
}));

const baseProps = {
  onClose: vi.fn(),
  method: "email" as const,
  step: "password" as const,
  phone: "",
  email: "",
  password: "",
  otp: "",
  isSignUp: false,
  signupName: "",
  setIsSignUp: vi.fn(),
  setSignupName: vi.fn(),
  setPhone: vi.fn(),
  setEmail: vi.fn(),
  setPassword: vi.fn(),
  setOtp: vi.fn(),
  setStep: vi.fn(),
  onAuth: vi.fn(),
  onVerifyOtp: vi.fn(),
  onPasswordLogin: vi.fn(),
  onResetPassword: vi.fn(),
  resetSent: false,
  resetError: null,
  authLoading: false,
  sendingOtp: false,
  otpSent: false,
  otpError: null,
  resendCooldown: 0,
  onResend: vi.fn(),
};

describe("AuthModal", () => {
  it("submits the password form", () => {
    const onPasswordLogin = vi.fn();
    const { container } = render(<AuthModal {...baseProps} onPasswordLogin={onPasswordLogin} />);
    const submit = container.querySelector('button[type="submit"]');
    expect(submit).not.toBeNull();
    fireEvent.click(submit!);
    expect(onPasswordLogin).toHaveBeenCalledTimes(1);
  });

  it("passes the visible form values on submit (even if React state is stale from autofill)", () => {
    const onPasswordLogin = vi.fn();
    render(<AuthModal {...baseProps} onPasswordLogin={onPasswordLogin} />);

    const setInputValue = (el: HTMLInputElement, value: string) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      nativeSetter.call(el, value);
    };
    const emailInput = screen.getByLabelText("Email address") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    setInputValue(emailInput, "ananya@laundryhome.com");
    setInputValue(passwordInput, "ananya123456");

    fireEvent.submit(emailInput.closest("form")!);
    expect(onPasswordLogin).toHaveBeenCalledTimes(1);
    const form = onPasswordLogin.mock.calls[0][0] as HTMLFormElement;
    const fd = new FormData(form);
    expect(fd.get("email")).toBe("ananya@laundryhome.com");
    expect(fd.get("password")).toBe("ananya123456");
  });

  it("marks the email and password fields for autofill", () => {
    render(<AuthModal {...baseProps} />);
    expect(screen.getByLabelText("Email address")).toHaveAttribute("autoComplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autoComplete", "current-password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("name", "password");
  });

  it("uses new-password autocomplete in signup mode", () => {
    render(<AuthModal {...baseProps} isSignUp={true} />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("autoComplete", "new-password");
  });
});
