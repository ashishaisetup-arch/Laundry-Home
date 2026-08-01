import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBookingSelection } from "../use-booking";

export function StepAddons() {
  const {
    addonCategories,
    addonQtys,
    setAddonQtys,
    selectedAddonCat,
    setSelectedAddonCat,
    totalAddonItems,
  } = useBookingSelection();

  const activeAddonCats = addonCategories.filter((cat) =>
    (cat.services || []).some((s) => s.isActive !== false)
  );

  if (!activeAddonCats.length) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Optional Add-ons</h2>
          <p className="text-xs text-muted-foreground mt-0.5">No add-on services available</p>
        </div>
      </div>
    );
  }

  const currentCat = activeAddonCats.find((c) => c.id === selectedAddonCat) || activeAddonCats[0];
  const catServices = (currentCat?.services || []).filter((s) => s.isActive !== false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Optional Add-ons</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Enhance your order with extra services</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {activeAddonCats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedAddonCat(cat.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium transition-all active:scale-[0.95]",
              (selectedAddonCat === cat.id || (!selectedAddonCat && activeAddonCats[0].id === cat.id))
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {catServices.map((svc) => {
          const qty = addonQtys[svc.id] || 0;
          const minPrice = svc.items?.length ? Math.min(...svc.items.map((i) => i.defaultPrice)) : 0;
          return (
            <div key={svc.id} className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-all",
              qty > 0 ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent" : "border-border/60"
            )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{svc.name}</p>
                <p className="text-[10px] text-muted-foreground">{svc.description || svc.unit === "flat" ? "Flat fee" : `From ₹${minPrice}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAddonQtys((prev) => ({ ...prev, [svc.id]: Math.max(0, qty - 1) }))}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-semibold hover:bg-muted/80 active:scale-[0.9] transition-all">−</button>
                <motion.span key={qty} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</motion.span>
                <button type="button" onClick={() => setAddonQtys((prev) => ({ ...prev, [svc.id]: qty + 1 }))}
                  className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold hover:bg-primary/90 active:scale-[0.9] transition-all">+</button>
              </div>
            </div>
          );
        })}
      </div>

      {totalAddonItems > 0 && (
        <p className="text-xs text-muted-foreground text-center">{totalAddonItems} add-on{totalAddonItems === 1 ? "" : "s"} selected</p>
      )}
    </div>
  );
}
