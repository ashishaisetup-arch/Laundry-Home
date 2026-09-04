import type { Request, Response } from "express";
import { createAdminClient } from "../supabase";

// ── Vendor resolution ──

export async function resolveVendorId(req: Request, res: Response): Promise<string | null> {
  const user = (req as any).user;
  const role = (req as any).userRole as string | undefined;

  if (role === "admin" || role === "superadmin") {
    const vid = req.query.vendorId as string | undefined;
    if (vid) return vid;
  }

  const admin = createAdminClient();
  const { data: vendor } = await admin
    .from("vendors")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!vendor) {
    res.status(404).json({ error: "Vendor profile not found" });
    return null;
  }
  return vendor.id;
}

// ── Constants ──

const COLORS = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316"];

const CUSTOMER_SEGMENTS = [
  { key: "one_time", label: "One-Time", min: 1, max: 1 },
  { key: "occasional", label: "Occasional", min: 2, max: 3 },
  { key: "regular", label: "Regular", min: 4, max: 6 },
  { key: "loyal", label: "Loyal", min: 7, max: 10 },
  { key: "vip", label: "VIP", min: 11, max: Infinity },
] as const;

const DEFAULT_TIMEZONE = "Asia/Kolkata";

// ── Timezone utilities ──

const TIMEZONE_OFFSETS: Record<string, number> = {
  "Asia/Kolkata": 330,
  "Asia/Kolkata_IST": 330,
  "Asia/Karachi": 300,
  "Asia/Dubai": 240,
  "Asia/Bangkok": 420,
  "Asia/Singapore": 480,
  "Asia/Shanghai": 480,
  "Asia/Tokyo": 540,
  "Europe/London": 0,
  "Europe/Paris": 60,
  "Europe/Berlin": 60,
  "America/New_York": -300,
  "America/Chicago": -360,
  "America/Denver": -420,
  "America/Los_Angeles": -480,
  "UTC": 0,
};

function getOffsetMinutes(timezone: string): number {
  return TIMEZONE_OFFSETS[timezone] ?? 330;
}

function calendarDateToUTC(dateStr: string, timezone: string, isStart: boolean): string {
  const offset = getOffsetMinutes(timezone);
  if (isStart) {
    // 2026-09-01 in IST → 2026-08-31T18:30:00.000Z (offset subtracted)
    const d = new Date(`${dateStr}T00:00:00`);
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString();
  } else {
    // 2026-09-04 end-of-day in IST → 2026-09-04T18:29:59.999Z
    const d = new Date(`${dateStr}T23:59:59.999`);
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString();
  }
}

