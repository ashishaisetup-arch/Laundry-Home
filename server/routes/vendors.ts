import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

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

function findClosestAreaForVendor(areaName: string, userLat: number, userLng: number): { lat: number; lng: number } | null {
  const nameL = areaName.toLowerCase();
  let best: { lat: number; lng: number; dist: number } | null = null;
  for (const [name, coords] of Object.entries(KNOWN_AREAS)) {
    const nameSimilar = name.toLowerCase().includes(nameL) || nameL.includes(name.toLowerCase());
    const d = haversineKm(userLat, userLng, coords.lat, coords.lng);
    if (nameSimilar && (!best || d < best.dist)) {
      best = { ...coords, dist: d };
    }
  }
  if (best && best.dist < 15) return { lat: best.lat, lng: best.lng };
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const area = req.query.area as string;
    const isOpen = req.query.isOpen as string;
    const service = req.query.service as string;
    const ownerId = req.query.owner_id as string;
    const lat = req.query.lat as string;
    const lng = req.query.lng as string;
    const radiusKm = parseFloat(req.query.radiusKm as string) || 5;
    const limit = parseInt(req.query.limit as string) || 50;

    const supabase = createAdminClient();
    let query = supabase.from("vendors").select("*").limit(limit);
    if (area) query = query.eq("area", area);
    if (isOpen === "true") query = query.eq("is_open", true);
    if (service) query = query.contains("services_offered", [service]);
    if (ownerId) query = query.eq("owner_id", ownerId);
    query = query.order("rating", { ascending: false });

    let { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    if (data && lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        data = data.filter((v) => {
          let coords = KNOWN_AREAS[v.area];
          if (!coords) {
            const closest = findClosestAreaForVendor(v.area, userLat, userLng);
            if (!closest) return false;
            coords = closest;
          }
          const d = haversineKm(userLat, userLng, coords.lat, coords.lng);
          v.distance_km = parseFloat(d.toFixed(1));
          return d <= radiusKm;
        });
        data.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
      }
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendors").insert(req.body).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendors").select("*").eq("id", id).single();
    if (error) { res.status(404).json({ error: "Vendor not found" }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendors").update(req.body).eq("id", id).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
