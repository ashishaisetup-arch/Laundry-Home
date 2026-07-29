import { cn } from "@/lib/utils";
import { Shirt, ShoppingBag, Layers } from "lucide-react";

type BookingType = "count_items" | "laundry_bag" | "mixed";

interface BookingTypeSelectorProps {
  value: BookingType;
  onChange: (type: BookingType) => void;
}

const OPTIONS: { type: BookingType; label: string; description: string; icon: typeof Shirt; ideal: string; recommended?: boolean }[] = [
  {
    type: "count_items",
    label: "Count Individual Items",
    description: "Select each item type and quantity",
    icon: Shirt,
    ideal: "Dry Cleaning, Shoes, Premium Wear",
  },
  {
    type: "laundry_bag",
    label: "Laundry Bag",
    description: "Fill a bag and we'll charge per bag",
    icon: ShoppingBag,
    ideal: "Daily Clothes",
  },
  {
    type: "mixed",
    label: "Mixed Order",
    description: "Bag for daily clothes + individual items",
    icon: Layers,
    ideal: "Most customers",
    recommended: true,
  },
];

export function BookingTypeSelector({ value, onChange }: BookingTypeSelectorProps) {
  return (
    <div className="grid gap-1.5">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => onChange(opt.type)}
            className={cn(
              "w-full text-left rounded-lg border p-2.5 transition-all flex items-start gap-2.5",
              selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/60 hover:border-muted-foreground/30 hover:bg-muted/30"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg shrink-0",
              selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold">{opt.label}</p>
                {opt.recommended && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium leading-none">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{opt.description}</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                Ideal for: {opt.ideal}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
