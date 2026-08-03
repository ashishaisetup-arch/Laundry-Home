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
  popup?: string;
  id?: string;
}

interface MapCircle {
  lat: number;
  lng: number;
  radius: number;
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  label?: string;
}

interface MapRoute {
  coordinates: [number, number][];
  color?: string;
  dashArray?: string;
}

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity?: number;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: MapRoute;
  routes?: MapRoute[];
  circles?: MapCircle[];
  heatmapPoints?: HeatmapPoint[];
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  height?: string;
  className?: string;
}

export function LeafletMap({
  center = [12.9719, 77.6413],
  zoom = 13,
  markers = [],
  route,
  routes = [],
  circles = [],
  heatmapPoints = [],
  flyTo,
  height = "h-48",
  className = "",
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);

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
    routesLayerRef.current = L.layerGroup().addTo(map);
    circlesLayerRef.current = L.layerGroup().addTo(map);
    heatLayerRef.current = L.layerGroup().addTo(map);
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

    const buildIcon = (m: MapMarker) => {
      const color = m.color || "#14b8a6";
      const size = m.type === "exec" ? 28 : 32;
      const html = m.type === "exec"
        ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${m.label?.[0] || "●"}</div>`
        : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${m.label?.[0] || "●"}</div>`;
      return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    };

    // Full rebuild when any marker lacks an id (existing consumers)
    if (!markers.every((m) => m.id)) {
      layer.clearLayers();
      markersByIdRef.current.clear();
      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], { icon: buildIcon(m) });
        if (m.popup) marker.bindPopup(m.popup);
        marker.addTo(layer);
      });
      return;
    }

    // In-place diff by id: preserves open popups and avoids layer churn
    const byId = markersByIdRef.current;
    const wanted = new Set(markers.map((m) => m.id as string));
    byId.forEach((marker, id) => {
      if (!wanted.has(id)) {
        layer.removeLayer(marker);
        byId.delete(id);
      }
    });

    markers.forEach((m) => {
      const existing = byId.get(m.id as string);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        const icon = buildIcon(m);
        const oldHtml = (existing.getIcon() as L.DivIcon | null)?.options?.html;
        if (oldHtml !== icon.options.html) existing.setIcon(icon);
        const popup = existing.getPopup();
        if (m.popup) {
          if (popup) {
            if (popup.getContent() !== m.popup) popup.setContent(m.popup);
          } else {
            existing.bindPopup(m.popup);
          }
        } else if (popup) {
          existing.unbindPopup();
        }
      } else {
        const marker = L.marker([m.lat, m.lng], { icon: buildIcon(m) });
        if (m.popup) marker.bindPopup(m.popup);
        marker.addTo(layer);
        byId.set(m.id as string, marker);
      }
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

  useEffect(() => {
    const layer = routesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    routes.forEach((r) => {
      if (!r.coordinates || r.coordinates.length < 2) return;
      L.polyline(r.coordinates, {
        color: r.color || "#14b8a6",
        weight: 3,
        dashArray: r.dashArray || "8 6",
        opacity: 0.8,
      }).addTo(layer);
    });
  }, [routes]);

  useEffect(() => {
    const layer = circlesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    circles.forEach((c) => {
      L.circle([c.lat, c.lng], {
        radius: c.radius,
        color: c.color || "#6366f1",
        fillColor: c.fillColor || c.color || "#6366f1",
        fillOpacity: c.fillOpacity ?? 0.1,
        weight: 1.5,
      }).addTo(layer);
    });
  }, [circles]);

  useEffect(() => {
    const layer = heatLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    heatmapPoints.forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 10,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.2 + (p.intensity ?? 0.5) * 0.5,
        weight: 1,
      }).addTo(layer);
    });
  }, [heatmapPoints]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom || 14);
  }, [flyTo]);

  return <div ref={mapRef} className={`${height} w-full rounded-lg overflow-hidden ${className}`} style={{ minHeight: "12rem" }} />;
}
