import { useEffect } from "react";
import { createClient } from "@/lib/supabase";

export function OAuthCallback() {
  useEffect(() => {
    async function completeOAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        window.location.replace("/");
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.session) {
        console.warn("[auth] OAuth code exchange failed:", error?.message);
        window.location.replace("/?authError=oauth");
        return;
      }

      let role = data.session.user.user_metadata?.role || "customer";

      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const sessionData = await res.json();
          role = sessionData.profile?.role || role;
        }
      } catch {}

      window.location.replace(`/${role}/dashboard`);
    }

    completeOAuth();
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
