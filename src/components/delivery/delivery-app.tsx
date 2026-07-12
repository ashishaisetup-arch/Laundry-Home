"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bike,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  MapPin,
  Navigation,
  Package,
  Phone,
  Signature,
  Store,
  User,
  Camera,
  ShieldCheck,
  MessageSquare,
  KeySquare,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { StatCard } from "@/components/shared/stat-card";
import { DELIVERY_TASKS } from "@/lib/mock-data";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Delivery",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { id: "pickups", label: "Today's Pickups", icon: "Package", badge: 2 },
      { id: "deliveries", label: "Today's Deliveries", icon: "Truck", badge: 2 },
      { id: "earnings", label: "Earnings", icon: "IndianRupee" },
    ],
  },
];

export function DeliveryApp() {
  const [view, setView] = useState("dashboard");

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <DeliveryDashboard key="d" />}
        {view === "pickups" && <DeliveryTasks key="p" type="pickup" />}
        {view === "deliveries" && <DeliveryTasks key="d" type="delivery" />}
        {view === "earnings" && <DeliveryEarnings key="e" />}
      </AnimatePresence>
    </AppShell>
  );
}

function pageTitle(view: string) {
  return {
    dashboard: "Delivery Dashboard",
    pickups: "Today's Pickups",
    deliveries: "Today's Deliveries",
    earnings: "Earnings",
  }[view] || "Dashboard";
}
function pageSubtitle(view: string) {
  return {
    dashboard: "Rajesh Kumar · Indiranagar zone",
    pickups: "Pickup tasks assigned to you today",
    deliveries: "Delivery tasks assigned to you today",
    earnings: "Track your earnings and payouts",
  }[view];
}

