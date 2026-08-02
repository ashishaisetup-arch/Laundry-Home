import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

const CUSTOMER_FEATURE_DEFAULTS: Record<string, boolean> = {
  enableSubscriptions: true,
  enableCoupons: true,
  enableWallet: true,
  enableLoyalty: true,
  enableFavorites: true,
  enableReviews: true,
  enableDiscover: true,
  enableOrders: true,
};

// GET /api/config/customer — customer-visible feature toggles (admin-controlled)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_config")
      .select("config")
      .eq("id", 1)
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    const customer = (data?.config as any)?.customer || {};
    const merged: Record<string, boolean> = {};
    for (const [key, enabled] of Object.entries(CUSTOMER_FEATURE_DEFAULTS)) {
      merged[key] = typeof customer[key] === "boolean" ? customer[key] : enabled;
    }
    res.json(merged);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;