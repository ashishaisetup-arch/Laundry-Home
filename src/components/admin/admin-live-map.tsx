import { useState, useEffect, useMemo } from "react";
import {
  Store, User, Bike, Package, MapPin,
  RefreshCw, Circle, Route, Thermometer, Search, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LeafletMap } from "@/components/shared/leaflet-map";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface MapMarker {
  lat: number; lng: number; label: string; color: string; type: "vendor" | "pickup" | "delivery" | "customer" | "exec";
  sublabel?: string;
  id: string;
  popup?: string;
}

interface MapCircle {
  lat: number; lng: number; radius: number;
  color?: string; fillColor?: string; fillOpacity?: number; label?: string;
}

interface MapRoute {
  coordinates: [number, number][];
  color?: string; dashArray?: string;
}

interface HeatmapPoint {
  lat: number; lng: number; intensity?: number;
}

type LayerKey = "vendors" | "customers" | "execs" | "orders" | "zones" | "routes" | "heat";

const LAYER_CONFIG: Record<LayerKey, { label: string; icon: any; color: string }> = {
  vendors:  { label: "Vendors",  icon: Store,      color: "#8b5cf6" },
  customers:{ label: "Customers",icon: User,       color: "#14b8a6" },
  execs:    { label: "Delivery", icon: Bike,       color: "#10b981" },
  orders:   { label: "Orders",   icon: Package,    color: "#f59e0b" },
  zones:    { label: "Zones",    icon: Circle,     color: "#6366f1" },
  routes:   { label: "Routes",   icon: Route,      color: "#ec4899" },
  heat:     { label: "Heatmap",  icon: Thermometer,color: "#ef4444" },
};

const DEFAULT_RADIUS_KM = 2;

