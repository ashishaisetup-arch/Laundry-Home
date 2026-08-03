import { useEffect, useRef } from "react";
import { subscribePostgresChanges } from "./realtimeChannel";

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
    const channelName = `realtime-${table}-${filter || "all"}`;
    return subscribePostgresChanges(
      channelName,
      { event: "*", schema: "public", table, filter },
      (payload) => onChangeRef.current(payload),
      (status) => onStatusRef.current?.(status),
    );
  }, [table, filter, enabled]);
}