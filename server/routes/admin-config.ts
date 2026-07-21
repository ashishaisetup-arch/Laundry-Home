import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

// GET /api/admin/config — return the entire system config JSON
router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_config")
      .select("config")
      .eq("id", 1)
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data?.config || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/config — update one or more config sections
router.patch("/", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();

    // Get existing config
    const { data: existing, error: getErr } = await admin
      .from("system_config")
      .select("config")
      .eq("id", 1)
      .single();

    if (getErr) { res.status(500).json({ error: getErr.message }); return; }

    const current = existing?.config || {};

    // Deep merge: only override the sections/keys provided
    const merged = { ...current };
    for (const [section, values] of Object.entries(req.body)) {
      if (typeof values === "object" && values !== null && !Array.isArray(values)) {
        merged[section] = { ...(merged[section] || {}), ...values };
      } else {
        merged[section] = values;
      }
    }

    const { data, error } = await admin
      .from("system_config")
      .update({ config: merged })
      .eq("id", 1)
      .select("config")
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data?.config || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
