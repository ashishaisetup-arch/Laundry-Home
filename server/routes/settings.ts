import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

const DEFAULTS = { pushEnabled: true, orderUpdates: true, promotions: false };

router.get("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_settings")
      .select("push_enabled, order_updates, promotions")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      notifications: {
        pushEnabled: data?.push_enabled ?? DEFAULTS.pushEnabled,
        orderUpdates: data?.order_updates ?? DEFAULTS.orderUpdates,
        promotions: data?.promotions ?? DEFAULTS.promotions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/notifications", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { pushEnabled, orderUpdates, promotions } = req.body;
    const updates: Record<string, boolean | string> = { updated_at: new Date().toISOString() };
    if (typeof pushEnabled === "boolean") updates.push_enabled = pushEnabled;
    if (typeof orderUpdates === "boolean") updates.order_updates = orderUpdates;
    if (typeof promotions === "boolean") updates.promotions = promotions;

    const admin = createAdminClient();
    const { error } = await admin
      .from("user_settings")
      .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" });

    if (error) { res.status(400).json({ error: error.message }); return; }

    const { data } = await admin
      .from("user_settings")
      .select("push_enabled, order_updates, promotions")
      .eq("user_id", user.id)
      .single();

    res.json({
      notifications: {
        pushEnabled: data?.push_enabled ?? DEFAULTS.pushEnabled,
        orderUpdates: data?.order_updates ?? DEFAULTS.orderUpdates,
        promotions: data?.promotions ?? DEFAULTS.promotions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/password", async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }

    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" }),
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      res.status(401).json({ error: "Unauthorized: email account required to change password" });
      return;
    }

    // Verify current password by attempting a fresh sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
