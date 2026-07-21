import { useEffect, useRef } from "react";
import { api } from "@/lib/api/client";
import { useGeolocation } from "./useGeolocation";

export function useDeliveryLocation(enabled: boolean) {
  const geo = useGeolocation(true);
  const lastSentRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !geo.lat || !geo.lng) return;

    // Only send if moved more than 20m
    const last = lastSentRef.current;
    if (last) {
      const dx = geo.lat - last.lat;
      const dy = geo.lng - last.lng;
      if (Math.sqrt(dx * dx + dy * dy) * 111320 < 20) return;
    }

    lastSentRef.current = { lat: geo.lat, lng: geo.lng };

    api.post("/api/delivery/location", {
      lat: geo.lat,
      lng: geo.lng,
      heading: geo.heading,
      speed: geo.speed,
      accuracy: geo.accuracy,
    }).catch(() => {});
  }, [enabled, geo.lat, geo.lng, geo.heading, geo.speed, geo.accuracy]);

  return geo;
}
