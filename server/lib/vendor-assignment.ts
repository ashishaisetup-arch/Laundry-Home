import { haversineKm } from "./location-service";
import { getAreas, findArea, findAreasWithinRadius } from "./area-cache";

// ============================================================================
// Types
// ============================================================================

export interface AssignmentCandidate {
  vendorId: string;
  vendor: any;
  distanceKm: number;
  areaMatch: boolean;
  capacityScore: number;
  ratingScore: number;
  etaMins: number;
  totalScore: number;
}

export interface AssignmentRequest {
  lat: number;
  lng: number;
  radiusKm?: number;
  serviceTypes?: string[];
  preferExpress?: boolean;
  maxResults?: number;
  cityId?: string;
}

// ============================================================================
// Scoring helpers
// ============================================================================

function capacityScore(vendor: any): number {
  const used = vendor.capacity_used_pct ?? 0;
  if (used >= 100) return 0;
  if (used >= 80) return 0.3;
  if (used >= 60) return 0.6;
  if (used >= 40) return 0.8;
  return 1.0;
}

function ratingScore(rating: number): number {
  return Math.min(1, Math.max(0, (rating - 3) / 2));
}

function distanceScore(km: number, maxKm: number): number {
  if (km >= maxKm) return 0;
  return 1 - km / maxKm;
}

function etaScore(mins: number): number {
  if (mins <= 30) return 1.0;
  if (mins <= 60) return 0.8;
  if (mins <= 120) return 0.5;
  if (mins <= 240) return 0.2;
  return 0;
}

// ============================================================================
// Main assignment pipeline
// ============================================================================

export class VendorAssignmentEngine {
  async findBestVendors(req: AssignmentRequest): Promise<AssignmentCandidate[]> {
    const {
      lat,
      lng,
      radiusKm = 5,
      maxResults = 20,
      cityId,
    } = req;

    const areas = await getAreas();
    const matchingAreas = findAreasWithinRadius(lat, lng, radiusKm);
    const matchingAreaNames = new Set(matchingAreas.map((a) => a.areaName.toLowerCase()));

    const supabase = (await import("../supabase")).createAdminClient();
    const { data: vendors } = await supabase
      .from("vendors")
      .select("*")
      .limit(100);

    if (!vendors || vendors.length === 0) return [];

    // City filter — prefer vendors in the same city
    let filteredVendors = vendors;
    if (cityId) {
      const sameCity = vendors.filter((v: any) => v.city_id === cityId);
      const crossCity = vendors.filter((v: any) => v.city_id !== cityId && v.is_accepting_cross_city);
      filteredVendors = sameCity.length > 0 ? sameCity : crossCity;
    }

    const candidates: AssignmentCandidate[] = [];

    for (const v of filteredVendors) {
      // 1. Radius check — prefer vendor's own coordinates
      let dist = Infinity;
      if (v.latitude != null && v.longitude != null) {
        dist = haversineKm(lat, lng, Number(v.latitude), Number(v.longitude));
      } else {
        // Fall back to area name match
        const matched = findArea(v.area);
        if (matched) {
          dist = haversineKm(lat, lng, matched.lat, matched.lng);
        } else {
          // Fuzzy match
          const vArea = (v.area || "").toLowerCase();
          for (const a of areas) {
            if (a.areaName.toLowerCase() === vArea || a.areaName.toLowerCase().includes(vArea)) {
              dist = haversineKm(lat, lng, a.lat, a.lng);
              break;
            }
          }
        }
      }

      if (dist > radiusKm) continue;

      // 2. Service radius check — use vendor's own service_radius_km if set
      const effectiveRadius = v.service_radius_km || radiusKm;
      if (dist > effectiveRadius) continue;

      // 2b. Cross-city penalty — add 20% to distance score reduction
      const crossCityPenalty = cityId && v.city_id !== cityId ? 0.2 : 0;

      // 3. Capacity check
      const capScore = capacityScore(v);
      if (capScore === 0) continue;

      // 4. Rating score
      const rateScore = ratingScore(v.rating || 0);

      // 5. ETA estimation (simplified — 30 km/h average speed)
      const avgSpeedKmph = 30;
      const estimatedMins = Math.round((dist / avgSpeedKmph) * 60 + 15); // 15 min buffer

      // 6. Total score (weighted) with cross-city penalty
      const totalScore =
        (distanceScore(dist, effectiveRadius) - crossCityPenalty) * 0.35 +
        capScore * 0.25 +
        rateScore * 0.20 +
        etaScore(estimatedMins) * 0.20;

      candidates.push({
        vendorId: v.id,
        vendor: v,
        distanceKm: parseFloat(dist.toFixed(1)),
        areaMatch: matchingAreaNames.has((v.area || "").toLowerCase()),
        capacityScore: capScore,
        ratingScore: rateScore,
        etaMins: estimatedMins,
        totalScore: parseFloat(totalScore.toFixed(3)),
      });
    }

    // Sort by total score descending
    candidates.sort((a, b) => b.totalScore - a.totalScore);

    return candidates.slice(0, maxResults);
  }
}

export const vendorAssignment = new VendorAssignmentEngine();
