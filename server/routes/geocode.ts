import { Router, Request, Response } from "express";

// ---- In-memory cache with 1-hour TTL ----
const cache = new Map<string, { data: unknown; ttl: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ttl: Date.now() + CACHE_TTL_MS });
}

// ---- Nominatim rate limiter (max 1 req/sec) ----
let lastNominatimCall = 0;
async function nominatimFetch(url: string) {
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  const res = await fetch(url, {
    headers: {
      "User-Agent": "LaundryHomeApp/1.0 (demo)",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  return res.json();
}

// ---- Known areas (fallback / seed) ----
const KNOWN_AREAS: Record<string, { lat: number; lng: number; displayName: string; pincode: string }> = {
  "Indiranagar":     { lat: 12.9719, lng: 77.6413, displayName: "Indiranagar, Bengaluru", pincode: "560038" },
  "Koramangala":     { lat: 12.9352, lng: 77.6245, displayName: "Koramangala, Bengaluru", pincode: "560034" },
  "HSR Layout":      { lat: 12.9116, lng: 77.6389, displayName: "HSR Layout, Bengaluru", pincode: "560102" },
  "Jayanagar":       { lat: 12.9250, lng: 77.5938, displayName: "Jayanagar, Bengaluru", pincode: "560011" },
  "BTM Layout":      { lat: 12.9166, lng: 77.6101, displayName: "BTM Layout, Bengaluru", pincode: "560076" },
  "Whitefield":      { lat: 12.9698, lng: 77.7500, displayName: "Whitefield, Bengaluru", pincode: "560066" },
  "MG Road":         { lat: 12.9750, lng: 77.6067, displayName: "MG Road, Bengaluru", pincode: "560001" },
  "Marathahalli":    { lat: 12.9591, lng: 77.6974, displayName: "Marathahalli, Bengaluru", pincode: "560037" },
  "Electronic City": { lat: 12.8399, lng: 77.6770, displayName: "Electronic City, Bengaluru", pincode: "560100" },
  "JP Nagar":        { lat: 12.9063, lng: 77.5857, displayName: "JP Nagar, Bengaluru", pincode: "560078" },
  "Horamavu":        { lat: 13.0208, lng: 77.6583, displayName: "Horamavu, Bengaluru", pincode: "560043" },
  "Hebbal":          { lat: 13.0358, lng: 77.5970, displayName: "Hebbal, Bengaluru", pincode: "560024" },
  "Banashankari":    { lat: 12.9250, lng: 77.5468, displayName: "Banashankari, Bengaluru", pincode: "560050" },
  "Rajajinagar":     { lat: 12.9900, lng: 77.5527, displayName: "Rajajinagar, Bengaluru", pincode: "560010" },
  "Malleshwaram":    { lat: 13.0031, lng: 77.5710, displayName: "Malleshwaram, Bengaluru", pincode: "560003" },
  "Basavanagudi":    { lat: 12.9400, lng: 77.5700, displayName: "Basavanagudi, Bengaluru", pincode: "560004" },
  "Yeshwanthpur":    { lat: 13.0200, lng: 77.5450, displayName: "Yeshwanthpur, Bengaluru", pincode: "560022" },
  "Vijay Nagar":     { lat: 12.9700, lng: 77.5300, displayName: "Vijay Nagar, Bengaluru", pincode: "560040" },
  "RT Nagar":        { lat: 13.0200, lng: 77.5950, displayName: "RT Nagar, Bengaluru", pincode: "560032" },
  "Kengeri":         { lat: 12.9100, lng: 77.4800, displayName: "Kengeri, Bengaluru", pincode: "560060" },
};

function findClosestArea(lat: number, lng: number): { name: string; pincode: string; lat: number; lng: number; distance: number } | null {
  let closest: { name: string; pincode: string; lat: number; lng: number; distance: number } | null = null;
  for (const [name, info] of Object.entries(KNOWN_AREAS)) {
    const d = haversineKm(lat, lng, info.lat, info.lng);
    if (!closest || d < closest.distance) {
      closest = { name, pincode: info.pincode, lat: info.lat, lng: info.lng, distance: d };
    }
  }
  return closest;
}

const router = Router();

// ---- Reverse geocode: lat/lng → area info ----
router.get("/reverse", async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat as string;
    const lng = req.query.lng as string;
    if (!lat || !lng) { res.status(400).json({ error: "lat and lng required" }); return; }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const cacheKey = `reverse:${latNum.toFixed(5)},${lngNum.toFixed(5)}`;

    const cached = getCached<{ area: string; city: string; pincode: string; lat: number; lng: number }>(cacheKey);
    if (cached) { res.json(cached); return; }

    // Check known areas first (exact match within 1 km)
    for (const [name, info] of Object.entries(KNOWN_AREAS)) {
      const d = haversineKm(latNum, lngNum, info.lat, info.lng);
      if (d < 1) {
        const result = { area: name, city: "Bengaluru", pincode: info.pincode, lat: info.lat, lng: info.lng };
        setCache(cacheKey, result);
        res.json(result);
        return;
      }
    }

    // Fall back to Nominatim
    const data = await nominatimFetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&addressdetails=1`
    );

    if (!data || data.error) {
      // Find the closest known area as fallback
      const closest = findClosestArea(latNum, lngNum);
      if (closest) {
        const result = { area: closest.name, city: "Bengaluru", pincode: closest.pincode, lat: latNum, lng: lngNum };
        setCache(cacheKey, result);
        res.json(result);
        return;
      }
      res.json({ area: "Unknown", city: "Bengaluru", pincode: "560001", lat: latNum, lng: lngNum });
      return;
    }

    const addr = data.address || {};
    const nominatimArea = addr.suburb || addr.neighbourhood || addr.locality || addr.town || addr.city || "";
    const city = addr.city || addr.town || addr.county || "Bengaluru";
    const pincode = addr.postcode || "560001";

    // Validate Nominatim area against known areas — if it's not a known area and user is within
    // 3 km of a known area, use the known area name instead (Nominatim data can be inaccurate)
    const isKnown = Object.keys(KNOWN_AREAS).some(
      (k) => k.toLowerCase() === nominatimArea.toLowerCase()
    );
    let area = nominatimArea || "Unknown";
    if (!isKnown) {
      const closest = findClosestArea(latNum, lngNum);
      if (closest && closest.distance < 3) {
        area = closest.name;
      }
    }

    const result = { area, city, pincode, lat: latNum, lng: lngNum };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Search: area/pincode → list of locations ----
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) { res.json([]); return; }

    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>(cacheKey);
    if (cached) { res.json(cached); return; }

    const results: Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }> = [];

    // Check known areas
    const ql = q.toLowerCase();
    for (const [name, info] of Object.entries(KNOWN_AREAS)) {
      if (name.toLowerCase().includes(ql) || info.pincode.startsWith(q)) {
        results.push({ label: info.displayName, area: name, city: "Bengaluru", pincode: info.pincode, lat: info.lat, lng: info.lng });
      }
    }

    // Also try Nominatim for broader results
    try {
      const data = await nominatimFetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&countrycodes=in`
      );
      if (Array.isArray(data)) {
        for (const item of data) {
          const addr = item.address || {};
          const name = addr.suburb || addr.neighbourhood || addr.locality || addr.town || addr.city || item.display_name?.split(",")[0] || q;
          const cityName = addr.city || addr.town || addr.county || "Bengaluru";
          const pincode2 = addr.postcode || "";
          const alreadyExists = results.some((r) => r.area.toLowerCase() === name.toLowerCase());
          if (!alreadyExists) {
            const fallbackPincode = pincode2 || "560001";
            results.push({ label: item.display_name || name, area: name, city: cityName, pincode: fallbackPincode, lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
          }
        }
      }
    } catch {
      // Nominatim errors are non-fatal; known areas are enough
    }

    setCache(cacheKey, results);
    res.json(results.slice(0, 6));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
