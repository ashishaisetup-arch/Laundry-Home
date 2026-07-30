import { createAdminClient } from "../supabase";

interface SurgeResult {
  surgeCharge: number;
  demandRatio: number;
  multiplier: number;
  label: string;
}

export class DynamicPricingEngine {
  /**
   * Calculate the dynamic surge multiplier for a given area/day/hour.
   * Uses recent order volume vs historical average to compute a demand ratio,
   * then looks up the pricing_coefficients table for configured multipliers.
   */
  async getSurge(
    areaName: string,
    date: Date,
    subtotal: number,
  ): Promise<SurgeResult> {
    const admin = createAdminClient();
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    // 1. Get coefficient row for this area/day/hour
    const { data: coeff } = await admin
      .from("pricing_coefficients")
      .select("*")
      .eq("area_name", areaName)
      .eq("day_of_week", dayOfWeek)
      .eq("hour_bucket", hour)
      .eq("is_active", true)
      .maybeSingle();

    const baseMultiplier = coeff?.base_multiplier ?? 1.0;
    const demandMultiplier = coeff?.demand_multiplier ?? 1.0;
    const supplyMultiplier = coeff?.supply_multiplier ?? 1.0;

    // 2. Compute dynamic demand ratio: current active orders / historical average
    //    Historical average = avg orders per same day/hour over last 4 weeks
    const now = date.toISOString();
    const fourWeeksAgo = new Date(date.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
    const oneHourLater = new Date(date.getTime() + 60 * 60 * 1000).toISOString();

    const [currentRes, historicalRes] = await Promise.all([
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("pickup_area", areaName)
        .gte("created_at", now)
        .lte("created_at", oneHourLater),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("pickup_area", areaName)
        .gte("created_at", fourWeeksAgo)
        .lt("created_at", now)
        .filter("created_at::time", "gte", `${String(hour).padStart(2, "0")}:00:00`)
        .filter("created_at::time", "lt", `${String(hour + 1).padStart(2, "0")}:00:00`),
    ]);

    const currentCount = currentRes.count ?? 0;
    const historicalCount = historicalRes.count ?? 0;
    const avgHistorical = historicalCount > 0
      ? Math.round((historicalCount / 4) * 10) / 10
      : 1; // floor of 1 to avoid division by zero

    const demandRatio = avgHistorical > 0
      ? Math.round((currentCount / avgHistorical) * 100) / 100
      : 1.0;

    // 3. Compute effective multiplier
    const effectiveMultiplier = baseMultiplier * demandMultiplier * Math.max(demandRatio, 0.5);

    // 4. Calculate surge charge
    const surgePercent = Math.round((effectiveMultiplier - 1.0) * 100);
    const surgeCharge = surgePercent > 0
      ? Math.round(subtotal * surgePercent / 100)
      : 0;

    return {
      surgeCharge,
      demandRatio,
      multiplier: effectiveMultiplier,
      label: surgePercent > 0
        ? `Demand Surge (${surgePercent}%)`
        : "No Surge",
    };
  }
}

export const dynamicPricing = new DynamicPricingEngine();
