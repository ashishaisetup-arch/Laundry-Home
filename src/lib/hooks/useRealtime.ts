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
    const channel = supabase
      .channel(`realtime-${table}-${filter || "all"}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => onChangeRef.current(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, filter, enabled]);
}
