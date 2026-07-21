import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";
import crypto from "crypto";

const router = Router();

// API Keys
router.get("/api-keys", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("api_keys").select("*").order("created_at", { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api-keys", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const keyValue = `lh_${crypto.randomBytes(24).toString("hex")}`;
    const { data, error } = await admin.from("api_keys").insert({ ...req.body, key_value: keyValue }).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/api-keys/:id", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("api_keys").delete().eq("id", req.params.id);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Webhooks
router.get("/webhooks", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("webhooks").select("*").order("created_at", { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/webhooks", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("webhooks").insert(req.body).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/webhooks/:id", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("webhooks").delete().eq("id", req.params.id);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
