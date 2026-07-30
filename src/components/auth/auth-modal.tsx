import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, ArrowRight, Chrome, Apple, Building2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Separator } from "@/components/ui/separator";
import { LogoMark } from "@/components/shared/brand";
import { cn } from "@/lib/utils";
import type { AuthMethod, AuthStep } from "./data";

export function AuthModal({
  onClose,
  method,
  step,
  phone,
  email,
  password,
  otp,
  isSignUp,
  signupName,
  setIsSignUp,
  setSignupName,
  setPhone,
  setEmail,
  setPassword,
  setOtp,
  setStep,
  onAuth,
  onVerifyOtp,
  onPasswordLogin,
  authLoading,
  sendingOtp,
  otpSent,
  otpError,
  resendCooldown,
  onResend,
}: {
  onClose: () => void;
  method: AuthMethod;
  step: AuthStep;
  phone: string;
  email: string;
  password: string;
  otp: string;
  isSignUp: boolean;
  signupName: string;
  setIsSignUp: (v: boolean) => void;
  setSignupName: (v: string) => void;
  setPhone: (s: string) => void;
  setEmail: (s: string) => void;
  setPassword: (s: string) => void;
  setOtp: (s: string) => void;
  setStep: (s: AuthStep) => void;
  onAuth: (m: AuthMethod) => void;
  onVerifyOtp: () => void;
  onPasswordLogin: () => void;
  authLoading: boolean;
  sendingOtp: boolean;
  otpSent: boolean;
  otpError: string | null;
  resendCooldown: number;
  onResend: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="pointer-events-auto w-full max-w-md"
        >
          <Card className="overflow-hidden shadow-2xl border-0">
            {/* Header */}
            <div className="relative bg-primary-surface p-6 text-primary-foreground">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                ×
              </button>
              <div className="flex items-center gap-3">
                <LogoMark size={40} />
                <div>
                  <p className="font-bold text-lg">Welcome to Laundry Home</p>
                  <p className="text-xs text-white/80">{isSignUp ? "Create your account" : "Sign in to continue"}</p>
                </div>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto scroll-fancy">

              <AnimatePresence mode="wait">
                {step === "method" && (
                  <motion.div
                    key="method"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    {/* Mobile OTP */}
                    <button
                      onClick={() => onAuth("otp")}
                      className="flex items-center gap-3 w-full rounded-xl border border-border bg-card p-3.5 hover:bg-muted hover:border-primary/30 transition-all group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold">Continue with Mobile OTP</p>
                        <p className="text-[11px] text-muted-foreground">We&apos;ll text you a code</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* OAuth providers */}
                    <div className="grid grid-cols-3 gap-2">
                      <OAuthButton icon={Chrome} label="Google" color="text-rose-500" onClick={() => onAuth("google")} />
                      <OAuthButton icon={Apple} label="Apple" color="text-foreground" onClick={() => onAuth("apple")} />
                      <OAuthButton icon={Building2} label="Microsoft" color="text-sky-600" onClick={() => onAuth("microsoft")} />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-4">
                      <Separator className="flex-1" />
                      <span className="text-[11px] text-muted-foreground">or</span>
                      <Separator className="flex-1" />
                    </div>

                    {/* Email */}
                    <button
                      onClick={() => onAuth("email")}
                      className="flex items-center gap-3 w-full rounded-xl border border-border bg-card p-3.5 hover:bg-muted hover:border-primary/30 transition-all group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold">Continue with Email</p>
                        <p className="text-[11px] text-muted-foreground">Use email & password</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>

                    <p className="text-[10px] text-muted-foreground text-center mt-4 leading-relaxed">
                      By continuing you agree to our{" "}
                      <a href="#" className="underline">Terms</a> &{" "}
                      <a href="#" className="underline">Privacy Policy</a>. Protected by OAuth 2.0, OpenID Connect & JWT.
                    </p>
                  </motion.div>
                )}

                {step === "otp" && (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <button
                      onClick={() => setStep("method")}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      ← Back to all options
                    </button>
                    <div>
                      <Label htmlFor="phone" className="text-xs font-semibold">Mobile number</Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex h-10 items-center rounded-lg border border-input bg-muted px-3 text-sm font-medium">
                          +91
                        </div>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {phone.length === 10 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        {sendingOtp ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            Sending OTP...
                          </div>
                        ) : otpError ? (
                          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 p-3 text-sm text-rose-600 dark:text-rose-400">
                            {otpError}
                          </div>
                        ) : otpSent ? (
                          <>
                            <Label className="text-xs font-semibold">Enter OTP</Label>
                            <p className="text-[11px] text-muted-foreground mb-2">Sent to +91 {phone} · use any 6 digits</p>
                            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground text-center py-2">
                            Click below to receive OTP
                          </div>
                        )}
                      </motion.div>
                    )}

                    <Button
                      className="w-full bg-primary hover:bg-primary/90 h-11"
                      disabled={otp.length < 6 || authLoading || !otpSent}
                      onClick={onVerifyOtp}
                    >
                      {authLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : !otpSent ? (
                        "Enter phone number first"
                      ) : otp.length < 6 ? (
                        "Enter OTP to continue"
                      ) : isSignUp ? (
                        "Verify & Create account"
                      ) : (
                        "Verify & Sign in"
                      )}
                      {!authLoading && otpSent && otp.length >= 6 && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>

                    {otpSent && (
                      <p className="text-[11px] text-center text-muted-foreground">
                        Didn&apos;t receive code?{" "}
                        {resendCooldown > 0 ? (
                          <span className="text-muted-foreground">Resend in {resendCooldown}s</span>
                        ) : (
                          <button className="text-primary hover:underline" onClick={onResend}>
                            Resend
                          </button>
                        )}
                      </p>
                    )}
                  </motion.div>
                )}

                {step === "password" && (
                  <motion.div
                    key="password"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <button
                      onClick={() => setStep("method")}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      ← Back to all options
                    </button>

                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => setIsSignUp(false)} className={cn("text-xs font-medium px-3 py-1 rounded-full transition-colors", !isSignUp ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Sign in</button>
                      <button type="button" onClick={() => setIsSignUp(true)} className={cn("text-xs font-medium px-3 py-1 rounded-full transition-colors", isSignUp ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Sign up</button>
                    </div>

                    {isSignUp && (
                      <div>
                        <Label htmlFor="signupName" className="text-xs font-semibold">Full name</Label>
                        <Input id="signupName" placeholder="Your name" value={signupName} onChange={(e) => setSignupName(e.target.value)} className="mt-1.5" />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="rounded" />
                        <span className="text-muted-foreground">Remember me</span>
                      </label>
                      <a href="#" className="text-primary hover:underline">Forgot password?</a>
                    </div>
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 h-11"
                      onClick={onPasswordLogin}
                      disabled={authLoading}
                    >
                      {authLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : isSignUp ? (
                        "Create account"
                      ) : (
                        "Sign in"
                      )}
                      {!authLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </Card>
        </motion.div>
      </div>
    </>
  );
}

function OAuthButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 hover:bg-muted hover:border-primary/30 transition-all"
    >
      <Icon className={cn("h-5 w-5", color)} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
