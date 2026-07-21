import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

const COLORS = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

router.get("/", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }

    const supabase = createAdminClient();
    const [vendorRes, ordersRes, reviewsRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).single(),
      supabase.from("orders").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10),
      supabase.from("reviews").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(20),
    ]);

    res.json({ vendor: vendorRes.data, recentOrders: ordersRes.data || [], reviews: reviewsRes.data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/weekly-revenue", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }

    const supabase = createAdminClient();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const startStr = sevenDaysAgo.toISOString();

    const { data: orders } = await supabase
      .from("orders")
      .select("total, created_at, status")
      .eq("vendor_id", vendorId)
      .gte("created_at", startStr)
      .neq("status", "cancelled");

    const dayBuckets: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      dayBuckets[DAY_LABELS[d.getDay()]] = { revenue: 0, orders: 0 };
    }

    for (const o of orders || []) {
      const d = new Date(o.created_at);
      const label = DAY_LABELS[d.getDay()];
      if (dayBuckets[label]) {
        dayBuckets[label].revenue += o.total || 0;
        dayBuckets[label].orders += 1;
      }
    }

    const result = DAY_LABELS.map((day) => ({
      day,
      revenue: dayBuckets[day]?.revenue || 0,
      orders: dayBuckets[day]?.orders || 0,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/service-revenue", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }

    const supabase = createAdminClient();
    const { data: orders } = await supabase
      .from("orders")
      .select("items, total")
      .eq("vendor_id", vendorId)
      .neq("status", "cancelled");

    const serviceBuckets: Record<string, number> = {};
    let totalRevenue = 0;

    for (const o of orders || []) {
      if (!o.total) continue;
      totalRevenue += o.total;

      const items: { serviceName?: string; unitPrice?: number; qty?: number }[] =
        typeof o.items === "string" ? JSON.parse(o.items) : o.items || [];

      if (items.length > 0) {
        const orderItemTotal = items.reduce((s, i) => s + (i.unitPrice || 0) * (i.qty || 0), 0);
        for (const item of items) {
          const name = item.serviceName || "Other";
          const proportion = orderItemTotal > 0 ? ((item.unitPrice || 0) * (item.qty || 0)) / orderItemTotal : 0;
          serviceBuckets[name] = (serviceBuckets[name] || 0) + (o.total || 0) * proportion;
        }
      }
    }

    const entries = Object.entries(serviceBuckets).sort((a, b) => b[1] - a[1]);
    const result = entries.map(([name, revenue], i) => ({
      name,
      revenue: Math.round(revenue),
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
      color: COLORS[i % COLORS.length],
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }

    const supabase = createAdminClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const startStr = sevenDaysAgo.toISOString();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const [ordersRes, reviewsRes, allOrdersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total, created_at, customer_id, status")
        .eq("vendor_id", vendorId)
        .neq("status", "cancelled"),
      supabase
        .from("reviews")
        .select("overall")
        .eq("vendor_id", vendorId),
      supabase
        .from("orders")
        .select("total, created_at, customer_id")
        .eq("vendor_id", vendorId)
        .neq("status", "cancelled"),
    ]);

    const allOrders = ordersRes.data || [];
    const totalOrdersThisWeek = allOrders.filter((o) => o.created_at >= startStr).length;
    const weeklyRevenue = allOrders
      .filter((o) => o.created_at >= startStr)
      .reduce((s, o) => s + (o.total || 0), 0);
    const ordersThisWeek = allOrders.filter((o) => o.created_at >= startStr);
    const avgOrderValue = ordersThisWeek.length > 0 ? Math.round(weeklyRevenue / ordersThisWeek.length) : 0;

    const uniqueCustomers = new Set(allOrders.map((o) => o.customer_id));
    const repeatCustomers = allOrdersRes.data
      ? Array.from(uniqueCustomers).filter((cid) =>
          (allOrdersRes.data || []).filter((o) => o.customer_id === cid).length > 1
        ).length
      : 0;
    const repeatRate = uniqueCustomers.size > 0 ? Math.round((repeatCustomers / uniqueCustomers.size) * 100) : 0;

    const reviews = reviewsRes.data || [];
    const avgRating =
      reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.overall, 0) / reviews.length)
        : 0;

    const ratingBuckets: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      const star = Math.round(r.overall);
      if (star >= 1 && star <= 5) ratingBuckets[star]++;
    }
    const totalReviews = reviews.length;

    const todayOrders = allOrders.filter((o) => o.created_at >= todayStr).length;
    const todayRevenue = allOrders
      .filter((o) => o.created_at >= todayStr)
      .reduce((s, o) => s + (o.total || 0), 0);

    res.json({
      totalOrdersThisWeek,
      weeklyRevenue,
      avgOrderValue,
      repeatRate,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews,
      ratingBuckets,
      todayOrders,
      todayRevenue,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/inventory", async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string;
    if (!vendorId) { res.status(400).json({ error: "vendorId required" }); return; }
    const supabase = createAdminClient();
    const { data } = await supabase.from("garment_inventory").select("*, orders!inner(vendor_id)").eq("orders.vendor_id", vendorId);
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
