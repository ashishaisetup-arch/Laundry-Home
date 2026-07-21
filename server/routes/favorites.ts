import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("favorite_vendors")
      .select("vendor_id, created_at, vendors(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { vendor_id } = req.body;
    if (!vendor_id) { res.status(400).json({ error: "vendor_id required" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("favorite_vendors")
      .insert({ user_id: user.id, vendor_id })
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:vendor_id", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { vendor_id } = req.params;
    const admin = createAdminClient();
    const { error } = await admin
      .from("favorite_vendors")
      .delete()
      .eq("user_id", user.id)
      .eq("vendor_id", vendor_id);

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
