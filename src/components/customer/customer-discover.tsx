import { useState, useEffect } from "react";
import {
  MapPin,
  Navigation,
  Search,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VendorCard } from "@/components/shared/vendor-card";
import { ServiceIcon } from "@/components/shared/service-icon";
import { useVendors, useServices, useAddresses, useFavoriteVendors } from "@/lib/hooks";
import type { Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/address";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAppStore } from "@/lib/store";

export function CustomerDiscover({ onBook, onLocationChange, onLocationUpdate }: { onBook: () => void; onLocationChange?: (area: string | null) => void; onLocationUpdate?: (loc: { area: string; city: string; pincode: string; lat: number; lng: number } | null) => void }) {
  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const { data: services } = useServices();
  const { isFavorited, toggleFavorite } = useFavoriteVendors();

  const servicesData = services || [];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("distance");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showLocationChange, setShowLocationChange] = useState(false);

  const pendingSearch = useAppStore((s) => s.pendingSearchQuery);
  const setPendingSearch = useAppStore((s) => s.setPendingSearchQuery);

  // Consume a search query passed from the header search (Enter jump)
  useEffect(() => {
    if (pendingSearch) {
      setSearch(pendingSearch);
      setPendingSearch(null);
    }
  }, [pendingSearch, setPendingSearch]);

  const [location, setLocation] = useState<{
    area: string; city: string; pincode: string; lat: number; lng: number
  } | null>(null);

  const [geolocating, setGeolocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ---- Auto-detect: saved address first, then browser geolocation ----
  useEffect(() => {
    if (location || geolocating) return;

    const defaultAddr = (addresses || []).find((a) => a.isDefault) || (addresses || [])[0];
    if (defaultAddr?.lat && defaultAddr?.lng) {
      setLocation({
        area: defaultAddr.area,
        city: defaultAddr.city,
        pincode: defaultAddr.pincode,
        lat: Number(defaultAddr.lat),
        lng: Number(defaultAddr.lng),
      });
      return;
    }

    // No saved address → auto-fetch browser location
    if (!navigator.geolocation) return;
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const result = await api.get<{ area: string; city: string; pincode: string; lat: number; lng: number }>(
            `/api/geocode/reverse?lat=${latitude}&lng=${longitude}`
          );
          if (result?.area) {
            setLocation({ area: result.area, city: result.city, pincode: result.pincode, lat: result.lat, lng: result.lng });
          }
        } catch {
          // silent — user can search manually
        } finally {
          setGeolocating(false);
        }
      },
      () => setGeolocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [addresses, location, geolocating]);

  // ---- Notify parent of area change for dynamic subtitle ----
  useEffect(() => {
    onLocationChange?.(location?.area || null);
    onLocationUpdate?.(location);
  }, [location?.area, location, onLocationChange, onLocationUpdate]);

  // ---- Dynamic search via Nominatim (debounced) ----
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.get<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>(
          `/api/geocode/search?q=${encodeURIComponent(searchQuery)}`
        );
        setSuggestions(results || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectSuggestion = (s: typeof suggestions[number]) => {
    setLocation({ area: s.area, city: s.city, pincode: s.pincode, lat: s.lat, lng: s.lng });
    setSuggestions([]);
  };

  // ---- Vendors query ----
  const vendorsResult = useVendors(
    location ? { lat: location.lat, lng: location.lng, radiusKm: 5 } : undefined
  );
  const vendorsList = vendorsResult.data;

  let vendors = (vendorsList || []).filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.area.toLowerCase().includes(search.toLowerCase())
  );

  if (filter === "open") vendors = vendors.filter((v) => v.isOpen);
  if (filter === "express") vendors = vendors.filter((v) => v.estimatedDeliveryHrs <= 12);
  if (filter === "top") vendors = vendors.filter((v) => v.rating >= 4.7);
  if (filter === "premium") vendors = vendors.filter((v) => v.priceLevel >= 3);
  if (filter === "near" && location) vendors = vendors.filter((v) => v.area.toLowerCase() === location.area.toLowerCase());

  const sortedVendors = [...vendors];
  if (sortBy === "distance") sortedVendors.sort((a, b) => a.distanceKm - b.distanceKm);
  if (sortBy === "rating") sortedVendors.sort((a, b) => b.rating - a.rating);
  if (sortBy === "delivery") sortedVendors.sort((a, b) => a.estimatedDeliveryHrs - b.estimatedDeliveryHrs);
  if (sortBy === "price") sortedVendors.sort((a, b) => a.priceLevel - b.priceLevel);

  return (
    <div className="space-y-6">
      {/* Location + Search */}
      <Card className="p-5 shadow-soft">
        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={() => { setShowLocationChange(true); setGeoError(null); }}
            className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 md:min-w-[220px] hover:bg-muted transition-colors text-left"
          >
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <div className="text-sm min-w-0">
              <p className="font-medium leading-tight truncate">{location?.area || "Your location"}</p>
              {location && (
                <p className="text-[10px] text-muted-foreground truncate">{location.city}, {location.pincode}</p>
              )}
            </div>
            <span className="ml-auto text-[10px] text-primary hover:underline shrink-0">Change</span>
          </button>
          <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor or area…"
              className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
            />
          </div>
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { id: "all", label: "All vendors" },
            ...(location ? [{ id: "near" as const, label: `Near ${location.area}` }] : []),
            { id: "open", label: "Open now" },
            { id: "express", label: "Express delivery" },
            { id: "top", label: "Top rated" },
            { id: "premium", label: "Premium" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Sort + count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{sortedVendors.length}</strong> vendors found
          {location ? <span> within 5 km of <strong className="text-foreground">{location.area}</strong></span> : ""}
          {(search || filter !== "all") && (
            <button
              onClick={() => { setSearch(""); setFilter("all"); }}
              className="ml-2 text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Sort: Distance</SelectItem>
            <SelectItem value="rating">Sort: Rating</SelectItem>
            <SelectItem value="delivery">Sort: Delivery time</SelectItem>
            <SelectItem value="price">Sort: Price</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vendor grid */}
      {!location ? (
        <Card className="p-8 text-center text-muted-foreground shadow-soft">
          {geolocating ? (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
              <p className="font-medium mb-1">Detecting your location…</p>
              <p className="text-sm">Please allow location access when prompted</p>
            </>
          ) : (
            <>
              <Navigation className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium mb-1">Choose your location</p>
              <p className="text-sm mb-4">Search for an area or enter a pincode to find nearby vendors</p>
              <Button onClick={() => { setShowLocationChange(true); setGeoError(null); }}>Set Location</Button>
            </>
          )}
        </Card>
      ) : vendorsResult.loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 shadow-soft animate-pulse">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-muted rounded" />
                  <div className="h-3 w-1/3 bg-muted rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-muted rounded mb-2" />
              <div className="h-3 w-4/5 bg-muted rounded mb-4" />
              <div className="h-8 w-full bg-muted rounded" />
            </Card>
          ))}
        </div>
      ) : sortedVendors.length === 0 ? (
        <Card className="p-8 text-center shadow-soft">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-amber-50 dark:bg-amber-950/30 mx-auto mb-4">
            <Navigation className="h-7 w-7 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold mb-1">We don't serve {location.area} yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-2">
            There are no vendors within 5 km of your location. We're expanding to new areas regularly.
          </p>
          {search || filter !== "all" ? (
            <p className="text-xs text-muted-foreground mb-4">
              Try clearing filters or searching for a different area.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-4">
              Try a nearby area like Indiranagar, Koramangala, or HSR Layout.
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => { setShowLocationChange(true); setGeoError(null); }}>Try another area</Button>
            {search || filter !== "all" ? (
              <Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>Clear Filters</Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedVendors.map((v) => (
            <VendorCard
              key={v.id}
              vendor={v}
              onBook={onBook}
              onView={() => setSelectedVendor(v)}
              isFavorited={isFavorited(v.id)}
              onToggleFavorite={() => toggleFavorite(v.id)}
            />
          ))}
        </div>
      )}

      {/* Vendor Detail Dialog — unchanged */}
      <Dialog open={!!selectedVendor} onOpenChange={(o) => !o && setSelectedVendor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">{selectedVendor?.name || "Vendor Details"}</DialogTitle>
          {selectedVendor && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl bg-primary-surface text-primary-foreground font-semibold text-lg", selectedVendor.logoColor)}>
                  {selectedVendor.logoInitials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{selectedVendor.name}</h2>
                    {selectedVendor.verified && (
                      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                        ✓ Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedVendor.area}, {selectedVendor.city} · {selectedVendor.distanceKm} km away</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 font-semibold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {selectedVendor.rating} ({selectedVendor.reviewCount} reviews)
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{selectedVendor.estimatedDeliveryHrs}h delivery</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{"₹".repeat(selectedVendor.priceLevel)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedVendor.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Services & Pricing</h3>
                <div className="space-y-1.5">
                  {servicesData.filter((s) => selectedVendor.servicesOffered.includes(s.key)).map((s) => (
                    <div key={s.key} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-tonal-accent text-primary")}>
                        <ServiceIcon serviceKey={s.key} className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{s.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">₹{s.basePrice}<span className="text-[10px] text-muted-foreground">/{s.pricingType === "per_kg" ? "kg" : "piece"}</span></p>
                        <p className="text-[10px] text-amber-600">Express: ₹{Math.round(s.basePrice * s.expressMultiplier)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Capacity</p>
                  <p className="text-sm font-semibold">{selectedVendor.capacityUsedPct}% used</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Repeat customers</p>
                  <p className="text-sm font-semibold">{selectedVendor.repeatCustomerRate}%</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Total orders</p>
                  <p className="text-sm font-semibold">{selectedVendor.totalOrders.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedVendor(null)}>Close</Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={!selectedVendor.isOpen}
                  onClick={() => { setSelectedVendor(null); onBook(); }}
                >
                  {selectedVendor.isOpen ? "Book Pickup" : "Vendor Closed"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Location Dialog with Geolocation + Nominatim search */}
      <Dialog open={showLocationChange} onOpenChange={(o) => { setShowLocationChange(o); if (!o) { setSuggestions([]); setGeoError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Change Location</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Change Location</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enter an area or pincode to find vendors nearby</p>
          </div>
          <div className="space-y-3 pt-2">

            {/* Saved addresses */}
            {addresses && addresses.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Your saved addresses</p>
                <div className="space-y-1.5">
                  {addresses.map((addr) => {
                    const selected = location?.lat === Number(addr.lat) && location?.lng === Number(addr.lng);
                    const hasCoords = addr.lat && addr.lng;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={async () => {
                          if (hasCoords) {
                            setLocation({
                              area: addr.area,
                              city: addr.city,
                              pincode: addr.pincode,
                              lat: Number(addr.lat),
                              lng: Number(addr.lng),
                            });
                          } else {
                            try {
                              const results = await api.get<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>(
                                `/api/geocode/search?q=${encodeURIComponent(addr.area)}`
                              );
                              if (results && results.length > 0) {
                                const best = results[0];
                                setLocation({
                                  area: best.area || addr.area,
                                  city: best.city || addr.city,
                                  pincode: best.pincode || addr.pincode,
                                  lat: best.lat,
                                  lng: best.lng,
                                });
                              }
                            } catch {
                              // silent
                            }
                          }
                        }}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/30",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border/60"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <MapPin className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-xs font-semibold">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 rounded-full font-medium">Default</span>
                          )}
                          {!hasCoords && (
                            <span className="text-[9px] text-amber-600 font-medium">Resolving…</span>
                          )}
                          {selected && (
                            <span className="ml-auto text-[9px] text-primary font-medium">Selected</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground ml-5.5">{formatAddress(addr)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic search input + suggestions */}
            <div>
              <Label className="text-xs">Area / Locality or Pincode</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type area name or enter pincode..."
                  className="pl-8"
                />
                {searching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                )}
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="mt-1 border border-border rounded-lg bg-background shadow-lg max-h-48 overflow-y-auto z-20">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={() => {
                        selectSuggestion(s);
                        setSearchQuery("");
                        setSuggestions([]);
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.area}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.label !== s.area ? s.label : `${s.city}${s.pincode ? `, ${s.pincode}` : ""}`}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>



            {location?.lat ? (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                Showing vendors within 5 km of {location.area}{location.pincode ? `, ${location.pincode}` : ""}
              </p>
            ) : location?.area && !location.lat ? (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Select an area from search suggestions above to get exact coordinates
              </p>
            ) : null}
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowLocationChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!location?.lat} onClick={() => {
              setShowLocationChange(false);
              setFilter("all");
              toast.success("Location set", { description: `Showing vendors within 5 km of ${location?.area}` });
            }}>
              Find Vendors
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
