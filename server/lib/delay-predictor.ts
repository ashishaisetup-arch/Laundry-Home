import { createAdminClient } from "../supabase";

export class DelayPredictor {
  /**
   * For a given order, check if its area is currently over capacity
   * and set ai_prediction accordingly.
   */
  async predict(orderId: string, pickupArea: string): Promise<void> {
    const admin = createAdminClient();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    // Count active orders in the same area right now
    const { count: activeCount } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("pickup_area", pickupArea)
      .not("status", "in", `("delivered","completed","cancelled")`);

    // Get historical average from area_demand
    const { data: demand } = await admin
      .from("area_demand")
      .select("orders")
      .eq("area", pickupArea)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const avgDaily = (demand as any)?.orders ?? 10;
    // Estimate hourly average from daily
    const avgHourly = Math.max(1, Math.round(avgDaily / 12));

    const current = activeCount ?? 0;
    const ratio = current / avgHourly;

    let delayRisk: "low" | "medium" | "high";
    let delayReason: string | null = null;

    if (ratio >= 2.0) {
      delayRisk = "high";
      delayReason = `Area ${pickupArea} is at ${current} active orders (${Math.round(ratio)}x normal)`;
    } else if (ratio >= 1.3) {
      delayRisk = "medium";
      delayReason = `Area ${pickupArea} is busier than usual (${Math.round(ratio)}x normal)`;
    } else {
      delayRisk = "low";
    }

    // Estimate completion time based on vendor capacity
    const estimatedCompletionHrs = ratio >= 2.0 ? 6 : ratio >= 1.3 ? 4 : 2;

    await admin
      .from("orders")
      .update({
        ai_prediction: {
          confidence: Math.min(0.95, ratio / 3),
          estimatedCompletionHrs,
          delayRisk,
          delayReason,
        },
      })
      .eq("id", orderId);
  }
}

export const delayPredictor = new DelayPredictor();
