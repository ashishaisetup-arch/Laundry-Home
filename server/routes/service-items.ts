import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("service_items")
      .select("*, services(name, unit)");

    if (req.query.include_inactive !== "true") {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query.order("item_name");
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Convert snake_case to camelCase
    const result = (data || []).map((i: any) => ({
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
      service: i.services ? {
        id: i.services.id,
        name: i.services.name,
        unit: i.services.unit,
      } : undefined,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — single item
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("service_items")
      .select("*, services(name, unit)")
      .eq("id", req.params.id)
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data) { res.status(404).json({ error: "Not found" }); return; }
    const i = data as any;
    res.json({
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
      service: i.services ? { id: i.services.id, name: i.services.name, unit: i.services.unit } : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST — create item
router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { serviceId, itemName, itemCategory, unit, defaultPrice, estimatedTime, estimatedWeightKg, isActive } = req.body;

    const weightKg = estimatedWeightKg ? parseFloat(estimatedWeightKg) : null;

    // First upsert into item_master to get the canonical ID
    const { data: masterItem, error: masterErr } = await supabase
      .from("item_master")
      .upsert({
        category: itemCategory,
        item_name: itemName,
        estimated_weight_kg: weightKg,
      }, { onConflict: "item_name,category", ignoreDuplicates: false })
      .select("id")
      .single();
    if (masterErr) { res.status(500).json({ error: masterErr.message }); return; }

    const { data, error } = await supabase
      .from("service_items")
      .upsert({
        service_id: serviceId,
        item_name: itemName,
        item_category: itemCategory,
        unit,
        default_price: defaultPrice,
        estimated_time: estimatedTime,
        estimated_weight_kg: weightKg,
        item_master_id: masterItem.id,
        is_active: isActive ?? true,
      }, { onConflict: "service_id,item_name,item_category", ignoreDuplicates: false })
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update item
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { serviceId, itemName, itemCategory, unit, defaultPrice, estimatedTime, estimatedWeightKg, isActive } = req.body;

    const weightKg = estimatedWeightKg ? parseFloat(estimatedWeightKg) : null;

    // First upsert into item_master to get the canonical ID
    const { data: masterItem, error: masterErr } = await supabase
      .from("item_master")
      .upsert({
        category: itemCategory,
        item_name: itemName,
        estimated_weight_kg: weightKg,
      }, { onConflict: "item_name,category", ignoreDuplicates: false })
      .select("id")
      .single();
    if (masterErr) { res.status(500).json({ error: masterErr.message }); return; }

    const { data, error } = await supabase
      .from("service_items")
      .update({
        service_id: serviceId,
        item_name: itemName,
        item_category: itemCategory,
        unit,
        default_price: defaultPrice,
        estimated_time: estimatedTime,
        estimated_weight_kg: weightKg,
        item_master_id: masterItem.id,
        is_active: isActive,
      })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — delete item
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("service_items")
      .delete()
      .eq("id", req.params.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
