"use client";

import { useState } from "react";
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
  Bike,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  ORDERS,
  VENDORS,
  SERVICES,
  COUPONS,
  ADDRESSES,
  REVIEWS,
  PICKUP_SLOTS,
  DELIVERY_SLOTS,
} from "@/lib/mock-data";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { BookingFlow } from "./booking-flow";
import { OrderTracking } from "./order-tracking";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Customer",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { id: "discover", label: "Find Vendors", icon: "MapPin" },
      { id: "booking", label: "Book Pickup", icon: "Package", badge: "New" },
      { id: "orders", label: "My Orders", icon: "ClipboardList", badge: 3 },
      { id: "payments", label: "Payments & Wallet", icon: "Wallet" },
      { id: "coupons", label: "Coupons & Rewards", icon: "Ticket" },
      { id: "favorites", label: "Favorites", icon: "Heart" },
      { id: "reviews", label: "My Reviews", icon: "Star" },
    ],
  },
];

export function CustomerApp() {
  const { walletBalance, loyaltyPoints } = useAppStore();
  const [view, setView] = useState("dashboard");
  const [showBooking, setShowBooking] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<string | null>(null);

  const activeOrders = ORDERS.filter((o) => !["completed", "cancelled"].includes(o.status));
  const completedOrders = ORDERS.filter((o) => o.status === "completed");

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
      actions={
        view === "dashboard" || view === "discover" ? (
          <Button
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90"
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
          <CustomerDashboard key="d" onTrack={(id) => setTrackingOrder(id)} onBook={() => setShowBooking(true)} />
        )}
        {view === "discover" && <CustomerDiscover key="disc" onBook={() => setShowBooking(true)} />}
        {view === "orders" && (
          <CustomerOrders
            key="o"
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            onTrack={(id) => setTrackingOrder(id)}
          />
        )}
        {view === "payments" && <CustomerPayments key="p" walletBalance={walletBalance} />}
        {view === "coupons" && <CustomerCoupons key="c" loyaltyPoints={loyaltyPoints} />}
        {view === "favorites" && <CustomerFavorites key="f" onBook={() => setShowBooking(true)} />}
        {view === "reviews" && <CustomerReviews key="r" />}
      </AnimatePresence>

      {/* Booking modal */}
      <BookingFlow open={showBooking} onClose={() => setShowBooking(false)} />

      {/* Order tracking modal */}
      <OrderTracking
        orderId={trackingOrder}
        onClose={() => setTrackingOrder(null)}
      />
    </AppShell>
  );
}

function pageTitle(view: string) {
  return {
    dashboard: "Dashboard",
    discover: "Find Vendors",
    booking: "Book Pickup",
    orders: "My Orders",
    payments: "Payments & Wallet",
    coupons: "Coupons & Rewards",
    favorites: "Favorite Vendors",
    reviews: "My Reviews",
  }[view] || "Dashboard";
}
function pageSubtitle(view: string) {
  return {
    dashboard: "Your laundry at a glance",
    discover: "Discover verified vendors near you",
    booking: "Schedule a pickup in 30 seconds",
    orders: "Track and manage your laundry orders",
    payments: "Wallet, payment methods & invoices",
    coupons: "Save more on every order",
    favorites: "Your go-to laundry vendors",
    reviews: "Reviews you've shared",
  }[view];
}

