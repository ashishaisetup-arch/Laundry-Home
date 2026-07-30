import { createAdminClient } from "../supabase";

// ============================================================================
// Types
// ============================================================================

export interface GeocodeResult {
  placeId: string;
  formattedAddress: string;
  locality: string | null;
  subLocality: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string | null;
  latitude: number;
  longitude: number;
  plusCode: string | null;
}

export interface GeocodeProvider {
  search(query: string): Promise<GeocodeResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
  placeDetails(placeId: string): Promise<GeocodeResult | null>;
}

// ============================================================================
// Google Geocode Provider (primary)
// ============================================================================

class GoogleGeocodeProvider implements GeocodeProvider {
  private client: any;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    const { Client } = require("@googlemaps/google-maps-services-js");
    this.client = new Client({});
  }

  async search(query: string): Promise<GeocodeResult[]> {
    try {
      const resp = await this.client.geocode({
        params: { address: query, key: this.apiKey, region: "in", components: { country: "IN" } },
      });
      if (resp.data.status !== "OK" || !resp.data.results) return [];
      return resp.data.results.map((r: any) => this.toResult(r));
    } catch {
      return [];
    }
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    try {
      const resp = await this.client.reverseGeocode({
        params: { latlng: { lat, lng }, key: this.apiKey, region: "in" },
      });
      if (resp.data.status !== "OK" || !resp.data.results?.length) return null;
      return this.toResult(resp.data.results[0]);
    } catch {
      return null;
    }
  }

  async placeDetails(placeId: string): Promise<GeocodeResult | null> {
    try {
      const resp = await this.client.placeDetails({
        params: { place_id: placeId, key: this.apiKey, region: "in" },
      });
      if (resp.data.status !== "OK" || !resp.data.result) return null;
      return this.toResult(resp.data.result);
    } catch {
      return null;
    }
  }

  private toResult(r: any): GeocodeResult {
    const ac = this.extractComponents(r.address_components || []);
    return {
      placeId: r.place_id || "",
      formattedAddress: r.formatted_address || "",
      locality: ac.locality,
      subLocality: ac.subLocality,
      city: ac.city || ac.locality || "",
      state: ac.state || "",
      country: ac.country || "India",
      pincode: ac.pincode || null,
      latitude: r.geometry?.location?.lat || 0,
      longitude: r.geometry?.location?.lng || 0,
      plusCode: r.plus_code?.global_code || null,
    };
  }

  private extractComponents(components: any[]) {
    const result: Record<string, string | null> = {};
    for (const c of components || []) {
      const types = c.types || [];
      if (types.includes("sublocality_level_1") || types.includes("sublocality")) result.subLocality = c.long_name;
      if (types.includes("locality")) result.locality = c.long_name;
      if (types.includes("administrative_area_level_1")) result.state = c.long_name;
      if (types.includes("country")) result.country = c.long_name;
      if (types.includes("postal_code")) result.pincode = c.long_name;
    }
    return result;
  }
}

// ============================================================================
// Nominatim Geocode Provider (fallback)
// ============================================================================

class NominatimGeocodeProvider implements GeocodeProvider {
  private lastRequest = 0;