export function AdminLiveMap() {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    vendors: true, customers: false, execs: true, orders: true,
    zones: true, routes: false, heat: false,
  });
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [circles, setCircles] = useState<MapCircle[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        layers.vendors ? api.get<any[]>("/api/vendors") : Promise.resolve([]),
        layers.execs ? api.get<any[]>("/api/delivery-executives") : Promise.resolve([]),
        layers.orders || layers.heat ? api.get<any[]>("/api/orders?admin=true&limit=200") : Promise.resolve([]),
        layers.zones ? api.get<any[]>("/api/areas") : Promise.resolve([]),
        layers.routes ? api.get<any[]>("/api/delivery-tasks") : Promise.resolve([]),
        layers.customers ? api.get<any[]>("/api/addresses?admin=true") : Promise.resolve([]),
      ]);

      const newMarkers: MapMarker[] = [];
      const newCircles: MapCircle[] = [];
      const newRoutes: MapRoute[] = [];
      const newHeatPoints: HeatmapPoint[] = [];

      // Vendors
      if (results[0].status === "fulfilled" && Array.isArray(results[0].value)) {
        for (const v of results[0].value) {
          if (v.latitude != null && v.longitude != null) {
            newMarkers.push({
              id: `v_${v.id}`, lat: Number(v.latitude), lng: Number(v.longitude),
              label: v.name || "Vendor", color: LAYER_CONFIG.vendors.color,
              type: "vendor", sublabel: v.area || v.city,
              popup: `<div style="font-size:13px;line-height:1.5">
                <strong>${v.name || "Vendor"}</strong><br/>
                <span style="color:#666">${v.area || v.city || ""}</span><br/>
                <span style="color:#888;font-size:11px">${v.isOpen ? "\ud83d\udfe2 Open" : "\ud83d\udd34 Closed"} \u2b50 ${v.rating || "N/A"}</span>
              </div>`,
            });
          }
        }
      }

      // Delivery execs
      if (results[1].status === "fulfilled" && Array.isArray(results[1].value)) {
        for (const e of results[1].value) {
          if (e.currentLat != null && e.currentLng != null) {
            newMarkers.push({
              id: `e_${e.id}`, lat: Number(e.currentLat), lng: Number(e.currentLng),
              label: e.name || "Exec", color: LAYER_CONFIG.execs.color,
              type: "exec", sublabel: `${e.assignedOrders || 0} tasks`,
              popup: `<div style="font-size:13px;line-height:1.5">
                <strong>${e.name || "Delivery Partner"}</strong><br/>
                <span style="color:#666">${e.email || ""}</span><br/>
                <span style="color:#888;font-size:11px">${e.assignedOrders || 0} active \u00b7 ${e.isAvailable ? "\ud83d\udfe2 Available" : "\ud83d\udd34 Busy"}</span>
              </div>`,
            });
          }
        }
      }

      // Orders
      if (results[2].status === "fulfilled" && Array.isArray(results[2].value)) {
        for (const o of results[2].value) {
          const lat = o.pickup_lat || o.pickupLat;
          const lng = o.pickup_lng || o.pickupLng;
          if (lat != null && lng != null) {
            if (layers.orders) {
              newMarkers.push({
                id: `o_${o.id}`, lat: Number(lat), lng: Number(lng),
                label: `#${o.code?.slice(0, 8) || o.id?.slice(0, 8)}`,
                color: LAYER_CONFIG.orders.color, type: "pickup",
                sublabel: o.status,
                popup: `<div style="font-size:13px;line-height:1.5">
                  <strong>Order ${o.code || o.id?.slice(0, 8)}</strong><br/>
                  <span style="color:#666">${o.pickup_area || o.pickupArea || ""}</span><br/>
                  <span style="color:#888;font-size:11px">${o.status} \u00b7 \u20b9${o.total || 0}</span>
                </div>`,
              });
            }
            if (layers.heat) {
              newHeatPoints.push({ lat: Number(lat), lng: Number(lng), intensity: 0.5 });
            }
          }
        }
      }

      // Geofencing zones — render circles at each service area center
      if (results[3].status === "fulfilled" && Array.isArray(results[3].value)) {
        for (const a of results[3].value) {
          if (a.lat != null && a.lng != null) {
            newCircles.push({
              lat: Number(a.lat), lng: Number(a.lng),
              radius: DEFAULT_RADIUS_KM * 1000,
              color: LAYER_CONFIG.zones.color,
              fillColor: LAYER_CONFIG.zones.color,
              fillOpacity: 0.08,
              label: a.area_name,
            });
          }
        }
      }

      // Delivery task routes — draw polylines from pickup to delivery
      if (results[4].status === "fulfilled" && Array.isArray(results[4].value)) {
        for (const t of results[4].value) {
          const pLat = t.pickup_lat || t.pickupLat;
          const pLng = t.pickup_lng || t.pickupLng;
          const dLat = t.delivery_lat || t.deliveryLat;
          const dLng = t.delivery_lng || t.deliveryLng;
          if (pLat != null && pLng != null && dLat != null && dLng != null) {
            newRoutes.push({
              coordinates: [[Number(pLat), Number(pLng)], [Number(dLat), Number(dLng)]],
              color: LAYER_CONFIG.routes.color,
              dashArray: "6 8",
            });
          }
        }
      }

      // Customer addresses — all user addresses with lat/lng
      if (results[5].status === "fulfilled" && Array.isArray(results[5].value)) {
        for (const a of results[5].value) {
          const lat = a.lat || a.latitude;
          const lng = a.lng || a.longitude;
          if (lat != null && lng != null) {
            newMarkers.push({
              id: `a_${a.id}`,
              lat: Number(lat), lng: Number(lng),
              label: a.label || "Address",
              color: LAYER_CONFIG.customers.color,
              type: "customer",
              sublabel: a.area || a.city,
              popup: `<div style="font-size:13px;line-height:1.5">
                <strong>${a.label || "Customer"}</strong><br/>
                <span style="color:#666">${a.area || ""}${a.city ? ", " + a.city : ""}</span><br/>
                <span style="color:#888;font-size:11px">${a.address_type || "home"} · ${a.pincode || ""}</span>
              </div>`,
            });
          }
        }
      }

      setMarkers(newMarkers);
      setCircles(newCircles);
      setRoutes(newRoutes);
      setHeatPoints(newHeatPoints);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const results = await api.get<any[]>("/api/geocode/search?q=" + encodeURIComponent(q));
      if (results && results.length > 0) {
        setFlyTo({ lat: Number(results[0].lat), lng: Number(results[0].lng), zoom: 15 });
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [layers]);

  const filteredMarkers = useMemo(() => {
    if (activeFilter === "all") return markers;
    return markers.filter((m) => m.type === activeFilter);
  }, [markers, activeFilter]);

  const counts = useMemo(() => ({
    vendors: markers.filter((m) => m.type === "vendor").length,
    execs: markers.filter((m) => m.type === "exec").length,
    orders: markers.filter((m) => m.type === "pickup").length,
    zones: circles.length,
    routes: routes.length,
    total: markers.length,
  }), [markers, circles, routes]);

  const center: [number, number] = markers.length > 0
    ? [markers.reduce((s, m) => s + m.lat, 0) / markers.length, markers.reduce((s, m) => s + m.lng, 0) / markers.length]
    : [12.9719, 77.6413];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {(["all", "vendor", "pickup", "exec"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activeFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f === "all" ? "All" : f === "vendor" ? "Vendors" : f === "pickup" ? "Orders" : "Delivery"}
              <span className="ml-1 opacity-70">
                ({f === "all" ? counts.total : f === "vendor" ? counts.vendors : f === "pickup" ? counts.orders : counts.execs})
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" className="h-7" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Layer toggles */}
      <div className="flex items-center gap-4 flex-wrap">
        {(Object.entries(LAYER_CONFIG) as [LayerKey, typeof LAYER_CONFIG[LayerKey]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Switch
                checked={layers[key]}
                onCheckedChange={(v) => setLayers((prev) => ({ ...prev, [key]: v }))}
                className="h-4 w-7"
              />
              <Icon className="h-3 w-3" style={{ color: cfg.color }} />
              {cfg.label}
            </Label>
          );
        })}
      </div>

      {/* Map */}
      <Card className="overflow-hidden shadow-soft relative">
        {/* Search overlay */}
        <form
          onSubmit={handleSearch}
          className="absolute top-3 right-3 z-[1000] flex items-center gap-1 bg-background/90 backdrop-blur rounded-lg shadow-lg border px-2 py-1.5"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
          {searching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </form>

        <LeafletMap
          markers={filteredMarkers.map((m) => ({
            lat: m.lat, lng: m.lng, label: m.label, color: m.color, type: m.type, popup: m.popup,
          }))}
          circles={layers.zones ? circles : []}
          routes={layers.routes ? routes : []}
          heatmapPoints={layers.heat ? heatPoints : []}
          center={center}
          zoom={12}
          height="h-[600px]"
          flyTo={flyTo}
        />
        {/* Legend overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg border text-xs space-y-1.5 min-w-[130px]">
          {Object.values(LAYER_CONFIG).map((cfg) => (
            <div key={cfg.label} className="flex items-center gap-2">
              <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "Total Pins", value: counts.total, color: "text-foreground" },
          { label: "Vendors", value: counts.vendors, color: "text-violet-500" },
          { label: "Orders", value: counts.orders, color: "text-amber-500" },
          { label: "Delivery", value: counts.execs, color: "text-emerald-500" },
          { label: "Zones", value: counts.zones, color: "text-indigo-500" },
          { label: "Routes", value: counts.routes, color: "text-pink-500" },
        ].map((stat) => (
          <Card key={stat.label} className="p-3 shadow-soft text-center">
            <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
