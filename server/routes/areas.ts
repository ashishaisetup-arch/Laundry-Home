import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";
import { invalidateAreaCache } from "../lib/area-cache";

const router = Router();

// GET /api/areas — list active areas, optionally filtered by city
router.get("/", async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string;
    const supabase = createAdminClient();

    let query = supabase
      .from("service_areas")
      .select("*, cities!inner(name, state)")
      .eq("is_active", true);

    if (city) {
      query = query.eq("cities.name", city);
    }

    const { data, error } = await query.order("area_name");

    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/areas/cities — list all active cities
router.get("/cities", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cities")
      .select("id, name, state")
      .eq("is_active", true)
      .order("name");

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/areas/vendor/:vendorId — areas served by a specific vendor
router.get("/vendor/:vendorId", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vendor_service_areas")
      .select("service_areas(*)")
      .eq("vendor_id", req.params.vendorId);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json((data || []).map((vsa: any) => vsa.service_areas).filter(Boolean));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/areas/cities — create a new city (superadmin)
router.post("/cities", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { name, state } = req.body;
    if (!name) { res.status(400).json({ error: "City name is required" }); return; }

    const { data, error } = await supabase
      .from("cities")
      .insert({ name, state: state || "Karnataka" })
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/areas — create a new service area (superadmin)
router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { city_id, zone, area_name, pincode, lat, lng, has_pickup, has_delivery, express_available } = req.body;
    if (!city_id || !area_name) { res.status(400).json({ error: "city_id and area_name are required" }); return; }

    const { data, error } = await supabase
      .from("service_areas")
      .insert({
        city_id,
        zone: zone || null,
        area_name,
        pincode: pincode || null,
        lat: lat || null,
        lng: lng || null,
        has_pickup: has_pickup ?? true,
        has_delivery: has_delivery ?? true,
        express_available: express_available ?? false,
      })
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    invalidateAreaCache();
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/areas/cities/:id — update a city
router.put("/cities/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cities")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/areas/:id — update a service area
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("service_areas")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    invalidateAreaCache();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/areas/:id — soft-delete (deactivate) a service area
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("service_areas")
      .update({ is_active: false })
      .eq("id", req.params.id);

    if (error) { res.status(400).json({ error: error.message }); return; }
    invalidateAreaCache();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/areas/vendor — assign a vendor to service areas
router.post("/vendor", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { vendor_id, area_ids } = req.body;
    if (!vendor_id || !area_ids || !Array.isArray(area_ids)) {
      res.status(400).json({ error: "vendor_id and area_ids[] are required" });
      return;
    }

    // Replace all existing assignments
    await supabase.from("vendor_service_areas").delete().eq("vendor_id", vendor_id);

    if (area_ids.length > 0) {
      const { error } = await supabase.from("vendor_service_areas").insert(
        area_ids.map((area_id: string) => ({ vendor_id, area_id }))
      );
      if (error) { res.status(400).json({ error: error.message }); return; }
    }

    res.json({ success: true, assignedAreas: area_ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/areas/waitlist — sign up for area notification
router.post("/waitlist", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { area_name, pincode, contact, contact_type } = req.body;
    if (!area_name || !contact) {
      res.status(400).json({ error: "area_name and contact are required" });
      return;
    }

    const { data, error } = await supabase
      .from("area_waitlist")
      .insert({
        area_name,
        pincode: pincode || null,
        contact,
        contact_type: contact_type || "email",
      })
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/areas/waitlist — view waitlist (admin/superadmin only)
router.get("/waitlist", async (req: Request, res: Response) => {
  try {
    const { createServerClientWithCookies } = await import("../supabase");
    const cookieClient = createServerClientWithCookies((name: string) => req.cookies?.[name]);
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
    if (!["admin", "superadmin"].includes((profile as any)?.role || "customer")) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const { data, error } = await admin
      .from("area_waitlist")
      .select("*, cities(name)")
      .order("created_at", { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
