import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.post("/approve", async (req: Request, res: Response) => {
  try {
    const { vendor_id, owner_id } = req.body;
    if (!vendor_id) { res.status(400).json({ error: "vendor_id is required" }); return; }

    const admin = createAdminClient();
    const { data: vendor, error: fetchErr } = await admin.from("vendors").select("*").eq("id", vendor_id).single();
    if (fetchErr || !vendor) { res.status(404).json({ error: "Vendor not found" }); return; }

    const { data, error } = await admin.from("vendors").update({
      kyc_status: "approved",
      verified: true,
      is_open: true,
    }).eq("id", vendor_id).select().single();

    if (error) { res.status(400).json({ error: error.message }); return; }

    // If owner_id provided, update their role to vendor
    if (owner_id) {
      await admin.from("user_profiles").update({ role: "vendor" }).eq("id", owner_id);
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reject", async (req: Request, res: Response) => {
  try {
    const { vendor_id, reason } = req.body;
    if (!vendor_id) { res.status(400).json({ error: "vendor_id is required" }); return; }

    const admin = createAdminClient();
    const { data, error } = await admin.from("vendors").update({
      kyc_status: "rejected",
      verified: false,
      rejection_reason: reason || null,
    }).eq("id", vendor_id).select().single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/pending", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("vendors")
      .select("*, owner:owner_id(id, name, email, phone)")
      .in("kyc_status", ["pending", "not_submitted"])
      .order("created_at", { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
