import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const KNOWN_AREAS: Record<string, { lat: number; lng: number }> = {
  "Indiranagar":     { lat: 12.9719, lng: 77.6413 },
  "Koramangala":     { lat: 12.9352, lng: 77.6245 },
  "HSR Layout":      { lat: 12.9116, lng: 77.6389 },
  "Jayanagar":       { lat: 12.9250, lng: 77.5938 },
  "BTM Layout":      { lat: 12.9166, lng: 77.6101 },
  "Whitefield":      { lat: 12.9698, lng: 77.7500 },
  "MG Road":         { lat: 12.9750, lng: 77.6067 },
  "Marathahalli":    { lat: 12.9591, lng: 77.6974 },
  "Electronic City": { lat: 12.8399, lng: 77.6770 },
  "JP Nagar":        { lat: 12.9063, lng: 77.5857 },
  "Horamavu":        { lat: 13.0208, lng: 77.6583 },
  "Hebbal":          { lat: 13.0358, lng: 77.5970 },
  "Banashankari":    { lat: 12.9250, lng: 77.5468 },
  "Rajajinagar":     { lat: 12.9900, lng: 77.5527 },
  "Malleshwaram":    { lat: 13.0031, lng: 77.5710 },
  "Basavanagudi":    { lat: 12.9400, lng: 77.5700 },
  "Yeshwanthpur":    { lat: 13.0200, lng: 77.5450 },
  "Vijay Nagar":     { lat: 12.9700, lng: 77.5300 },
  "RT Nagar":        { lat: 13.0200, lng: 77.5950 },
  "Kengeri":         { lat: 12.9100, lng: 77.4800 },
};

