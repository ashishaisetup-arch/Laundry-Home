import { useState, useEffect } from "react";
import { api } from "@/lib/api/client";

export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(url != null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional setState to start loading
    setLoading(true);
    api.get<T>(url)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  const refetch = () => {
    if (!url) return;
    setLoading(true);
    api.get<T>(url)
      .then((res) => { setData(res); })
      .catch((err) => { setError(err.message); })
      .finally(() => { setLoading(false); });
  };

  return { data, loading, error, refetch };
}