// ============================================================================
// Customer Dashboard
// ============================================================================
function CustomerDashboard({
  onTrack,
  onBook,
}: {
  onTrack: (id: string) => void;
  onBook: () => void;
}) {
  const { userName, walletBalance, loyaltyPoints } = useAppStore();
  const firstName = userName.split(" ")[0];
  const activeOrders = ORDERS.filter((o) => !["completed", "cancelled"].includes(o.status));

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="relative overflow-hidden p-6 md:p-8 bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 text-white border-0">
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
          { label: "Track Order", icon: Navigation, color: "from-emerald-500 to-green-600", onClick: () => onTrack("o1") },
          { label: "Find Vendors", icon: MapPin, color: "from-violet-500 to-purple-600", onClick: () => {} },
          { label: "Offers", icon: Ticket, color: "from-amber-500 to-orange-600", onClick: () => {} },
        ].map((a) => (
          <motion.button
            key={a.label}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={a.onClick}
            className="text-left"
          >
            <Card className="p-4 shadow-soft hover:shadow-glow transition-shadow">
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
          <Button variant="ghost" size="sm" className="text-xs">View all</Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {activeOrders.slice(0, 2).map((order) => (
            <OrderCard key={order.id} order={order} onClick={() => onTrack(order.id)} />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value="47" change={12.5} trend="up" icon={ShoppingBag} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Total Spent" value={formatINR(28450)} change={8.2} trend="up" icon={Wallet} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Rating Given" value="4.6★" change={2.1} trend="up" icon={Star} accent="from-amber-500 to-orange-600" />
        <StatCard label="Money Saved" value={formatINR(3240)} change={15.8} trend="up" icon={Ticket} accent="from-violet-500 to-purple-600" />
      </div>

      {/* Two columns: upcoming + recommended */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Upcoming pickups */}
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Upcoming Pickups & Deliveries</h3>
            <Badge variant="secondary" className="text-xs">Next 7 days</Badge>
          </div>
          <div className="space-y-3">
            {[
              { type: "Pickup", code: "LH-2849", vendor: "QuickClean Express", date: "Today, 2:00 PM", color: "bg-sky-500" },
              { type: "Delivery", code: "LH-2848", vendor: "Pristine Wash Hub", date: "Today, 12:00 PM", color: "bg-emerald-500" },
              { type: "Delivery", code: "LH-2847", vendor: "FreshFold Laundry Co.", date: "Tomorrow, 6:00 PM", color: "bg-teal-500" },
            ].map((p) => (
              <div key={p.code} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white", p.color)}>
                  {p.type === "Pickup" ? <Package className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{p.type}</p>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-mono">{p.code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.vendor}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{p.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* AI recommendation */}
        <Card className="p-5 shadow-soft bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">AI Recommendation</p>
              <p className="text-[10px] text-muted-foreground">Based on your patterns</p>
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-3">
            You usually order <strong>Wash & Iron</strong> on weekends. Save 15% with a monthly subscription!
          </p>
          <div className="rounded-lg bg-white dark:bg-card p-3 mb-3">
            <p className="text-xs text-muted-foreground">Recommended plan</p>
            <p className="text-sm font-bold mt-0.5">Monthly Essentials</p>
            <p className="text-xs text-emerald-600 mt-1">₹1,499/mo · Save ₹350</p>
          </div>
          <Button size="sm" className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
            View Plans
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Card>
      </div>

      {/* Saved addresses */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Saved Addresses</h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add new
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {ADDRESSES.map((addr) => (
            <div key={addr.id} className="rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">{addr.label}</span>
                {addr.isDefault && <Badge variant="secondary" className="text-[10px] py-0 h-4">Default</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{addr.line}</p>
              <p className="text-xs text-muted-foreground">{addr.area}, {addr.city} - {addr.pincode}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Customer Discover (vendor discovery)
// ============================================================================
function CustomerDiscover({ onBook }: { onBook: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("distance");

  let vendors = VENDORS.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.area.toLowerCase().includes(search.toLowerCase())
  );

  if (filter === "open") vendors = vendors.filter((v) => v.isOpen);
  if (filter === "express") vendors = vendors.filter((v) => v.estimatedDeliveryHrs <= 12);
  if (filter === "top") vendors = vendors.filter((v) => v.rating >= 4.7);

  if (sortBy === "distance") vendors.sort((a, b) => a.distanceKm - b.distanceKm);
  if (sortBy === "rating") vendors.sort((a, b) => b.rating - a.rating);
  if (sortBy === "delivery") vendors.sort((a, b) => a.estimatedDeliveryHrs - b.estimatedDeliveryHrs);

  return (
    <div className="space-y-6">
      {/* Location + Search */}
      <Card className="p-5 shadow-soft">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 md:min-w-[200px]">
            <Navigation className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <p className="font-medium leading-tight">Indiranagar</p>
              <p className="text-[10px] text-muted-foreground">Bengaluru, 560038</p>
            </div>
            <button className="ml-auto text-[10px] text-primary hover:underline">Change</button>
          </div>
          <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor or area…"
              className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { id: "all", label: "All vendors" },
            { id: "open", label: "Open now" },
            { id: "express", label: "Express delivery" },
            { id: "top", label: "Top rated" },
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
          <strong className="text-foreground">{vendors.length}</strong> vendors found near you
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Sort: Distance</SelectItem>
            <SelectItem value="rating">Sort: Rating</SelectItem>
            <SelectItem value="delivery">Sort: Delivery time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vendor grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((v) => (
          <VendorCard key={v.id} vendor={v} onBook={onBook} />
        ))}
      </div>

      {/* Services catalog */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Browse by Service</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {SERVICES.map((s) => (
            <motion.div key={s.key} whileHover={{ y: -2 }}>
              <Card className="p-4 shadow-soft hover:shadow-glow transition-shadow cursor-pointer" onClick={onBook}>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-3", s.gradient)}>
                  <ServiceIcon serviceKey={s.key} className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/60">
                  <span className="text-xs font-semibold text-primary">
                    ₹{s.basePrice}{s.pricingType === "per_kg" ? "/kg" : "/pc"}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
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
// Customer Orders
// ============================================================================
function CustomerOrders({
  activeOrders,
  completedOrders,
  onTrack,
}: {
  activeOrders: typeof ORDERS;
  completedOrders: typeof ORDERS;
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
  const transactions = [
    { id: "t1", desc: "Order LH-2847 payment", amount: -525.2, method: "UPI", date: "Today, 12:30 PM", status: "success" },
    { id: "t2", desc: "Wallet top-up", amount: 1000, method: "UPI", date: "Yesterday", status: "success" },
    { id: "t3", desc: "Order LH-2848 payment", amount: -1069.2, method: "Credit Card", date: "Yesterday", status: "success" },
    { id: "t4", desc: "Refund — LH-2812", amount: 220, method: "Wallet", date: "3 days ago", status: "success" },
    { id: "t5", desc: "Order LH-2821 payment", amount: -795.4, method: "UPI", date: "5 days ago", status: "success" },
    { id: "t6", desc: "Order LH-2810 payment", amount: -1197.8, method: "Credit Card", date: "1 week ago", status: "success" },
  ];

  const paymentMethods = [
    { id: "pm1", type: "UPI", label: "aarav@okhdfcbank", icon: "📱", isDefault: true },
    { id: "pm2", type: "Visa", label: "•••• 4242", icon: "💳", isDefault: false },
    { id: "pm3", type: "Mastercard", label: "•••• 5555", icon: "💳", isDefault: false },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Wallet Balance" value={formatINR(walletBalance)} icon={Wallet} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Total Spent (6mo)" value={formatINR(28450)} change={8.2} trend="up" icon={TrendingUp} accent="from-emerald-500 to-green-600" />
        <StatCard label="Money Saved" value={formatINR(3240)} change={15.8} trend="up" icon={Ticket} accent="from-amber-500 to-orange-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Wallet card */}
        <Card className="lg:col-span-1 p-5 shadow-soft bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 text-white border-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/80">Laundry Home Wallet</p>
            <Wallet className="h-5 w-5 text-white/80" />
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatINR(walletBalance)}</p>
          <p className="text-xs text-white/70 mt-1">Available balance</p>
          <div className="flex gap-2 mt-5">
            <Button size="sm" className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0">
              Add Money
            </Button>
            <Button size="sm" variant="outline" className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10">
              History
            </Button>
          </div>
        </Card>

        {/* Payment methods */}
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Saved Payment Methods</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add new
            </Button>
          </div>
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
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

      {/* Transactions */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Transaction History</h3>
          <Button variant="ghost" size="sm" className="text-xs">Download statement</Button>
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
    </div>
  );
}

// ============================================================================
// Customer Coupons
// ============================================================================
function CustomerCoupons({ loyaltyPoints }: { loyaltyPoints: number }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Loyalty card */}
      <Card className="relative overflow-hidden p-6 shadow-soft bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600 text-white border-0">
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
          {COUPONS.map((c) => (
            <motion.div key={c.code} whileHover={{ y: -2 }}>
              <Card className="overflow-hidden shadow-soft hover:shadow-glow transition-shadow">
                <div className="relative bg-gradient-to-br from-teal-500 to-cyan-600 p-4 text-white">
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
  const favVendors = VENDORS.slice(0, 4);
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {favVendors.map((v) => (
        <VendorCard key={v.id} vendor={v} onBook={onBook} />
      ))}
    </div>
  );
}

// ============================================================================
// Customer Reviews
// ============================================================================
function CustomerReviews() {
  return (
    <div className="space-y-4">
      {REVIEWS.map((r) => (
        <Card key={r.id} className="p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-xs font-semibold">
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
              { label: "Vendor", v: r.vendor },
              { label: "Pickup", v: r.pickup },
              { label: "Laundry", v: r.laundry },
              { label: "Delivery", v: r.delivery },
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
