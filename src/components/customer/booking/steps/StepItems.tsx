import { motion } from "framer-motion";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ItemCatalog } from "../../item-catalog";
import { useBookingSelection, useBookingPricing } from "../use-booking";

export function StepItems() {
  const {
    bookingType,
    bagServices,
    bagQty,
    catalogItems,
    itemQtys,
    setItemQtys,
    selectedServiceObjs,
    totalItems,
    totalWeight,
    defaultPrices,
  } = useBookingSelection();
  const { totalPrice } = useBookingPricing();

  const bagServiceIds = new Set(bagServices.map((s) => s.id));
  const itemCatalogItems = catalogItems.filter((i) => !bagServiceIds.has(i.serviceId));

  const updateBagQty = (serviceId: string, itemId: string, delta: number) => {
    const key = `${serviceId}:${itemId}`;
    const current = itemQtys[key]?.qty || 0;
    const newQty = Math.max(0, current + delta);
    setItemQtys((prev) => {
      if (newQty === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { serviceId, itemId, qty: newQty, instructions: prev[key]?.instructions || [] } };
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Step 3 of 7</p>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Laundry Inventory</h2>
        <p className="text-xs text-muted-foreground mt-0.2">Add the items you're handing over</p>
        {selectedServiceObjs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedServiceObjs.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>
            ))}
          </div>
        )}
      </div>

      {bagServices.length > 0 && (
        <div className="space-y-2">
          {bagServices.map((svc) => {
            const bagItemId = svc.items?.[0]?.itemMasterId || svc.id;
            const key = `${svc.id}:${bagItemId}`;
            const qty = itemQtys[key]?.qty || 0;
            return (
              <Card key={svc.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">{svc.name}</p>
                  {svc.bagPrice ? (
                    <span className="text-xs text-muted-foreground">₹{svc.bagPrice}/bag</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Number of {svc.name.toLowerCase()}s</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => updateBagQty(svc.id, bagItemId, -1)}
                    className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-[0.9] transition-all"><Minus className="h-3.5 w-3.5" /></button>
                  <motion.span key={qty} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="w-8 text-center text-lg font-semibold tabular-nums">{qty}</motion.span>
                  <button type="button" onClick={() => updateBagQty(svc.id, bagItemId, 1)}
                    className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-[0.9] transition-all"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {(bookingType === "count_items" || bookingType === "mixed") && (
        <ItemCatalog
          items={itemCatalogItems}
          quantities={itemQtys}
          onChange={setItemQtys}
          defaultPrices={defaultPrices}
        />
      )}

      {(totalItems > 0 || bagQty > 0) && (
        <div className="border-t pt-4 mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{totalItems} Item{totalItems !== 1 ? "s" : ""}{bagQty > 0 ? ` + ${bagQty} Bag${bagQty !== 1 ? "s" : ""}` : ""}</span>
            <p className="text-sm font-semibold">Est. ₹{totalPrice + bagServices.reduce((sum, s) => sum + (s.bagPrice || 0) * (itemQtys[`${s.id}:${s.items?.[0]?.itemMasterId || s.id}`]?.qty || 0), 0)}</p>
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