function DeliveryDashboard() {
  const pickups = DELIVERY_TASKS.filter((t) => t.type === "pickup");
  const deliveries = DELIVERY_TASKS.filter((t) => t.type === "delivery");

  return (
    <div className="space-y-6">
      {/* Banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0">● On duty</Badge>
                <Badge className="bg-white/20 text-white border-0">Indiranagar zone</Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Hi Rajesh! 4 tasks today 🛵
              </h2>
              <p className="text-sm text-white/80 mt-1">
                <strong>2 pickups</strong> and <strong>2 deliveries</strong> · Estimated earnings: <strong>₹640</strong>
              </p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur p-3">
              <p className="text-xs text-white/80">Today&apos;s earnings</p>
              <p className="text-2xl font-bold mt-0.5">{formatINR(640)}</p>
              <p className="text-[10px] text-emerald-200">+₹180 in tips</p>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Tasks" value="4" icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Completed" value="0" icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Km Today" value="12.4" icon={Navigation} accent="from-violet-500 to-purple-600" />
        <StatCard label="Earnings" value={formatINR(640)} change={8.2} trend="up" icon={IndianRupee} accent="from-amber-500 to-orange-600" />
      </div>

      {/* Next task highlight */}
      <Card className="p-5 shadow-glow border-primary/30 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30">
        <div className="flex items-center gap-2 mb-3">
          <motion.span
            className="flex h-2 w-2 rounded-full bg-primary"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Next task · in 25 mins</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Pickup · LH-2849</p>
              <p className="text-sm text-muted-foreground">Aarav Mehta · Flat 402, Skyline Residency, Indiranagar</p>
              <p className="text-xs text-muted-foreground mt-0.5">10 shirts (Wash & Iron) · 1.4 km away</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Phone className="h-4 w-4 mr-1.5" />
              Call
            </Button>
            <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
              <Navigation className="h-4 w-4 mr-1.5" />
              Start navigation
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Today's pickups */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-500" />
              Pickups
            </h3>
            <Badge variant="secondary">{pickups.length} tasks</Badge>
          </div>
          <div className="space-y-2">
            {pickups.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </Card>

        {/* Today's deliveries */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Bike className="h-4 w-4 text-emerald-500" />
              Deliveries
            </h3>
            <Badge variant="secondary">{deliveries.length} tasks</Badge>
          </div>
          <div className="space-y-2">
            {deliveries.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: typeof DELIVERY_TASKS[0] }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-white shrink-0",
        task.type === "pickup" ? "bg-gradient-to-br from-teal-500 to-cyan-600" : "bg-gradient-to-br from-emerald-500 to-green-600"
      )}>
        {task.type === "pickup" ? <Package className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{task.orderCode}</p>
          <Badge variant="outline" className="text-[9px] py-0 h-4">{task.slot}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{task.customerName} · {task.area}</p>
        <p className="text-[10px] text-muted-foreground">{task.distanceKm} km · {task.estimatedMins} mins</p>
      </div>
      <Button size="sm" variant="outline" className="h-7 text-xs">
        <Navigation className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function DeliveryTasks({ type }: { type: "pickup" | "delivery" }) {
  const tasks = DELIVERY_TASKS.filter((t) => t.type === type);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id || null);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Task list */}
      <Card className="p-4 shadow-soft">
        <h3 className="font-semibold mb-3 capitalize">{type} Tasks</h3>
        <div className="space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className={cn(
                "w-full text-left rounded-lg border p-3 transition-all",
                selectedTask?.id === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{t.orderCode}</p>
                <Badge variant="outline" className="text-[9px] py-0 h-4 capitalize">{t.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{t.customerName}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t.slot} · {t.distanceKm} km</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Task detail */}
      <div className="lg:col-span-2 space-y-4">
        {selectedTask && (
          <>
            {/* Map */}
            <Card className="p-0 overflow-hidden shadow-soft">
              <div className="relative h-56 bg-gradient-to-br from-teal-100 via-emerald-100 to-cyan-100 dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-cyan-950/40">
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: `
                    linear-gradient(oklch(0.62 0.13 180 / 0.15) 1px, transparent 1px),
                    linear-gradient(90deg, oklch(0.62 0.13 180 / 0.15) 1px, transparent 1px)
                  `,
                  backgroundSize: "30px 30px",
                }} />
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <motion.path
                    d="M 60 150 Q 150 50 200 100 T 340 60"
                    stroke="oklch(0.62 0.13 180)"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  />
                </svg>
                <div className="absolute bottom-8 left-8 flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg ring-4 ring-white">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold mt-1 bg-white/80 px-1.5 rounded">Your location</span>
                </div>
                <div className="absolute top-12 right-16 flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg ring-4 ring-white">
                    <Store className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold mt-1 bg-white/80 px-1.5 rounded capitalize">{type}</span>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedTask.distanceKm} km away</span>
                  <span className="text-muted-foreground">· ~{selectedTask.estimatedMins} mins</span>
                </div>
                <Button size="sm" className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
                  <Navigation className="h-3.5 w-3.5 mr-1.5" />
                  Navigate
                </Button>
              </div>
            </Card>

            {/* Customer info */}
            <Card className="p-5 shadow-soft">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">{type === "pickup" ? "Pickup from" : "Deliver to"}</p>
                  <h3 className="text-lg font-semibold">{selectedTask.customerName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTask.address}</p>
                </div>
                <Badge variant="secondary">{selectedTask.slot}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground">Items</p>
                  <p className="text-sm font-medium">{selectedTask.items}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground">Payment</p>
                  <p className="text-sm font-medium">{selectedTask.paymentMode}</p>
                  {selectedTask.amount > 0 && <p className="text-xs text-muted-foreground">{formatINRDecimal(selectedTask.amount)} to collect</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-10">
                  <Phone className="h-4 w-4 mr-1.5" />
                  Call
                </Button>
                <Button variant="outline" className="h-10">
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Chat
                </Button>
                <Button variant="outline" className="h-10">
                  <Store className="h-4 w-4 mr-1.5" />
                  Vendor
                </Button>
              </div>
            </Card>

            {/* Status update + Proof of delivery */}
            <Card className="p-5 shadow-soft">
              <h3 className="font-semibold mb-3">Status Updates</h3>
              <div className="space-y-2 mb-4">
                {[
                  { id: "heading_to_pickup", label: "Heading to pickup", icon: Navigation, done: type === "pickup" ? false : true },
                  { id: "picked_up", label: "Picked up", icon: Package, done: type === "pickup" ? false : true },
                  { id: "heading_to_vendor", label: "Heading to vendor", icon: Bike, done: type === "pickup" ? false : true },
                  { id: "reached_vendor", label: "Reached vendor", icon: Store, done: type === "pickup" ? false : true },
                  { id: "out_for_delivery", label: "Out for delivery", icon: Bike, done: type === "delivery" ? selectedTask.status === "out_for_delivery" : false },
                  { id: "delivered", label: "Delivered", icon: CheckCircle2, done: false },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toast.success(`Status updated: ${s.label}`)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                      s.done ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-border hover:bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <span className={cn("text-sm flex-1", s.done ? "font-medium text-emerald-700 dark:text-emerald-400" : "")}>{s.label}</span>
                    {!s.done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {s.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>

              {type === "delivery" && (
                <>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-semibold mb-3">Proof of Delivery</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="flex-col h-20 hover:bg-muted/30">
                      <KeySquare className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Customer OTP</span>
                    </Button>
                    <Button variant="outline" className="flex-col h-20 hover:bg-muted/30">
                      <Signature className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Signature</span>
                    </Button>
                    <Button variant="outline" className="flex-col h-20 hover:bg-muted/30">
                      <Camera className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Photo</span>
                    </Button>
                  </div>
                  <Button className="w-full mt-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90">
                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                    Complete Delivery
                  </Button>
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function DeliveryEarnings() {
  const weeklyEarnings = [
    { day: "Mon", earnings: 420, trips: 8 },
    { day: "Tue", earnings: 580, trips: 11 },
    { day: "Wed", earnings: 510, trips: 10 },
    { day: "Thu", earnings: 640, trips: 12 },
    { day: "Fri", earnings: 780, trips: 14 },
    { day: "Sat", earnings: 920, trips: 16 },
    { day: "Sun", earnings: 680, trips: 12 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Earnings" value={formatINR(640)} change={8.2} trend="up" icon={IndianRupee} accent="from-teal-500 to-cyan-600" />
        <StatCard label="This Week" value={formatINR(4530)} change={12.4} trend="up" icon={Calendar} accent="from-emerald-500 to-green-600" />
        <StatCard label="Total Trips" value="83" change={6.1} trend="up" icon={Bike} accent="from-violet-500 to-purple-600" />
        <StatCard label="Avg Per Trip" value={formatINR(54)} change={3.2} trend="up" icon={TrendingUp} accent="from-amber-500 to-orange-600" />
      </div>

      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Weekly Earnings</h3>
            <p className="text-xs text-muted-foreground">Last 7 days · 83 trips · ₹4,530 total</p>
          </div>
          <Button variant="outline" size="sm">Withdraw</Button>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={weeklyEarnings} margin={{ left: -16, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 180)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" />
            <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 195)" tickFormatter={(v) => `₹${v}`} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 180)", fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
            <Bar dataKey="earnings" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Recent Payouts</h3>
        <div className="space-y-2">
          {[
            { date: "Today", amount: 640, status: "pending", trips: 4 },
            { date: "Yesterday", amount: 920, status: "paid", trips: 16 },
            { date: "2 days ago", amount: 780, status: "paid", trips: 14 },
            { date: "3 days ago", amount: 640, status: "paid", trips: 12 },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{p.date} · {p.trips} trips</p>
                <p className="text-xs text-muted-foreground">Payout to •••• 4242</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatINR(p.amount)}</p>
                <Badge variant="outline" className={cn("text-[10px] py-0 h-4", p.status === "paid" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30")}>
                  {p.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
