
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Package,
  Plus,
  Sparkles,
  Star,
  Wallet,
  Ticket,
  Heart,
  ShoppingBag,
  ChevronRight,
  TrendingUp,
  Gift,
  Bell,
  Search,
  Navigation,
  Zap,
  CheckCircle2,
  Filter,
  FileText,
  Trash2,
  User,
  Smartphone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { StatCard } from "@/components/shared/stat-card";
import { VendorCard } from "@/components/shared/vendor-card";
import { OrderCard } from "@/components/shared/order-card";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { ServiceIcon, getServiceMeta } from "@/components/shared/service-icon";
import { useAppStore } from "@/lib/store";
import { useOrders, useVendors, useServices, useAddresses, useCoupons, useReviews, usePaymentMethods, useSubscriptionPlans, useFavoriteVendors } from "@/lib/hooks";
import type { Order, Vendor, ServiceType } from "@/lib/types";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BookingFlow } from "./booking-flow";
import { OrderTracking } from "./order-tracking";

export function CustomerApp() {
  const { userId, walletBalance, loyaltyPoints } = useAppStore();
  const [view, setView] = useState("dashboard");
  const [showBooking, setShowBooking] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<string | null>(null);
  const [discoverArea, setDiscoverArea] = useState<string | null>(null);
  const [bookingLocation, setBookingLocation] = useState<{lat: number; lng: number} | null>(null);
  const { data: orders, refetch: refetchOrders } = useOrders(userId ? { customerId: userId } : undefined);

  // Browser back button → always go to dashboard
  useEffect(() => {
    const onPop = () => {
      setView("dashboard");
      // Push dashboard state so the next back also goes to dashboard
      window.history.pushState({ view: "dashboard" }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Push history state when navigating to non-dashboard views
  const handleNavigate = (v: string) => {
    if (v === "booking") {
      setShowBooking(true);
      return;
    }
    if (v !== "dashboard") {
      window.history.pushState({ view: v }, "");
    }
    setView(v);
  };

  const handleBookingClose = () => {
    setShowBooking(false);
    refetchOrders();
  };

  const activeOrders = (orders || []).filter((o) => !["completed", "cancelled"].includes(o.status));
  const completedOrders = (orders || []).filter((o) => o.status === "completed");

  const NAV_GROUPS: NavGroup[] = [
    {
      label: "Customer",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
        { id: "profile", label: "My Profile", icon: "User" },
        { id: "discover", label: "Find Vendors", icon: "MapPin" },
        { id: "booking", label: "Book Pickup", icon: "Package", badge: "New" },
        { id: "orders", label: "My Orders", icon: "ClipboardList", badge: activeOrders.length || undefined },
        { id: "subscriptions", label: "Subscription Plans", icon: "Calendar" },
        { id: "payments", label: "Payments & Wallet", icon: "Wallet" },
        { id: "coupons", label: "Coupons & Rewards", icon: "Ticket" },
        { id: "favorites", label: "Favorites", icon: "Heart" },
        { id: "reviews", label: "My Reviews", icon: "Star" },
      ],
    },
  ];

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={handleNavigate}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view, discoverArea)}
      actions={
        view === "dashboard" || view === "discover" ? (
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowBooking(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Book Pickup
          </Button>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && (
          <CustomerDashboard key="d" onTrack={(id) => setTrackingOrder(id)} onBook={() => setShowBooking(true)} onNavigate={setView} />
        )}
        {view === "profile" && <CustomerProfile key="pf" />}
        {view === "discover" && <CustomerDiscover key="disc" onBook={() => setShowBooking(true)} onLocationChange={setDiscoverArea} onLocationUpdate={(loc) => setBookingLocation(loc ? {lat: loc.lat, lng: loc.lng} : null)} />}
        {view === "orders" && (
          <CustomerOrders
            key="o"
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            onTrack={(id) => setTrackingOrder(id)}
          />
        )}
        {view === "payments" && <CustomerPayments key="p" walletBalance={walletBalance} />}
        {view === "subscriptions" && <CustomerSubscriptions key="sub" />}
        {view === "coupons" && <CustomerCoupons key="c" loyaltyPoints={loyaltyPoints} />}
        {view === "favorites" && <CustomerFavorites key="f" onBook={() => setShowBooking(true)} />}
        {view === "reviews" && <CustomerReviews key="r" />}
      </AnimatePresence>

      {/* Booking modal */}
      <BookingFlow open={showBooking} onClose={handleBookingClose} location={bookingLocation} />

      {/* Order tracking modal */}
      <OrderTracking
        orderId={trackingOrder}
        onClose={() => setTrackingOrder(null)}
        onCancel={refetchOrders}
      />
    </AppShell>
  );
}

function pageTitle(view: string) {
  return {
    dashboard: "Dashboard",
    profile: "My Profile",
    discover: "Find Vendors",
    booking: "Book Pickup",
    orders: "My Orders",
    subscriptions: "Subscription Plans",
    payments: "Payments & Wallet",
    coupons: "Coupons & Rewards",
    favorites: "Favorite Vendors",
    reviews: "My Reviews",
  }[view] || "Dashboard";
}
function pageSubtitle(view: string, discoverArea?: string | null) {
  const subtitles: Record<string, string> = {
    dashboard: "Your laundry at a glance",
    profile: "Manage your personal details",
    discover: "Discover verified vendors near you",
    booking: "Schedule a pickup in 30 seconds",
    orders: "Track and manage your laundry orders",
    subscriptions: "Save more with monthly subscription plans",
    payments: "Wallet, payment methods & invoices",
    coupons: "Save more on every order",
    favorites: "Your go-to laundry vendors",
    reviews: "Reviews you've shared",
  };
  if (view === "discover" && discoverArea) {
    return `Verified laundry services near ${discoverArea}`;
  }
  return subtitles[view];
}

// ============================================================================
// Customer Dashboard
// ============================================================================
function CustomerDashboard({
  onTrack,
  onBook,
  onNavigate,
}: {
  onTrack: (id: string) => void;
  onBook: () => void;
  onNavigate: (view: string) => void;
}) {
  const { userId, userName, walletBalance, loyaltyPoints } = useAppStore();
  const firstName = userName.split(" ")[0];
  const { data: orders } = useOrders(userId ? { customerId: userId } : undefined);
  const activeOrders = (orders || []).filter((o) => !["completed", "cancelled"].includes(o.status));

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="relative overflow-hidden p-6 md:p-8 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/80">Good afternoon,</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {firstName} 👋
              </h2>
              <p className="text-sm text-white/80 mt-1">
                You have <strong>{activeOrders.length} active orders</strong> · Next delivery today at 8:00 PM
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[110px]">
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <Wallet className="h-3.5 w-3.5" />
                  Wallet
                </div>
                <p className="text-lg font-bold mt-0.5">{formatINR(walletBalance)}</p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[110px]">
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <Gift className="h-3.5 w-3.5" />
                  Loyalty
                </div>
                <p className="text-lg font-bold mt-0.5">{loyaltyPoints} pts</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Book Pickup", icon: Plus, color: "from-teal-500 to-cyan-600", onClick: onBook },
          { label: "Track Order", icon: Navigation, color: "from-emerald-500 to-green-600", onClick: () => activeOrders[0] ? onTrack(activeOrders[0].id) : toast("No active orders") },
          { label: "Find Vendors", icon: MapPin, color: "from-violet-500 to-purple-600", onClick: () => onNavigate("discover") },
          { label: "Offers", icon: Ticket, color: "from-amber-500 to-orange-600", onClick: () => onNavigate("coupons") },
        ].map((a) => (
          <motion.button
            key={a.label}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={a.onClick}
            className="text-left"
          >
            <Card className="p-4 shadow-soft hover:shadow-lift transition-shadow">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-2.5", a.color)}>
                <a.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">{a.label}</p>
            </Card>
          </motion.button>
        ))}
      </div>

      {/* Active orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Orders
          </h3>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => onNavigate("orders")}>View all</Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {activeOrders.slice(0, 2).map((order) => (
            <OrderCard key={order.id} order={order} onClick={() => onTrack(order.id)} />
          ))}
        </div>
      </div>




    </div>
  );
}
// ============================================================================
// Customer Discover (vendor discovery) — Browser Geolocation API + Nominatim
// ============================================================================

function CustomerDiscover({ onBook, onLocationChange, onLocationUpdate }: { onBook: () => void; onLocationChange?: (area: string | null) => void; onLocationUpdate?: (loc: { area: string; city: string; pincode: string; lat: number; lng: number } | null) => void }) {
  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const { data: services } = useServices();
  const { isFavorited, toggleFavorite } = useFavoriteVendors();
  const servicesData = services || [];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("distance");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showLocationChange, setShowLocationChange] = useState(false);

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
                            // Geocode the area to get coordinates
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
                        <p className="text-[11px] text-muted-foreground ml-5.5">{addr.line}, {addr.area}</p>
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

// ============================================================================
// Customer Orders
// ============================================================================
function CustomerOrders({
  activeOrders,
  completedOrders,
  onTrack,
}: {
  activeOrders: Order[];
  completedOrders: Order[];
  onTrack: (id: string) => void;
}) {
  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">
          Active <Badge variant="secondary" className="ml-1.5 text-[10px]">{activeOrders.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="completed">
          Completed <Badge variant="secondary" className="ml-1.5 text-[10px]">{completedOrders.length}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-4">
        <div className="grid md:grid-cols-2 gap-4">
          {activeOrders.map((o) => (
            <OrderCard key={o.id} order={o} onClick={() => onTrack(o.id)} />
          ))}
        </div>
      </TabsContent>
      <TabsContent value="completed" className="mt-4">
        <div className="grid md:grid-cols-2 gap-4">
          {completedOrders.map((o) => (
            <OrderCard key={o.id} order={o} onClick={() => onTrack(o.id)} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ============================================================================
// Customer Payments
// ============================================================================
function CustomerPayments({ walletBalance }: { walletBalance: number }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [balance, setBalance] = useState(walletBalance);
  const { data: paymentMethods } = usePaymentMethods();

  const transactions: Array<{ id: string; desc: string; amount: number; method: string; date: string; status: string }> = [];

  const invoices: Array<{ id: string; code: string; vendor: string; date: string; amount: number; gst: string }> = [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Wallet Balance" value={formatINR(balance)} icon={Wallet} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Total Spent (6mo)" value={formatINR(0)} icon={TrendingUp} accent="from-emerald-500 to-green-600" />
        <StatCard label="Money Saved" value={formatINR(0)} icon={Ticket} accent="from-amber-500 to-orange-600" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions <Badge variant="secondary" className="ml-1.5 text-[10px]">{transactions.length}</Badge></TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="invoices">GST Invoices <Badge variant="secondary" className="ml-1.5 text-[10px]">{invoices.length}</Badge></TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Wallet card */}
            <Card className="lg:col-span-1 p-5 shadow-soft bg-primary-surface text-primary-foreground border-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-white/80">Laundry Home Wallet</p>
                <Wallet className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatINR(balance)}</p>
              <p className="text-xs text-white/70 mt-1">Available balance</p>
              <div className="flex gap-2 mt-5">
                <Button size="sm" className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => setShowTopUp(true)}>
                  Add Money
                </Button>
                <Button size="sm" variant="outline" className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10" onClick={() => setActiveTab("transactions")}>
                  History
                </Button>
              </div>
            </Card>

            {/* Payment methods preview */}
            <Card className="lg:col-span-2 p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Saved Payment Methods</h3>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab("methods")}>View all</Button>
              </div>
              <div className="space-y-2">
                {(paymentMethods || []).map((pm) => (
                  <div key={pm.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
                      {pm.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{pm.type}</p>
                      <p className="text-xs text-muted-foreground">{pm.label}</p>
                    </div>
                    {pm.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions tab */}
        <TabsContent value="transactions" className="mt-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Transaction History</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => toast.success("Statement downloaded", { description: "Your transaction statement has been exported." })}>Download statement</Button>
            </div>
            <div className="space-y-1">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    t.amount > 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                  )}>
                    {t.amount > 0 ? <Plus className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.desc}</p>
                    <p className="text-[11px] text-muted-foreground">{t.method} · {t.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", t.amount > 0 ? "text-emerald-600" : "text-foreground")}>
                      {t.amount > 0 ? "+" : ""}{formatINRDecimal(t.amount)}
                    </p>
                    <Badge variant="outline" className="text-[9px] py-0 h-4 mt-0.5 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Payment Methods tab */}
        <TabsContent value="methods" className="mt-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Saved Payment Methods</h3>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => toast.success("Add payment method", { description: "Payment method form opened." })}>
                <Plus className="h-3.5 w-3.5" />
                Add new
              </Button>
            </div>
            <div className="space-y-2">
              {(paymentMethods || []).map((pm) => (
                <div key={pm.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                    {pm.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{pm.type}</p>
                      {pm.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{pm.label}</p>
                  </div>
                  <div className="flex gap-1">
                    {!pm.isDefault && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success(`${pm.type} set as default`)}>Set default</Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={() => toast.info(`${pm.type} removed`)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Invoices tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-3">GST Invoices</h3>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{inv.code} · {inv.vendor}</p>
                    <p className="text-[11px] text-muted-foreground">GSTIN: {inv.gst} · {inv.date}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatINRDecimal(inv.amount)}</p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.success(`Invoice ${inv.code} downloaded`, { description: "GST invoice exported as PDF." })}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top-up dialog */}
      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Add Money to Wallet</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add Money to Wallet</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Current balance: {formatINR(balance)}</p>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="500" className="mt-1" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(amt.toString())}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted hover:border-primary/30 transition-colors"
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowTopUp(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!topUpAmount || Number(topUpAmount) <= 0}
              onClick={async () => {
                const amt = Number(topUpAmount);
                try {
                  await api.post("/api/wallet", { amount: amt, method: "UPI" });
                  setBalance(balance + amt);
                  setTopUpAmount("");
                  setShowTopUp(false);
                  toast.success("Wallet topped up", { description: `${formatINR(amt)} added to your wallet.` });
                } catch (err: any) {
                  toast.error("Top-up failed", { description: err.message });
                }
              }}
            >
              Add {topUpAmount ? formatINR(Number(topUpAmount)) : "Money"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Customer Coupons
// ============================================================================
function CustomerCoupons({ loyaltyPoints }: { loyaltyPoints: number }) {
  const { data: coupons } = useCoupons();
  const couponsData = coupons || [];
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Loyalty card */}
      <Card className="relative overflow-hidden p-6 shadow-soft bg-tonal text-foreground border-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-5 w-5" />
              <p className="text-sm font-semibold">Laundry Home Rewards</p>
            </div>
            <p className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {loyaltyPoints} <span className="text-xl font-medium">pts</span>
            </p>
            <p className="text-sm text-white/80 mt-1">
              You&apos;re <strong>{5000 - loyaltyPoints} pts</strong> away from <strong>Platinum tier</strong>
            </p>
          </div>
          <div className="w-full md:w-48">
            <div className="flex justify-between text-[10px] text-white/70 mb-1">
              <span>Gold</span>
              <span>Platinum</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${(loyaltyPoints / 5000) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Coupons grid */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Available Coupons</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {couponsData.map((c) => (
            <motion.div key={c.code} whileHover={{ y: -2 }}>
              <Card className="overflow-hidden shadow-soft hover:shadow-lift transition-shadow">
                <div className="relative bg-primary-surface p-4 text-white">
                  <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-white/20" />
                  <p className="text-[10px] uppercase tracking-wider text-white/80 mb-1">Use code</p>
                  <p className="text-2xl font-bold font-mono tracking-tight">{c.code}</p>
                  <p className="text-sm mt-1">{c.description}</p>
                </div>
                <div className="p-4">
                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    <p>Min order: <strong className="text-foreground">{formatINR(c.minOrder)}</strong></p>
                    {c.type === "percentage" ? (
                      <p>Discount: <strong className="text-foreground">{c.discountPct}% off (max {formatINR(c.maxDiscount)})</strong></p>
                    ) : (
                      <p>Discount: <strong className="text-foreground">{formatINR(c.maxDiscount)} off</strong></p>
                    )}
                    <p>Expires: <strong className="text-foreground">{new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={copiedCode === c.code ? "secondary" : "outline"}
                    onClick={() => {
                      setCopiedCode(c.code);
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                  >
                    {copiedCode === c.code ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Copied!</>
                    ) : (
                      <>Apply coupon</>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Customer Favorites
// ============================================================================
function CustomerFavorites({ onBook }: { onBook: () => void }) {
  const { vendorList, loading, toggleFavorite, isFavorited } = useFavoriteVendors();

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 shadow-soft">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-3" />
            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (vendorList.length === 0) {
    return (
      <div className="text-center py-16">
        <Heart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No favorites yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tap the heart icon on any vendor to save them here
        </p>
        <Button variant="outline" onClick={() => {}}>
          <MapPin className="h-4 w-4 mr-1.5" />
          Find Vendors
        </Button>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {vendorList.map((v) => (
        <VendorCard
          key={v.id}
          vendor={v}
          onBook={onBook}
          isFavorited={isFavorited(v.id)}
          onToggleFavorite={() => toggleFavorite(v.id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Customer Reviews
// ============================================================================
function CustomerReviews() {
  const { data: reviews, loading } = useReviews();
  const reviewsData = reviews || [];

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 shadow-soft">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-2 w-1/4 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-full bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (reviewsData.length === 0) {
    return (
      <div className="text-center py-16">
        <Star className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">No reviews yet</h3>
        <p className="text-sm text-muted-foreground">
          Reviews you leave after orders will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviewsData.map((r) => (
        <Card key={r.id} className="p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary-surface text-primary-foreground text-xs font-semibold">
                  {r.customerAvatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{r.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  Reviewed {r.vendorName} · {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("h-3.5 w-3.5", i < r.overall ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Order #{r.orderId}</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-foreground/90">{r.comment}</p>

          {/* Rating breakdown */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60">
            {[
              { label: "Vendor", v: r.vendorRating },
              { label: "Pickup", v: r.pickupRating },
              { label: "Laundry", v: r.laundryRating },
              { label: "Delivery", v: r.deliveryRating },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold">{s.v}.0</p>
              </div>
            ))}
          </div>

          {r.vendorReply && (
            <div className="mt-3 rounded-lg bg-muted/40 p-3 border-l-2 border-primary">
              <p className="text-[10px] font-semibold text-primary mb-1">💬 Reply from {r.vendorName}</p>
              <p className="text-xs text-muted-foreground">{r.vendorReply}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Customer Subscriptions
// ============================================================================
function CustomerSubscriptions() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState<string | null>(null);
  const { data: plans, loading } = useSubscriptionPlans();

  const handleSubscribe = async (plan: { id: string; name: string }) => {
    try {
      await api.post("/api/subscriptions", {
        plan_id: plan.id,
        billing_interval: billing,
      });
      setSubscribed(plan.name);
      toast.success(`Subscribed to ${plan.name}!`, {
        description: `Your ${billing} plan is now active. Welcome to hassle-free laundry.`,
      });
    } catch (err: any) {
      toast.error("Subscription failed", { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscribed banner */}
      {subscribed && (
        <Card className="p-4 shadow-soft bg-tonal-accent border-primary/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">You&apos;re subscribed to {subscribed}</p>
              <p className="text-xs text-muted-foreground">Your plan is active. Manage or cancel anytime from Payments.</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSubscribed(null)}>Cancel plan</Button>
          </div>
        </Card>
      )}

      {/* Billing toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Choose your plan</h3>
          <p className="text-sm text-muted-foreground">Save 17% with annual billing. Cancel anytime.</p>
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              billing === "monthly" ? "bg-background shadow-soft" : "text-muted-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-all flex items-center gap-1.5",
              billing === "yearly" ? "bg-background shadow-soft" : "text-muted-foreground"
            )}
          >
            Yearly
            <Badge variant="secondary" className="text-[9px] py-0 h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              −17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 shadow-soft animate-pulse">
              <div className="h-11 w-11 rounded-xl bg-muted mb-3" />
              <div className="h-5 w-24 bg-muted rounded mb-2" />
              <div className="h-3 w-40 bg-muted rounded mb-4" />
              <div className="h-8 w-20 bg-muted rounded mb-4" />
              <div className="h-9 w-full bg-muted rounded mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => <div key={j} className="h-3 w-full bg-muted rounded" />)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
      <div className="grid md:grid-cols-3 gap-4">
        {(plans || []).map((plan) => {
          const isSelected = selectedPlan === plan.name;
          const isSubscribed = subscribed === plan.name;
          return (
            <motion.div
              key={plan.id}
              whileHover={{ y: -4 }}
              className={cn(plan.popular && "md:-mt-4")}
              onClick={() => setSelectedPlan(plan.name)}
            >
              <Card className={cn(
                "relative overflow-hidden p-6 shadow-soft transition-all cursor-pointer",
                plan.popular && !isSelected && "shadow-lift ring-2 ring-primary",
                isSelected && "ring-2 ring-primary shadow-lift",
                isSubscribed && "ring-2 ring-emerald-400"
              )}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                    ★ MOST POPULAR
                  </div>
                )}
                {isSubscribed && (
                  <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg">
                    ✓ ACTIVE
                  </div>
                )}
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-3", plan.color)}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold">{plan.name}</h4>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                <div className="mt-4 mb-4">
                  <span className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                    ₹{billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                  </span>
                  <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "month" : "year"}</span>
                </div>
                <Button
                  className={cn("w-full", isSubscribed ? "bg-emerald-500 hover:bg-emerald-600" : plan.popular || isSelected ? "bg-primary hover:bg-primary/90" : "")}
                  variant={plan.popular || isSelected ? "default" : "outline"}
                  disabled={isSubscribed}
                  onClick={(e) => { e.stopPropagation(); handleSubscribe(plan); }}
                >
                  {isSubscribed ? "✓ Subscribed" : isSelected ? `Subscribe to ${plan.name}` : `Choose ${plan.name}`}
                </Button>
                <Separator className="my-4" />
                <ul className="space-y-2">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Comparison / FAQ */}
      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Why subscribe?</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Wallet, title: "Save up to 35%", desc: "Compared to pay-per-order pricing" },
            { icon: Zap, title: "Priority service", desc: "Skip the queue with priority pickups" },
            { icon: Gift, title: "Bonus rewards", desc: "2×–5× loyalty points boost" },
          ].map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/30">
                <b.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Customer Profile
// ============================================================================
function CustomerProfile() {
  const { userName, userEmail, userPhone, userAvatar, role: userRole, setProfile } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState(userPhone);
  const [saving, setSaving] = useState(false);

  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const addrList = addresses || [];
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", line: "", area: "", city: "", pincode: "" });
  const [profileAddrCoords, setProfileAddrCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingProfileAddr, setGeocodingProfileAddr] = useState(false);

  const detectForProfileAddress = useCallback(async () => {
    if (!navigator.geolocation) return;
    setGeocodingProfileAddr(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await api.get<{ area: string; city: string; pincode: string; lat: number; lng: number }>(
            `/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (result?.area) {
            setNewAddr((prev) => ({ ...prev, area: result.area, city: result.city, pincode: result.pincode }));
            setAddrSearchQuery(result.area);
            setProfileAddrCoords({ lat: result.lat, lng: result.lng });
          }
        } catch {
          // silent — user can type manually
        } finally {
          setGeocodingProfileAddr(false);
        }
      },
      () => setGeocodingProfileAddr(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (showAddAddr && !newAddr.area) detectForProfileAddress();
  }, [showAddAddr, newAddr.area, detectForProfileAddress]);

  // ---- Dynamic area search with suggestions ----
  const [addrSearchQuery, setAddrSearchQuery] = useState("");
  const [addrSuggestions, setAddrSuggestions] = useState<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>([]);
  const [addrSearching, setAddrSearching] = useState(false);
  const addrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showAddAddr) { setAddrSearchQuery(""); setAddrSuggestions([]); return; }
  }, [showAddAddr]);

  useEffect(() => {
    if (addrSearchQuery.length < 2) { setAddrSuggestions([]); return; }
    setAddrSearching(true);
    if (addrTimerRef.current) clearTimeout(addrTimerRef.current);
    addrTimerRef.current = setTimeout(async () => {
      try {
        const results = await api.get<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>(
          `/api/geocode/search?q=${encodeURIComponent(addrSearchQuery)}`
        );
        setAddrSuggestions(results || []);
      } catch {
        setAddrSuggestions([]);
      } finally {
        setAddrSearching(false);
      }
    }, 300);
    return () => { if (addrTimerRef.current) clearTimeout(addrTimerRef.current); };
  }, [addrSearchQuery]);

  const selectAddrSuggestion = (s: typeof addrSuggestions[number]) => {
    setNewAddr((prev) => ({ ...prev, area: s.area, city: s.city, pincode: s.pincode }));
    setProfileAddrCoords({ lat: s.lat, lng: s.lng });
    setAddrSearchQuery(s.area);
    setAddrSuggestions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setProfile(name, phone);
      setEditing(false);
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error("Failed to update profile", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(userName);
    setPhone(userPhone);
    setEditing(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile card */}
      <Card className="p-6 shadow-soft">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
              {userAvatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{userName}</h2>
            <p className="text-sm text-muted-foreground">{userRole}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {userEmail || "—"}
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            {editing ? (
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            ) : (
              <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {userName}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            {editing ? (
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter your phone number" className="mt-1" />
            ) : (
              <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                {userPhone || "—"}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <User className="h-4 w-4 mr-1.5" />
              Edit Profile
            </Button>
          )}
        </div>
      </Card>

      {/* Saved addresses */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Saved Addresses</h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowAddAddr(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add new
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {addrList.map((addr) => (
            <div key={addr.id} className="group rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">{addr.label}</span>
                {addr.isDefault && <Badge variant="secondary" className="text-[10px] py-0 h-4">Default</Badge>}
                <button
                  onClick={async () => {
                    try {
                      await api.delete(`/api/addresses/${addr.id}`);
                      refetchAddresses();
                      toast.success("Address deleted", { description: `${addr.label} address removed.` });
                    } catch (err: any) {
                      toast.error("Failed to delete address", { description: err.message });
                    }
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-600"
                  title="Delete address"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{addr.line}</p>
              <p className="text-xs text-muted-foreground">{addr.area}, {addr.city} - {addr.pincode}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Address Dialog */}
      <Dialog open={showAddAddr} onOpenChange={(o) => { setShowAddAddr(o); if (!o) { setProfileAddrCoords(null); setAddrSearchQuery(""); setAddrSuggestions([]); } }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Add New Address</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add New Address</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Save a new pickup/delivery address</p>
          </div>
          <div className="space-y-3 pt-2">
            {/* ═══ Location ═══ */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Location</p>

              {/* Auto-detect button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mb-2"
                onClick={detectForProfileAddress}
                disabled={geocodingProfileAddr}
              >
                {geocodingProfileAddr ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5" />
                )}
                {geocodingProfileAddr ? "Detecting…" : "Auto-fill my current location"}
              </Button>

              {/* Dynamic search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                <Input
                  value={addrSearchQuery}
                  onChange={(e) => setAddrSearchQuery(e.target.value)}
                  placeholder="Search area or enter pincode..."
                  className="pl-8"
                />
                {addrSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                )}
              </div>

              {/* Suggestions dropdown */}
              {addrSuggestions.length > 0 && (
                <div className="mt-1 border border-border rounded-lg bg-background shadow-lg max-h-48 overflow-y-auto z-20">
                  {addrSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={() => selectAddrSuggestion(s)}
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

            {/* ═══ Address Details ═══ */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Address Details</p>
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} placeholder="Home, Work, etc." className="mt-1" />
              </div>
              <div className="mt-2">
                <Label className="text-xs">Address Line</Label>
                <Input value={newAddr.line} onChange={(e) => setNewAddr({ ...newAddr, line: e.target.value })} placeholder="Flat / House no, Street" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} placeholder="Bengaluru" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Pincode</Label>
                  <Input value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="560038" className="mt-1" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowAddAddr(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!newAddr.label || !newAddr.line || !newAddr.area || !newAddr.city || newAddr.pincode.length < 6}
              onClick={async () => {
                try {
                  const payload = profileAddrCoords
                    ? { ...newAddr, lat: profileAddrCoords.lat, lng: profileAddrCoords.lng }
                    : newAddr;
                  await api.post("/api/addresses", payload);
                  refetchAddresses();
                  setNewAddr({ label: "", line: "", area: "", city: "", pincode: "" });
                  setProfileAddrCoords(null);
                  setShowAddAddr(false);
                  toast.success("Address added", { description: "New address saved successfully." });
                } catch (err: any) {
                  toast.error("Failed to add address", { description: err.message });
                }
              }}
            >
              Save Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
