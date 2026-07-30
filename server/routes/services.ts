import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("services").select("*");
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/catalog", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const includeInactive = req.query.includeInactive === "true";

    let query = supabase
      .from("service_categories")
      .select("*, services(*, service_items(*))")
      .order("display_order");

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    const result = (data || []).map((cat: any) => {
      const services = (cat.services || [])
        .filter((s: any) => includeInactive || s.is_active !== false)
        .map((s: any) => {
          const { service_items: _, ...serviceRest } = s;
          return {
            ...serviceRest,
            items: (s.service_items || [])
              .filter((i: any) => includeInactive || i.is_active !== false)
              .map((i: any) => ({
                id: i.id,
                serviceId: i.service_id,
                itemName: i.item_name,
                itemCategory: i.item_category,
                unit: i.unit,
                defaultPrice: i.default_price,
                estimatedTime: i.estimated_time,
                estimatedWeightKg: i.estimated_weight_kg,
                itemMasterId: i.item_master_id,
                isActive: i.is_active,
              })),
          };
        });
      const { services: _, service_items: __, ...rest } = cat;
      return { ...rest, services };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
