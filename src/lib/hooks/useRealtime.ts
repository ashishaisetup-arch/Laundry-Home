import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

export function useRealtime(
  table: string,
  filter: string | undefined,
  onChange: (payload: any) => void,
  enabled = true,
  onStatus?: (status: string) => void,
) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channelName = `realtime-${table}-${filter || "all"}`;
    const existing = supabase.getChannels().find(c => c.topic === channelName);
    if (existing) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload) => onChangeRef.current(payload),
      )
      .subscribe((status) => onStatusRef.current?.(status));

    return () => { supabase.removeChannel(channel); };
  }, [table, filter, enabled]);
}
