import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    const orderId = req.query.orderId as string;
    let userId = req.query.userId as string;

    if (!userId && !vendorId && !orderId) {
      const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

    const admin = createAdminClient();
    let query = admin.from("reviews").select("*").order("created_at", { ascending: false });

    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (orderId) query = query.eq("order_id", orderId);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin.from("reviews").insert({ ...req.body, user_id: user.id }).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
