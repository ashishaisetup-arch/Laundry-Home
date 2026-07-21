import { useState, useEffect, useRef, useCallback } from "react";
import type { DeliveryTask } from "@/lib/types";
import { api } from "@/lib/api/client";
import { useRealtime } from "./useRealtime";

const POLL_INTERVAL = 30000;

export function useDeliveryTasks(execId?: string | null) {
  const [data, setData] = useState<DeliveryTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const result = await api.get<DeliveryTask[]>("/api/delivery-tasks");
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    intervalRef.current = setInterval(fetchTasks, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTasks]);

  useRealtime("delivery_tasks", execId ? `exec_id=eq.${execId}` : undefined, fetchTasks, !!execId);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  return { data, loading, error, refetch };
}
