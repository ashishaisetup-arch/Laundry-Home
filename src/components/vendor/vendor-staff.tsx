import { useEffect } from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle2, Clock, XCircle, Package, Star, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/shared/stat-card";
import { useStaff } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useMyVendorId } from "./vendor-helpers";

export function VendorStaff() {
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
