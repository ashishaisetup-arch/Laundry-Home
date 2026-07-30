import { createAdminClient } from "../supabase";

export interface Insight {
  type: "warning" | "info" | "positive";
  severity: "high" | "medium" | "low";
  message: string;
  detail: string;
  link?: string;
}

export class AIAnalyticsService {
  async getInsights(): Promise<Insight[]> {
    const admin = createAdminClient();
    const insights: Insight[] = [];

    // 1. Orders at risk of delay (ai_prediction delayRisk = high)
    const { data: atRiskOrders } = await admin
      .from("orders")
      .select("code, pickup_area, ai_prediction, id")
      .not("ai_prediction", "is", null)
      .not("status", "in", `("delivered","completed","cancelled")`)
      .limit(10);

    if (atRiskOrders) {
      const highRisk = atRiskOrders.filter((o: any) => o.ai_prediction?.delayRisk === "high");
      if (highRisk.length > 0) {
        const areas = [...new Set(highRisk.map((o: any) => o.pickup_area).filter(Boolean))];
        insights.push({
          type: "warning",
          severity: "high",
          message: `${highRisk.length} order${highRisk.length > 1 ? "s" : ""} at high risk of delay`,
          detail: areas.length > 0
            ? `Areas affected: ${areas.join(", ")}`
            : "Check the order monitoring dashboard for details.",
          link: "/admin/orders",
        });
      }

      const mediumRisk = atRiskOrders.filter((o: any) => o.ai_prediction?.delayRisk === "medium");
      if (mediumRisk.length > 2) {
        insights.push({
          type: "info",
          severity: "medium",
          message: `${mediumRisk.length} orders flagged with medium delay risk`,
          detail: "Monitor these orders closely and consider reallocating delivery partners.",
          link: "/admin/orders",
        });
      }
    }

    // 2. Area demand growth trends
    const { data: demandTrends } = await admin
      .from("area_demand")
      .select("area, orders, growth, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(20);

    if (demandTrends && demandTrends.length > 0) {
      const growing = demandTrends.filter((d: any) => d.growth > 20);
      for (const g of growing.slice(0, 3)) {
        insights.push({
          type: "positive",
          severity: "low",
          message: `${g.area} demand up ${g.growth}% week-over-week`,
          detail: `${g.orders} orders this week — consider onboarding more vendors in this area.`,
        });
      }

      const declining = demandTrends.filter((d: any) => d.growth < -20);
      if (declining.length > 0) {
        insights.push({
          type: "info",
          severity: "low",
          message: `${declining.length} area${declining.length > 1 ? "s" : ""} seeing demand decline`,
          detail: declining.map((d: any) => `${d.area} (${d.growth}%)`).join(", "),
        });
      }
    }

    // 3. Vendors near capacity
    const { data: vendors } = await admin
      .from("vendors")
      .select("name, capacity_used_pct, area")
      .gte("capacity_used_pct", 80)
      .limit(5);

    if (vendors && vendors.length > 0) {
      insights.push({
        type: "warning",
        severity: vendors.some((v: any) => v.capacity_used_pct >= 95) ? "high" : "medium",
        message: `${vendors.length} vendor${vendors.length > 1 ? "s" : ""} at ≥80% capacity`,
        detail: vendors.map((v: any) => `${v.name} (${v.capacity_used_pct}%)`).join(", "),
        link: "/admin/vendors",
      });
    }

    return insights;
  }
}

export const aiAnalytics = new AIAnalyticsService();
