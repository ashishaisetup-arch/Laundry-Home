import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceIcon } from "@/components/shared/service-icon";
import { useBookingSelection } from "../use-booking";

export function StepCategory() {
  const {
    mainCategories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    setSelectedServiceIds,
    setItemQtys,
  } = useBookingSelection();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>What do you need today?</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Select one or more service categories</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mainCategories.map((cat) => {
          const selected = selectedCategoryIds.includes(cat.id);
          const svcCount = (cat.services || []).filter((s) => s.isActive !== false).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategoryIds((prev) =>
                  selected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                );
                setSelectedServiceIds([]);
                setItemQtys({});
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition-all flex flex-col gap-2 active:scale-[0.98]",
                selected ? "border-primary bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm ring-1 ring-primary/20" : "border-border/60 hover:border-muted-foreground/30 hover:shadow-sm"
              )}
            >
              <div className="flex items-center justify-between">
                <ServiceIcon serviceKey={cat.slug} iconName={cat.icon} className="h-8 w-8 shrink-0 text-primary" />
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}>
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">{cat.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{svcCount} services</p>
              </div>
            </button>
          );
        })}
      </div>
      {selectedCategoryIds.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"} selected
        </p>
      )}
    </div>
  );
}
