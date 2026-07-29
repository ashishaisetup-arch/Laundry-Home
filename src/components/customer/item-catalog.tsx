import { useState, useMemo } from "react";
import { Minus, Plus, Info, Search, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ServiceItem } from "@/lib/types";

interface ItemQuantity {
  itemId: string;
  qty: number;
  instructions: string[];
}

interface ItemCatalogProps {
  items: ServiceItem[];
  quantities: Record<string, ItemQuantity>;
  onChange: (quantities: Record<string, ItemQuantity>) => void;
  defaultPrices?: Record<string, number>;
}

const INSTRUCTIONS = ["Heavy Stains", "Delicate", "Separate Wash", "Do Not Bleach", "Hand Wash", "Cold Wash"];



export function ItemCatalog({ items, quantities, onChange, defaultPrices }: ItemCatalogProps) {
  const [instructionOpen, setInstructionOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");

  const updateQty = (itemId: string, delta: number) => {
    const current = quantities[itemId]?.qty || 0;
    const newQty = Math.max(0, current + delta);
    if (newQty === 0) {
      const { [itemId]: _, ...rest } = quantities;
      onChange(rest);
    } else {
      onChange({
        ...quantities,
        [itemId]: { itemId, qty: newQty, instructions: quantities[itemId]?.instructions || [] },
      });
    }
  };

  const toggleInstruction = (itemId: string, instruction: string) => {
    const current = quantities[itemId];
    if (!current) return;
    const has = current.instructions.includes(instruction);
    onChange({
      ...quantities,
      [itemId]: {
        ...current,
        instructions: has
          ? current.instructions.filter((i) => i !== instruction)
          : [...current.instructions, instruction],
      },
    });
  };

  const addCustomItem = () => {
    if (!customName.trim()) { toast.error("Please enter an item name"); return; }
    const customId = `custom_${Date.now()}`;
    onChange({
      ...quantities,
      [customId]: { itemId: customId, qty: 1, instructions: [customName.trim()] },
    });
    setCustomName("");
    setCustomOpen(false);
    toast.success(`Added "${customName.trim()}"`);
  };

  const searchLower = search.toLowerCase();

  const visibleItems = useMemo(() =>
    items.filter((item) => item.itemCategory !== "General"),
    [items]
  );

  const filtered = useMemo(() => {
    if (!searchLower) return visibleItems;
    return visibleItems.filter((item) => item.itemName.toLowerCase().includes(searchLower));
  }, [visibleItems, searchLower]);

  const grouped = useMemo(() => {
    const map: Record<string, ServiceItem[]> = {};
    for (const item of filtered) {
      const cat = item.itemCategory || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return map;
  }, [filtered]);

  const categoryOrder = useMemo(() => {
    const order: Record<string, number> = {};
    visibleItems.forEach((item, i) => {
      const cat = item.itemCategory || "Other";
      if (order[cat] === undefined) order[cat] = i;
    });
    return order;
  }, [visibleItems]);

  const sortedEntries = useMemo(() =>
    Object.entries(grouped).sort(
      ([a], [b]) => (categoryOrder[a] ?? Infinity) - (categoryOrder[b] ?? Infinity)
    ),
    [grouped, categoryOrder]
  );

  const totalQty = Object.values(quantities).reduce((sum, q) => sum + q.qty, 0);

  function renderItemRow(item: ServiceItem) {
    const key = item.itemMasterId || item.id;
    const qty = quantities[key]?.qty || 0;
    return (
      <div key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors relative">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.itemName}</p>
          {defaultPrices?.[key] && (
            <p className="text-[10px] text-muted-foreground">₹{defaultPrices[key]}/pc</p>
          )}
        </div>
        <div className="flex items-center gap-1 w-28 justify-end shrink-0">
          <button
            type="button"
            onClick={() => setInstructionOpen(instructionOpen === key ? null : key)}
            className="p-1 hover:bg-muted rounded-full"
          >
            <Info className={cn("h-3.5 w-3.5", instructionOpen === key ? "text-primary" : "text-muted-foreground")} />
          </button>
          <button
            type="button"
            onClick={() => updateQty(key, -1)}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
              qty > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
            )}
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => updateQty(key, 1)}
            className="w-7 h-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {instructionOpen === key && (
          <div className="absolute left-0 right-0 top-full mt-0.5 z-10 bg-popover border border-border rounded-lg p-2 shadow-lg">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Instructions</p>
            <div className="flex flex-wrap gap-1">
              {INSTRUCTIONS.map((inst) => {
                const selected = (quantities[key]?.instructions || []).includes(inst);
                return (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => toggleInstruction(key, inst)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    )}
                  >
                    {inst}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!visibleItems.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No items available for selected services.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {searchLower ? (
        <div className="divide-y divide-border/30 rounded-lg border border-border/60">
          {filtered.map(renderItemRow)}
          {!filtered.length && (
            <p className="text-sm text-muted-foreground text-center py-4">No matching items</p>
          )}
        </div>
      ) : sortedEntries.length > 0 ? (
        <Tabs defaultValue={sortedEntries[0][0]}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {sortedEntries.map(([category]) => (
              <TabsTrigger key={category} value={category} className="text-xs">
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
          {sortedEntries.map(([category, categoryItems]) => (
            <TabsContent key={category} value={category}>
              <div className="divide-y divide-border/30 rounded-lg border border-border/60">
                {categoryItems.map(renderItemRow)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No items available</p>
      )}

      <button
        type="button"
        onClick={() => setCustomOpen(true)}
        className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Can't find your item? Add it manually
      </button>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Custom Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Item Name</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} className="mt-1" placeholder="e.g. Leather Jacket" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCustomOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={addCustomItem} disabled={!customName.trim()}>Add Item</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
