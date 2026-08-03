import { useEffect, useState } from "react";
import { subscribePostgresChanges } from "./realtimeChannel";

export function useLiveLocation(execId: string | null) {
  const [location, setLocation] = useState<{ lat: number; lng: number; heading: number | null; speed: number | null; updatedAt: string | null } | null>(null);

  useEffect(() => {
    if (!execId) return;

    const fetchInitial = async () => {
      const res = await fetch(`/api/delivery/location/${execId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.lat != null && data?.lng != null) {
          setLocation({ lat: data.lat, lng: data.lng, heading: data.heading, speed: data.speed, updatedAt: data.updated_at });
        }
      }
    };

    fetchInitial();

    return subscribePostgresChanges(
      "live-location-" + execId,
      {
        event: "*",
        schema: "public",
        table: "delivery_live_locations",
        filter: `exec_id=eq.${execId}`,
      },
      (payload: any) => {
        const row = payload.new || payload.old;
        if (row?.lat != null && row?.lng != null) {
          setLocation({ lat: row.lat, lng: row.lng, heading: row.heading, speed: row.speed, updatedAt: row.updated_at });
        }
      },
    );
  }, [execId]);

  return location;
}