// Shared cache for service_areas — avoids repeated DB queries
import { createAdminClient } from "../supabase";

interface AreaCacheEntry {
  id: string;
  cityId: string;
  zone: string | null;
  areaName: string;
  pincode: string | null;
  lat: number;
  lng: number;
  isActive: boolean;
  hasPickup: boolean;
  hasDelivery: boolean;
  expressAvailable: boolean;
}

let cache: AreaCacheEntry[] | null = null;
let lastFetch = 0;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getAreas(): Promise<AreaCacheEntry[]> {
  const now = Date.now();
  if (cache && now - lastFetch < TTL_MS) return cache;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("service_areas")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("area-cache: failed to fetch areas", error.message);
    return cache || [];
  }

  cache = (data || []).map((a: any) => ({
    id: a.id,
    cityId: a.city_id,
    zone: a.zone,
    areaName: a.area_name,
    pincode: a.pincode,
    lat: parseFloat(a.lat),
    lng: parseFloat(a.lng),
    isActive: a.is_active,
    hasPickup: a.has_pickup,
    hasDelivery: a.has_delivery,
    expressAvailable: a.express_available,
  }));

  lastFetch = now;
  return cache;
}

export function invalidateAreaCache() {
  cache = null;
  lastFetch = 0;
}

// Find area by name (case-insensitive, trimmed)
export function findArea(name: string | null | undefined): AreaCacheEntry | undefined {
  if (!name) return undefined;
  const q = name.trim().toLowerCase();
  return (cache || []).find(
    (a) => a.areaName.toLowerCase() === q
  );
}

// Find closest area to given coordinates
export function findClosestArea(lat: number, lng: number): AreaCacheEntry | null {
  const areas = cache || [];
  if (areas.length === 0) return null;

  let best: AreaCacheEntry | null = null;
  let bestDist = Infinity;

  for (const a of areas) {
    const d = haversineKm(lat, lng, a.lat, a.lng);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }

  return best;
}

// Find areas within radius
export function findAreasWithinRadius(lat: number, lng: number, radiusKm: number): AreaCacheEntry[] {
  const areas = cache || [];
  return areas.filter((a) => {
    const d = haversineKm(lat, lng, a.lat, a.lng);
    return d <= radiusKm;
  });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
