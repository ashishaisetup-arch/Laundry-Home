import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";
import {
  resolveVendorId,
  parseDateRange,
  resolveDateBoundaries,
  resolveBusinessTimezone,
  buildOrderQuery,
  computeTurnaroundHours,
  computeOnTimeRate,
  computeRepeatRate,
  COLORS,
  CUSTOMER_SEGMENTS,
} from "./vendor-reports-utils";

const router = Router();

// ── 1. Overview ──

router.get("/overview", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = orders || [];

    const completedOrders = allOrders.filter((o: any) => ["completed", "delivered"].includes(o.status));
    const cancelledOrders = allOrders.filter((o: any) => o.status === "cancelled");
    const totalRevenue = completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const aov = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

    const { repeatRate, repeatCount, uniqueCustomers } = computeRepeatRate(allOrders);
    const avgTurnaroundHrs = computeTurnaroundHours(allOrders);
    const onTimeRate = computeOnTimeRate(allOrders);

    const cancellationRate = allOrders.length > 0 ? Math.round((cancelledOrders.length / allOrders.length) * 100) : 0;

    const { data: reviews } = await supabase
      .from("reviews")
      .select("overall")
      .eq("vendor_id", vendorId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);
    const allReviews = reviews || [];
    const avgRating = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.overall || 0), 0) / allReviews.length) * 10) / 10
      : 0;

    const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const prevStart = new Date(new Date(startDate).getTime() - periodMs).toISOString();
    const { data: prevOrders } = await buildOrderQuery(supabase, vendorId, prevStart, startDate, service, status);
    const prevAll = prevOrders || [];
    const prevCompleted = prevAll.filter((o: any) => ["completed", "delivered"].includes(o.status));
    const prevRevenue = prevCompleted.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    const ordersChange = prevAll.length > 0 ? Math.round(((allOrders.length - prevAll.length) / prevAll.length) * 100) : 0;

    const delayed = allOrders.filter((o: any) =>
      !["completed", "cancelled", "delivered"].includes(o.status) &&
      o.estimated_delivery_at && new Date(o.estimated_delivery_at) < new Date()
    );

    const serviceMap: Record<string, number> = {};
    completedOrders.forEach((o: any) => {
      const items = o.items_v2 || o.items || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const name = item.serviceName || item.serviceKey || "Unknown";
          serviceMap[name] = (serviceMap[name] || 0) + (item.unitPrice || 0) * (item.qty || 1);
        });
      }
    });
    const topServiceEntry = Object.entries(serviceMap).sort((a, b) => b[1] - a[1])[0];

    const dayMap: Record<string, number> = {};
    completedOrders.forEach((o: any) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      dayMap[day] = (dayMap[day] || 0) + (o.total || 0);
    });
    const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];

    const customerCounts: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      if (o.customer_id) customerCounts[o.customer_id] = (customerCounts[o.customer_id] || 0) + 1;
    });
    const topCustomerEntry = Object.entries(customerCounts).sort((a, b) => b[1] - a[1])[0];

    const revenueTrend = Object.entries(dayMap).map(([day, revenue]) => ({ day, revenue })).sort((a, b) => a.day.localeCompare(b.day));
    const ordersTrendMap: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      ordersTrendMap[day] = (ordersTrendMap[day] || 0) + 1;
    });
    const ordersTrend = Object.entries(ordersTrendMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));

    res.json({
      totalOrders: allOrders.length,
      totalRevenue,
      aov,
      avgTurnaroundHrs,
      repeatRate,
      onTimeRate,
      cancellationRate,
      avgRating,
      totalReviews: allReviews.length,
      revenueChange,
      ordersChange,
      delayedCount: delayed.length,
      topService: topServiceEntry ? { name: topServiceEntry[0], revenue: topServiceEntry[1] } : null,
      bestDay: bestDayEntry ? { day: bestDayEntry[0], revenue: bestDayEntry[1] } : null,
      mostActiveCustomer: topCustomerEntry ? { name: topCustomerEntry[0], orderCount: topCustomerEntry[1] } : null,
      revenueTrend,
      ordersTrend,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. Sales & Revenue ──

router.get("/sales-revenue", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = (orders || []).filter((o: any) => o.status !== "cancelled");

    const subtotal = allOrders.reduce((s: number, o: any) => s + (o.amount || 0), 0);
    const couponDiscount = allOrders.reduce((s: number, o: any) => s + (o.coupon_discount || 0), 0);
    const subscriptionDiscount = allOrders.reduce((s: number, o: any) => s + (o.subscription_discount || 0), 0);
    const refunds = allOrders.filter((o: any) => o.payment_status === "refunded").reduce((s: number, o: any) => s + (o.total || 0), 0);
    const platformFees = allOrders.reduce((s: number, o: any) => s + (o.platform_fee || 0), 0);
    const deliveryFees = allOrders.reduce((s: number, o: any) => s + (o.delivery_fee || 0), 0);
    const expressSurcharges = allOrders.reduce((s: number, o: any) => s + (o.express_surcharge || 0), 0);
    const taxes = allOrders.reduce((s: number, o: any) => s + (o.taxes || 0), 0);

    const netOrderValue = subtotal - couponDiscount - subscriptionDiscount;
    const grossRevenue = allOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const estimatedCommission = Math.round(grossRevenue * 0.10);
    const estimatedVendorEarnings = grossRevenue - estimatedCommission;

    const dailyMap: Record<string, { revenue: number; orders: number }> = {};
    allOrders.forEach((o: any) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, orders: 0 };
      dailyMap[day].revenue += o.total || 0;
      dailyMap[day].orders += 1;
    });
    const dailyRevenue = Object.entries(dailyMap)
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const serviceMap: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      const items = o.items_v2 || o.items || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const name = item.serviceName || item.serviceKey || "Unknown";
          serviceMap[name] = (serviceMap[name] || 0) + (item.unitPrice || 0) * (item.qty || 1);
        });
      }
    });
    const totalServiceRevenue = Object.values(serviceMap).reduce((s, v) => s + v, 0);
    const revenueByService = Object.entries(serviceMap)
      .map(([name, revenue], i) => ({
        name,
        revenue,
        percentage: totalServiceRevenue > 0 ? Math.round((revenue / totalServiceRevenue) * 100) : 0,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const paymentMap: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      const method = o.payment_method || "unknown";
      paymentMap[method] = (paymentMap[method] || 0) + (o.total || 0);
    });
    const totalPaymentRevenue = Object.values(paymentMap).reduce((s, v) => s + v, 0);
    const revenueByPaymentMethod = Object.entries(paymentMap).map(([method, revenue]) => ({
      method,
      revenue,
      percentage: totalPaymentRevenue > 0 ? Math.round((revenue / totalPaymentRevenue) * 100) : 0,
    }));

    const dayOfWeekMap: Record<string, { revenue: number; orders: number }> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    allOrders.forEach((o: any) => {
      const d = new Date(o.created_at);
      const dayName = dayNames[d.getDay()];
      if (!dayOfWeekMap[dayName]) dayOfWeekMap[dayName] = { revenue: 0, orders: 0 };
      dayOfWeekMap[dayName].revenue += o.total || 0;
      dayOfWeekMap[dayName].orders += 1;
    });
    const revenueByDayOfWeek = dayNames.map((day) => ({
      day,
      revenue: dayOfWeekMap[day]?.revenue || 0,
      orders: dayOfWeekMap[day]?.orders || 0,
    }));

    const sorted = [...dailyRevenue].sort((a, b) => b.revenue - a.revenue);
    const topDay = sorted[0] || null;
    const worstDay = sorted[sorted.length - 1] || null;

    const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const prevStart = new Date(new Date(startDate).getTime() - periodMs).toISOString();
    const { data: prevOrders } = await buildOrderQuery(supabase, vendorId, prevStart, startDate, service, status);
    const prevAll = (prevOrders || []).filter((o: any) => o.status !== "cancelled");
    const prevRevenue = prevAll.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const revenueGrowth = prevRevenue > 0 ? Math.round(((grossRevenue - prevRevenue) / prevRevenue) * 100) : 0;

    res.json({
      subtotal,
      couponDiscount,
      subscriptionDiscount,
      netOrderValue,
      refunds,
      platformFees,
      deliveryFees,
      expressSurcharges,
      taxes,
      grossRevenue,
      estimatedCommission,
      estimatedVendorEarnings,
      dailyRevenue,
      revenueByService,
      revenueByPaymentMethod,
      revenueByDayOfWeek,
      topDay,
      worstDay,
      revenueGrowth,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Orders & Operations ──

router.get("/orders-operations", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = orders || [];

    const completedOrders = allOrders.filter((o: any) => ["completed", "delivered"].includes(o.status));
    const avgTurnaroundHrs = computeTurnaroundHours(allOrders);
    const onTimeRate = computeOnTimeRate(allOrders);

    const delayed = allOrders.filter((o: any) =>
      !["completed", "cancelled", "delivered"].includes(o.status) &&
      o.estimated_delivery_at && new Date(o.estimated_delivery_at) < new Date()
    );

    const express = allOrders.filter((o: any) => o.express);

    const statusCounts: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    const stageOrder = ["placed", "vendor_assigned", "processing", "ready", "out_for_delivery", "delivered", "completed"];
    const funnelStages = stageOrder.map((stage, i) => {
      const count = statusCounts[stage] || 0;
      const prevCount = i > 0 ? (statusCounts[stageOrder[i - 1]] || 0) : allOrders.length;
      return {
        stage,
        count,
        conversionRate: prevCount > 0 ? Math.round((count / prevCount) * 100) : null,
        avgTimeHours: null as number | null,
      };
    });

    const dayMap: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const ordersByDay = Object.entries(dayMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));

    const buckets = ["< 24h", "24-48h", "48-72h", "72-96h", "96h+"];
    const turnaroundMap: Record<string, number> = {};
    buckets.forEach((b) => turnaroundMap[b] = 0);
    completedOrders.forEach((o: any) => {
      if (!o.estimated_delivery_at || !o.created_at) return;
      const hours = (new Date(o.updated_at || o.estimated_delivery_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60);
      if (hours < 24) turnaroundMap["< 24h"]++;
      else if (hours < 48) turnaroundMap["24-48h"]++;
      else if (hours < 72) turnaroundMap["48-72h"]++;
      else if (hours < 96) turnaroundMap["72-96h"]++;
      else turnaroundMap["96h+"]++;
    });
    const turnaroundHistogram = buckets.map((bucket) => ({ bucket, count: turnaroundMap[bucket] }));

    const attentionCategories = {
      pendingPickup: statusCounts["placed"] || 0,
      delayedInProgress: delayed.length,
      qualityIssues: 0,
      failedCancelled: statusCounts["cancelled"] || 0,
    };

    const topDelayedOrders = delayed.slice(0, 10).map((o: any) => ({
      id: o.id, code: o.code, customerName: o.customer_name, total: o.total, createdAt: o.created_at,
    }));

    res.json({
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      avgTurnaroundHrs,
      onTimeRate,
      delayedCount: delayed.length,
      expressOrders: express.length,
      funnelStages,
      statusDistribution: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      ordersByDay,
      turnaroundHistogram,
      expressVsRegular: {
        express: { count: express.length, revenue: express.reduce((s: number, o: any) => s + (o.total || 0), 0) },
        regular: { count: allOrders.length - express.length, revenue: allOrders.filter((o: any) => !o.express).reduce((s: number, o: any) => s + (o.total || 0), 0) },
      },
      attentionCategories,
      delayedDrillDown: { status: "processing", delayed: true, startDate, endDate },
      topDelayedOrders,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. Services ──

router.get("/services", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = (orders || []).filter((o: any) => o.status !== "cancelled");

    const serviceMap: Record<string, { orderCount: number; revenue: number }> = {};
    allOrders.forEach((o: any) => {
      const items = o.items_v2 || o.items || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const name = item.serviceName || item.serviceKey || "Unknown";
          if (!serviceMap[name]) serviceMap[name] = { orderCount: 0, revenue: 0 };
          serviceMap[name].orderCount += 1;
          serviceMap[name].revenue += (item.unitPrice || 0) * (item.qty || 1);
        });
      }
    });

    const { data: reviews } = await supabase
      .from("reviews")
      .select("overall")
      .eq("vendor_id", vendorId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);
    const allReviews = reviews || [];
    const avgRating = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.overall || 0), 0) / allReviews.length) * 10) / 10
      : 0;

    const totalRevenue = allOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);

    const services = Object.entries(serviceMap).map(([name, data]) => ({
      name,
      orderCount: data.orderCount,
      revenue: data.revenue,
      aov: data.orderCount > 0 ? Math.round(data.revenue / data.orderCount) : 0,
      avgTurnaroundHrs: null as number | null,
      avgRating,
      revenueShare: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
      cancellationRate: 0,
      repeatRate: 0,
    })).sort((a, b) => b.revenue - a.revenue);

    const revenueByService = services.map((s, i) => ({
      name: s.name,
      revenue: s.revenue,
      color: COLORS[i % COLORS.length],
    }));
    const orderVolumeByService = services.map((s, i) => ({
      name: s.name,
      count: s.orderCount,
      color: COLORS[i % COLORS.length],
    }));

    res.json({
      topRevenueService: services[0] ? { name: services[0].name, revenue: services[0].revenue } : null,
      mostOrderedService: [...services].sort((a, b) => b.orderCount - a.orderCount)[0]
        ? { name: [...services].sort((a, b) => b.orderCount - a.orderCount)[0].name, orderCount: [...services].sort((a, b) => b.orderCount - a.orderCount)[0].orderCount }
        : null,
      highestRatedService: services[0] ? { name: services[0].name, avgRating: services[0].avgRating } : null,
      fastestService: null,
      revenueByService,
      orderVolumeByService,
      services,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. Customers ──

router.get("/customers", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = orders || [];
    const completedOrders = allOrders.filter((o: any) => ["completed", "delivered"].includes(o.status));

    const customerMap: Record<string, { name: string; orderCount: number; totalSpend: number; lastOrder: string }> = {};
    allOrders.forEach((o: any) => {
      const id = o.customer_id;
      if (!id) return;
      if (!customerMap[id]) customerMap[id] = { name: o.customer_name || "Unknown", orderCount: 0, totalSpend: 0, lastOrder: o.created_at };
      customerMap[id].orderCount += 1;
      customerMap[id].totalSpend += o.total || 0;
      if (o.created_at > customerMap[id].lastOrder) customerMap[id].lastOrder = o.created_at;
    });

    const totalCustomers = Object.keys(customerMap).length;
    const repeatCount = Object.values(customerMap).filter((c) => c.orderCount >= 2).length;
    const newCount = totalCustomers - repeatCount;
    const { repeatRate } = computeRepeatRate(allOrders);

    const avgSpendPerCustomer = totalCustomers > 0
      ? Math.round(completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / totalCustomers)
      : 0;

    const segmentCounts: Record<string, number> = {};
    CUSTOMER_SEGMENTS.forEach((s) => segmentCounts[s.label] = 0);
    Object.values(customerMap).forEach((c) => {
      for (const seg of CUSTOMER_SEGMENTS) {
        if (c.orderCount >= seg.min && c.orderCount <= seg.max) {
          segmentCounts[seg.label]++;
          break;
        }
      }
    });
    const customerSegments = CUSTOMER_SEGMENTS.map((seg) => ({
      label: seg.label,
      count: segmentCounts[seg.label],
      percentage: totalCustomers > 0 ? Math.round((segmentCounts[seg.label] / totalCustomers) * 100) : 0,
    }));

    const freqMap: Record<number, number> = {};
    Object.values(customerMap).forEach((c) => {
      freqMap[c.orderCount] = (freqMap[c.orderCount] || 0) + 1;
    });
    const orderFrequencyDistribution = Object.entries(freqMap)
      .map(([count, customers]) => ({ orderCount: Number(count), customerCount: customers }))
      .sort((a, b) => a.orderCount - b.orderCount);

    const repeatTrend = [{ period: startStr + " to " + endStr, repeatRate }];

    const topCustomers = Object.entries(customerMap)
      .map(([id, data]) => ({ id, ...data, avgOrder: data.orderCount > 0 ? Math.round(data.totalSpend / data.orderCount) : 0 }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    res.json({
      totalCustomers,
      newCustomers: newCount,
      repeatCustomers: repeatCount,
      repeatRate,
      avgSpendPerCustomer,
      historicalCustomerValue: avgSpendPerCustomer,
      repeatVsNew: { repeat: repeatCount, new: newCount },
      repeatTrend,
      orderFrequencyDistribution,
      customerSegments,
      topCustomers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Settlements ──

router.get("/settlements", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const supabase = createAdminClient();

    const { data: settlements } = await supabase
      .from("vendor_settlements")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("period_start", { ascending: false });

    const allSettlements = settlements || [];
    const pendingPayout = allSettlements
      .filter((s: any) => s.status === "pending" || s.status === "processing")
      .reduce((sum: number, s: any) => sum + (s.net_payout || 0), 0);
    const settledTotal = allSettlements
      .filter((s: any) => s.status === "settled")
      .reduce((sum: number, s: any) => sum + (s.net_payout || 0), 0);

    const totalGross = allSettlements.reduce((sum: number, s: any) => sum + (s.gross_order_value || 0), 0);
    const totalCommission = allSettlements.reduce((sum: number, s: any) => sum + (s.commission_amount || 0), 0);
    const totalRefunds = allSettlements.reduce((sum: number, s: any) => sum + (s.refunds_amount || 0), 0);
    const totalAdjustments = allSettlements.reduce((sum: number, s: any) => sum + (s.adjustments_amount || 0), 0);

    const settlementIds = allSettlements.map((s: any) => s.id);
    let items: any[] = [];
    if (settlementIds.length > 0) {
      const { data } = await supabase
        .from("vendor_settlement_items")
        .select("*, orders(code, customer_name)")
        .in("settlement_id", settlementIds);
      items = data || [];
    }

    const itemsBySettlement: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!itemsBySettlement[item.settlement_id]) itemsBySettlement[item.settlement_id] = [];
      itemsBySettlement[item.settlement_id].push(item);
    });

    res.json({
      pendingPayout,
      settledTotal,
      totalGross,
      totalCommission,
      totalRefunds,
      totalAdjustments,
      settlements: allSettlements.map((s: any) => ({
        ...s,
        items: itemsBySettlement[s.id] || [],
      })),
      commissionRateBps: allSettlements.length > 0 ? allSettlements[0].commission_rate_bps : 1000,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 7. Ratings & Issues ──

router.get("/ratings-issues", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: reviews } = await supabase
      .from("reviews")
      .select("*, orders(id, code)")
      .eq("vendor_id", vendorId)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    const allReviews = reviews || [];

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach((r: any) => {
      const star = Math.round(r.overall || 0);
      if (star >= 1 && star <= 5) distribution[star] += 1;
    });

    const avgOverall = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.overall || 0), 0) / allReviews.length) * 10) / 10
      : 0;
    const avgVendor = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.vendor_rating || 0), 0) / allReviews.length) * 10) / 10
      : 0;
    const avgPickup = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.pickup_rating || 0), 0) / allReviews.length) * 10) / 10
      : 0;
    const avgLaundry = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.laundry_rating || 0), 0) / allReviews.length) * 10) / 10
      : 0;
    const avgDelivery = allReviews.length > 0
      ? Math.round((allReviews.reduce((s: number, r: any) => s + (r.delivery_rating || 0), 0) / allReviews.length) * 10) / 10
      : 0;

    const openIssues = (() => {
      try {
        const ticketIds = allReviews
          .filter((r: any) => (r.overall || 0) <= 3)
          .map((r: any) => r.order_id)
          .filter(Boolean);
        if (ticketIds.length === 0) return 0;
        // Approximate: open issues related to this vendor's low-rated orders
        return null;
      } catch {
        return null;
      }
    })();

    const recentNegative = allReviews
      .filter((r: any) => (r.overall || 0) <= 3)
      .slice(0, 10)
      .map((r: any) => ({
        id: r.id,
        customerName: r.customer_name,
        overall: r.overall,
        comment: r.comment,
        createdAt: r.created_at,
        orderCode: r.orders?.code || null,
        status: null,
      }));

    const issueCategories: { category: string; count: number }[] = [];

    const weekMap: Record<string, { total: number; count: number }> = {};
    allReviews.forEach((r: any) => {
      const d = new Date(r.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!weekMap[key]) weekMap[key] = { total: 0, count: 0 };
      weekMap[key].total += r.overall || 0;
      weekMap[key].count += 1;
    });
    const ratingTrend = Object.entries(weekMap)
      .map(([week, v]) => ({ week, avg: Math.round((v.total / v.count) * 10) / 10, count: v.count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    res.json({
      avgOverall,
      avgVendor,
      avgPickup,
      avgLaundry,
      avgDelivery,
      openIssues,
      distribution,
      ratingTrend,
      issueCategories,
      recentNegative,
      totalReviews: allReviews.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8. Cancellations & Rejections ──

router.get("/cancellations", async (req: Request, res: Response) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);

    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service);
    const allOrders = orders || [];
    const cancelled = allOrders.filter((o: any) => o.status === "cancelled");
    const cancelRate = allOrders.length > 0 ? Math.round((cancelled.length / allOrders.length) * 100) : 0;
    const refundTotal = cancelled.reduce((s: number, o: any) => s + (o.total || 0), 0);

    const vendorRejections = cancelled.filter((o: any) => o.cancelled_by === "vendor").length;
    const customerCancellations = cancelled.filter((o: any) => o.cancelled_by === "customer").length;

    const reasonMap: Record<string, number> = {};
    cancelled.forEach((o: any) => {
      const note = o.notes || "No reason specified";
      reasonMap[note] = (reasonMap[note] || 0) + 1;
    });
    const reasonsBreakdown = Object.entries(reasonMap)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: cancelled.length > 0 ? Math.round((count / cancelled.length) * 100) : 0,
        lostRevenue: Math.round((refundTotal * count) / (cancelled.length || 1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const weekMap: Record<string, number> = {};
    cancelled.forEach((o: any) => {
      const d = new Date(o.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      weekMap[key] = (weekMap[key] || 0) + 1;
    });
    const cancellationTrend = Object.entries(weekMap)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const typeMap: Record<string, number> = {};
    cancelled.forEach((o: any) => {
      const type = o.cancelled_by || "unknown";
      typeMap[type] = (typeMap[type] || 0) + 1;
    });
    const cancellationByType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

    const cancelDrillDown = { status: "cancelled", startDate, endDate };

    res.json({
      cancelledOrders: cancelled.length,
      vendorRejections,
      customerCancellations,
      cancelRate,
      refundTotal,
      estimatedLostRevenue: refundTotal,
      cancellationTrend,
      cancellationByType,
      reasonsBreakdown,
      cancelDrillDown,
      topCancelledOrders: cancelled.slice(0, 10).map((o: any) => ({
        id: o.id, code: o.code, customerName: o.customer_name, total: o.total, createdAt: o.created_at, notes: o.notes, cancelledBy: o.cancelled_by || null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
