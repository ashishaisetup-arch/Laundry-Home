import { Navigation, Package, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DeliveryTask } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskRow({ task, execLat, execLng }: { task: DeliveryTask; execLat?: number | null; execLng?: number | null }) {
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
