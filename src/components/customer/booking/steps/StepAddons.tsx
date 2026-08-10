import { cn } from "@/lib/utils";
import { useBookingSelection } from "../use-booking";
import {
  SCHEDULE_ADD_ON_SLUGS,
  expressAvailable,
  selectDeliverySpeed,
} from "../schedule-windows";

export function StepAddons() {
  const {
    addonCategories,
    addonEnabled,
    setAddonEnabled,
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

  const priceLabel = (svc: any): string => {
    if (svc.pricingType === "BAG") return `₹${svc.bagPrice || 0}/bag`;
    if (svc.pricingType === "FIXED" || svc.unit === "flat") {
      const flat = svc.items?.length ? Math.min(...svc.items.map((i: any) => i.defaultPrice)) : svc.bagPrice || 0;
      return `₹${flat} flat`;
    }
    const minPrice = svc.items?.length ? Math.min(...svc.items.map((i: any) => i.defaultPrice)) : 0;
    return minPrice > 0 ? `From ₹${minPrice}` : "";
  };

  // Delivery-speed add-ons (Same Day / 24 Hour) are one-hot (mutually exclusive)
  const speedSvcs = catServices.filter(
    (s) => s.slug === SCHEDULE_ADD_ON_SLUGS.SAME_DAY || s.slug === SCHEDULE_ADD_ON_SLUGS.TWENTY_FOUR_HOUR
  );
  const speedChoices = speedSvcs.map((s) => ({ id: s.id, slug: s.slug || "" }));
  const activeSpeedId = speedSvcs.find((s) => addonEnabled[s.id])?.id || "standard";

  // Express Pickup is an independent fulfillment-mode add-on
  const expressSvc = catServices.find((s) => s.slug === SCHEDULE_ADD_ON_SLUGS.EXPRESS_PICKUP);
  const expressOn = expressSvc ? !!addonEnabled[expressSvc.id] : false;
  const expressOff = expressSvc ? !expressAvailable(new Date()) : false;

  const otherSvcs = catServices.filter(
    (s) => s.slug !== SCHEDULE_ADD_ON_SLUGS.SAME_DAY &&
      s.slug !== SCHEDULE_ADD_ON_SLUGS.TWENTY_FOUR_HOUR &&
      s.slug !== SCHEDULE_ADD_ON_SLUGS.EXPRESS_PICKUP
  );

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
        {speedSvcs.length > 0 && (
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Delivery Speed</p>
            <button
              type="button"
              onClick={() => setAddonEnabled((prev) => selectDeliverySpeed(prev, null, speedChoices))}
              className={cn(
                "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                activeSpeedId === "standard"
                  ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent text-primary"
                  : "border-border/60 hover:bg-muted/30"
              )}
            >
              <span>Standard</span>
              <span className="text-[10px] text-muted-foreground">Delivered within 48 hrs</span>
            </button>
            {speedSvcs.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => setAddonEnabled((prev) => selectDeliverySpeed(prev, { id: svc.id, slug: svc.slug || "" }, speedChoices))}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  addonEnabled[svc.id]
                    ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent text-primary"
                    : "border-border/60 hover:bg-muted/30"
                )}
              >
                <span>{svc.name}</span>
                <span className="text-[11px] font-medium text-primary">{priceLabel(svc)}</span>
              </button>
            ))}
            <p className="text-[10px] text-muted-foreground">Same Day and 24 Hour Delivery are mutually exclusive.</p>
          </div>
        )}

        {expressSvc && (
          <div className={cn(
            "flex items-center gap-3 rounded-lg border p-3 transition-all",
            expressOn ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent" : "border-border/60"
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{expressSvc.name}</p>
              {expressSvc.description && (
                <p className="text-[10px] text-muted-foreground">{expressSvc.description}</p>
              )}
              <p className="text-[11px] font-medium text-primary mt-0.5">{priceLabel(expressSvc)}</p>
              {expressOff && (
                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Unavailable after 6:30 PM</p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={expressOn}
              disabled={expressOff}
              onClick={() => setAddonEnabled((prev) => ({ ...prev, [expressSvc.id]: !expressOn }))}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors shrink-0",
                expressOn ? "bg-primary" : "bg-muted-foreground/30",
                expressOff && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                expressOn ? "left-[calc(100%-1.375rem)]" : "left-0.5"
              )} />
            </button>
          </div>
        )}

        {otherSvcs.map((svc) => {
          const on = !!addonEnabled[svc.id];
          return (
            <div key={svc.id} className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-all",
              on ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent" : "border-border/60"
            )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{svc.name}</p>
                {svc.description && (
                  <p className="text-[10px] text-muted-foreground">{svc.description}</p>
                )}
                <p className="text-[11px] font-medium text-primary mt-0.5">{priceLabel(svc)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setAddonEnabled((prev) => ({ ...prev, [svc.id]: !on }))}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors shrink-0",
                  on ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  on ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                )} />
              </button>
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
