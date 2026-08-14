import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

async function canManageVendor(req: Request, vendorId: string): Promise<boolean> {
  const admin = createAdminClient();
  const user = (req as any).user as { id?: string } | undefined;
  if (!user?.id) return false;
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as any)?.role || "customer";
  if (role === "admin" || role === "superadmin") return true;
  const { data: vendor } = await admin
    .from("vendors")
    .select("id")
    .eq("id", vendorId)
    .eq("owner_id", user.id)
    .maybeSingle();
  return !!vendor;
}

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

// Upsert a price override for (vendor, service, item). Overrides the catalog's
// default price wherever the vendor is selected.
router.post("/", async (req: Request, res: Response) => {
  try {
    const { vendor_id, service_id, item_id, price } = req.body;
    if (!vendor_id || !service_id || !item_id || typeof price !== "number" || price <= 0) {
      res.status(400).json({ error: "vendor_id, service_id, item_id and a positive price are required" });
      return;
    }
    if (!(await canManageVendor(req, vendor_id))) {
      res.status(403).json({ error: "Forbidden: not your vendor" });
      return;
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vendor_service_prices")
      .upsert(
        { vendor_id, service_id, item_id, price, is_active: true },
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

// Delete an override so the catalog's default price applies again.
router.delete("/:vendorId/:serviceId/:itemId", async (req: Request, res: Response) => {
  try {
    const { vendorId, serviceId, itemId } = req.params as { vendorId: string; serviceId: string; itemId: string };
    if (!(await canManageVendor(req, vendorId))) {
      res.status(403).json({ error: "Forbidden: not your vendor" });
      return;
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("vendor_service_prices")
      .delete()
      .eq("vendor_id", vendorId)
      .eq("service_id", serviceId)
      .eq("item_id", itemId);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
