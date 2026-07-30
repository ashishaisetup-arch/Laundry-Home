// ============================================================================
// Map Provider Interface — abstracts routing/maps behind a vendor-agnostic layer
// ============================================================================

export interface RouteRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
  profile?: "driving" | "walking" | "cycling";
}

export interface RouteResult {
  distanceKm: number;
  durationMins: number;
  polyline?: string;
  steps?: { instruction: string; distanceKm: number; durationMins: number }[];
}

export interface DistanceMatrixRequest {
  origins: { lat: number; lng: number }[];
  destinations: { lat: number; lng: number }[];
  profile?: "driving" | "walking" | "cycling";
}

export interface DistanceMatrixResult {
  rows: {
    elements: {
      distanceKm: number;
      durationMins: number;
      status: "OK" | "ZERO_RESULTS" | "NOT_FOUND";
    }[];
  }[];
}

export interface RouteProvider {
  getRoute(req: RouteRequest): Promise<RouteResult | null>;
  getDistanceMatrix(req: DistanceMatrixRequest): Promise<DistanceMatrixResult | null>;
}

// ============================================================================
// Google Directions Provider
// ============================================================================

export class GoogleRouteProvider implements RouteProvider {
  private apiKey: string;
  private client: any;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    const { Client } = require("@googlemaps/google-maps-services-js");
    this.client = new Client({});
  }

  async getRoute(req: RouteRequest): Promise<RouteResult | null> {
    try {
      const params: any = {
        origin: { lat: req.origin.lat, lng: req.origin.lng },
        destination: { lat: req.destination.lat, lng: req.destination.lng },
        key: this.apiKey,
      };
      if (req.profile) {
        const mode = req.profile.replace(/-.*$/, "").toLowerCase();
        if (["driving", "walking", "bicycling", "transit"].includes(mode)) {
          params.mode = mode;
        }
      }
      if (req.waypoints?.length) {
        params.waypoints = req.waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
      }

      const resp = await this.client.directions({ params });
      if (resp.data.status !== "OK" || !resp.data.routes?.length) return null;

      const route = resp.data.routes[0];
      const leg = route.legs[0];
      return {
        distanceKm: leg.distance?.value ? leg.distance.value / 1000 : 0,
        durationMins: leg.duration?.value ? leg.duration.value / 60 : 0,
        polyline: route.overview_polyline?.points || undefined,
        steps: leg.steps?.map((s: any) => ({
          instruction: s.html_instructions?.replace(/<[^>]*>/g, "") || "",
          distanceKm: s.distance?.value ? s.distance.value / 1000 : 0,
          durationMins: s.duration?.value ? s.duration.value / 60 : 0,
          endLocation: s.end_location ? { lat: s.end_location.lat, lng: s.end_location.lng } : undefined,
        })),
      };
    } catch (err) {
      console.error("[GoogleRouteProvider] getRoute threw:", err);
      return null;
    }
  }

  async getDistanceMatrix(req: DistanceMatrixRequest): Promise<DistanceMatrixResult | null> {
    try {
      const resp = await this.client.distancematrix({
        params: {
          origins: req.origins.map((o) => ({ lat: o.lat, lng: o.lng })),
          destinations: req.destinations.map((d) => ({ lat: d.lat, lng: d.lng })),
          key: this.apiKey,
          mode: (() => { const m = (req.profile || "driving").replace(/-.*$/, "").toLowerCase(); return ["driving", "walking", "bicycling", "transit"].includes(m) ? m : "driving"; })(),
        },
      });
      if (resp.data.status !== "OK") return null;

      return {
        rows: (resp.data.rows || []).map((row: any) => ({
          elements: (row.elements || []).map((el: any) => ({
            distanceKm: el.distance?.value ? el.distance.value / 1000 : 0,
            durationMins: el.duration?.value ? el.duration.value / 60 : 0,
            status: el.status === "OK" ? "OK" : el.status === "ZERO_RESULTS" ? "ZERO_RESULTS" : "NOT_FOUND",
          })),
        })),
      };
    } catch {
      return null;
    }
  }

  async getTrafficDuration(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<number | null> {
    try {
      const resp = await this.client.directions({
        params: {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          key: this.apiKey,
          departure_time: "now",
          traffic_model: "best_guess",
        },
      });
      if (resp.data.status !== "OK" || !resp.data.routes?.length) return null;
      const leg = resp.data.routes[0].legs[0];
      const d = leg.duration_in_traffic || leg.duration;
      return d?.value ? d.value / 60 : null;
    } catch (err) {
      console.error("[GoogleRouteProvider] getTrafficDuration threw:", err);
      return null;
    }
  }
}

// ============================================================================
// OpenRouteService Provider (fallback)
// ============================================================================

export class OpenRouteServiceProvider implements RouteProvider {
  private apiKey: string;
  private ORS_BASE = "https://api.openrouteservice.org/v2";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getRoute(req: RouteRequest): Promise<RouteResult | null> {
    try {
      const profile = req.profile === "walking" ? "foot-walking" : req.profile === "cycling" ? "cycling-regular" : "driving-car";
      const coords = [req.origin, ...(req.waypoints || []), req.destination]
        .map((p) => [p.lng, p.lat]);

      const resp = await fetch(`${this.ORS_BASE}/directions/${profile}/json`, {
        method: "POST",
        headers: { Authorization: this.apiKey, "Content-Type": "application/json", Accept: "application/json, application/geo+json" },
        body: JSON.stringify({ coordinates: coords }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("[ORS] getRoute failed:", resp.status, body);
        return null;
      }

      const data = await resp.json();
      const route = data.routes?.[0];
      if (!route) return null;

      const distanceKm = route.summary?.distance ? route.summary.distance / 1000 : 0;
      const durationMins = route.summary?.duration ? route.summary.duration / 60 : 0;

      return { distanceKm, durationMins, polyline: route.geometry || undefined };
    } catch {
      return null;
    }
  }

  async getDistanceMatrix(req: DistanceMatrixRequest): Promise<DistanceMatrixResult | null> {
    return null;
  }
}

// ============================================================================
// Singleton — selects provider based on config
// ============================================================================

let provider: RouteProvider | null = null;

export function getRouteProvider(): RouteProvider {
  if (provider) return provider;

  const googleKey = process.env.GOOGLE_BACKEND_API_KEY;
  const orsKey = process.env.OPENROUTESERVICE_API_KEY;
  const useGoogle = process.env.GOOGLE_ROUTES_ENABLED === "true" && !!googleKey;

  if (useGoogle) {
    console.log("[RouteProvider] using Google provider, key length:", googleKey?.length);
    provider = new GoogleRouteProvider(googleKey!);
  } else if (orsKey) {
    console.log("[RouteProvider] using ORS provider, key length:", orsKey?.length, "GOOGLE_ROUTES_ENABLED:", process.env.GOOGLE_ROUTES_ENABLED);
    provider = new OpenRouteServiceProvider(orsKey);
  } else {
    console.log("[RouteProvider] no provider available");
    // Fallback that returns null for all requests
    provider = { getRoute: async () => null, getDistanceMatrix: async () => null };
  }

  return provider;
}

export function resetRouteProvider() {
  provider = null;
}

let googleTrafficProvider: GoogleRouteProvider | null = null;

export function getGoogleTrafficProvider(): GoogleRouteProvider | null {
  const googleKey = process.env.GOOGLE_BACKEND_API_KEY;
  if (!googleKey) return null;
  if (!googleTrafficProvider) {
    googleTrafficProvider = new GoogleRouteProvider(googleKey);
  }
  return googleTrafficProvider;
}
