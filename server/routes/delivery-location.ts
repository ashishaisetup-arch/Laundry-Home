import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { lat, lng, heading, speed, accuracy } = req.body;
    if (lat == null || lng == null) {
      res.status(400).json({ error: "lat and lng are required" });
      return;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("delivery_live_locations")
      .upsert(
        {
          exec_id: user.id,
          lat,
          lng,
          heading: heading || null,
          speed: speed || null,
          accuracy: accuracy || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "exec_id" }
      )
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:execId", async (req: Request, res: Response) => {
  try {
    const { execId } = req.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("delivery_live_locations")
      .select("*")
      .eq("exec_id", execId)
      .single();

    if (error && error.code !== "PGRST116") {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
