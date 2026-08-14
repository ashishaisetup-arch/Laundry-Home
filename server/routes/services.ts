import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("services")
      .select("*, service_items(item_name, default_price, unit)");
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json((data || []).map(serializeService));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Compatibility adapter for legacy consumers of GET /api/services. The catalog
// migration (00022) moved prices into service_items and dropped key/base_price/
// pricing_type; this derives a legacy-shaped response from the modern schema:
//  - key          -> stable slug (backfilled in migration 00048) else id
//  - pricingType  -> derived strictly from unit (kg/per_kg, item/per_piece, flat)
//  - basePrice    -> min item default_price, ignoring null/zero placeholders
function serializeService(s: any) {
  const { service_items: items, pricing_type, bag_price, is_active, ...rest } = s;
  const unit = s.unit || "item";
  const pricingType = unit === "kg" ? "per_kg" : unit === "flat" ? "flat" : "per_piece";
  const prices = (items || [])
    .map((i: any) => i.default_price)
    .filter((p: any) => typeof p === "number" && p > 0);
  const basePrice = prices.length > 0 ? Math.min(...prices) : 0;
  return {
    ...rest,
    key: s.slug ?? s.id,
    unit,
    pricingType,
    basePrice,
    bagPrice: bag_price ?? undefined,
    isActive: is_active,
  };
}

router.get("/catalog", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const includeInactive = req.query.includeInactive === "true";

    let query = supabase
      .from("service_categories")
      .select("*, services(*, service_items(*))")
      .order("display_order")
      .order("display_order", { foreignTable: "services" });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    const result = (data || []).map((cat: any) => {
      const services = (cat.services || [])
        .filter((s: any) => includeInactive || s.is_active !== false)
        .map((s: any) => {
          const { service_items: _, pricing_type, bag_price, is_active, ...serviceRest } = s;
          return {
            ...serviceRest,
            categoryId: s.category_id,
            imageUrl: s.image_url,
            displayOrder: s.display_order,
            pricingType: pricing_type || "ITEM",
            bagPrice: bag_price ?? undefined,
            isActive: is_active,
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
      return { ...rest, displayOrder: cat.display_order, isActive: cat.is_active, services };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST — create service
router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { categoryId, name, description, unit, imageUrl, taxable, displayOrder, isActive, pricingType, bagPrice } = req.body;
    const { data, error } = await supabase
      .from("services")
      .insert({
        category_id: categoryId,
        name,
        description,
        unit,
        image_url: imageUrl || null,
        taxable: taxable ?? true,
        display_order: displayOrder ?? 0,
        is_active: isActive ?? true,
        pricing_type: pricingType || "ITEM",
        bag_price: bagPrice ?? null,
      })
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update service
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { categoryId, name, description, unit, imageUrl, taxable, displayOrder, isActive, pricingType, bagPrice } = req.body;
    const { data, error } = await supabase
      .from("services")
      .update({
        category_id: categoryId,
        name,
        description,
        unit,
        image_url: imageUrl || null,
        taxable,
        display_order: displayOrder ?? 0,
        is_active: isActive,
        pricing_type: pricingType || "ITEM",
        bag_price: bagPrice ?? null,
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

// DELETE /:id — delete service
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", req.params.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
