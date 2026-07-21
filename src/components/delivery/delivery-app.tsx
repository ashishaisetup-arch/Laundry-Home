
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bike,
  Calendar,
  CheckCircle2,
  IndianRupee,
  Navigation,
  Package,
  Phone,
  Signature,
  Store,
  Camera,
  ShieldCheck,
  KeySquare,
  TrendingUp,
  X,
  Image,
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
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { StatCard } from "@/components/shared/stat-card";
import { LeafletMap } from "@/components/shared/leaflet-map";
import { useDeliveryTasks, useOrders } from "@/lib/hooks";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useDeliveryLocation } from "@/lib/hooks/useDeliveryLocation";
import { useAppStore } from "@/lib/store";
import type { DeliveryTask } from "@/lib/types";
import { api } from "@/lib/api/client";
import { cn, formatINRDecimal } from "@/lib/utils";
import { lookupAreaCoords } from "@/lib/geo";
import { toast } from "sonner";

const STATUS_ORDER = [
  "pending",
  "heading_to_pickup",
  "picked_up",
  "heading_to_vendor",
  "reached_vendor",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
] as const;

// Pickup-relevant status steps (mapped to UI-friendly labels)
const PICKUP_STEPS = [
  { id: "heading_to_pickup", label: "Heading to pickup", icon: Navigation },
  { id: "picked_up", label: "Picked up", icon: Package },
  { id: "heading_to_vendor", label: "Heading to vendor", icon: Bike },
  { id: "reached_vendor", label: "Reached vendor", icon: Store },
  { id: "ready_for_delivery", label: "Handover to vendor", icon: CheckCircle2 },
];

const DELIVERY_STEPS = [
  { id: "out_for_delivery", label: "Out for delivery", icon: Bike },
  { id: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function statusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as typeof STATUS_ORDER[number]);
}

function filterSortTasks(tasks: DeliveryTask[], type: "pickup" | "delivery") {
  return tasks
    .filter((t) => t.type === type)
    .sort((a, b) => {
      const orderA = statusIndex(a.status);
      const orderB = statusIndex(b.status);
      if (orderA !== orderB) return orderA - orderB;
      return (a.slot || "").localeCompare(b.slot || "");
    });
}

export function DeliveryApp() {
  const [view, setView] = useState("dashboard");
  const { userName, userId } = useAppStore();
  const { data: allTasks } = useDeliveryTasks(userId);
  useOrders(userId ? { deliveryExecutiveId: userId } : undefined);
  const tasks = allTasks || [];

  const pickupCount = useMemo(() => tasks.filter((t) => t.type === "pickup").length, [tasks]);
  const deliveryCount = useMemo(() => tasks.filter((t) => t.type === "delivery").length, [tasks]);

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: "Delivery",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
        { id: "pickups", label: "Today's Pickups", icon: "Package", badge: pickupCount },
        { id: "deliveries", label: "Today's Deliveries", icon: "Truck", badge: deliveryCount },
        { id: "earnings", label: "Earnings", icon: "IndianRupee" },
      ],
    },
  ], [pickupCount, deliveryCount]);

  const pageTitle = useMemo(() => ({
    dashboard: "Delivery Dashboard",
    pickups: "Today's Pickups",
    deliveries: "Today's Deliveries",
    earnings: "Earnings",
  } as Record<string, string>), []);

  const pageSubtitle = useMemo(() => ({
    dashboard: `${userName || "Delivery Partner"} · Active now`,
    pickups: "Pickup tasks assigned to you today",
    deliveries: "Delivery tasks assigned to you today",
    earnings: "Track your earnings and payouts",
  } as Record<string, string>), [userName]);

  return (
    <AppShell
      groups={navGroups}
      activeView={view}
      onNavigate={setView}
      pageTitle={pageTitle[view] || "Dashboard"}
      pageSubtitle={pageSubtitle[view] || ""}
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && <DeliveryDashboard key="dashboard" tasks={tasks} />}
        {view === "pickups" && <DeliveryTasks key="pickups" type="pickup" />}
        {view === "deliveries" && <DeliveryTasks key="deliveries" type="delivery" />}
        {view === "earnings" && <DeliveryEarnings key="earnings" />}
      </AnimatePresence>
    </AppShell>
  );
}

