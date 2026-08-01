import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark, BrandLockup } from "@/components/shared/brand";
import { createClient } from "@/lib/supabase";

type Phase = "exchanging" | "ready" | "submitting" | "done" | "invalid";

const SESSION_CHECK_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    id = setTimeout(() => resolve("timeout"), ms);
  });
  promise.then(
    () => clearTimeout(id),
    () => clearTimeout(id)
  );
  return Promise.race([promise, timeout]);
}

export function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("exchanging");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hasServerError =
          url.searchParams.has("error") || url.searchParams.has("error_code") || url.hash.includes("error_code");
        if (hasServerError || !url.searchParams.has("code")) {
          if (!cancelled) setPhase("invalid");
          return;
        }
        const supabase = createClient();
        const result = await withTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS);
        if (cancelled) return;
        if (result === "timeout") {
          console.warn("[reset] session check timed out");
          setPhase("invalid");
          return;
        }
        setPhase(result.data.session ? "ready" : "invalid");
      } catch (e) {
        console.error("[reset] session check failed", e);
        if (!cancelled) setPhase("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPhase("submitting");
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      await supabase.auth.signOut().catch(() => {});
      setPhase("done");
    } catch (e: any) {
      setError(e.message || "Failed to update password. Please try again.");
      setPhase("ready");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-aurora">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-16 flex items-center">
          <BrandLockup size="md" />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="overflow-hidden shadow-2xl border-0">
            <div className="bg-primary-surface p-6 text-primary-foreground">
              <div className="flex items-center gap-3">
                <LogoMark size={40} />
                <div>
                  <p className="font-bold text-lg">Reset your password</p>
                  <p className="text-xs text-white/80">Laundry Home</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {phase === "exchanging" && (
                <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Verifying your reset link…
                </div>
              )}

              {phase === "invalid" && (
                <div className="space-y-4 py-4 text-center">
                  <KeyRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-semibold">Invalid or expired link</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This password reset link is invalid or has expired. Request a new one from the sign-in page.
                    </p>
                  </div>
                  <Button className="w-full h-11" onClick={() => { window.location.href = "/"; }}>
                    Back to sign in
                  </Button>
                </div>
              )}

              {phase === "ready" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Set a new password</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Choose a strong password you don&apos;t use elsewhere.</p>
                  </div>
                  <div>
                    <Label htmlFor="newPassword" className="text-xs font-semibold">New password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 dark:bg-rose-950/30 dark:text-rose-400">
                      {error}
                    </p>
                  )}
                  <Button className="w-full h-11" onClick={submit} disabled={phase === "submitting"}>
                    {phase === "submitting" ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        Update password
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {phase === "done" && (
                <div className="space-y-4 py-4 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold">Password updated</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your password has been changed. Sign in with your new password.
                    </p>
                  </div>
                  <Button className="w-full h-11" onClick={() => { window.location.href = "/"; }}>
                    Go to sign in
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
