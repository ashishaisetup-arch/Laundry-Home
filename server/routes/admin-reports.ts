import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data: reports, error: rErr } = await admin.from("reports").select("*").order("created_at", { ascending: false });
    if (rErr) { res.status(500).json({ error: rErr.message }); return; }
    const { data: scheduled, error: sErr } = await admin.from("scheduled_reports").select("*, report_id(*)").order("created_at", { ascending: false });
    if (sErr) { res.status(500).json({ error: sErr.message }); return; }
    res.json({ reports: reports || [], scheduled: scheduled || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("reports").insert(req.body).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/scheduled", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("scheduled_reports").insert(req.body).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/scheduled/:id", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("scheduled_reports").delete().eq("id", req.params.id);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
