"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Leaf,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  Sparkles,
  Store,
  Truck,
  Lock,
  ChevronRight,
  Apple,
  Chrome,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BrandLockup, LogoMark, GradientOrb } from "@/components/shared/brand";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FEATURES = [
  { icon: MapPin, title: "Verified vendors near you", desc: "AI-matched to your location, ratings and budget." },
  { icon: Truck, title: "Doorstep pickup & delivery", desc: "Live 18-stage tracking from pickup to delivery." },
  { icon: Sparkles, title: "AI-powered intelligence", desc: "Smart vendor assignment, delay prediction, demand forecasting." },
  { icon: Shield, title: "Bank-grade security", desc: "OAuth 2.0, OpenID Connect, JWT with MFA." },
];

type AuthMethod = "otp" | "google" | "apple" | "microsoft" | "email";
type AuthStep = "method" | "otp" | "password";

const SERVICES = [
  { name: "Wash & Fold", price: "₹60/kg", icon: "🫧" },
  { name: "Wash & Iron", price: "₹15/piece", icon: "👔" },
  { name: "Dry Cleaning", price: "₹120/piece", icon: "✨" },
  { name: "Premium Care", price: "₹250/piece", icon: "👑" },
  { name: "Shoe Cleaning", price: "₹149/piece", icon: "👟" },
  { name: "Bulk Laundry", price: "₹45/kg", icon: "📦" },
];

export function AuthLanding() {
  const { signInWithOAuth, verifyOtp, signInWithEmail, signUp, authLoading } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [method, setMethod] = useState<AuthMethod>("otp");
  const [step, setStep] = useState<AuthStep>("method");
  const [signupName, setSignupName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const handleVerifyOtp = async () => {
    if (phone.length === 10 && otp.length >= 6) {
      try {
        await verifyOtp(phone, otp);
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
            <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => { setIsSignUp(false); setShowAuth(true); }}>
              Sign in
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={() => { setIsSignUp(true); setShowAuth(true); }}
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
                  onClick={() => { setIsSignUp(true); setShowAuth(true); }}
                >
                  Book your first pickup
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => { setIsSignUp(true); setShowAuth(true); }}>
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
                onClick={() => { setIsSignUp(true); setShowAuth(true); }}
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
                onClick={() => { setIsSignUp(true); setShowAuth(true); }}
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
            onClose={() => {
              setShowAuth(false);
              setStep("method");
              setMethod("otp");
              setIsSignUp(false);
            }}
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
            authLoading={authLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Auth Modal
// ============================================================================
function AuthModal({
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
                      </motion.div>
                    )}

                    <Button
                      className="w-full bg-primary hover:bg-primary/90 h-11"
                      disabled={otp.length < 6 || authLoading}
                      onClick={onVerifyOtp}
                    >
                      {authLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : otp.length < 6 ? (
                        "Enter OTP to continue"
                      ) : isSignUp ? (
                        "Verify & Create account"
                      ) : (
                        "Verify & Sign in"
                      )}
                      {!authLoading && otp.length >= 6 && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>

                    <p className="text-[11px] text-center text-muted-foreground">
                      Didn&apos;t receive code? <button className="text-primary hover:underline">Resend in 0:30</button>
                    </p>
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

// ============================================================================
// Phone Mockup (hero visual)
// ============================================================================
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[300px]">
      <div className="relative rounded-[2.5rem] border-8 border-foreground/90 bg-foreground/90 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-background">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2 text-[10px] font-semibold bg-background">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span>●●●</span>
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>

          {/* App content */}
          <div className="p-4 space-y-3 bg-aurora">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Good morning</p>
                <p className="text-sm font-bold">You 👋</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-surface text-primary-foreground text-[10px] font-bold">
                LH
              </div>
            </div>

            {/* Active order card */}
            <div className="rounded-2xl bg-white dark:bg-card p-3 shadow-soft">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-primary">LIVE ORDER</span>
                <span className="text-[10px] text-muted-foreground">LH-0000</span>
              </div>
              <p className="text-xs font-semibold mb-2">Wash & Fold + Iron</p>
              <div className="space-y-1.5">
                {["○ Pickup", "○ Sorting", "○ Washing", "○ Ironing", "○ Delivery"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className={s.startsWith("✓") ? "text-emerald-500" : s.startsWith("●") ? "text-primary font-bold" : "text-muted-foreground"}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: ["10%", "55%", "55%"] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5">ETA: Today, 8:00 PM</p>
            </div>

            {/* Service chips */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { e: "🫧", n: "Wash & Fold", p: "₹60/kg" },
                { e: "👔", n: "Iron", p: "₹15/pc" },
                { e: "✨", n: "Dry Clean", p: "₹120/pc" },
              ].map((s) => (
                <div key={s.n} className="rounded-xl bg-white dark:bg-card p-2 text-center shadow-soft">
                  <div className="text-lg">{s.e}</div>
                  <p className="text-[9px] font-semibold mt-0.5">{s.n}</p>
                  <p className="text-[8px] text-muted-foreground">{s.p}</p>
                </div>
              ))}
            </div>

            {/* Book button */}
            <button className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-semibold py-2.5">
              Book new pickup →
            </button>
          </div>
        </div>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-24 bg-foreground/90 rounded-b-2xl" />
      </div>

      {/* Floating badges */}
      <motion.div
        className="absolute -left-12 top-20 rounded-xl bg-white dark:bg-card p-2.5 shadow-lift"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-emerald-500" />
          <div>
            <p className="text-[9px] font-semibold">Picked up!</p>
            <p className="text-[8px] text-muted-foreground">2 mins ago</p>
          </div>
        </div>
      </motion.div>
      <motion.div
        className="absolute -right-8 bottom-32 rounded-xl bg-white dark:bg-card p-2.5 shadow-lift"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <div>
            <p className="text-[9px] font-semibold">AI suggests</p>
            <p className="text-[8px] text-muted-foreground">Best vendor · 4.8★</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Vendor Dashboard Preview
// ============================================================================
function VendorDashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      <Card className="p-5 shadow-lift">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-bold">
              YC
            </div>
            <div>
              <p className="text-sm font-semibold">Your Company Name</p>
              <p className="text-[10px] text-muted-foreground">Vendor dashboard</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">● Live</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground">Today&apos;s Revenue</p>
            <p className="text-lg font-bold">₹0</p>
            <p className="text-[10px] text-emerald-600">Start receiving orders</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground">Orders Today</p>
            <p className="text-lg font-bold">0</p>
            <p className="text-[10px] text-emerald-600">0 pending</p>
          </div>
        </div>

        {/* Mini chart */}
        <div className="rounded-lg bg-muted/30 p-3 mb-3">
          <p className="text-[10px] text-muted-foreground mb-2">Weekly revenue</p>
          <div className="flex items-end gap-1.5 h-16">
            {[5, 10, 8, 15, 20, 12, 18].map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-teal-500 to-cyan-400"
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-muted-foreground">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground text-center py-2">No active orders yet</p>
        </div>
      </Card>
    </motion.div>
  );
}