  private async rateLimitedFetch(url: string): Promise<any> {
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - this.lastRequest));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();
    const resp = await fetch(url, { headers: { "User-Agent": "LaundryHome/1.0" } });
    if (!resp.ok) return null;
    return resp.json();
  }

  async search(query: string): Promise<GeocodeResult[]> {
    try {
      const data = await this.rateLimitedFetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=in`
      );
      if (!Array.isArray(data)) return [];
      return data.map((r: any) => ({
        placeId: r.place_id ? `osm_${r.place_id}` : "",
        formattedAddress: r.display_name || "",
        locality: r.address?.suburb || r.address?.neighbourhood || null,
        subLocality: r.address?.road || null,
        city: r.address?.city || r.address?.town || r.address?.village || "",
        state: r.address?.state || "",
        country: r.address?.country || "India",
        pincode: r.address?.postcode || null,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        plusCode: null,
      }));
    } catch {
      return [];
    }
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    try {
      const data = await this.rateLimitedFetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
      );
      if (!data || !data.address) return null;
      const addr = data.address;
      return {
        placeId: data.place_id ? `osm_${data.place_id}` : "",
        formattedAddress: data.display_name || "",
        locality: addr.suburb || addr.neighbourhood || null,
        subLocality: addr.road || null,
        city: addr.city || addr.town || addr.village || "",
        state: addr.state || "",
        country: addr.country || "India",
        pincode: addr.postcode || null,
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        plusCode: null,
      };
    } catch {
      return null;
    }
  }

  async placeDetails(_placeId: string): Promise<GeocodeResult | null> {
    return null;
  }
}

// ============================================================================
// LocationService — DB-cached, provider-backed geocoding
// ============================================================================

export class LocationService {
  private primary: GeocodeProvider;
  private fallback: GeocodeProvider;
  private adminClient: any;
  private useGoogle: boolean;

  constructor(primary: GeocodeProvider, fallback: GeocodeProvider) {
    this.primary = primary;
    this.fallback = fallback;
    this.adminClient = createAdminClient();
    this.useGoogle = primary instanceof GoogleGeocodeProvider;
  }

  private get providers(): GeocodeProvider[] {
    return this.useGoogle ? [this.primary, this.fallback] : [this.fallback];
  }

  // Resolve a place_id to a locations DB row
  // 1. Check DB cache by place_id
  // 2. Try primary provider's placeDetails
  // 3. Insert into DB and return
  async resolvePlaceId(placeId: string): Promise<any | null> {
    // Check DB cache
    const { data: existing } = await this.adminClient
      .from("locations")
      .select("*")
      .eq("place_id", placeId)
      .maybeSingle();
    if (existing) return existing;

    // Fetch from providers
    for (const provider of this.providers) {
      const result = await provider.placeDetails(placeId);
      if (result) {
        const { data: inserted } = await this.adminClient
          .from("locations")
          .upsert({ place_id: result.placeId, formatted_address: result.formattedAddress, locality: result.locality, sub_locality: result.subLocality, city: result.city, state: result.state, country: result.country, pincode: result.pincode, latitude: result.latitude, longitude: result.longitude, plus_code: result.plusCode }, { onConflict: "place_id" })
          .select()
          .single();
        return inserted || null;
      }
    }
    return null;
  }

  // Search for locations by query string
  // 1. Check DB first (locality/city/pincode match)
  // 2. Try providers
  // 3. Cache any new results in DB
  async search(query: string): Promise<GeocodeResult[]> {
    const results: GeocodeResult[] = [];
    const seen = new Set<string>();

    // DB-first: search existing locations
    const { data: dbResults } = await this.adminClient
      .from("locations")
      .select("*")
      .or(`locality.ilike.%${query}%,city.ilike.%${query}%,pincode.ilike.%${query}%`)
      .limit(10);

    for (const row of dbResults || []) {
      const r: GeocodeResult = {
        placeId: row.place_id,
        formattedAddress: row.formatted_address,
        locality: row.locality, subLocality: row.sub_locality,
        city: row.city, state: row.state, country: row.country,
        pincode: row.pincode, latitude: Number(row.latitude), longitude: Number(row.longitude),
        plusCode: row.plus_code,
      };
      if (!seen.has(r.placeId)) { seen.add(r.placeId); results.push(r); }
    }

    // Provider fallback
    for (const provider of this.providers) {
      const providerResults = await provider.search(query);
      for (const r of providerResults) {
        if (!seen.has(r.placeId)) {
          seen.add(r.placeId);
          results.push(r);
          // Cache asynchronously
          this.cacheResult(r);
        }
      }
      if (results.length > 0) break;
    }

    return results.slice(0, 10);
  }

  // Reverse geocode lat/lng to a location
  // 1. Check DB by closest coordinates
  // 2. Try providers
  // 3. Cache new results
  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    // DB-first: check if we have a location close by
    const { data: nearby } = await this.adminClient
      .from("locations")
      .select("*")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(50);

    if (nearby?.length) {
      let closest: any = null;
      let minDist = Infinity;
      for (const loc of nearby) {
        const d = haversineKm(lat, lng, Number(loc.latitude), Number(loc.longitude));
        if (d < minDist) { minDist = d; closest = loc; }
      }
      if (closest && minDist < 1) { // within 1 km
        return {
          placeId: closest.place_id, formattedAddress: closest.formatted_address,
          locality: closest.locality, subLocality: closest.sub_locality,
          city: closest.city, state: closest.state, country: closest.country,
          pincode: closest.pincode, latitude: Number(closest.latitude), longitude: Number(closest.longitude),
          plusCode: closest.plus_code,
        };
      }
    }

    for (const provider of this.providers) {
      const result = await provider.reverse(lat, lng);
      if (result) {
        this.cacheResult(result);
        return result;
      }
    }
    return null;
  }

  private async cacheResult(r: GeocodeResult) {
    try {
      await this.adminClient
        .from("locations")
        .upsert({
          place_id: r.placeId, formatted_address: r.formattedAddress,
          locality: r.locality, sub_locality: r.subLocality,
          city: r.city, state: r.state, country: r.country,
          pincode: r.pincode, latitude: r.latitude, longitude: r.longitude,
          plus_code: r.plusCode,
        }, { onConflict: "place_id" });
    } catch {
      // silent — cache best-effort
    }
  }
}

// ============================================================================
// Haversine distance (shared utility)
// ============================================================================

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================================
// Singleton instance
// ============================================================================

const googleKey = process.env.GOOGLE_BACKEND_API_KEY;
const hasGoogle = !!googleKey;

export const locationService = new LocationService(
  hasGoogle ? new GoogleGeocodeProvider(googleKey!) : new NominatimGeocodeProvider(),
  new NominatimGeocodeProvider()
);

export const isGoogleMapsAvailable = () => hasGoogle;
