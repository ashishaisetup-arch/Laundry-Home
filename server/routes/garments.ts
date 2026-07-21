import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    const admin = createAdminClient();
    let query = admin.from("garment_inventory").select("*, orders!inner(vendor_id)");
    if (vendorId) query = query.eq("orders.vendor_id", vendorId);
    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("garment_inventory").insert(req.body).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("garment_inventory").update(req.body).eq("id", req.params.id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("garment_inventory").delete().eq("id", req.params.id);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