const STAGES = [
  "placed", "vendor_assigned", "vendor_accepted", "pickup_scheduled",
  "pickup_completed", "laundry_received", "sorting", "tagging",
  "washing", "drying", "ironing", "dry_cleaning", "quality_inspection",
  "packing", "ready_for_dispatch", "out_for_delivery", "delivered", "completed",
];

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const isAdminQuery = req.query.admin === "true";

    const user = (req as any).user;
    let customerId = req.query.customerId as string;
    if (!customerId && user && !vendorId && !isAdminQuery) customerId = user.id;

    const admin = createAdminClient();
    let query = admin.from("orders").select("*").limit(limit).order("created_at", { ascending: false });

    if (customerId) query = query.eq("customer_id", customerId);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (status) query = query.eq("status", status);

    console.log("[orders] GET", { vendorId, customerId, status, limit, isAdminQuery });

    const { data, error } = await query;
    if (error) { console.error("[orders] DB error:", error.message); res.status(500).json({ error: error.message }); return; }
    console.log("[orders] returning", data?.length || 0, "orders");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const body = req.body;
    const adminClient = createAdminClient();
    const code = `LH-${Date.now().toString(36).toUpperCase()}`;
    const hasVendor = body.vendor_id && body.vendor_id !== "00000000-0000-0000-0000-000000000001" && body.vendor_id !== "00000000-0000-0000-0000-000000000002";

    let vendorName = body.vendor_name || "Vendor";
    let vendorLogoInitials = body.vendor_logo_initials || "";
    let vendorLogoColor = body.vendor_logo_color || "bg-primary-surface";

    if (hasVendor) {
      const { data: vendor } = await adminClient
        .from("vendors")
        .select("name, logo_initials, logo_color")
        .eq("id", body.vendor_id)
        .single();
      if (vendor) {
        vendorName = vendor.name;
        vendorLogoInitials = vendor.logo_initials;
        vendorLogoColor = vendor.logo_color;
      }
    }

    const pickupAreaKey = body.pickup_area as string;
    const pickupCoords = KNOWN_AREAS[pickupAreaKey];
    const vendorAreaKey = vendorName ? Object.keys(KNOWN_AREAS).find(
      (k) => vendorName.toLowerCase().includes(k.toLowerCase())
    ) : undefined;
    const vendorCoords = vendorAreaKey ? KNOWN_AREAS[vendorAreaKey] : undefined;

    const orderData = {
      code,
      customer_id: user.id,
      customer_name: body.customer_name || "Customer",
      customer_avatar: body.customer_avatar || "",
      vendor_id: hasVendor ? body.vendor_id : null,
      vendor_name: vendorName,
      vendor_logo_initials: vendorLogoInitials,
      vendor_logo_color: vendorLogoColor,
      status: hasVendor ? "vendor_assigned" : "placed",
      current_stage_index: hasVendor ? 1 : 0,
      items: body.items || [],
      pickup_address: body.pickup_address || "",
      pickup_area: body.pickup_area || "",
      pickup_date: body.pickup_date || "",
      pickup_slot: body.pickup_slot || "",
      delivery_date: body.delivery_date || "",
      delivery_slot: body.delivery_slot || "",
      estimated_delivery_at: body.estimated_delivery_at || null,
      amount: body.amount || 0,
      taxes: body.taxes || 0,
      platform_fee: body.platform_fee || 0,
      delivery_fee: body.delivery_fee || 0,
      total: body.total || 0,
      payment_method: body.payment_method || "cod",
      payment_status: body.payment_status || "pending",
      pickup_lat: pickupCoords?.lat || null,
      pickup_lng: pickupCoords?.lng || null,
      delivery_lat: vendorCoords?.lat || null,
      delivery_lng: vendorCoords?.lng || null,
      express: body.express || false,
      notes: body.notes || null,
      garment_count: body.garment_count || 0,
      weight_kg: body.weight_kg || null,
    };
    const { data, error } = await adminClient.from("orders").insert(orderData).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }

    const { data: stages } = await adminClient.from("order_stage_definitions").select("*").order("sort_order");
    if (stages) {
      const doneUpTo = hasVendor ? 1 : 0;
      const stageEvents = stages.map((s: any, i: number) => ({
        order_id: data.id,
        stage: s.stage,
        label: s.label,
        timestamp: i <= doneUpTo ? new Date().toISOString() : null,
        done: i <= doneUpTo,
      }));
      await adminClient.from("order_stage_events").insert(stageEvents);
    }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error) { res.status(404).json({ error: "Order not found" }); return; }

    const { data: stages } = await supabase
      .from("order_stage_events")
      .select("*")
      .eq("order_id", id)
      .order("stage");
    res.json({ ...order, stages: stages || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const supabase = createAdminClient();

    // Fetch current order for validation
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) { res.status(404).json({ error: "Order not found" }); return; }

    // Stage transition validation
    // Build update payload (map camelCase from API to snake_case in DB)
    const updatePayload: Record<string, any> = {};

    if (body.currentStageIndex !== undefined) {
      const newIndex = body.currentStageIndex;
      const currentIndex = order.current_stage_index;

      if (newIndex < currentIndex) {
        res.status(400).json({ error: "Cannot revert to a previous stage" });
        return;
      }

      if (newIndex > STAGES.length - 1) {
        res.status(400).json({ error: "Invalid stage index" });
        return;
      }

      if (order.status === "cancelled") {
        res.status(400).json({ error: "Order is cancelled" });
        return;
      }

      const { data: stages } = await supabase
        .from("order_stage_events")
        .select("*")
        .eq("order_id", id)
        .order("stage");

      if (stages) {
        for (let i = currentIndex; i <= newIndex; i++) {
          if (stages[i]) {
            await supabase
              .from("order_stage_events")
              .update({ done: true, timestamp: new Date().toISOString() })
              .eq("id", stages[i].id);
          }
        }
      }

      updatePayload.status = STAGES[newIndex];
      updatePayload.current_stage_index = newIndex;

      if (STAGES[newIndex] === "pickup_scheduled" && order.status !== "pickup_scheduled") {
        const { data: existing } = await supabase
          .from("delivery_tasks")
          .select("id")
          .eq("order_id", id)
          .eq("type", "pickup")
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("delivery_tasks").insert({
            type: "pickup",
            order_id: id,
            order_code: order.code,
            customer_name: order.customer_name || "Customer",
            vendor_name: order.vendor_name || "",
            address: order.pickup_address || "",
            area: order.pickup_area || "",
            slot: order.pickup_slot || "",
            amount: order.total || 0,
            items: "",
            status: "pending",
          });
        }
      }

      if (STAGES[newIndex] === "ready_for_dispatch" && order.status !== "ready_for_dispatch") {
        const { data: existing } = await supabase
          .from("delivery_tasks")
          .select("id")
          .eq("order_id", id)
          .eq("type", "delivery")
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("delivery_tasks").insert({
            type: "delivery",
            order_id: id,
            order_code: order.code,
            customer_name: order.customer_name || "Customer",
            vendor_name: order.vendor_name || "",
            address: order.pickup_address || "",
            area: order.pickup_area || "",
            slot: order.delivery_slot || "",
            amount: order.total || 0,
            items: "",
            status: "pending",
          });
        }
      }
    }

    if (body.status && !updatePayload.status) updatePayload.status = body.status;

    const { data, error } = await supabase.from("orders").update(updatePayload).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "vendor_assigned") {
      res.status(400).json({ error: "Can only reject orders at 'vendor_assigned' stage" });
      return;
    }

    // Find another vendor in the same area, excluding the current one
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name, logo_initials, logo_color")
      .eq("area", order.pickup_area)
      .neq("id", order.vendor_id)
      .limit(5);

    if (!vendors || vendors.length === 0) {
      // No alternative vendor — keep the order but mark it for admin review
      res.json({ message: "No alternative vendors available", order });
      return;
    }

    // Pick the first available vendor
    const nextVendor = vendors[0];
    const { data, error } = await supabase
      .from("orders")
      .update({
        vendor_id: nextVendor.id,
        vendor_name: nextVendor.name,
        vendor_logo_initials: nextVendor.logo_initials,
        vendor_logo_color: nextVendor.logo_color,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/assign-delivery", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { delivery_executive_id } = req.body;
    const supabase = createAdminClient();

    // Unassign path
    if (!delivery_executive_id) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .update({ delivery_executive_id: null, delivery_executive_name: null })
        .eq("id", id)
        .select()
        .single();
      if (orderErr) { res.status(400).json({ error: orderErr.message }); return; }

      // Clear exec_id on all tasks for this order
      await supabase
        .from("delivery_tasks")
        .update({ exec_id: null })
        .eq("order_id", id);

      res.json(order);
      return;
    }

    // Fetch the delivery exec's profile
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", delivery_executive_id)
      .single();
    if (profileErr || !profile) { res.status(404).json({ error: "Delivery executive not found" }); return; }

    // Update the order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .update({
        delivery_executive_id,
        delivery_executive_name: profile.name,
      })
      .eq("id", id)
      .select()
      .single();
    if (orderErr) { res.status(400).json({ error: orderErr.message }); return; }

    // Claim any unassigned delivery tasks for this order
    await supabase
      .from("delivery_tasks")
      .update({ exec_id: delivery_executive_id })
      .eq("order_id", id)
      .is("exec_id", null);

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();

    const { data: order } = await supabase.from("orders").select("status").eq("id", id).single();
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const nonCancelable = ["completed", "cancelled", "delivered", "out_for_delivery"];
    if (nonCancelable.includes(order.status)) {
      res.status(400).json({ error: `Cannot cancel order in '${order.status}' status` });
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled", payment_status: "refunded" })
      .eq("id", id)
      .select()
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
