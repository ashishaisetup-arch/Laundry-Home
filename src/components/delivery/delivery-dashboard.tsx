import { useMemo } from "react";
import { motion } from "framer-motion";
import { Package, Bike, CheckCircle2, Navigation, IndianRupee } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useAppStore } from "@/lib/store";
import type { DeliveryTask } from "@/lib/types";
import { statusIndex } from "./delivery-data";
import { TaskRow } from "./task-row";

export function DeliveryDashboard({ tasks }: { tasks: DeliveryTask[] }) {
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
