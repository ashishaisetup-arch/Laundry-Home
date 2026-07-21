import { Request, Response, NextFunction } from "express";
import { createServerClientWithCookies, createAdminClient } from "../supabase";

const ROLE_ROUTES: Record<string, string[]> = {
  "/api/admin": ["admin", "superadmin"],
  "/api/vendor": ["vendor", "admin", "superadmin"],
  "/api/delivery": ["delivery", "admin", "superadmin"],
};

const PUBLIC_ROUTES = [
  "/api/auth/", "/api/services", "/api/coupons", "/api/vendors",
  "/api/slots", "/api/seed", "/api/subscriptions/plans", "/api/geocode",
];

const PROTECTED_PREFIXES = [
  "/api/orders", "/api/addresses", "/api/reviews", "/api/delivery-tasks",
  "/api/notifications", "/api/wallet",
];

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const pathname = req.path;

  const matchedRoleRoute = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  );

  if (matchedRoleRoute) {
    try {
      const cookieGetter = (name: string) => req.cookies?.[name];
      const supabase = createServerClientWithCookies(cookieGetter);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
      (req as any).user = user;

      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const userRole = (profile as any)?.role || "customer";
      if (!matchedRoleRoute[1].includes(userRole)) {
        res.status(403).json({ error: "Forbidden: insufficient role" });
        return;
      }
      next();
      return;
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!pathname.startsWith("/api/")) { next(); return; }

  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) { next(); return; }

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!needsAuth) { next(); return; }

  try {
    const cookieGetter = (name: string) => req.cookies?.[name];
    const supabase = createServerClientWithCookies(cookieGetter);
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    if (getUserError) {
      console.error("getUser error:", getUserError.message);
    }
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
