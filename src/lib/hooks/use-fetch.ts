import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api/client";

export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(url != null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    const controller = new AbortController();
    api.get<T>(url)
      .then((res) => { if (!cancelled && mountedRef.current) setData(res); })
      .catch((err) => { if (!cancelled && mountedRef.current) setError(err.message); })
      .finally(() => { if (!cancelled && mountedRef.current) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [url]);

  const refetch = useCallback(() => {
    if (!url) return;
    setLoading(true);
    const controller = new AbortController();
    api.get<T>(url)
      .then((res) => { if (mountedRef.current) setData(res); })
      .catch((err) => { if (mountedRef.current) setError(err.message); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return controller;
  }, [url]);

  return { data, loading, error, refetch };
}