export async function resolveBusinessTimezone(
  supabase: any,
  vendorId: string,
): Promise<string> {
  try {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("timezone")
      .eq("id", vendorId)
      .single();
    return vendor?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// ── Date range parsing ──

export function parseDateRange(req: Request) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startStr = (req.query.startDate as string) || defaultStart.toISOString().slice(0, 10);
  const endStr = (req.query.endDate as string) || now.toISOString().slice(0, 10);
  const service = (req.query.service as string) || undefined;
  const status = (req.query.status as string) || undefined;
  return { startStr, endStr, service, status };
}

export function resolveDateBoundaries(
  startStr: string,
  endStr: string,
  timezone: string,
) {
  return {
    startDate: calendarDateToUTC(startStr, timezone, true),
    endDate: calendarDateToUTC(endStr, timezone, false),
  };
}

// ── Order query builder ──

export function buildOrderQuery(
  supabase: any,
  vendorId: string,
  startDate: string,
  endDate: string,
  service?: string,
  status?: string,
) {
  let q = supabase
    .from("orders")
    .select("*")
    .eq("vendor_id", vendorId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (status) q = q.eq("status", status);
  if (service) q = q.contains("items_v2", [{ serviceName: service }]);
  return q;
}

// ── Stage event helpers ──

export async function loadStageEvents(
  supabase: any,
  orderIds: string[],
): Promise<Record<string, Record<string, string>>> {
  if (orderIds.length === 0) return {};

  const { data: events } = await supabase
    .from("order_stage_events")
    .select("order_id, stage, timestamp")
    .in("order_id", orderIds)
    .order("timestamp", { ascending: true });

  if (!events || events.length === 0) return {};

  const byOrder: Record<string, Record<string, string>> = {};
  for (const e of events) {
    if (!byOrder[e.order_id]) byOrder[e.order_id] = {};
    if (!byOrder[e.order_id][e.stage]) {
      byOrder[e.order_id][e.stage] = e.timestamp;
    }
  }
  return byOrder;
}

// ── KPI computation helpers ──

export function computeTurnaroundFromEvents(
  stageEvents: Record<string, Record<string, string>>,
): number | null {
  const diffs: number[] = [];

  for (const stages of Object.values(stageEvents)) {
    const pickup = stages["pickup_completed"];
    const completion = stages["delivered"] ?? stages["completed"];
    if (pickup && completion) {
      const diff = (new Date(completion).getTime() - new Date(pickup).getTime()) / (1000 * 60 * 60);
      if (diff >= 0) diffs.push(diff);
    }
  }

  if (diffs.length === 0) return null;
  return Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
}

export function computeOnTimeRateFromEvents(
  stageEvents: Record<string, Record<string, string>>,
  orders: any[],
): number | null {
  const eligible = orders.filter(
    (o) => ["completed", "delivered"].includes(o.status) && o.estimated_delivery_at,
  );
  if (eligible.length === 0) return null;

  let onTime = 0;
  let counted = 0;
  for (const o of eligible) {
    const stages = stageEvents[o.id];
    if (!stages) continue;
    const completion = stages["delivered"] ?? stages["completed"];
    if (completion) {
      counted++;
      if (new Date(completion).getTime() <= new Date(o.estimated_delivery_at).getTime()) {
        onTime++;
      }
    }
  }

  if (counted === 0) return null;
  return Math.round((onTime / counted) * 100);
}

export function computeRepeatRate(orders: any[]): {
  repeatRate: number;
  repeatCount: number;
  uniqueCustomers: number;
} {
  const customerCounts: Record<string, number> = {};
  orders
    .filter((o) => o.customer_id && ["completed", "delivered"].includes(o.status))
    .forEach((o) => {
      customerCounts[o.customer_id] = (customerCounts[o.customer_id] || 0) + 1;
    });

  const uniqueCustomers = Object.keys(customerCounts).length;
  if (uniqueCustomers === 0)
    return { repeatRate: 0, repeatCount: 0, uniqueCustomers: 0 };

  const repeatCount = Object.values(customerCounts).filter(
    (c) => c >= 2,
  ).length;

  return {
    repeatRate: Math.round((repeatCount / uniqueCustomers) * 100),
    repeatCount,
    uniqueCustomers,
  };
}

export function computeSegment(count: number): string {
  for (const seg of CUSTOMER_SEGMENTS) {
    if (count >= seg.min && count <= seg.max) return seg.label;
  }
  return CUSTOMER_SEGMENTS[CUSTOMER_SEGMENTS.length - 1].label;
}

// ── Previous period comparison ──

export function computePeriodComparison(
  startDate: string,
  endDate: string,
  current: { revenue: number; orders: number; reviewCount: number },
  previous: { revenue: number; orders: number; reviewCount: number },
) {
  const revenueChange =
    previous.revenue > 0
      ? Math.round(
          ((current.revenue - previous.revenue) / previous.revenue) * 100,
        )
      : 0;
  const ordersChange =
    previous.orders > 0
      ? Math.round(
          ((current.orders - previous.orders) / previous.orders) * 100,
        )
      : 0;

  return { revenueChange, ordersChange };
}

// ── Exports ──

export { COLORS, CUSTOMER_SEGMENTS };
