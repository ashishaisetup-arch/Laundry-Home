import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").select("*").order("created_at", { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").insert(req.body).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").update(req.body).eq("id", req.params.id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
