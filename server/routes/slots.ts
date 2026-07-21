import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

const DEFAULT_PICKUP_SLOTS = [
  { slot: "7:00 AM - 9:00 AM", available: true, premium: false },
  { slot: "9:00 AM - 11:00 AM", available: true, premium: false },
  { slot: "11:00 AM - 1:00 PM", available: true, premium: false },
  { slot: "1:00 PM - 3:00 PM", available: true, premium: true },
  { slot: "3:00 PM - 5:00 PM", available: true, premium: false },
  { slot: "5:00 PM - 7:00 PM", available: true, premium: false },
];

const DEFAULT_DELIVERY_SLOTS = [
  { slot: "7:00 AM - 9:00 AM", available: true },
  { slot: "9:00 AM - 11:00 AM", available: true },
  { slot: "11:00 AM - 1:00 PM", available: true },
  { slot: "1:00 PM - 3:00 PM", available: true },
  { slot: "3:00 PM - 5:00 PM", available: true },
  { slot: "5:00 PM - 7:00 PM", available: true },
];

router.get("/", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();

    const { data: pickup, error: psErr } = await supabase.from("pickup_slots").select("*").order("slot");
    if (psErr) { res.status(500).json({ error: psErr.message }); return; }

    const { data: delivery, error: dsErr } = await supabase.from("delivery_slots").select("*").order("slot");
    if (dsErr) { res.status(500).json({ error: dsErr.message }); return; }

    if (pickup && pickup.length > 0 && delivery && delivery.length > 0) {
      res.json({ pickup, delivery });
      return;
    }

    // Auto-seed defaults if tables are empty
    if (!pickup || pickup.length === 0) {
      await supabase.from("pickup_slots").upsert(DEFAULT_PICKUP_SLOTS, { onConflict: "slot" });
    }
    if (!delivery || delivery.length === 0) {
      await supabase.from("delivery_slots").upsert(DEFAULT_DELIVERY_SLOTS, { onConflict: "slot" });
    }

    const { data: seededPickup } = await supabase.from("pickup_slots").select("*").order("slot");
    const { data: seededDelivery } = await supabase.from("delivery_slots").select("*").order("slot");

    res.json({ pickup: seededPickup || [], delivery: seededDelivery || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
