import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceIcon } from "@/components/shared/service-icon";
import { Separator } from "@/components/ui/separator";
import { BookingTypeSelector } from "../../booking-type-selector";
import { useBookingSelection } from "../use-booking";

export function StepServices() {
  const {
    servicesData,
    selectedCategoryIds,
    selectedCategoryObjs,
    selectedServiceIds,
    setSelectedServiceIds,
    setItemQtys,
    bookingType,
    setBookingType,
  } = useBookingSelection();

  const servicesForCategories = servicesData.filter(
    (s) => s.isActive !== false && selectedCategoryIds.includes(s.categoryId || "")
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Choose services</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Select the services you need within the chosen categories</p>
      </div>
      {selectedCategoryObjs.map((cat) => {
        const catServices = servicesForCategories.filter((s) => s.categoryId === cat.id);
        if (!catServices.length) return null;
        return (
          <div key={cat.id}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ServiceIcon serviceKey={cat.slug} iconName={cat.icon} className="h-3.5 w-3.5" />
              {cat.name}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {catServices.map((svc) => {
                const selected = selectedServiceIds.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      setSelectedServiceIds((prev) =>
                        selected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                      );
                      setItemQtys({});
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all flex items-center gap-3 active:scale-[0.98]",
                      selected ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm ring-1 ring-primary/20" : "border-border/60 hover:border-muted-foreground/30 hover:shadow-sm"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{svc.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{svc.description || svc.unit}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {selectedServiceIds.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {selectedServiceIds.length} service{selectedServiceIds.length === 1 ? "" : "s"} selected
        </p>
      )}

      <Separator className="my-3" />
      <BookingTypeSelector value={bookingType} onChange={setBookingType} />
    </div>
  );
}
