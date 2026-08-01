import { motion } from "framer-motion";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ItemCatalog } from "../../item-catalog";
import { useBookingSelection, useBookingPricing } from "../use-booking";

export function StepItems() {
  const {
    bookingType,
    laundryBagQty,
    setLaundryBagQty,
    catalogItems,
    itemQtys,
    setItemQtys,
    selectedServiceObjs,
    totalItems,
    totalWeight,
    defaultPrices,
  } = useBookingSelection();
  const { totalPrice } = useBookingPricing();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Step 3 of 7</p>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Laundry Inventory</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Add the items you're handing over</p>
        {selectedServiceObjs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedServiceObjs.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>
            ))}
          </div>
        )}
      </div>

      {(bookingType === "laundry_bag" || bookingType === "mixed") && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">Laundry Bags</p>
          </div>
          <p className="text-xs text-muted-foreground">Number of laundry bags</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setLaundryBagQty(Math.max(0, laundryBagQty - 1))}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-[0.9] transition-all"><Minus className="h-3.5 w-3.5" /></button>
            <motion.span key={laundryBagQty} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="w-8 text-center text-lg font-semibold tabular-nums">{laundryBagQty}</motion.span>
            <button type="button" onClick={() => setLaundryBagQty(laundryBagQty + 1)}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-[0.9] transition-all"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </Card>
      )}

      {(bookingType === "count_items" || bookingType === "mixed") && (
        <ItemCatalog
          items={catalogItems}
          quantities={itemQtys}
          onChange={setItemQtys}
          defaultPrices={defaultPrices}
        />
      )}

      {totalItems > 0 && (
        <div className="border-t pt-4 mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{totalItems} Item{totalItems !== 1 ? "s" : ""}</span>
            <p className="text-sm font-semibold">Est. ₹{totalPrice}</p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Service: {selectedServiceObjs.map((s) => s.name).join(", ")}</span>
            <span>Est. Weight: {totalWeight.toFixed(1)} kg</span>
          </div>
        </div>
      )}
    </div>
  );
}
