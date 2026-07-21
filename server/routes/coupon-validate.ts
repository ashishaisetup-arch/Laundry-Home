import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) { res.status(400).json({ error: "Coupon code required" }); return; }

    const admin = createAdminClient();
    const { data: coupon, error } = await admin.from("coupons").select("*").eq("code", code.toUpperCase()).single();
    if (error || !coupon) { res.status(404).json({ error: "Invalid coupon code" }); return; }

    if (!coupon.active) { res.status(400).json({ error: "Coupon expired" }); return; }
    if (subtotal < coupon.min_order) { res.status(400).json({ error: `Min order ₹${coupon.min_order} required` }); return; }
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) { res.status(400).json({ error: "Coupon usage limit reached" }); return; }

    let discount = 0;
    if (coupon.type === "percentage") {
      discount = Math.min(subtotal * coupon.discount_pct / 100, coupon.max_discount);
    } else {
      discount = Math.min(coupon.max_discount, subtotal);
    }

    res.json({ valid: true, discount, coupon });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
