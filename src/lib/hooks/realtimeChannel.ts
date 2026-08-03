import { createClient } from "@/lib/supabase";
import type { RealtimePostgresChangesFilter, REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from "@supabase/realtime-js";

type RealtimeClient = ReturnType<typeof createClient>;
type RealtimeChannel = ReturnType<RealtimeClient["channel"]>;
type PayloadHandler = (payload: any) => void;
type StatusHandler = (status: string) => void;

const channels = new Map<string, RealtimeChannel>();
const payloadHandlers = new Map<string, Set<PayloadHandler>>();
const statusHandlers = new Map<string, Set<StatusHandler>>();

export function subscribePostgresChanges(
  name: string,
  config: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`>,
  onPayload: PayloadHandler,
  onStatus?: StatusHandler,
): () => void {
  let channel = channels.get(name);

  if (!channel) {
    payloadHandlers.set(name, new Set());
    statusHandlers.set(name, new Set());
    channel = createClient()
      .channel(name)
      .on("postgres_changes", config, (payload: any) => {
        payloadHandlers.get(name)?.forEach((h) => h(payload));
      })
      .subscribe((status) => {
        statusHandlers.get(name)?.forEach((h) => h(status));
      });
    channels.set(name, channel);
  }

  const payloadSet = payloadHandlers.get(name)!;
  payloadSet.add(onPayload);
  if (onStatus) statusHandlers.get(name)!.add(onStatus);

  return () => {
    payloadSet.delete(onPayload);
    if (onStatus) statusHandlers.get(name)!.delete(onStatus);
  };
}

export function resetRealtimeRegistry() {
  channels.clear();
  payloadHandlers.clear();
  statusHandlers.clear();
}