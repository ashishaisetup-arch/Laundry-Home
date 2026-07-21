import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const admin = createAdminClient();
    const { data, error } = await admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
