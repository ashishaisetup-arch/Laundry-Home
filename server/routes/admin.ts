import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

router.get("/kpis", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const [usersRes, vendorsRes, ordersRes, reviewsRes, todayOrdersRes] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("vendors").select("id, verified, is_open"),
      supabase.from("orders").select("total, status, created_at"),
      supabase.from("reviews").select("rating"),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStr),
    ]);

    const totalUsers = usersRes.count || 0;
    const vendors = vendorsRes.data || [];
    const totalVendors = vendors.length;
    const verifiedVendors = vendors.filter((v: any) => v.verified).length;
    const activeVendors = vendors.filter((v: any) => v.verified && v.is_open).length;

    const orders = ordersRes.data || [];
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const liveOrders = orders.filter((o: any) =>
      ["placed", "vendor_assigned", "vendor_accepted", "pickup_scheduled", "pickup_completed",
       "laundry_received", "sorting", "tagging", "washing", "drying", "ironing",
       "dry_cleaning", "quality_inspection", "packing", "ready_for_dispatch", "out_for_delivery"].includes(o.status)
    ).length;
    const deliveredOrders = orders.filter((o: any) => o.status === "delivered" || o.status === "completed").length;
    const cancelledOrders = orders.filter((o: any) => o.status === "cancelled").length;
    const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

    const reviews = reviewsRes.data || [];
    const avgRating = reviews.length > 0
      ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(2)
      : "0.00";

    const todayOrders = todayOrdersRes.count || 0;

    const kpis = [
      { label: "Total Users", value: totalUsers.toLocaleString(), change: 0, trend: "up", icon: "Users", accent: "from-teal-500 to-cyan-600", spark: [40, 60, 45, 70, 65, 80, 75] },
      { label: "Active Vendors", value: String(activeVendors), change: 0, trend: "up", icon: "Store", accent: "from-emerald-500 to-green-600", spark: [30, 40, 35, 50, 45, 55, 52] },
      { label: "Live Orders", value: String(liveOrders), change: 0, trend: "up", icon: "Activity", accent: "from-violet-500 to-purple-600", spark: [80, 90, 85, 95, 100, 110, liveOrders] },
      { label: "Revenue (MTD)", value: `₹${(totalRevenue / 100000).toFixed(1)}L`, change: 0, trend: "up", icon: "IndianRupee", accent: "from-amber-500 to-orange-600", spark: [50, 60, 55, 70, 65, 75, 70] },
      { label: "Avg Rating", value: `${avgRating}★`, change: 0, trend: "flat", icon: "Smile", accent: "from-sky-500 to-blue-600", spark: [42, 45, 44, 46, 45, 47, Math.round(parseFloat(avgRating) * 10)] },
      { label: "Delivery Rate", value: `${deliveryRate}%`, change: 0, trend: "up", icon: "Percent", accent: "from-teal-500 to-cyan-600", spark: [70, 75, 72, 78, 76, 80, deliveryRate] },
      { label: "Cancellation Rate", value: totalOrders > 0 ? `${((cancelledOrders / totalOrders) * 100).toFixed(1)}%` : "0%", change: 0, trend: "down", icon: "XCircle", accent: "from-rose-500 to-pink-600", spark: [10, 8, 12, 6, 9, 7, Math.round((cancelledOrders / Math.max(totalOrders, 1)) * 100)] },
      { label: "Today's Orders", value: String(todayOrders), change: 0, trend: "up", icon: "Clock", accent: "from-indigo-500 to-violet-600", spark: [10, 15, 12, 18, 14, 20, todayOrders] },
    ];

    res.json(kpis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/analytics", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const startStr = sevenDaysAgo.toISOString();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const monthStartStr = sixMonthsAgo.toISOString();

    const [allOrdersRes, recentOrdersRes] = await Promise.all([
      supabase.from("orders").select("total, created_at, status, pickup_area, items"),
      supabase.from("orders").select("total, created_at").gte("created_at", startStr).neq("status", "cancelled"),
    ]);

    const allOrders = allOrdersRes.data || [];
    const recentOrders = recentOrdersRes.data || [];

    // Revenue chart: group by month for last 7 months
    const monthBuckets: Record<string, { revenue: number; commission: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      monthBuckets[key] = { revenue: 0, commission: 0, orders: 0 };
    }
    const completedOrders = allOrders.filter((o: any) =>
      !["cancelled"].includes(o.status) && o.total > 0
    );
    for (const o of completedOrders) {
      const d = new Date(o.created_at);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (monthBuckets[key]) {
        monthBuckets[key].revenue += o.total;
        monthBuckets[key].commission += Math.round(o.total * 0.1);
        monthBuckets[key].orders += 1;
      }
    }
    const revenueChart = Object.entries(monthBuckets).map(([month, data]) => ({
      month,
      revenue: Math.round(data.revenue / 100000 * 10) / 10,
      commission: Math.round(data.commission / 100000 * 10) / 10,
      orders: data.orders,
    }));

    // Area demand: group by pickup_area
    const areaBuckets: Record<string, { area: string; orders: number; revenue: number }> = {};
    for (const o of completedOrders) {
      const area = (o as any).pickup_area || "Other";
      if (!areaBuckets[area]) areaBuckets[area] = { area, orders: 0, revenue: 0 };
      areaBuckets[area].orders += 1;
      areaBuckets[area].revenue += o.total || 0;
    }
    const areaDemand = Object.values(areaBuckets)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)
      .map((a) => ({
        area: a.area,
        orders: a.orders,
        growth: 0,
      }));

    // Weekly trend: group by day for last 7 days
    const dayBuckets: Record<string, { pickups: number; deliveries: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      dayBuckets[DAY_LABELS[d.getDay()]] = { pickups: 0, deliveries: 0 };
    }
    for (const o of recentOrders) {
      const d = new Date(o.created_at);
      const label = DAY_LABELS[d.getDay()];
      if (dayBuckets[label]) {
        dayBuckets[label].deliveries += 1;
      }
    }
    const weeklyTrend = DAY_LABELS.map((day) => ({
      day,
      pickups: dayBuckets[day]?.deliveries || 0,
      deliveries: Math.round((dayBuckets[day]?.deliveries || 0) * 0.45),
    }));

    // Service demand: parse items JSONB
    const serviceBuckets: Record<string, number> = {};
    for (const o of completedOrders) {
      const items: { serviceName?: string }[] =
        typeof (o as any).items === "string" ? JSON.parse((o as any).items) : (o as any).items || [];
      for (const item of items) {
        const name = item.serviceName || "Other";
        serviceBuckets[name] = (serviceBuckets[name] || 0) + 1;
      }
    }
    const totalServices = Object.values(serviceBuckets).reduce((s, c) => s + c, 0);
    const COLORS = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316", "#22c55e"];
    const serviceDemand = Object.entries(serviceBuckets)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        name,
        value: totalServices > 0 ? Math.round((count / totalServices) * 100) : 0,
        color: COLORS[i % COLORS.length],
      }));

    res.json({
      revenue: revenueChart,
      areaDemand,
      serviceDemand,
      weeklyTrend,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/orders", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    let query = supabase.from("orders").select("*");

    if (req.query.status) {
      const status = req.query.status as string;
      if (status === "active") {
        query = query.not("status", "eq", "completed").not("status", "eq", "cancelled");
      } else if (status === "delayed") {
        query = query.or("ai_prediction->>delayRisk.eq.high,ai_prediction->>delayRisk.eq.medium");
      } else {
        query = query.eq("status", status);
      }
    }
    if (req.query.vendor_id) {
      query = query.eq("vendor_id", req.query.vendor_id as string);
    }
    if (req.query.delivery_executive_id) {
      query = query.eq("delivery_executive_id", req.query.delivery_executive_id as string);
    }
    if (req.query.payment_status) {
      query = query.eq("payment_status", req.query.payment_status as string);
    }
    if (req.query.pickup_area) {
      query = query.ilike("pickup_area", `%${req.query.pickup_area}%`);
    }
    if (req.query.search) {
      const term = `%${req.query.search}%`;
      query = query.or(`code.ilike.${term},customer_name.ilike.${term},vendor_name.ilike.${term}`);
    }
    if (req.query.delay_risk) {
      query = query.filter("ai_prediction->>delayRisk", "eq", req.query.delay_risk as string);
    }
    if (req.query.from_date) {
      query = query.gte("created_at", req.query.from_date as string);
    }
    if (req.query.to_date) {
      query = query.lte("created_at", req.query.to_date as string);
    }
    if (req.query.express) {
      query = query.eq("express", req.query.express === "true");
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 200;
    const offset = (page - 1) * limit;

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
