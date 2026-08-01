import { Sparkles, Star, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookingSelection } from "../use-booking";

export function StepVendor() {
  const {
    vendorMode,
    setVendorMode,
    selectedVendor,
    setSelectedVendor,
    vendorsList,
  } = useBookingSelection();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Assign vendor</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how to assign your laundry vendor.</p>
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { setVendorMode("auto"); setSelectedVendor(""); }}
          className={cn(
            "w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3 active:scale-[0.98]",
            vendorMode === "auto"
              ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm ring-1 ring-primary/20"
              : "border-border/60 hover:border-muted-foreground/30 hover:shadow-sm"
          )}
        >
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            vendorMode === "auto" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">AI Auto-Assign (Recommended)</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Our AI picks the best vendor based on distance, ratings, and availability.</p>
            {vendorMode === "auto" && vendorsList?.[0] && (
              <p className="text-[11px] text-primary mt-1 font-medium">
                → {vendorsList[0].name} · {vendorsList[0].rating} ⭐ · {vendorsList[0].distanceKm} km
              </p>
            )}
          </div>
          <input type="radio" checked={vendorMode === "auto"} readOnly className="accent-primary mt-1" />
        </button>

        <button
          type="button"
          onClick={() => setVendorMode("manual")}
          className={cn(
            "w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3 active:scale-[0.98]",
            vendorMode === "manual"
              ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm ring-1 ring-primary/20"
              : "border-border/60 hover:border-muted-foreground/30 hover:shadow-sm"
          )}
        >
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            vendorMode === "manual" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Store className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Choose manually</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pick from available vendors near you.</p>
          </div>
          <input type="radio" checked={vendorMode === "manual"} readOnly className="accent-primary mt-1" />
        </button>

        {vendorMode === "manual" && (
          <div className="grid md:grid-cols-2 gap-2 pl-2">
            {vendorsList?.map((v) => (
              <label
                key={v.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all active:scale-[0.98]",
                selectedVendor === v.id ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm" : "border-border/60 hover:bg-muted/30"
              )}
              >
                <input type="radio" name="vendor" checked={selectedVendor === v.id} onChange={() => setSelectedVendor(v.id)} className="accent-primary" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold shrink-0",
                    v.logoColor || "bg-primary"
                  )}>
                    {v.logoInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {v.rating} · {v.distanceKm}km
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
