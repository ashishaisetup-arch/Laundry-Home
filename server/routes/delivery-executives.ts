import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

// Degrees to radians
function toRad(deg: number) { return (deg * Math.PI) / 180; }

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/delivery-executives — list all delivery execs with workload + availability
router.get("/", async (_req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_profiles")
      .select("id, name, email, phone, avatar, is_available, current_lat, current_lng, max_daily_orders")
      .eq("role", "delivery")
      .order("name");

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Fetch assigned order counts for all execs
    const execIds = (data || []).map((e) => e.id);
    let workloads: Record<string, number> = {};
    if (execIds.length > 0) {
      const { data: counts } = await admin
        .from("delivery_tasks")
        .select("exec_id, status")
        .in("exec_id", execIds);
      const activeStatuses = new Set(["pending","heading_to_pickup","picked_up","heading_to_vendor","reached_vendor","ready_for_delivery","out_for_delivery"]);
      for (const row of counts || []) {
        if (activeStatuses.has(row.status)) {
          workloads[row.exec_id] = (workloads[row.exec_id] || 0) + 1;
        }
      }
    }

    const result = (data || []).map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone,
      avatar: e.avatar,
      isAvailable: e.is_available,
      currentLat: e.current_lat ? Number(e.current_lat) : null,
      currentLng: e.current_lng ? Number(e.current_lng) : null,
      maxDailyOrders: e.max_daily_orders,
      assignedOrders: workloads[e.id] || 0,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delivery-executives/available — find best execs for a pickup/delivery
// Query params: pickup_lat, pickup_lng (optional), order_id (optional)
router.get("/available", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const pickupLat = req.query.pickup_lat ? parseFloat(req.query.pickup_lat as string) : null;
    const pickupLng = req.query.pickup_lng ? parseFloat(req.query.pickup_lng as string) : null;
    const orderId = (req.query.order_id as string) || null;

    // Fetch available execs
    const { data, error } = await admin
      .from("user_profiles")
      .select("id, name, email, phone, avatar, is_available, current_lat, current_lng, max_daily_orders")
      .eq("role", "delivery")
      .eq("is_available", true)
      .order("name");

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Fetch workload counts
    const execIds = (data || []).map((e) => e.id);
    let workloads: Record<string, number> = {};
    if (execIds.length > 0) {
      const { data: counts } = await admin
        .from("delivery_tasks")
        .select("exec_id, status")
        .in("exec_id", execIds);
      const activeStatuses = new Set(["pending","heading_to_pickup","picked_up","heading_to_vendor","reached_vendor","ready_for_delivery","out_for_delivery"]);
      for (const row of counts || []) {
        if (activeStatuses.has(row.status)) {
          workloads[row.exec_id] = (workloads[row.exec_id] || 0) + 1;
        }
      }
    }

    // If orderId is provided, exclude the currently assigned exec
    let excludeExecId: string | null = null;
    if (orderId) {
      const { data: order } = await admin
        .from("orders")
        .select("delivery_executive_id")
        .eq("id", orderId)
        .single();
      excludeExecId = order?.delivery_executive_id || null;
    }

    const result = (data || [])
      .filter((e) => e.id !== excludeExecId)
      .map((e) => {
        const assigned = workloads[e.id] || 0;
        const maxOrders = e.max_daily_orders || 10;
        const capacityPct = maxOrders > 0 ? assigned / maxOrders : 1;
        let distanceKm = 0;
        if (pickupLat != null && pickupLng != null && e.current_lat != null && e.current_lng != null) {
          distanceKm = haversineKm(
            pickupLat, pickupLng,
            Number(e.current_lat), Number(e.current_lng)
          );
        }
        // Score: lower is better — weighted combination of workload (60%) and distance (40%)
        const workloadScore = capacityPct * 60;
        const distanceScore = distanceKm > 0 ? Math.min(distanceKm / 20, 1) * 40 : 0;
        const score = workloadScore + distanceScore;
        return {
          id: e.id,
          name: e.name,
          email: e.email,
          phone: e.phone,
          avatar: e.avatar,
          isAvailable: e.is_available,
          currentLat: e.current_lat ? Number(e.current_lat) : null,
          currentLng: e.current_lng ? Number(e.current_lng) : null,
          maxDailyOrders: maxOrders,
          assignedOrders: assigned,
          distanceKm: Math.round(distanceKm * 10) / 10,
          score: Math.round(score * 100) / 100,
        };
      })
      .sort((a, b) => a.score - b.score);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delivery-executives/earnings — earnings stats for current delivery exec
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Start of current week (Monday)
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString();

    // Fetch completed delivery tasks
    const { data: allTasks } = await admin
      .from("delivery_tasks")
      .select("*")
      .eq("exec_id", user.id)
      .in("status", ["delivered"])
      .order("updated_at", { ascending: false });

    const tasks = allTasks || [];

    // Today's earnings
    const todayTasks = tasks.filter((t) => new Date(t.updated_at) >= today);
    const todayEarnings = todayTasks.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Weekly earnings
    const weekTasks = tasks.filter((t) => new Date(t.updated_at) >= weekStart);
    const weekEarnings = weekTasks.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Total trips completed by this exec
    const totalTrips = tasks.length;

    // Avg per trip
    const avgPerTrip = totalTrips > 0 ? Math.round(weekEarnings / totalTrips) : 0;

    // Weekly chart data (earnings per day Mon-Sun)
    const weekDays: { day: string; earnings: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dayTasks = tasks.filter((t) => {
        const tDate = new Date(t.updated_at);
        return tDate >= dayStart && tDate <= dayEnd;
      });
      const dayEarnings = dayTasks.reduce((sum, t) => sum + (t.amount || 0), 0);
      weekDays.push({ day: dayLabel, earnings: dayEarnings });
    }

    // Recent payouts (from wallet transactions if available, otherwise derive from tasks)
    const { data: txns } = await admin
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "credit")
      .order("created_at", { ascending: false })
      .limit(20);

    const recentPayouts = (txns || []).map((t) => ({
      id: t.id,
      amount: t.amount,
      method: t.method || "bank transfer",
      status: t.status || "completed",
      date: t.created_at,
      description: t.description || "Delivery earnings",
    }));

    res.json({
      todayEarnings,
      weekEarnings,
      totalTrips,
      avgPerTrip,
      weekChart: weekDays,
      recentPayouts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
