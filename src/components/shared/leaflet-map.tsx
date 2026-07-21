import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  icon?: string;
  type?: "vendor" | "pickup" | "delivery" | "customer" | "exec";
}

interface RoutePath {
  coordinates: [number, number][];
  color?: string;
  dashArray?: string;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: RoutePath;
  height?: string;
  className?: string;
}

export function LeafletMap({
  center = [12.9719, 77.6413],
  zoom = 13,
  markers = [],
  route,
  height = "h-48",
  className = "",
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Handle tile load errors (e.g., network blocks OSM tiles)
    map.on("tileerror", (e: any) => {
      console.warn("Leaflet tile failed to load:", e.tile?.src);
    });

    // Invalidate size after mount to handle dialog/overlay animations
    requestAnimationFrame(() => map.invalidateSize());

    markersLayerRef.current = L.layerGroup().addTo(map);
    instanceRef.current = map;

    return () => {
      map.remove();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;
    map.setView(center, zoom);
  }, [center[0], center[1], zoom]);

  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    markers.forEach((m) => {
      const color = m.color || "#14b8a6";
      const size = m.type === "exec" ? 28 : 32;
      const html = m.type === "exec"
        ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${m.label?.[0] || "●"}</div>`
        : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${m.label?.[0] || "●"}</div>`;

      const icon = L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      L.marker([m.lat, m.lng], { icon }).addTo(layer);
    });
  }, [markers]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (route && route.coordinates.length >= 2) {
      const polyline = L.polyline(route.coordinates, {
        color: route.color || "#14b8a6",
        weight: 3,
        dashArray: route.dashArray || "8 6",
        opacity: 0.8,
      }).addTo(map);
      routeLayerRef.current = polyline;
      map.fitBounds(polyline.getBounds().pad(0.15));
    }
  }, [route]);

  return <div ref={mapRef} className={`${height} w-full rounded-lg overflow-hidden ${className}`} style={{ minHeight: "12rem" }} />;
}
