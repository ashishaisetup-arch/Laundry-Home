import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Package, Layers, Tags, GripVertical, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { useServiceCatalog } from "@/lib/hooks";
import { cn, formatINR } from "@/lib/utils";
import { toast } from "sonner";

export function ServiceCatalogManager() {
  const { data: catalog, refetch } = useServiceCatalog({ includeInactive: true });
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expandedSvc, setExpandedSvc] = useState<string | null>(null);

  // Create/edit dialogs
  const [catDialog, setCatDialog] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [svcDialog, setSvcDialog] = useState<{ open: boolean; categoryId?: string; edit?: any }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; serviceId?: string; edit?: any }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const cats = catalog || [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/${deleteTarget.type}/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refetch();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  const toggleCategoryActive = async (cat: any) => {
    try {
      await api.put(`/api/service-categories/${cat.id}`, { ...cat, is_active: !cat.isActive });
      refetch();
    } catch (e: any) {
      toast.error("Failed to toggle category", { description: e.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Service Catalog</h2>
          <p className="text-sm text-muted-foreground">Manage categories, services, and service items</p>
        </div>
        <Button onClick={() => setCatDialog({ open: true })}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Category
        </Button>
      </div>

      {/* Category list */}
      <div className="space-y-3">
        {cats.map((cat) => {
          const catOpen = expandedCat === cat.id;
          return (
            <Card key={cat.id} className="shadow-soft overflow-hidden">
              {/* Category header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCat(catOpen ? null : cat.id)}
              >
                <button className="text-muted-foreground">
                  {catOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Layers className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.description || ""}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{cat.services?.length || 0} services</Badge>
                {!cat.isActive && (
                  <Badge variant="destructive" className="text-[9px]">Inactive</Badge>
                )}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={cat.isActive}
                    onCheckedChange={() => toggleCategoryActive(cat)}
                    className="scale-75"
                  />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCatDialog({ open: true, edit: cat })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => setDeleteTarget({ type: "service-categories", id: cat.id, name: cat.name })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Services within category */}
              {catOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</p>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSvcDialog({ open: true, categoryId: cat.id })}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Service
                      </Button>
                    </div>

                    {(cat.services || []).length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">No services in this category</p>
                    )}

                    {(cat.services || []).map((svc) => {
                      const svcOpen = expandedSvc === svc.id;
                      return (
                        <div key={svc.id} className="rounded-lg border">
                          {/* Service header */}
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedSvc(svcOpen ? null : svc.id)}
                          >
                            <button className="text-muted-foreground">
                              {svcOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                            <Package className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{svc.name}</p>
                              <p className="text-[11px] text-muted-foreground">{svc.description || ""}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{svc.unit}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{svc.items?.length || 0} items</Badge>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSvcDialog({ open: true, categoryId: svc.categoryId, edit: svc })}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-rose-600" onClick={() => setDeleteTarget({ type: "services", id: svc.id, name: svc.name })}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Items within service */}
                          {svcOpen && (
                            <div className="border-t p-3 space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
                                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setItemDialog({ open: true, serviceId: svc.id })}>
                                  <Plus className="h-3 w-3 mr-0.5" />
                                  Add Item
                                </Button>
                              </div>

                              {(svc.items || []).length === 0 && (
                                <p className="text-[11px] text-muted-foreground py-1 text-center">No items — defaults to base service price</p>
                              )}

                              {(svc.items || []).map((item) => (
                                <div key={item.id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                                  <Tags className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="flex-1 font-medium">{item.itemName}</span>
                                  <Badge variant="outline" className="text-[9px]">{item.itemCategory || "—"}</Badge>
                                  <span className="font-semibold tabular-nums">{formatINR(item.defaultPrice)}</span>
                                  {item.estimatedTime && (
                                    <span className="text-muted-foreground">~{item.estimatedTime}min</span>
                                  )}
                                  <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setItemDialog({ open: true, serviceId: item.serviceId, edit: item })}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-rose-600" onClick={() => setDeleteTarget({ type: "service-items", id: item.id, name: item.itemName })}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Category dialog */}
      <CatalogEntryDialog
        open={catDialog.open}
        edit={catDialog.edit}
        onClose={() => setCatDialog({ open: false })}
        onSave={refetch}
      />

      {/* Service dialog */}
      <ServiceEntryDialog
        open={svcDialog.open}
        categoryId={svcDialog.categoryId}
        edit={svcDialog.edit}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setSvcDialog({ open: false })}
        onSave={refetch}
      />

      {/* Item dialog */}
      <ServiceItemDialog
        open={itemDialog.open}
        serviceId={itemDialog.serviceId}
        edit={itemDialog.edit}
        onClose={() => setItemDialog({ open: false })}
        onSave={refetch}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type === "service-categories" ? "Category" : deleteTarget?.type === "services" ? "Service" : "Item"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Category Create/Edit Dialog
// ============================================================================
function CatalogEntryDialog({ open, edit, onClose, onSave }: { open: boolean; edit?: any; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(edit?.name || "");
  const [slug, setSlug] = useState(edit?.slug || "");
  const [description, setDescription] = useState(edit?.description || "");
  const [icon, setIcon] = useState(edit?.icon || "Layers");
  const [displayOrder, setDisplayOrder] = useState(String(edit?.displayOrder ?? 0));
  const [grouping, setGrouping] = useState(edit?.grouping || "main");
  const [isActive, setIsActive] = useState(edit?.isActive !== false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, "_"), description: description.trim(), icon, display_order: parseInt(displayOrder) || 0, grouping, is_active: isActive };
      if (edit) {
        await api.put(`/api/service-categories/${edit.id}`, body);
        toast.success("Category updated");
      } else {
        await api.post("/api/service-categories", body);
        toast.success("Category created");
      }
      onSave();
      onClose();
    } catch (e: any) {
      toast.error("Failed to save category", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. Wash & Laundry" />
          </div>
          <div>
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1" placeholder="auto-generated if empty" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Icon</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Display Order</Label>
              <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Grouping</Label>
            <div className="flex gap-3 mt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" name="grouping" value="main" checked={grouping === "main"} onChange={() => setGrouping("main")} className="accent-primary" />
                Main (shown on "What do you need?")
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" name="grouping" value="addon" checked={grouping === "addon"} onChange={() => setGrouping("addon")} className="accent-primary" />
                Add-on (shown as optional extras)
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : edit ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Service Create/Edit Dialog
// ============================================================================
function ServiceEntryDialog({ open, categoryId, edit, categories, onClose, onSave }: { open: boolean; categoryId?: string; edit?: any; categories: { id: string; name: string }[]; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(edit?.name || "");
  const [description, setDescription] = useState(edit?.description || "");
  const [unit, setUnit] = useState(edit?.unit || "item");
  const [imageUrl, setImageUrl] = useState(edit?.imageUrl || "");
  const [taxable, setTaxable] = useState(edit?.taxable !== false);
  const [displayOrder, setDisplayOrder] = useState(String(edit?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(edit?.isActive !== false);
  const [selectedCat, setSelectedCat] = useState(edit?.categoryId || categoryId || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!selectedCat) { toast.error("Category is required"); return; }
    setSaving(true);
    try {
      const body = { categoryId: selectedCat, name: name.trim(), description: description.trim(), unit, imageUrl, taxable, displayOrder: parseInt(displayOrder) || 0, isActive };
      if (edit) {
        await api.put(`/api/services/${edit.id}`, body);
        toast.success("Service updated");
      } else {
        await api.post("/api/services", body);
        toast.success("Service created");
      }
      onSave();
      onClose();
    } catch (e: any) {
      toast.error("Failed to save service", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. Wash & Fold" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Unit</Label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="item">Per item</option>
                <option value="kg">Per kg</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Display Order</Label>
              <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Image URL</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Taxable</Label>
            <Switch checked={taxable} onCheckedChange={setTaxable} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : edit ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Item Create/Edit Dialog
// ============================================================================
function ServiceItemDialog({ open, serviceId, edit, onClose, onSave }: { open: boolean; serviceId?: string; edit?: any; onClose: () => void; onSave: () => void }) {
  const [itemName, setItemName] = useState(edit?.itemName || "");
  const [customerCategory, setCustomerCategory] = useState(edit?.itemCategory && ["Men","Women","Kids","Home Care","Accessories"].includes(edit.itemCategory) ? edit.itemCategory : "Men");
  const [unit, setUnit] = useState(edit?.unit || "item");
  const [defaultPrice, setDefaultPrice] = useState(String(edit?.defaultPrice ?? ""));
  const [estimatedTime, setEstimatedTime] = useState(String(edit?.estimatedTime ?? ""));
  const [estimatedWeight, setEstimatedWeight] = useState(edit?.estimatedWeightKg ? String(edit.estimatedWeightKg) : "");
  const [isActive, setIsActive] = useState(edit?.isActive !== false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!itemName.trim()) { toast.error("Item name is required"); return; }
    if (!serviceId && !edit?.serviceId) { toast.error("No service selected"); return; }
    setSaving(true);
    try {
      const body = {
        serviceId: serviceId || edit?.serviceId,
        itemName: itemName.trim(),
        itemCategory: customerCategory,
        unit,
        defaultPrice: parseFloat(defaultPrice) || 0,
        estimatedTime: parseInt(estimatedTime) || null,
        estimatedWeightKg: parseFloat(estimatedWeight) || null,
        isActive,
      };
      if (edit) {
        await api.put(`/api/service-items/${edit.id}`, body);
        toast.success("Item updated");
      } else {
        await api.post("/api/service-items", body);
        toast.success("Item created");
      }
      onSave();
      onClose();
    } catch (e: any) {
      toast.error("Failed to save item", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Item Name</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} className="mt-1" placeholder="e.g. Cotton Shirt" />
          </div>
          <div>
            <Label className="text-xs">Customer Category</Label>
            <select
              value={customerCategory}
              onChange={(e) => setCustomerCategory(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Kids">Kids</option>
              <option value="Home Care">Home Care</option>
              <option value="Accessories">Accessories</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Unit</Label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="item">Per piece</option>
                <option value="kg">Per kg</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Default Price (₹)</Label>
              <Input type="number" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} className="mt-1" placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Weight (kg)</Label>
              <Input type="number" step="0.01" value={estimatedWeight} onChange={(e) => setEstimatedWeight(e.target.value)} className="mt-1" placeholder="e.g. 0.20" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Estimated Time (min)</Label>
            <Input type="number" value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} className="mt-1" placeholder="Optional" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : edit ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
