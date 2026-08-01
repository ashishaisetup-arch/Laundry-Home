"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Globe, Leaf, Sparkles, Store, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BrandLockup, GradientOrb } from "@/components/shared/brand";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { FEATURES, SERVICES, type AuthMethod, type AuthStep } from "./data";
import { AuthModal } from "./auth-modal";
import { PhoneMockup } from "./phone-mockup";
import { VendorDashboardPreview } from "./vendor-dashboard-preview";

export function resetErrorMessage(e: any): string {
  if (e?.status === 429) return "Too many reset requests — try again in about an hour.";
  return e?.message || "Failed to send reset link";
}

export function AuthLanding() {
  const { signInWithOAuth, signInWithPhone, verifyOtp, signInWithEmail, signUp, resetPassword, authLoading } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [method, setMethod] = useState<AuthMethod>("otp");
  const [step, setStep] = useState<AuthStep>("method");
  const [signupName, setSignupName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const openAuth = (signUp: boolean) => {
    setIsSignUp(signUp);
    setStep("method");
    setMethod("otp");
    setPhone("");
    setEmail("");
    setPassword("");
    setOtp("");
    setSignupName("");
    setSendingOtp(false);
    setOtpSent(false);
    setOtpError(null);
    setResetSent(false);
    setResetError(null);
    setResendCooldown(0);
    setShowAuth(true);
  };

  const closeAuth = () => {
    setShowAuth(false);
    setStep("method");
    setMethod("otp");
    setIsSignUp(false);
    setPhone("");
    setEmail("");
    setPassword("");
    setOtp("");
    setSignupName("");
    setSendingOtp(false);
    setOtpSent(false);
    setOtpError(null);
    setResetSent(false);
    setResetError(null);
    setResendCooldown(0);
  };

  const sendOtp = async (phoneNumber: string) => {
    if (phoneNumber.length !== 10 || sendingOtp) return;
    setSendingOtp(true);
    setOtpError(null);
    try {
      await signInWithPhone(`+91${phoneNumber}`);
      setOtpSent(true);
      setResendCooldown(30);
      toast.success("OTP sent to " + phoneNumber);
    } catch (e: any) {
      setOtpError(e.message || "Failed to send OTP");
      toast.error(e.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  // Auto-send OTP when phone reaches 10 digits on OTP step
  useEffect(() => {
    if (step === "otp" && phone.length === 10 && !otpSent && !sendingOtp) {
      sendOtp(phone);
    }
  }, [step, phone, otpSent, sendingOtp]);

  // Resend countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      resendTimer.current = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            if (resendTimer.current) clearInterval(resendTimer.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => { if (resendTimer.current) clearInterval(resendTimer.current); };
  }, [resendCooldown > 0]);

  const handleVerifyOtp = async () => {
    if (phone.length === 10 && otp.length >= 6) {
      try {
        await verifyOtp(`+91${phone}`, otp);
      } catch (e: any) {
        toast.error(e.message || "Verification failed");
      }
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      if (isSignUp) {
        await signUp(email, password, signupName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e: any) {
      toast.error(e.message || "Authentication failed");
    }
  };

  const handleAuth = (m: AuthMethod) => {
    if (m === "google" || m === "apple" || m === "microsoft") {
      signInWithOAuth(m);
      return;
    }
    setMethod(m);
    setStep(m === "otp" ? "otp" : "password");
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    setResetError(null);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
      toast.success("Reset link sent — check your inbox");
    } catch (e: any) {
      setResetError(resetErrorMessage(e));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-aurora">
      {/* ===== Navigation ===== */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-16 flex items-center justify-between">
          <BrandLockup size="md" />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#services" className="hover:text-foreground transition-colors">Services</a>
            <a href="#vendors" className="hover:text-foreground transition-colors">For Vendors</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => openAuth(false)}>
              Sign in
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={() => openAuth(true)}
            >
              Get Started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <GradientOrb className="top-0 right-0 h-96 w-96" />
        <GradientOrb className="top-40 -left-20 h-72 w-72" />

        <div className="relative mx-auto max-w-7xl px-4 lg:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-5 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-powered laundry aggregator
              </Badge>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Your laundry,{" "}
                <span className="text-primary">
                  picked up, washed
                </span>{" "}
                and delivered.
              </h1>
              <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Book premium laundry services from verified vendors near you. Track every stage in real time — from pickup to folding to delivery — all in one beautiful app.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 h-12 px-6 text-base shadow-lift"
                  onClick={() => openAuth(true)}
                >
                  Book your first pickup
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => openAuth(true)}>
                  <Store className="mr-2 h-5 w-5" />
                  Become a vendor
                </Button>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Free pickup & delivery
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  No subscription needed
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  100% satisfaction
                </div>
              </div>
            </motion.div>

            {/* Hero visual — phone mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, rotate: 2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-8 bg-gradient-to-tr from-teal-500/20 via-emerald-500/20 to-cyan-500/20 rounded-full blur-3xl" />
              <PhoneMockup />
            </motion.div>
          </div>

        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="py-16 md:py-24 bg-background/50">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="secondary" className="mb-3">Why Laundry Home</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Everything laundry, beautifully unified
            </h2>
            <p className="mt-3 text-muted-foreground">
              One platform for customers, vendors, delivery executives and admins — powered by AI at every step.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full p-6 shadow-soft hover:shadow-lift transition-shadow group">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-surface text-primary-foreground mb-4 group-hover:scale-110 transition-transform">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Services ===== */}
      <section id="services" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="secondary" className="mb-3">Services</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Every fabric, every occasion
            </h2>
            <p className="mt-3 text-muted-foreground">
              From daily wear to designer pieces, bulk loads to delicate care — we handle it all.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-5 shadow-soft hover:shadow-lift transition-all hover:-translate-y-1 group cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl group-hover:scale-110 transition-transform">
                        {s.icon}
                      </div>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">Starting at {s.price}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== For Vendors CTA ===== */}
      <section id="vendors" className="py-16 md:py-24 bg-tonal-accent">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-3">For Laundry Vendors</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Grow your laundry business 3× faster
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Join 1,284+ verified vendors on Laundry Home. Get a complete operations dashboard, AI-powered demand forecasting, automated order routing, and instant settlements.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Free vendor onboarding & KYC verification",
                  "Real-time order management dashboard",
                  "AI demand forecasting for your area",
                  "Low 10% commission, instant settlements",
                  "Analytics, ratings & customer insights",
                ].map((point) => (
                  <div key={point} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    {point}
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                className="mt-7 bg-primary hover:bg-primary/90 h-12 px-6"
                onClick={() => openAuth(true)}
              >
                Register your business
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <VendorDashboardPreview />
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 lg:px-8">
          <Card className="relative overflow-hidden p-8 md:p-12 text-center shadow-lift">
            <GradientOrb className="top-0 right-0 h-64 w-64" />
            <GradientOrb className="bottom-0 left-0 h-64 w-64" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Ready to never do laundry again?
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Sign up in 30 seconds. Get ₹150 off your first order with code <span className="font-mono font-semibold text-primary">FRESH50</span>.
              </p>
              <Button
                size="lg"
                className="mt-6 bg-primary hover:bg-primary/90 h-12 px-8 text-base shadow-lift"
                onClick={() => openAuth(true)}
              >
                Get started free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="mt-auto border-t border-border bg-background/50">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-10">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <BrandLockup size="md" />
              <p className="mt-3 text-sm text-muted-foreground max-w-md">
                Laundry Home is India&apos;s first AI-powered laundry aggregator, connecting customers with verified laundry vendors across 12 cities.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <Badge variant="outline" className="gap-1">
                  <Leaf className="h-3 w-3 text-emerald-500" />
                  Eco-friendly
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  12 cities
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Platform</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#services" className="hover:text-foreground">Services</a></li>
                <li><a href="#vendors" className="hover:text-foreground">For Vendors</a></li>
                <li><a href="#" className="hover:text-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Company</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© 2026 Laundry Home Technologies Pvt. Ltd. All rights reserved.</p>
            <p>Made with care in Bengaluru 🇮🇳</p>
          </div>
        </div>
      </footer>

      {/* ===== Auth Modal ===== */}
      <AnimatePresence>
        {showAuth && (
          <AuthModal
            onClose={closeAuth}
            method={method}
            step={step}
            phone={phone}
            email={email}
            password={password}
            otp={otp}
            isSignUp={isSignUp}
            signupName={signupName}
            setIsSignUp={setIsSignUp}
            setSignupName={setSignupName}
            setPhone={setPhone}
            setEmail={setEmail}
            setPassword={setPassword}
            setOtp={setOtp}
            setStep={setStep}
            onAuth={handleAuth}
            onVerifyOtp={handleVerifyOtp}
            onPasswordLogin={handlePasswordLogin}
            onResetPassword={handleResetPassword}
            resetSent={resetSent}
            resetError={resetError}
            authLoading={authLoading}
            sendingOtp={sendingOtp}
            otpSent={otpSent}
            otpError={otpError}
            resendCooldown={resendCooldown}
            onResend={() => sendOtp(phone)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
