"use client";

import { useState } from "react";
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
import { StatCard } from "@/components/shared/stat-card";
import { ServiceIcon } from "@/components/shared/service-icon";
import { OrderTimeline } from "@/components/shared/order-timeline";
import {
  ORDERS,
  VENDOR_ORDERS,
  SERVICES,
  VENDOR_WEEKLY_REVENUE,
  VENDOR_SERVICE_REVENUE,
  GARMENT_INVENTORY,
  ORDER_STAGE_FLOW,
} from "@/lib/mock-data";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Vendor",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { id: "orders", label: "Order Management", icon: "ClipboardList", badge: 4 },
      { id: "processing", label: "Laundry Processing", icon: "WashingMachine" },
      { id: "inventory", label: "Garment Inventory", icon: "Boxes" },
      { id: "staff", label: "Staff Management", icon: "Users" },
      { id: "services", label: "Service Management", icon: "Settings2" },
      { id: "analytics", label: "Analytics", icon: "BarChart3" },
    ],
  },
];

const allVendorOrders = [...ORDERS.filter(o => o.vendorId === "v1"), ...VENDOR_ORDERS];

export function VendorApp() {
  const [view, setView] = useState("dashboard");

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
      actions={
        view === "orders" ? (
          <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />
            Manual Order
          </Button>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <VendorDashboard key="d" />}
        {view === "orders" && <VendorOrders key="o" />}
        {view === "processing" && <VendorProcessing key="p" />}
        {view === "inventory" && <VendorInventory key="i" />}
        {view === "staff" && <VendorStaff key="st" />}
        {view === "services" && <VendorServices key="s" />}
        {view === "analytics" && <VendorAnalytics key="a" />}
      </AnimatePresence>
    </AppShell>
  );
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
  }[view] || "Dashboard";
}
function pageSubtitle(view: string) {
  return {
    dashboard: "FreshFold Laundry Co. · Indiranagar, Bengaluru",
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
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 text-white border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0">● Online</Badge>
                <Badge className="bg-white/20 text-white border-0">Verified Vendor</Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Good afternoon, FreshFold! 👋
              </h2>
              <p className="text-sm text-white/80 mt-1">
                You have <strong>4 new orders</strong> waiting · Today&apos;s revenue: <strong>₹18,900</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Today&apos;s Revenue</p>
                <p className="text-xl font-bold mt-0.5">₹18.9K</p>
                <p className="text-[10px] text-emerald-200">+12% vs avg</p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Capacity Used</p>
                <p className="text-xl font-bold mt-0.5">62%</p>
                <p className="text-[10px] text-white/70">38% available</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Orders" value="28" change={8.1} trend="up" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Today's Revenue" value={formatINR(18900)} change={12.4} trend="up" icon={IndianRupee} accent="from-emerald-500 to-green-600" />
        <StatCard label="Pending Acceptance" value="4" icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Avg Rating" value="4.8★" change={2.1} trend="up" icon={Star} accent="from-violet-500 to-purple-600" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Weekly Revenue</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · ₹1,46,500 total</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              +18.9%
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={VENDOR_WEEKLY_REVENUE} margin={{ left: -16, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }}
                formatter={(v: number) => [formatINR(v), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2.5} fill="url(#rev-grad)" />
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
                data={VENDOR_SERVICE_REVENUE}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
              >
                {VENDOR_SERVICE_REVENUE.map((entry, i) => (
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
            {VENDOR_SERVICE_REVENUE.map((s) => (
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
            {allVendorOrders.filter(o => ["placed", "vendor_assigned", "vendor_accepted", "pickup_scheduled"].includes(o.status)).map((o) => (
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
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700">
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90"
                    onClick={() => toast.success(`Order ${o.code} accepted`, { description: "Customer has been notified." })}
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
  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-1.5 text-[10px]">3</Badge></TabsTrigger>
        <TabsTrigger value="accepted">Accepted <Badge variant="secondary" className="ml-1.5 text-[10px]">1</Badge></TabsTrigger>
        <TabsTrigger value="processing">Processing <Badge variant="secondary" className="ml-1.5 text-[10px]">2</Badge></TabsTrigger>
        <TabsTrigger value="completed">Completed</TabsTrigger>
      </TabsList>

      {(["pending", "accepted", "processing", "completed"] as const).map((tab) => {
        const filtered = allVendorOrders.filter((o) => {
          if (tab === "pending") return ["placed", "vendor_assigned"].includes(o.status);
          if (tab === "accepted") return ["vendor_accepted", "pickup_scheduled"].includes(o.status);
          if (tab === "processing") return ["pickup_completed", "laundry_received", "sorting", "tagging", "washing", "drying", "ironing", "dry_cleaning", "quality_inspection", "packing", "ready_for_dispatch"].includes(o.status);
          return ["delivered", "completed"].includes(o.status);
        });
        return (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((o) => (
                <VendorOrderCard key={o.id} order={o} />
              ))}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function VendorOrderCard({ order }: { order: typeof ORDERS[0] }) {
  const stage = ORDER_STAGE_FLOW[order.currentStageIndex];
  return (
    <Card className="p-4 shadow-soft hover:shadow-glow transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted text-[10px] font-semibold">{order.customerAvatar}</AvatarFallback>
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
          {order.garmentCount} items · {order.items.length} services
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
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
        {["placed", "vendor_assigned"].includes(order.status) && (
          <>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-rose-600">
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90"
              onClick={() => toast.success(`Order ${order.code} accepted`)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Accept
            </Button>
          </>
        )}
        {!["placed", "vendor_assigned", "delivered", "completed"].includes(order.status) && (
          <Button size="sm" className="flex-1 h-8 bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
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
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
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
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90"
                onClick={() => toast.success("Stage updated", { description: "Customer notified." })}
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">LH-2847</Badge>
          <span className="text-sm text-muted-foreground">Aarav Mehta · 11 items</span>
        </div>
        <Button size="sm" className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
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
              {GARMENT_INVENTORY.map((g) => (
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
  return (
    <div className="space-y-6">
      {/* Service toggles */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Offered Services</h3>
            <p className="text-xs text-muted-foreground">Toggle services on/off and configure pricing</p>
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Bulk edit
          </Button>
        </div>
        <div className="space-y-2">
          {SERVICES.map((s) => {
            const offered = ["wash_fold", "wash_iron", "dry_cleaning", "steam_ironing", "premium_care"].includes(s.key);
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
                  <Switch defaultChecked={offered} />
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
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
              <div key={day} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{day}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">8:00 AM – 9:00 PM</span>
                  <Switch defaultChecked={day !== "Sunday"} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Service Area & Settings</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Service Radius</p>
              <p className="text-lg font-semibold">5 km</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Minimum Order Value</p>
              <p className="text-lg font-semibold">₹150</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Express Service</p>
              <div className="flex items-center justify-between">
                <p className="text-sm">1.5× pricing · 12hr delivery</p>
                <Switch defaultChecked />
              </div>
            </div>
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
    </div>
  );
}

// ============================================================================
// Vendor Analytics
// ============================================================================
function VendorAnalytics() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Orders This Week" value="208" change={14.2} trend="up" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Weekly Revenue" value={formatINR(146500)} change={18.9} trend="up" icon={IndianRupee} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Order Value" value={formatINR(705)} change={4.1} trend="up" icon={TrendingUp} accent="from-violet-500 to-purple-600" />
        <StatCard label="Repeat Customers" value="78%" change={4.5} trend="up" icon={Repeat} accent="from-amber-500 to-orange-600" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Orders & Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={VENDOR_WEEKLY_REVENUE} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Service-wise Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={VENDOR_SERVICE_REVENUE}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry: any) => `${entry.name}`}
                labelLine={false}
              >
                {VENDOR_SERVICE_REVENUE.map((entry, i) => (
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
          {[
            { star: 5, count: 892, pct: 78 },
            { star: 4, count: 184, pct: 16 },
            { star: 3, count: 72, pct: 6 },
            { star: 2, count: 28, pct: 2 },
            { star: 1, count: 19, pct: 2 },
          ].map((r) => (
            <div key={r.star} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-12">
                <span className="text-sm font-medium">{r.star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
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
            <p className="text-2xl font-bold">4.8</p>
            <p className="text-xs text-muted-foreground">Average rating · 1,195 reviews</p>
          </div>
          <Badge variant="secondary" className="text-emerald-600">Top 5% vendors</Badge>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Vendor Staff Management
// ============================================================================
function VendorStaff() {
  const staff = [
    { id: "s1", name: "Lakshmi Devi", role: "Senior Washer", avatar: "LD", shift: "Morning (6 AM – 2 PM)", status: "on-duty", ordersToday: 18, rating: 4.9, joined: "Mar 2023" },
    { id: "s2", name: "Mohammed Irfan", role: "Ironing Specialist", avatar: "MI", shift: "Morning (6 AM – 2 PM)", status: "on-duty", ordersToday: 22, rating: 4.8, joined: "Jul 2023" },
    { id: "s3", name: "Sunita Rao", role: "Dry Cleaner", avatar: "SR", shift: "Afternoon (2 PM – 10 PM)", status: "on-duty", ordersToday: 14, rating: 4.7, joined: "Jan 2024" },
    { id: "s4", name: "Arjun Nair", role: "Quality Inspector", avatar: "AN", shift: "Afternoon (2 PM – 10 PM)", status: "on-duty", ordersToday: 28, rating: 4.9, joined: "Nov 2023" },
    { id: "s5", name: "Fatima Begum", role: "Packing Specialist", avatar: "FB", shift: "Evening (10 AM – 6 PM)", status: "on-break", ordersToday: 16, rating: 4.6, joined: "Feb 2024" },
    { id: "s6", name: "Vijay Kumar", role: "Sorting & Tagging", avatar: "VK", shift: "Morning (6 AM – 2 PM)", status: "off-duty", ordersToday: 0, rating: 4.5, joined: "Apr 2024" },
    { id: "s7", name: "Deepa Singh", role: "Junior Washer", avatar: "DS", shift: "Afternoon (2 PM – 10 PM)", status: "off-duty", ordersToday: 0, rating: 4.4, joined: "May 2024" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Staff" value="7" icon={Users} accent="from-teal-500 to-cyan-600" />
        <StatCard label="On Duty Now" value="5" icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="On Break" value="1" icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Off Duty" value="1" icon={XCircle} accent="from-rose-500 to-pink-600" />
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
        <Button size="sm" className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Staff
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map((s) => (
          <motion.div key={s.id} whileHover={{ y: -2 }}>
            <Card className="p-4 shadow-soft hover:shadow-glow transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-xs font-semibold">
                        {s.avatar}
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
        ))}
      </div>

      {/* Shift schedule */}
      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Today&apos;s Shift Schedule</h3>
        <div className="space-y-2">
          {[
            { shift: "Morning (6 AM – 2 PM)", staff: ["Lakshmi Devi", "Mohammed Irfan", "Vijay Kumar"], color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30" },
            { shift: "Evening (10 AM – 6 PM)", staff: ["Fatima Begum"], color: "bg-teal-100 text-teal-700 dark:bg-teal-950/30" },
            { shift: "Afternoon (2 PM – 10 PM)", staff: ["Sunita Rao", "Arjun Nair", "Deepa Singh"], color: "bg-violet-100 text-violet-700 dark:bg-violet-950/30" },
          ].map((s) => (
            <div key={s.shift} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <Badge variant="outline" className={cn("text-[10px]", s.color)}>{s.shift}</Badge>
              <div className="flex flex-wrap gap-1.5">
                {s.staff.map((name) => (
                  <span key={name} className="text-xs font-medium rounded-full bg-muted px-2 py-0.5">{name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
