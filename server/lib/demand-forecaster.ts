import { createAdminClient } from "../supabase";

export class DemandForecaster {
  /**
   * Compute 7-day average order volume per area and write to area_demand.
   * Also calculates week-over-week growth percentage.
   */
  async runForecast(): Promise<{ areasProcessed: number }> {
    const admin = createAdminClient();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Get unique pickup areas from orders
    const { data: areas } = await admin
      .from("orders")
      .select("pickup_area")
      .not("pickup_area", "is", null)
      .limit(500);

    if (!areas) return { areasProcessed: 0 };

    const areaSet = new Set<string>();
    for (const row of areas) {
      if (row.pickup_area) areaSet.add(row.pickup_area);
    }

    let processed = 0;

    for (const areaName of areaSet) {
      // Orders in last 7 days
      const { count: recentCount } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("pickup_area", areaName)
        .gte("created_at", sevenDaysAgo)
        .lt("created_at", todayStr + "T23:59:59Z");

      // Orders in previous 7 days (for growth calc)
      const { count: prevCount } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("pickup_area", areaName)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo);

      const recent = recentCount ?? 0;
      const previous = prevCount ?? 0;
      const growth = previous > 0
        ? Math.round(((recent - previous) / previous) * 100 * 10) / 10
        : 0;

      await admin
        .from("area_demand")
        .upsert({
          area: areaName,
          orders: recent,
          growth,
          snapshot_date: todayStr,
        }, { onConflict: "area,snapshot_date", ignoreDuplicates: false });

      processed++;
    }

    return { areasProcessed: processed };
  }
}

export const demandForecaster = new DemandForecaster();
