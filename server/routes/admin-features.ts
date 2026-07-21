import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("feature_flags").select("*").order("key");
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:key", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("feature_flags").update({ enabled: req.body.enabled, updated_at: new Date().toISOString() }).eq("key", req.params.key).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
