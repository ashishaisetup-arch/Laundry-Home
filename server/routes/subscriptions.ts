import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("subscription_plans").select("*").order("price");
    if (error) { res.status(500).json({ error: error.message }); return; }
    const plans = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      tagline: p.description || "",
      monthlyPrice: p.interval === "monthly" ? p.price : Math.round(p.price / 12),
      yearlyPrice: p.interval === "yearly" ? p.price : p.price * 12,
      features: p.services_included || [],
      popular: p.savings_pct > 15,
      color: p.name === "Premium" ? "from-violet-500 to-purple-600" : p.name === "Ultimate" ? "from-amber-500 to-orange-600" : "from-teal-500 to-cyan-600",
    }));
    res.json(plans);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin.from("user_subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin.from("user_subscriptions").insert({ ...req.body, user_id: user.id, status: "active" }).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { error } = await admin.from("user_subscriptions").update({ status: "cancelled" }).eq("id", req.params.id).eq("user_id", user.id);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
