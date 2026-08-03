import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useRealtime } from "./useRealtime";

export interface LiveExecutive {
  id: string;
  name: string;
  email?: string;
  currentLat: number | null;
  currentLng: number | null;
  lastSeenAt?: string | null;
  locationSource?: "live" | "profile";
  isAvailable?: boolean;
  assignedOrders?: number;
  [key: string]: any;
}

export type ConnectionState = "live" | "connecting" | "offline";

export type ExecFreshness = "live" | "idle" | "offline";

const EXEC_COLORS: Record<ExecFreshness, string> = {
  live: "#10b981",
  idle: "#eab308",
  offline: "#9ca3af",
};

const LIVE_THRESHOLD_MS = 60_000;
const IDLE_THRESHOLD_MS = 5 * 60_000;

export function execStatus(lastSeenAt: string | null | undefined, now: number): { state: ExecFreshness; color: string } {
  if (!lastSeenAt) return { state: "offline", color: EXEC_COLORS.offline };
  const age = now - new Date(lastSeenAt).getTime();
  if (age < LIVE_THRESHOLD_MS) return { state: "live", color: EXEC_COLORS.live };
  if (age < IDLE_THRESHOLD_MS) return { state: "idle", color: EXEC_COLORS.idle };
  return { state: "offline", color: EXEC_COLORS.offline };
}

export function formatAge(lastSeenAt: string | null | undefined, now: number): string {
  if (!lastSeenAt) return "never";
  const ms = Math.max(0, now - new Date(lastSeenAt).getTime());
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

const POLL_INTERVAL_MS = 60_000;
const BATCH_FLUSH_MS = 100;
const TICK_MS = 5_000;
const ORDERS_LIMIT = 200;

export function useAdminLiveMap() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [executives, setExecutives] = useState<LiveExecutive[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const refreshExecutives = useCallback(async () => {
    try {
      setExecutives(await api.get<LiveExecutive[]>("/api/delivery-executives"));
    } catch {
      // silent — realtime + polling will retry
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      setOrders(await api.get<any[]>(`/api/orders?admin=true&limit=${ORDERS_LIMIT}`));
    } catch {
      // silent
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await api.get<any[]>("/api/delivery-tasks"));
    } catch {
      // silent
    }
  }, []);

  const refreshStatic = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get<any[]>("/api/vendors"),
      api.get<any[]>("/api/areas"),
      api.get<any[]>("/api/addresses?admin=true"),
    ]);
    if (results[0].status === "fulfilled") setVendors(results[0].value);
    if (results[1].status === "fulfilled") setAreas(results[1].value);
    if (results[2].status === "fulfilled") setAddresses(results[2].value);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([refreshExecutives(), refreshOrders(), refreshTasks(), refreshStatic()]);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [refreshExecutives, refreshOrders, refreshTasks, refreshStatic]);

  // ─── Realtime: delivery_live_locations (batched, latest per exec) ───
  const pendingExecsRef = useRef<Map<string, any>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

  const handleLocationPayload = useCallback((payload: any) => {
    const row = payload?.new || payload?.old;
    if (!row?.exec_id || row.lat == null || row.lng == null) return;
    pendingExecsRef.current.set(row.exec_id, row);
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const pending = pendingExecsRef.current;
      pendingExecsRef.current = new Map();
      if (pending.size === 0) return;
      setExecutives((prev) =>
        prev.map((exec) => {
          const incoming = pending.get(exec.id);
          if (!incoming) return exec;
          const existingTs = exec.lastSeenAt ? new Date(exec.lastSeenAt).getTime() : null;
          const incomingTs = incoming.updated_at ? new Date(incoming.updated_at).getTime() : null;
          if (existingTs != null && incomingTs != null && incomingTs <= existingTs) return exec;
          return {
            ...exec,
            currentLat: Number(incoming.lat),
            currentLng: Number(incoming.lng),
            lastSeenAt: incoming.updated_at || exec.lastSeenAt,
            locationSource: "live" as const,
          };
        })
      );
    }, BATCH_FLUSH_MS);
  }, []);

  // ─── Realtime: delivery_tasks / orders (patch own slice) ───
  const handleTaskPayload = useCallback((payload: any) => {
    const row = payload?.new || payload?.old;
    if (!row?.id) return;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === row.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...row };
      return next;
    });
  }, []);

  const handleOrderPayload = useCallback((payload: any) => {
    const row = payload?.new || payload?.old;
    if (!row?.id) return;
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === row.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...row };
      return next;
    });
  }, []);

  // ─── Reconnect reconciliation: SUBSCRIBED transition after a gap → loadAll once ───
  const prevStatusRef = useRef<string | null>(null);
  const loadAllRef = useRef(loadAll);
  useEffect(() => { loadAllRef.current = loadAll; }, [loadAll]);

  const handleStatus = useCallback((status: string) => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    setConnection(status === "SUBSCRIBED" ? "live" : status === "CLOSED" ? "offline" : "connecting");
    if (prev && prev !== "SUBSCRIBED" && status === "SUBSCRIBED") {
      loadAllRef.current();
    }
  }, []);

  useRealtime("delivery_live_locations", undefined, handleLocationPayload, true, handleStatus);
  useRealtime("delivery_tasks", undefined, handleTaskPayload);
  useRealtime("orders", undefined, handleOrderPayload);

  // Initial load + polling safety net
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadAll]);

  return {
    vendors,
    executives,
    orders,
    areas,
    tasks,
    addresses,
    connection,
    loading,
    lastUpdated,
    now,
    loadAll,
    refreshExecutives,
  };
}
