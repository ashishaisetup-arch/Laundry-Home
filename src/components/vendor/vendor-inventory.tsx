import { useEffect } from "react";
import { Camera, AlertCircle, Shirt, Package, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVendorInventory } from "@/lib/hooks/useVendorAnalytics";
import { cn } from "@/lib/utils";
import { useMyVendorId } from "./vendor-helpers";

export function VendorInventory() {
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
