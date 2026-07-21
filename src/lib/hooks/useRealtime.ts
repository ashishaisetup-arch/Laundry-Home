import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

export function useRealtime(
  table: string,
  filter: string | undefined,
  onChange: () => void,
  enabled = true,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
        () => onChangeRef.current(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, filter, enabled]);
}
