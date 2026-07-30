import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

router.get("/:vendorId", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vendor_service_prices")
      .select("*, services(name, unit), service_items(item_name, unit)")
      .eq("vendor_id", req.params.vendorId)
      .eq("is_active", true);
    if (error) { res.status(500).json({ error: error.message }); return; }

    const result = (data || []).map((p: any) => ({
      id: p.id,
      vendorId: p.vendor_id,
      serviceId: p.service_id,
      itemId: p.item_id,
      price: p.price,
      isActive: p.is_active,
      service: p.services ? { name: p.services.name, unit: p.services.unit } : undefined,
      item: p.service_items ? { itemName: p.service_items.item_name, unit: p.service_items.unit } : undefined,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { vendor_id, service_id, item_id, price } = req.body;
    const { data, error } = await supabase
      .from("vendor_service_prices")
      .upsert(
        { vendor_id, service_id, item_id, price },
        { onConflict: "vendor_id,service_id,item_id", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
