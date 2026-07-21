import { Request, Response, NextFunction } from "express";
import { createServerClientWithCookies } from "../supabase";

const protectedRoutes = new Set([
  "/api/orders", "/api/addresses", "/api/reviews", "/api/delivery-tasks",
  "/api/notifications", "/api/wallet",
]);

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const pathname = req.path;

  const needsProtection =
    (Array.from(protectedRoutes).some((p) => pathname.startsWith(p))) ||
    (pathname.startsWith("/api/") &&
      !pathname.startsWith("/api/auth/") &&
      !pathname.startsWith("/api/services") &&
      !pathname.startsWith("/api/coupons") &&
      !pathname.startsWith("/api/vendors") &&
      !pathname.startsWith("/api/slots") &&
      !pathname.startsWith("/api/seed") &&
      !pathname.startsWith("/api/admin") &&
      !pathname.startsWith("/api/vendor") &&
      !pathname.startsWith("/api/subscriptions/plans") &&
      !pathname.startsWith("/api/geocode"));

  if (!needsProtection) return next();

  try {
    const cookieGetter = (name: string) => {
      const val = req.cookies?.[name];
      if (!val && name !== "sb-zuayfacnytoougyvvvcl-auth-token" && !name.startsWith("sb-zuayfacnytoougyvvvcl-auth-token.")) {
        // empty
      }
      return val;
    };
    const supabase = createServerClientWithCookies(cookieGetter);
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    if (getUserError) {
      console.error("getUser error:", getUserError.message);
    }
    if (!user) {
      console.log("Auth fail:", {
        cookies: req.cookies ? Object.keys(req.cookies) : "no cookies",
        authCookie: req.cookies?.["sb-zuayfacnytoougyvvvcl-auth-token"] ? "exists" : "missing",
      });
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