function DeliveryDashboard({ tasks }: { tasks: DeliveryTask[] }) {
  const { userName } = useAppStore();
  const pickups = tasks.filter((t) => t.type === "pickup");
  const deliveries = tasks.filter((t) => t.type === "delivery");
  const totalCount = tasks.length;
  const completed = tasks.filter((t) => t.status === "delivered").length;
  const totalKm = tasks.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const todayEarnings = tasks
    .filter((t) => t.status === "delivered")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const geo = useGeolocation(true);

  // Next task: the first pending non-delivered task sorted by status+slot
  const nextTask = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "delivered");
    const sorted = active.sort((a, b) => {
      const orderA = statusIndex(a.status);
      const orderB = statusIndex(b.status);
      if (orderA !== orderB) return orderA - orderB;
      return (a.slot || "").localeCompare(b.slot || "");
    });
    return sorted[0] || null;
  }, [tasks]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-0">● On duty</Badge>
                {nextTask && <Badge className="bg-white/20 text-white border-0">{nextTask.area}</Badge>}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Hi {userName || "Partner"}! {totalCount} task{totalCount !== 1 ? "s" : ""} today 🛵
              </h2>
              <p className="text-sm text-white/80 mt-1">
                <strong>{pickups.length} pickup{pickups.length !== 1 ? "s" : ""}</strong> and <strong>{deliveries.length} delivery{deliveries.length !== 1 ? "ies" : "y"}</strong> · Estimated earnings: <strong>₹{todayEarnings}</strong>
              </p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur p-3">
              <p className="text-xs text-white/80">Today&apos;s earnings</p>
              <p className="text-2xl font-bold mt-0.5">₹{todayEarnings}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Tasks" value={String(totalCount)} icon={Package} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Completed" value={String(completed)} icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Km Today" value={String(totalKm.toFixed(1))} icon={Navigation} accent="from-violet-500 to-purple-600" />
        <StatCard label="Earnings" value={`₹${todayEarnings}`} icon={IndianRupee} accent="from-amber-500 to-orange-600" />
      </div>

      {nextTask && (
        <Card className="p-5 shadow-lift border-primary/30 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30">
          <div className="flex items-center gap-2 mb-3">
            <motion.span
              className="flex h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Next task · {nextTask.slot}
            </p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-surface text-primary-foreground">
                {nextTask.type === "pickup" ? <Package className="h-6 w-6" /> : <Bike className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-semibold capitalize">{nextTask.type} · {nextTask.orderCode}</p>
                <p className="text-sm text-muted-foreground">{nextTask.customerName} · {nextTask.address}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{nextTask.items} · {nextTask.distanceKm} km away</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-500" />
              Pickups
            </h3>
            <Badge variant="secondary">{pickups.length} task{pickups.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="space-y-2">
            {pickups.map((t) => (
              <TaskRow key={t.id} task={t} execLat={geo.lat} execLng={geo.lng} />
            ))}
            {pickups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pickup tasks</p>}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Bike className="h-4 w-4 text-emerald-500" />
              Deliveries
            </h3>
            <Badge variant="secondary">{deliveries.length} task{deliveries.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="space-y-2">
            {deliveries.map((t) => (
              <TaskRow key={t.id} task={t} execLat={geo.lat} execLng={geo.lng} />
            ))}
            {deliveries.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No delivery tasks</p>}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function TaskRow({ task, execLat, execLng }: { task: DeliveryTask; execLat?: number | null; execLng?: number | null }) {
  function navUrl(t: DeliveryTask): string {
    const lat = t.type === "pickup" ? t.pickupLat : t.deliveryLat;
    const lng = t.type === "pickup" ? t.pickupLng : t.deliveryLng;
    const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(t.address || t.area);
    const origin = execLat != null && execLng != null ? `&origin=${execLat},${execLng}` : "";
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=driving`;
  }
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
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(navUrl(task), "_blank")}>
        <Navigation className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── OTP Dialog ──
function OtpDialog({ task, open, onOpenChange }: { task: DeliveryTask; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [inputOtp, setInputOtp] = useState("");
  const [verified, setVerified] = useState(task.otpVerified || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setOtp(null);
      setInputOtp("");
      setVerified(task.otpVerified || false);
    }
  }, [open, task.otpVerified]);

  const generateOtp = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ otp: string; masked: string }>(`/api/delivery-tasks/${task.id}/otp`);
      setOtp(data.masked);
      toast.success("OTP generated");
    } catch (e: any) {
      toast.error("Failed to generate OTP", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!inputOtp) { toast.error("Enter the OTP"); return; }
    setLoading(true);
    try {
      const data = await api.post<{ verified: boolean }>(`/api/delivery-tasks/${task.id}/verify-otp`, { otp: inputOtp });
      if (data.verified) {
        setVerified(true);
        toast.success("OTP verified");
      }
    } catch (e: any) {
      toast.error("Invalid OTP", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Customer OTP</DialogTitle>
          <DialogDescription>Verify identity before completing delivery</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {verified ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">OTP Verified</span>
            </div>
          ) : otp ? (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Generated OTP</p>
                <p className="text-3xl font-bold tracking-widest">{otp}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Enter OTP from customer</p>
                <Input
                  placeholder="Enter 4-digit OTP"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="text-center text-lg tracking-widest"
                />
                <Button className="w-full" onClick={verifyOtp} disabled={loading || inputOtp.length !== 4}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Generate a one-time password for the customer to provide at delivery.</p>
              <Button className="w-full" onClick={generateOtp} disabled={loading}>
                {loading ? "Generating..." : "Generate OTP"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Signature Canvas Dialog ──
function SignatureDialog({ task, open, onOpenChange }: { task: DeliveryTask; open: boolean; onOpenChange: (open: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saved, setSaved] = useState(!!task.signature);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSaved(!!task.signature);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
        }
      }
    }
  }, [open, task.signature]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setLoading(true);
    try {
      await api.post(`/api/delivery-tasks/${task.id}/signature`, { signature_data: dataUrl });
      setSaved(true);
      toast.success("Signature saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed to save signature", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proof of Delivery — Signature</DialogTitle>
          <DialogDescription>Ask the customer to sign below</DialogDescription>
        </DialogHeader>
        {saved ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Signature captured</span>
          </div>
        ) : (
          <div className="space-y-3">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="w-full border border-border rounded-lg cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={clearCanvas}>Clear</Button>
              <Button className="flex-1" onClick={saveSignature} disabled={loading}>
                {loading ? "Saving..." : "Accept Signature"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delivery Tasks (Pickups & Deliveries) ──
function DeliveryTasks({ type }: { type: "pickup" | "delivery" }) {
  const { data: allTasks, refetch: refetchTasks } = useDeliveryTasks();
  const tasks = useMemo(() => filterSortTasks(allTasks || [], type), [allTasks, type]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;

  // Proof-of-delivery dialogs
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) setSelectedTaskId(tasks[0].id);
  }, [tasks, selectedTaskId]);

  const isActive = selectedTask != null && !["pending", "delivered"].includes(selectedTask.status);
  const geo = useGeolocation(true);
  useDeliveryLocation(isActive);

  function taskDest(task: DeliveryTask): { lat: number; lng: number } | null {
    const lat = task.type === "pickup" ? task.pickupLat : task.deliveryLat;
    const lng = task.type === "pickup" ? task.pickupLng : task.deliveryLng;
    if (lat != null && lng != null) return { lat, lng };
    return lookupAreaCoords(task.area);
  }
  const taskCoords = selectedTask ? taskDest(selectedTask) : null;
  const origin = geo.lat && geo.lng ? { lat: geo.lat, lng: geo.lng } : null;
  const dest = taskCoords;
  const [route, setRoute] = useState<{ coordinates: [number, number][]; distance: number; duration: number } | null>(null);

  useEffect(() => {
    if (!origin || !dest) { setRoute(null); return; }
    let cancelled = false;
    fetch(`/api/routing/directions?start_lat=${origin.lat}&start_lng=${origin.lng}&end_lat=${dest.lat}&end_lng=${dest.lng}&profile=driving-car`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.features?.[0]?.geometry?.coordinates;
        if (coords && coords.length >= 2) {
          const summary = data.features[0].properties?.summary;
          setRoute({
            coordinates: coords.map((c: number[]) => [c[1], c[0]] as [number, number]),
            distance: summary?.distance || 0,
            duration: summary?.duration || 0,
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lng, dest?.lat, dest?.lng]);

  const updateTaskStatus = async (taskId: string, status: string, label: string) => {
    try {
      await api.patch(`/api/delivery-tasks/${taskId}`, { status });
      toast.success(`Status updated: ${label}`);
      refetchTasks();
    } catch (e: any) {
      toast.error("Failed to update status", { description: e.message });
    }
  };

  // Determine which status steps to show based on type and actual status
  const steps = useMemo(() => {
    const allSteps = type === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
    if (!selectedTask) return allSteps;
    const currentIdx = statusIndex(selectedTask.status);
    return allSteps.map((s) => {
      const stepIdx = statusIndex(s.id);
      const done = stepIdx <= currentIdx && selectedTask.status !== "pending";
      const available = !done && stepIdx === currentIdx + 1;
      return { ...s, done, available };
    });
  }, [type, selectedTask]);

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await api.post(`/api/delivery-tasks/${selectedTask.id}/photo`, { photo_data: dataUrl });
        toast.success("Photo uploaded");
        refetchTasks();
      } catch (err: any) {
        toast.error("Failed to upload photo", { description: err.message });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="grid lg:grid-cols-3 gap-4">
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
              <p className="text-[10px] text-muted-foreground mt-1">{t.slot} · {t.area}</p>
            </button>
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No {type} tasks</p>}
        </div>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {selectedTask && (
          <>
            {/* Map */}
            <Card className="p-0 overflow-hidden shadow-soft">
              <div className="relative">
                <LeafletMap
                  center={dest ? [dest.lat, dest.lng] : [12.9719, 77.6413]}
                  zoom={13}
                  height="h-56"
                  markers={[
                    ...(origin ? [{ lat: origin.lat, lng: origin.lng, label: "You", color: "#14b8a6", type: "exec" as const }] : []),
                    ...(dest ? [{ lat: dest.lat, lng: dest.lng, label: type === "pickup" ? "Pickup" : "Delivery", color: "#f43f5e", type: "pickup" as const }] : []),
                  ]}
                  route={route ? { coordinates: route.coordinates, color: "#14b8a6", dashArray: "8 6" } : undefined}
                />
                {dest && (
                  <Button
                    size="sm"
                    className="absolute bottom-3 right-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg z-[1000]"
                    onClick={() => {
                      const org = origin ? `&origin=${origin.lat},${origin.lng}` : "";
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${org}&travelmode=driving`, "_blank");
                    }}
                  >
                    <Navigation className="h-4 w-4 mr-1.5" />
                    Start
                  </Button>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="h-4 w-4 text-primary" />
                  {route ? (
                    <>
                      <span className="font-medium">{(route.distance / 1000).toFixed(1)} km</span>
                      <span className="text-muted-foreground">· ~{Math.round(route.duration / 60)} mins</span>
                    </>
                  ) : (
                    <span className="font-medium">{selectedTask.distanceKm} km away</span>
                  )}
                </div>
                {dest && (
                  <Button
                    size="sm" className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      const org = origin ? `&origin=${origin.lat},${origin.lng}` : "";
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${org}&travelmode=driving`, "_blank");
                    }}
                  >
                    <Navigation className="h-3.5 w-3.5 mr-1.5" />
                    Navigate
                  </Button>
                )}
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
                <Button variant="outline" className="h-10" onClick={() => window.open(`tel:${selectedTask.customerPhone}`, "_blank")}>
                  <Phone className="h-4 w-4 mr-1.5" />
                  Call
                </Button>
                <Button variant="outline" className="h-10 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                  const lat = type === "pickup" ? selectedTask.pickupLat : selectedTask.deliveryLat;
                  const lng = type === "pickup" ? selectedTask.pickupLng : selectedTask.deliveryLng;
                  const org = origin ? `&origin=${origin.lat},${origin.lng}` : "";
                  if (lat != null && lng != null) {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${org}&travelmode=driving`, "_blank");
                  } else {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedTask.address || selectedTask.area)}${org}&travelmode=driving`, "_blank");
                  }
                }}>
                  <Navigation className="h-4 w-4 mr-1.5" />
                  Navigate
                </Button>
                <Button variant="outline" className="h-10">
                  <Store className="h-4 w-4 mr-1.5" />
                  Vendor
                </Button>
              </div>
            </Card>

            {/* Status updates */}
            <Card className="p-5 shadow-soft">
              <h3 className="font-semibold mb-3">Status Updates</h3>
              <div className="space-y-2 mb-4">
                {steps.map((s) => (
                  <button
                    key={s.id}
                    disabled={s.done || !s.available}
                    onClick={() => selectedTask && updateTaskStatus(selectedTask.id, s.id, s.label)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                      s.done ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : s.available ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer" : "border-border opacity-50"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      s.done ? "bg-emerald-500 text-white" : s.available ? "bg-primary-surface text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      "text-sm flex-1",
                      s.done ? "font-medium text-emerald-700 dark:text-emerald-400" : s.available ? "font-medium text-primary" : ""
                    )}>{s.label}</span>
                    {s.available && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
                    {s.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>

              {type === "delivery" && (
                <>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-semibold mb-3">Proof of Delivery</h4>

                  {/* Show existing photos */}
                  {selectedTask.photos && selectedTask.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedTask.photos.map((photo, idx) => (
                        <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                          <img src={photo} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Show existing signature */}
                  {selectedTask.signature && (
                    <div className="mb-3 rounded-lg border border-border p-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Customer Signature</p>
                      <img src={selectedTask.signature} alt="Signature" className="h-16 object-contain" />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={selectedTask.otpVerified ? "default" : "outline"}
                      className={cn("flex-col h-20", selectedTask.otpVerified ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-muted/30")}
                      onClick={() => setOtpDialogOpen(true)}
                    >
                      <KeySquare className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">{selectedTask.otpVerified ? "OTP Verified" : "Customer OTP"}</span>
                    </Button>
                    <Button
                      variant={selectedTask.signature ? "default" : "outline"}
                      className={cn("flex-col h-20", selectedTask.signature ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-muted/30")}
                      onClick={() => setSignatureDialogOpen(true)}
                    >
                      <Signature className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">{selectedTask.signature ? "Signed" : "Signature"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-20 hover:bg-muted/30"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">{selectedTask.photos?.length ? `${selectedTask.photos.length} photo${selectedTask.photos.length > 1 ? "s" : ""}` : "Photo"}</span>
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                    </Button>
                  </div>

                  <Button
                    className="w-full mt-3"
                    disabled={selectedTask.status === "delivered"}
                    onClick={() => selectedTask && updateTaskStatus(selectedTask.id, "delivered", "Delivered")}
                  >
                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                    {selectedTask.status === "delivered" ? "Delivered" : "Complete Delivery"}
                  </Button>
                </>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Dialogs */}
      {selectedTask && (
        <>
          <OtpDialog task={selectedTask} open={otpDialogOpen} onOpenChange={setOtpDialogOpen} />
          <SignatureDialog task={selectedTask} open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen} />
        </>
      )}
    </motion.div>
  );
}

// ── Earnings ──
function DeliveryEarnings() {
  const [data, setData] = useState<{
    todayEarnings: number;
    weekEarnings: number;
    totalTrips: number;
    avgPerTrip: number;
    weekChart: { day: string; earnings: number }[];
    recentPayouts: { id: string; amount: number; method: string; status: string; date: string; description: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{
      todayEarnings: number;
      weekEarnings: number;
      totalTrips: number;
      avgPerTrip: number;
      weekChart: { day: string; earnings: number }[];
      recentPayouts: { id: string; amount: number; method: string; status: string; date: string; description: string }[];
    }>("/api/delivery-executives/earnings")
      .then(setData)
      .catch((e) => toast.error("Failed to load earnings"))
      .finally(() => setLoading(false));
  }, []);

  const hasData = data && data.totalTrips > 0;
  const chartData = data?.weekChart || [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Earnings" value={data ? `₹${data.todayEarnings}` : "₹0"} icon={IndianRupee} accent="from-teal-500 to-cyan-600" />
        <StatCard label="This Week" value={data ? `₹${data.weekEarnings}` : "₹0"} icon={Calendar} accent="from-emerald-500 to-green-600" />
        <StatCard label="Total Trips" value={data ? String(data.totalTrips) : "0"} icon={Bike} accent="from-violet-500 to-purple-600" />
        <StatCard label="Avg Per Trip" value={data ? `₹${data.avgPerTrip}` : "₹0"} icon={TrendingUp} accent="from-amber-500 to-orange-600" />
      </div>

      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Weekly Earnings</h3>
            <p className="text-xs text-muted-foreground">
              {hasData ? `₹${data!.weekEarnings} this week` : "No earnings data yet"}
            </p>
          </div>
        </div>
        {hasData && chartData.length > 0 ? (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number) => [`₹${value}`, "Earnings"]}
                />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
            {loading ? "Loading..." : "Start completing deliveries to see your earnings"}
          </div>
        )}
      </Card>

      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Recent Payouts</h3>
        {hasData && data!.recentPayouts.length > 0 ? (
          <div className="space-y-2">
            {data!.recentPayouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">{p.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(p.date).toLocaleDateString("en-IN")} · {p.method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">₹{p.amount}</p>
                  <Badge variant={p.status === "completed" ? "secondary" : "outline"} className="text-[9px] py-0 h-4 capitalize">
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {loading ? "Loading..." : "No payouts yet"}
          </p>
        )}
      </Card>
    </motion.div>
  );
}
