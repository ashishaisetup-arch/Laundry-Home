
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  IndianRupee,
  Package,
  Plus,
  Repeat,
  Settings2,
  Star,
  Store,
  TrendingUp,
  Users,
  XCircle,
  Boxes,
  Tag,
  Shirt,
  Sparkles,
  ListTree,
  WashingMachine,
  Wind,
  SearchCheck,
  Truck,
  Bike,
  Home,
  CircleCheck,
  Camera,
  AlertCircle,
  ClipboardList,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { useAppStore } from "@/lib/store";
import { useFetch } from "@/lib/hooks/use-fetch";
import {
  BarChart,
  Bar,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { VendorOrderDetail } from "./vendor-order-detail";
import { StatCard } from "@/components/shared/stat-card";
import { ServiceIcon } from "@/components/shared/service-icon";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { useOrders, useServices, useStaff, useGarments, useVendor } from "@/lib/hooks";
import { useRouterView } from "@/lib/hooks/use-router-view";
import { ProfilePage } from "@/components/shared/profile-page";
import { SettingsPage } from "@/components/shared/settings-page";
import { useVendorWeeklyRevenue, useVendorServiceRevenue, useVendorInventory, useVendorDashboardStats } from "@/lib/hooks/useVendorAnalytics";
import { ORDER_STAGE_FLOW } from "@/lib/data/stages";
import type { Order } from "@/lib/types";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

export function VendorApp() {
  const [view, setView, handleNavigate] = useRouterView("dashboard");
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const vid = useMyVendorId();
  const { data: orders } = useOrders({ vendorId: vid });
  const pendingCount = (orders || []).filter((o) => ["placed", "vendor_assigned"].includes(o.status)).length;

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: "Vendor",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
        { id: "orders", label: "Order Management", icon: "ClipboardList", badge: pendingCount },
        { id: "processing", label: "Laundry Processing", icon: "WashingMachine" },
        { id: "inventory", label: "Garment Inventory", icon: "Boxes" },
        { id: "staff", label: "Staff Management", icon: "Users" },
        { id: "services", label: "Service Management", icon: "Settings2" },
        { id: "analytics", label: "Analytics", icon: "BarChart3" },
      ],
    },
  ], [pendingCount]);

  return (
    <>
      <AppShell
        groups={navGroups}
        activeView={view}
        onNavigate={handleNavigate}
        pageTitle={pageTitle(view)}
        pageSubtitle={pageSubtitle(view)}
        actions={
          view === "orders" ? (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setManualOrderOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Manual Order
            </Button>
          ) : undefined
        }
      >
        <AnimatePresence mode="wait">
          {view === "dashboard" && <VendorDashboard key="dashboard" />}
          {view === "orders" && <VendorOrders key="orders" />}
          {view === "processing" && <VendorProcessing key="processing" />}
          {view === "inventory" && <VendorInventory key="inventory" />}
          {view === "staff" && <VendorStaff key="staff" />}
          {view === "services" && <VendorServices key="services" />}
          {view === "analytics" && <VendorAnalytics key="analytics" />}
          {view === "profile" && <ProfilePage key="profile" />}
          {view === "settings" && <SettingsPage key="settings" />}
        </AnimatePresence>
      </AppShell>

      <Dialog open={manualOrderOpen} onOpenChange={setManualOrderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Manual Order</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Manual order creation coming soon. Please use the customer app to place orders.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function useMyVendorId(): string | null {
  const userId = useAppStore((s) => s.userId);
  const { data } = useFetch<{ id: string }[]>(userId ? `/api/vendors?owner_id=${userId}` : null);
  const vendors = data || [];
  const [vid, setVid] = useState<string | null>(null);
  useEffect(() => { if (vendors.length > 0) setVid(vendors[0].id); }, [vendors]);
  return vid;
}

function pageTitle(view: string) {
  return {
    dashboard: "Vendor Dashboard",
    orders: "Order Management",
    processing: "Laundry Processing",
    inventory: "Garment Inventory",
    staff: "Staff Management",
    services: "Service Management",
    analytics: "Analytics & Reports",
    profile: "My Profile",
    settings: "Settings",
  }[view] || "Dashboard";
}
function pageSubtitle(view: string) {
  return {
    dashboard: "FreshFold Laundry Co. · Indiranagar, Bengaluru",
    profile: "Manage your account details",
    settings: "Account and app preferences",
    orders: "Accept, schedule and manage incoming orders",
    processing: "Update each garment through the laundry workflow",
    inventory: "Track every garment with photos and condition notes",
    staff: "Manage your laundry staff and assignments",
    services: "Configure your offerings, pricing and availability",
    analytics: "Revenue, ratings and operational insights",
  }[view];
}

// ============================================================================
// Vendor Dashboard
// ============================================================================
function VendorDashboard() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  const { data: weeklyRevenue } = useVendorWeeklyRevenue(vid);
  const { data: serviceRevenue } = useVendorServiceRevenue(vid);
  const userId = useAppStore((s) => s.userId);
  const { data: vendorInfo } = useFetch<{ name: string; rating: number; logoColor: string }[]>(
    userId ? `/api/vendors?owner_id=${userId}` : null
  );
  const vendorName = vendorInfo?.[0]?.name || "Vendor";
  const vendorRating = vendorInfo?.[0]?.rating || 0;

  // Auto-poll every 30 seconds for new orders
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const orderList = orders || [];
  const pendingOrders = orderList.filter((o) => ["placed", "vendor_assigned"].includes(o.status));
  const todayOrders = orderList.filter((o) => o.createdAt?.startsWith(todayStr));
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingCount = pendingOrders.length;
  const todayOrderCount = todayOrders.length;

  const wr = weeklyRevenue || [];
  const sr = serviceRevenue || [];
  const weeklyTotal = wr.reduce((s, d) => s + (d.revenue || 0), 0);
  const maxDaily = Math.max(...wr.map((d) => d.orders || 0), 1);
  const capacityUsed = Math.min(Math.round((todayOrderCount / maxDaily) * 100), 100);
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0">● Online</Badge>
                <Badge className="bg-white/20 text-white border-0">Verified Vendor</Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Good afternoon, {vendorName}! 👋
              </h2>
              <p className="text-sm text-white/80 mt-1">
                You have <strong>{pendingCount} new order{pendingCount !== 1 ? "s" : ""}</strong> waiting · Today&apos;s revenue: <strong>{formatINR(todayRevenue)}</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Today&apos;s Revenue</p>
                <p className="text-xl font-bold mt-0.5">{formatINR(todayRevenue)}</p>
                <p className="text-[10px] text-emerald-200">{todayOrderCount} order{todayOrderCount !== 1 ? "s" : ""} today</p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Capacity Used</p>
                <p className="text-xl font-bold mt-0.5">{capacityUsed}%</p>
                <p className="text-[10px] text-white/70">{100 - capacityUsed}% available</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Orders" value={String(todayOrderCount)} change={0} trend="up" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Today's Revenue" value={formatINR(todayRevenue)} change={0} trend="up" icon={IndianRupee} accent="from-emerald-500 to-green-600" />
        <StatCard label="Pending Acceptance" value={String(pendingCount)} icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Avg Rating" value={`${vendorRating}★`} change={0} trend="up" icon={Star} accent="from-violet-500 to-purple-600" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Weekly Revenue</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · {formatINR(weeklyTotal)} total</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={wr} margin={{ left: -16, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6B9C8E" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6B9C8E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }}
                formatter={(v: number) => [formatINR(v), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6B9C8E" strokeWidth={2.5} fill="url(#rev-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Service revenue pie */}
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-1">Revenue by Service</h3>
          <p className="text-xs text-muted-foreground mb-3">This month</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sr}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
              >
                {sr.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }}
                formatter={(v: number) => formatINR(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {sr.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1">{s.name}</span>
                <span className="font-semibold">{formatINR(s.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pending orders + analytics */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Pending Orders</h3>
            <Button variant="ghost" size="sm" className="text-xs">View all</Button>
          </div>
          <div className="space-y-2">
            {(orders || []).filter((o) => ["placed", "vendor_assigned", "vendor_accepted", "pickup_scheduled"].includes(o.status)).map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-muted text-xs font-semibold">{o.customerAvatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{o.code}</p>
                    {o.express && <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600">Express</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{o.customerName} · {o.garmentCount} items</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatINRDecimal(o.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{o.pickupSlot}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                    onClick={async () => {
                      try {
                        await api.post(`/api/orders/${o.id}/reject`);
                        toast.success(`Order ${o.code} rejected`, { description: "Reassigned to next available vendor." });
                        refetchOrders();
                      } catch (e: any) { toast.error("Failed to reject order", { description: e.message }); }
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-primary hover:bg-primary/90"
                    onClick={async () => {
                      try {
                        await api.patch(`/api/orders/${o.id}`, { status: "vendor_accepted", currentStageIndex: 2 });
                        toast.success(`Order ${o.code} accepted`, { description: "Customer has been notified." });
                        refetchOrders();
                      } catch (e: any) { toast.error("Failed to accept order", { description: e.message }); }
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick stats */}
        <div className="space-y-4">
          <StatCard label="Avg Turnaround" value="22 hrs" change={-6.2} trend="down" invertTrend icon={Clock} accent="from-lime-500 to-emerald-600" />
          <StatCard label="Repeat Customers" value="78%" change={4.5} trend="up" icon={Repeat} accent="from-violet-500 to-purple-600" />
          <StatCard label="Monthly Revenue" value={formatINR(428000)} change={15.8} trend="up" icon={TrendingUp} accent="from-amber-500 to-orange-600" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Vendor Orders
// ============================================================================
function VendorOrders() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);
  const allVendorOrders = orders || [];

  const tabFilters: Record<string, string[]> = {
    pending: ["placed", "vendor_assigned"],
    accepted: ["vendor_accepted", "pickup_scheduled"],
    processing: [
      "pickup_completed", "laundry_received", "sorting", "tagging",
      "washing", "drying", "ironing", "dry_cleaning",
      "quality_inspection", "packing", "ready_for_dispatch",
    ],
    completed: ["delivered", "completed"],
  };

  const counts = Object.fromEntries(
    Object.entries(tabFilters).map(([tab, statuses]) => [
      tab, allVendorOrders.filter(o => statuses.includes(o.status)).length,
    ])
  );

  return (
    <>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.pending}</Badge></TabsTrigger>
          <TabsTrigger value="accepted">Accepted <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.accepted}</Badge></TabsTrigger>
          <TabsTrigger value="processing">Processing <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.processing}</Badge></TabsTrigger>
          <TabsTrigger value="completed">Completed <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.completed}</Badge></TabsTrigger>
        </TabsList>

        {(["pending", "accepted", "processing", "completed"] as const).map((tab) => {
          const filtered = allVendorOrders.filter((o) => tabFilters[tab].includes(o.status));
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((o) => (
                  <VendorOrderCard key={o.id} order={o} onView={setDetailOrderId} />
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <VendorOrderDetail orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </>
  );
}

function VendorOrderCard({ order, onView }: { order: Order; onView?: (id: string) => void }) {
  const stage = ORDER_STAGE_FLOW[order.currentStageIndex];
  const itemCount = order.garmentCount || (order.items || []).reduce((sum, i: any) => sum + (i.qty || 0), 0);
  return (
    <Card className="p-4 shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted text-[10px] font-semibold">{order.customerAvatar || order.customerName?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{order.code}</p>
            <p className="text-[11px] text-muted-foreground">{order.customerName}</p>
          </div>
        </div>
        {order.express && (
          <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
            Express
          </Badge>
        )}
      </div>

      <div className="space-y-1 mb-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-3 w-3" />
          {itemCount} items · {order.items.length} services
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Pickup: {order.pickupSlot}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <IndianRupee className="h-3 w-3" />
          {formatINRDecimal(order.total)} · {order.paymentMethod}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <Badge variant="secondary" className="text-[10px]">{stage?.label}</Badge>
        <span className="text-muted-foreground">{order.pickupArea}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onView?.(order.id)}>
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
        {["placed", "vendor_assigned"].includes(order.status) && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 text-rose-600"
              onClick={async () => {
                try {
                  await api.post(`/api/orders/${order.id}/reject`);
                  toast.success(`Order ${order.code} rejected`);
                } catch (e: any) { toast.error("Failed to reject order", { description: e.message }); }
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 bg-primary hover:bg-primary/90"
              onClick={async () => {
                try {
                  await api.patch(`/api/orders/${order.id}`, { status: "vendor_accepted", currentStageIndex: 2 });
                  toast.success(`Order ${order.code} accepted`);
                } catch (e: any) { toast.error("Failed to accept order", { description: e.message }); }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Accept
            </Button>
          </>
        )}
        {!["placed", "vendor_assigned", "delivered", "completed"].includes(order.status) && (
          <Button size="sm" className="flex-1 h-8 bg-primary hover:bg-primary/90" onClick={async () => {
            const idx = ORDER_STAGE_FLOW.findIndex(s => s.stage === order.status);
            const nextStage = ORDER_STAGE_FLOW[idx + 1];
            if (!nextStage) return;
            try {
              await api.patch(`/api/orders/${order.id}`, { status: nextStage.stage, currentStageIndex: idx + 1 });
              toast.success(`Status updated to ${nextStage.label}`);
            } catch (e: any) { toast.error("Update failed", { description: e.message }); }
          }}>
            Update Status
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Vendor Processing
// ============================================================================
function VendorProcessing() {
  const vid = useMyVendorId();
  const { data: orders, refetch: refetchOrders } = useOrders({ vendorId: vid });
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchOrders, 30000);
    return () => clearInterval(interval);
  }, [vid, refetchOrders]);
  const allVendorOrders = orders || [];
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const processingOrders = allVendorOrders.filter(o =>
    ["pickup_completed", "laundry_received", "sorting", "tagging", "washing", "drying", "ironing", "dry_cleaning", "quality_inspection", "packing", "ready_for_dispatch"].includes(o.status)
  );
  const selectedOrder = processingOrders.find(o => o.id === selectedOrderId) || processingOrders[0];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Order list */}
      <Card className="p-4 shadow-soft">
        <h3 className="font-semibold mb-3">In Processing</h3>
        <ScrollArea className="h-[600px] -mx-2 px-2">
          <div className="space-y-2">
            {processingOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-all",
                  selectedOrder?.id === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{o.code}</p>
                  {o.express && <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-400 text-amber-600">Express</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground">{o.customerName}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground">Stage {o.currentStageIndex + 1}/18:</span>
                  <span className="text-[10px] font-medium text-primary">{ORDER_STAGE_FLOW[o.currentStageIndex]?.label}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${((o.currentStageIndex + 1) / 18) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Stage updater */}
      <div className="lg:col-span-2">
        {selectedOrder && (
          <Card className="p-5 shadow-soft">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedOrder.code}</h3>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerName} · {selectedOrder.garmentCount} items</p>
              </div>
              <Badge variant="secondary">{ORDER_STAGE_FLOW[selectedOrder.currentStageIndex]?.label}</Badge>
            </div>

            <OrderTimeline order={selectedOrder} />

            <Separator className="my-5" />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={async () => {
                  const idx = ORDER_STAGE_FLOW.findIndex(s => s.stage === selectedOrder.status);
                  const nextStage = ORDER_STAGE_FLOW[idx + 1];
                  if (!nextStage) return;
                  try {
                    await api.patch(`/api/orders/${selectedOrder.id}`, { status: nextStage.stage, currentStageIndex: idx + 1 });
                    toast.success(`Stage updated to ${nextStage.label}`, { description: "Customer notified." });
                  } catch (e: any) { toast.error("Update failed", { description: e.message }); }
                }}
              >
                <ArrowUpRight className="h-4 w-4 mr-1.5" />
                Advance to next stage
              </Button>
              <Button variant="outline">
                <Camera className="h-4 w-4 mr-1.5" />
                Upload photo
              </Button>
              <Button variant="outline">
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Report issue
              </Button>
            </div>

            {/* Items */}
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
              <div className="space-y-1.5">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded-lg bg-muted/40 p-2">
                    <ServiceIcon serviceKey={item.serviceKey} className="h-4 w-4 text-primary" />
                    <span className="flex-1">{item.serviceName}</span>
                    <span className="text-muted-foreground">{item.qty} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Vendor Inventory
// ============================================================================
function VendorInventory() {
  const vid = useMyVendorId();
  const { data: inventory, refetch: refetchInventory } = useVendorInventory(vid);
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchInventory, 60000);
    return () => clearInterval(interval);
  }, [vid, refetchInventory]);
  const inv = inventory || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">LH-2847</Badge>
          <span className="text-sm text-muted-foreground">Aarav Mehta · 11 items</span>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1.5" />
          Add garment
        </Button>
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Garment</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Brand</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Color</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Qty</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Condition</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Notes</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Photos</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inv.map((g: any) => (
                <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{g.type}</td>
                  <td className="p-3 text-muted-foreground">{g.brand}</td>
                  <td className="p-3 text-muted-foreground">{g.color}</td>
                  <td className="p-3 text-center font-semibold">{g.qty}</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        g.condition === "Good" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                        g.condition === "Stain on collar" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                        g.condition === "Premium" && "border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-950/30",
                        g.condition === "Delicate" && "border-pink-300 text-pink-700 bg-pink-50 dark:bg-pink-950/30",
                      )}
                    >
                      {g.condition}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{g.notes || "—"}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-muted">
                        <Camera className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-xs">{g.photos}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Damage / missing reports */}
      <Card className="p-4 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Damage & Missing Reports</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border-l-2 border-amber-400">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <Shirt className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Stain on collar — Nike T-Shirt</p>
              <p className="text-xs text-muted-foreground">Pre-treat required before washing · Photo attached</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs">Resolve</Button>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 border-l-2 border-rose-400">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
              <Package className="h-4 w-4 text-rose-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Missing item reported — LH-2810</p>
              <p className="text-xs text-muted-foreground">Customer reports 1 shirt missing from delivery</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs">Investigate</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Vendor Services
// ============================================================================
function VendorServices() {
  const vid = useMyVendorId();
  const { data: services } = useServices();
  const { data: vendorData, refetch: refetchVendor } = useVendor(vid || "");
  const svc = services || [];
  const vendor = vendorData || null;

  const offeredSet = new Set(vendor?.servicesOffered || []);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());

  const [editingRadius, setEditingRadius] = useState(false);
  const [radiusInput, setRadiusInput] = useState(String(vendor?.serviceRadiusKm ?? 5));
  const [editingMinOrder, setEditingMinOrder] = useState(false);
  const [minOrderInput, setMinOrderInput] = useState(String(vendor?.minOrderValue ?? 150));

  useEffect(() => {
    setRadiusInput(String(vendor?.serviceRadiusKm ?? 5));
    setMinOrderInput(String(vendor?.minOrderValue ?? 150));
  }, [vendor?.serviceRadiusKm, vendor?.minOrderValue]);

  const toggleService = useCallback(async (key: string, enabled: boolean) => {
    if (!vendor?.id) return;
    const updated = enabled
      ? [...(vendor.servicesOffered || []), key]
      : (vendor.servicesOffered || []).filter((k) => k !== key);
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { services_offered: updated });
      toast.success(enabled ? "Service enabled" : "Service disabled");
      refetchVendor();
    } catch (e: any) {
      toast.error("Failed to update services", { description: e.message });
    }
  }, [vendor, refetchVendor]);

  const saveSetting = useCallback(async (field: string, value: any, label: string) => {
    if (!vendor?.id) return;
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { [field]: value });
      toast.success(`${label} updated`);
      refetchVendor();
    } catch (e: any) {
      toast.error(`Failed to update ${label}`, { description: e.message });
    }
  }, [vendor, refetchVendor]);

  const toggleDay = useCallback(async (dayKey: string, active: boolean) => {
    if (!vendor?.id) return;
    const hours = { ...(vendor.businessHours || {}) };
    hours[dayKey] = { ...(hours[dayKey] || { open: "08:00", close: "21:00" }), active };
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { business_hours: hours });
      toast.success(active ? `${dayKey} enabled` : `${dayKey} disabled`);
      refetchVendor();
    } catch (e: any) {
      toast.error("Failed to update hours", { description: e.message });
    }
  }, [vendor, refetchVendor]);

  const openBulk = () => {
    setBulkSelection(new Set(vendor?.servicesOffered || []));
    setBulkOpen(true);
  };

  const applyBulk = async () => {
    if (!vendor?.id) return;
    try {
      await api.patch(`/api/vendors/${vendor.id}`, {
        services_offered: Array.from(bulkSelection),
      });
      toast.success("Bulk update applied");
      setBulkOpen(false);
      refetchVendor();
    } catch (e: any) {
      toast.error("Failed to bulk update", { description: e.message });
    }
  };

  // Weekday key map
  const DAY_MAP: Record<string, string> = {
    Monday: "monday", Tuesday: "tuesday", Wednesday: "wednesday",
    Thursday: "thursday", Friday: "friday", Saturday: "saturday", Sunday: "sunday",
  };
  const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const hours = vendor?.businessHours || {};

  if (!vid) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading vendor profile…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Service toggles */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Offered Services</h3>
            <p className="text-xs text-muted-foreground">Toggle services on/off and configure pricing</p>
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={openBulk}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Bulk edit
          </Button>
        </div>
        <div className="space-y-2">
          {svc.map((s) => {
            const offered = offeredSet.has(s.key as any);
            return (
              <div key={s.key} className={cn("flex items-center gap-3 rounded-lg border p-3 transition-all", offered ? "border-border" : "border-dashed opacity-60")}>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shrink-0", s.gradient)}>
                  <ServiceIcon serviceKey={s.key} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Base price</p>
                    <p className="text-sm font-semibold">₹{s.basePrice}{s.pricingType === "per_kg" ? "/kg" : "/pc"}</p>
                  </div>
                  <Switch checked={offered} onCheckedChange={(chk) => toggleService(s.key, chk)} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Business settings */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Business Hours</h3>
          <div className="space-y-2">
            {DAY_LABELS.map((day) => {
              const key = DAY_MAP[day];
              const dayHours = hours[key] || { open: "08:00", close: "21:00", active: key !== "sunday" };
              return (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{day}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{dayHours.open} – {dayHours.close}</span>
                    <Switch checked={dayHours.active !== false} onCheckedChange={(chk) => toggleDay(key, chk)} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Service Area & Settings</h3>
          <div className="space-y-4">
            {/* Service Radius */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Service Radius (km)</p>
              {editingRadius ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={1} max={50}
                    value={radiusInput}
                    onChange={(e) => setRadiusInput(e.target.value)}
                    className="h-8 w-20 text-sm"
                  />
                  <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => { saveSetting("service_radius_km", parseInt(radiusInput) || 5, "Service radius"); setEditingRadius(false); }}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingRadius(false); setRadiusInput(String(vendor?.serviceRadiusKm ?? 5)); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{vendor?.serviceRadiusKm ?? 5} km</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingRadius(true)}>Edit</Button>
                </div>
              )}
            </div>

            {/* Minimum Order */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Minimum Order Value (₹)</p>
              {editingMinOrder ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} step={10}
                    value={minOrderInput}
                    onChange={(e) => setMinOrderInput(e.target.value)}
                    className="h-8 w-20 text-sm"
                  />
                  <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => { saveSetting("min_order_value", parseInt(minOrderInput) || 150, "Min order"); setEditingMinOrder(false); }}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingMinOrder(false); setMinOrderInput(String(vendor?.minOrderValue ?? 150)); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">₹{vendor?.minOrderValue ?? 150}</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingMinOrder(true)}>Edit</Button>
                </div>
              )}
            </div>

            {/* Express Service */}
            <div>
              <p className="text-xs text-muted-foreground">Express Service</p>
              <div className="flex items-center justify-between">
                <p className="text-sm">1.5× pricing · 12hr delivery</p>
                <Switch
                  checked={vendor?.expressEnabled !== false}
                  onCheckedChange={(chk) => saveSetting("express_enabled", chk, "Express service")}
                />
              </div>
            </div>

            {/* Holiday Calendar */}
            <div>
              <p className="text-xs text-muted-foreground">Holiday Calendar</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">15 Aug — Independence Day</Badge>
                <Badge variant="outline" className="text-xs">2 Oct — Gandhi Jayanti</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Services</DialogTitle>
            <DialogDescription>Select all services you want to offer</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {svc.map((s) => {
              const selected = bulkSelection.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    const next = new Set(bulkSelection);
                    if (selected) next.delete(s.key); else next.add(s.key);
                    setBulkSelection(next);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    selected ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shrink-0", s.gradient)}>
                    <ServiceIcon serviceKey={s.key} className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">₹{s.basePrice}/{s.pricingType === "per_kg" ? "kg" : "pc"}</p>
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkSelection(new Set(svc.map((s) => s.key)))}>Select All</Button>
              <Button variant="outline" size="sm" onClick={() => setBulkSelection(new Set())}>Deselect All</Button>
            </div>
            <Button onClick={applyBulk}>Apply ({bulkSelection.size} services)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Vendor Analytics
// ============================================================================
function VendorAnalytics() {
  const vid = useMyVendorId();
  const { data: weeklyRevenue, refetch: refetchWeekly } = useVendorWeeklyRevenue(vid);
  const { data: serviceRevenue, refetch: refetchService } = useVendorServiceRevenue(vid);
  const { data: stats, refetch: refetchStats } = useVendorDashboardStats(vid);
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(() => { refetchWeekly(); refetchService(); refetchStats(); }, 60000);
    return () => clearInterval(interval);
  }, [vid, refetchWeekly, refetchService, refetchStats]);
  const wr = weeklyRevenue || [];
  const sr = serviceRevenue || [];
  const s = stats || {
    totalOrdersThisWeek: 0, weeklyRevenue: 0, avgOrderValue: 0, repeatRate: 0,
    avgRating: 0, totalReviews: 0, ratingBuckets: {}, todayOrders: 0, todayRevenue: 0,
  };
  const totalReviews = s.totalReviews || 0;
  const ratingBuckets = s.ratingBuckets || {};
  const buckets = [5, 4, 3, 2, 1].map((star) => {
    const count = ratingBuckets[star] || 0;
    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { star, count, pct };
  });
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Orders This Week" value={String(s.totalOrdersThisWeek)} change={0} trend="up" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Weekly Revenue" value={formatINR(s.weeklyRevenue)} change={0} trend="up" icon={IndianRupee} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Order Value" value={formatINR(s.avgOrderValue)} change={0} trend="up" icon={TrendingUp} accent="from-violet-500 to-purple-600" />
        <StatCard label="Repeat Customers" value={`${s.repeatRate}%`} change={0} trend="up" icon={Repeat} accent="from-amber-500 to-orange-600" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Orders & Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wr} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹)" fill="#6B9C8E" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#A89B7B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Service-wise Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={sr}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry: any) => `${entry.name}`}
                labelLine={false}
              >
                {sr.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Customer ratings */}
      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Customer Ratings Breakdown</h3>
        <div className="space-y-2">
          {buckets.map((r) => (
            <div key={r.star} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-12">
                <span className="text-sm font-medium">{r.star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-amber-500"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${r.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">{r.count} reviews</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{s.avgRating}</p>
            <p className="text-xs text-muted-foreground">Average rating · {totalReviews} reviews</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Vendor Staff Management
// ============================================================================
function VendorStaff() {
  const vid = useMyVendorId();
  const { data: staff, refetch: refetchStaff } = useStaff(vid || undefined);
  useEffect(() => {
    if (!vid) return;
    const interval = setInterval(refetchStaff, 60000);
    return () => clearInterval(interval);
  }, [vid, refetchStaff]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Staff" value={String((staff || []).length)} icon={Users} accent="from-teal-500 to-cyan-600" />
        <StatCard label="On Duty Now" value={String((staff || []).filter((s) => s.status === "on-duty").length)} icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="On Break" value={String((staff || []).filter((s) => s.status === "on-break").length)} icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Off Duty" value={String((staff || []).filter((s) => s.status === "off-duty").length)} icon={XCircle} accent="from-rose-500 to-pink-600" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["All Staff", "On Duty", "On Break", "Off Duty"].map((f, i) => (
            <button
              key={f}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Staff
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(staff || []).map((s) => {
          const initials = s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
          <motion.div key={s.id} whileHover={{ y: -2 }}>
            <Card className="p-4 shadow-soft hover:shadow-lift transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-primary-surface text-primary-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {s.status === "on-duty" && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                    )}
                    {s.status === "on-break" && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-card" />
                    )}
                    {s.status === "off-duty" && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-muted-foreground ring-2 ring-card" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.role}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    s.status === "on-duty" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                    s.status === "on-break" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                    s.status === "off-duty" && "border-border text-muted-foreground"
                  )}
                >
                  {s.status.replace("-", " ")}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Shift:</span>
                  <span className="font-medium">{s.shift}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Orders today:</span>
                  <span className="font-medium">{s.ordersToday}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  <span className="text-muted-foreground">Rating:</span>
                  <span className="font-medium">{s.rating}</span>
                </div>
              </div>

              <Separator className="my-3" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
                  Assign Order
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  View Profile
                </Button>
              </div>
            </Card>
          </motion.div>
          );
        })}
      </div>

      {/* Shift schedule */}
      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Today&apos;s Shift Schedule</h3>
        <div className="space-y-2">
          {Array.from(new Set((staff || []).map((s) => s.shift))).map((shift) => {
            const names = (staff || []).filter((s) => s.shift === shift).map((s) => s.name);
            const colors = ["bg-amber-100 text-amber-700 dark:bg-amber-950/30", "bg-teal-100 text-teal-700 dark:bg-teal-950/30", "bg-violet-100 text-violet-700 dark:bg-violet-950/30", "bg-blue-100 text-blue-700 dark:bg-blue-950/30"];
            const idx = Array.from(new Set((staff || []).map((s) => s.shift))).indexOf(shift) % colors.length;
            return (
              <div key={shift} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <Badge variant="outline" className={cn("text-[10px]", colors[idx])}>{shift}</Badge>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((name) => (
                    <span key={name} className="text-xs font-medium rounded-full bg-muted px-2 py-0.5">{name}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
