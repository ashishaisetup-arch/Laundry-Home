import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, MapPin, Building2,
  Globe, Check, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { useCities, useAreas, useVendorAreas, useAreaWaitlist } from "@/lib/hooks/useAreas";
import { useVendors } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LocationsManager() {
  const [tab, setTab] = useState("cities");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Location Management</h2>
        <p className="text-sm text-muted-foreground">Manage cities, service areas, and vendor area assignments</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cities">Cities & Areas</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Coverage</TabsTrigger>
          <TabsTrigger value="waitlist">Area Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="cities">
          <CitiesAreasTab />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorCoverageTab />
        </TabsContent>
        <TabsContent value="waitlist">
          <WaitlistTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Cities & Areas Tab
// ============================================================================
function CitiesAreasTab() {
  const { data: cities, refetch: refetchCities } = useCities();
  const { data: allAreas, refetch: refetchAreas } = useAreas();
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [cityDialog, setCityDialog] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [areaDialog, setAreaDialog] = useState<{ open: boolean; cityId?: string; edit?: any }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const areasByCity: Record<string, any[]> = {};
  (allAreas || []).forEach((a: any) => {
    const cityId = a.city_id;
    if (!areasByCity[cityId]) areasByCity[cityId] = [];
    areasByCity[cityId].push(a);
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/areas/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} deactivated`);
      setDeleteTarget(null);
      refetchAreas();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  const filteredCities = (cities || []).filter((c) =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cities..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm"
          />
        </div>
        <Button onClick={() => setCityDialog({ open: true })}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add City
        </Button>
      </div>

      <div className="space-y-3">
        {filteredCities.map((city) => {
          const open = expandedCity === city.id;
          const cityAreas = areasByCity[city.id] || [];
          return (
            <Card key={city.id} className="shadow-soft overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCity(open ? null : city.id)}
              >
                <button className="text-muted-foreground">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Globe className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{city.name}</p>
                  <p className="text-xs text-muted-foreground">{city.state}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{cityAreas.length} areas</Badge>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCityDialog({ open: true, edit: city })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service Areas</p>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAreaDialog({ open: true, cityId: city.id })}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Area
                      </Button>
                    </div>

                    {cityAreas.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">No areas in this city</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cityAreas.map((area: any) => (
                        <div key={area.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm font-medium">{area.area_name}</span>
                          {area.zone && <Badge variant="outline" className="text-[9px]">{area.zone}</Badge>}
                          {area.pincode && <span className="text-[10px] text-muted-foreground">{area.pincode}</span>}
                          <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAreaDialog({ open: true, cityId: area.city_id, edit: area })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-rose-600" onClick={() => setDeleteTarget({ id: area.id, name: area.area_name })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </Card>
          );
        })}
      </div>

      <CityDialog open={cityDialog.open} edit={cityDialog.edit} onClose={() => setCityDialog({ open: false })} onSave={() => { refetchCities(); }} />
      <AreaDialog open={areaDialog.open} cityId={areaDialog.cityId} edit={areaDialog.edit} onClose={() => setAreaDialog({ open: false })} onSave={() => { refetchAreas(); }} />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Area</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Vendor Coverage Tab
// ============================================================================
function VendorCoverageTab() {
  const { data: vendors } = useVendors();
  const { data: allAreas } = useAreas();
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const { data: vendorAreas, refetch: refetchVendorAreas } = useVendorAreas(selectedVendor || undefined);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const allVendors = vendors || [];

  useEffect(() => {
    if (vendorAreas) {
      setSelectedAreaIds(vendorAreas.map((a: any) => a.id));
    } else {
      setSelectedAreaIds([]);
    }
  }, [vendorAreas]);

  const handleSave = async () => {
    if (!selectedVendor) return;
    setSaving(true);
    try {
      await api.post("/api/areas/vendor", { vendor_id: selectedVendor, area_ids: selectedAreaIds });
      toast.success("Vendor coverage updated");
      refetchVendorAreas();
    } catch (e: any) {
      toast.error("Failed to update coverage", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const vendor = allVendors.find((v: any) => v.id === selectedVendor);

  const areasByZone: Record<string, any[]> = {};
  (allAreas || []).forEach((a: any) => {
    const zone = a.zone || "Other";
    if (!areasByZone[zone]) areasByZone[zone] = [];
    areasByZone[zone].push(a);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Label className="text-xs">Select Vendor</Label>
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a vendor..." />
            </SelectTrigger>
            <SelectContent>
              {allVendors.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{v.business_name || v.name || v.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedVendor && (
          <div className="pt-5">
            <Badge variant="secondary" className="text-xs">
              {vendorAreas?.length || 0} / {allAreas?.length || 0} areas assigned
            </Badge>
          </div>
        )}
      </div>

      {selectedVendor && (
        <>
          <div className="space-y-3">
            {Object.entries(areasByZone).map(([zone, areas]) => {
              const checked = areas.filter((a) => selectedAreaIds.includes(a.id)).length;
              return (
                <Card key={zone} className="shadow-soft overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{zone}</p>
                      <Badge variant="secondary" className="text-[10px]">{checked}/{areas.length}</Badge>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {areas.map((area) => {
                      const isSelected = selectedAreaIds.includes(area.id);
                      return (
                        <button
                          key={area.id}
                          onClick={() => toggleArea(area.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                            isSelected
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-card hover:bg-muted/50 border-border"
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-3 w-3 shrink-0" />
                          ) : (
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-medium truncate">{area.area_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Coverage"}
            </Button>
          </div>
        </>
      )}

      {!selectedVendor && (
        <Card className="p-12 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Select a vendor to assign service area coverage</p>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Waitlist Tab
// ============================================================================
function WaitlistTab() {
  const { data: waitlist, loading, refetch } = useAreaWaitlist();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {waitlist?.length || 0} area requests waiting for coverage
        </p>
        <Button variant="outline" size="sm" onClick={refetch}>
          <Search className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>}

      {!loading && (!waitlist || waitlist.length === 0) && (
        <Card className="p-12 text-center">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No waitlist entries yet</p>
        </Card>
      )}

      {waitlist && waitlist.length > 0 && (
        <div className="space-y-2">
          {waitlist.map((entry: any) => (
            <Card key={entry.id} className="flex items-center gap-3 px-4 py-3 shadow-soft">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{entry.area_name}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {entry.pincode && <span>PIN: {entry.pincode}</span>}
                  <span>via: {entry.contact}</span>
                  {entry.created_at && (
                    <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{entry.contact_type}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// City Dialog
// ============================================================================
function CityDialog({ open, edit, onClose, onSave }: { open: boolean; edit?: any; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(edit?.name || "");
  const [state, setState] = useState(edit?.state || "Karnataka");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("City name is required"); return; }
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/api/areas/cities/${edit.id}`, { name: name.trim(), state: state.trim() });
        toast.success("City updated");
      } else {
        await api.post("/api/areas/cities", { name: name.trim(), state: state.trim() });
        toast.success("City added");
      }
      onSave();
      onClose();
    } catch (e: any) {
      toast.error("Failed to save city", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit City" : "Add City"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">City Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. Bengaluru" />
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Input value={state} onChange={(e) => setState(e.target.value)} className="mt-1" placeholder="Karnataka" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Area Dialog
// ============================================================================
function AreaDialog({ open, cityId, edit, onClose, onSave }: { open: boolean; cityId?: string; edit?: any; onClose: () => void; onSave: () => void }) {
  const [areaName, setAreaName] = useState(edit?.area_name || "");
  const [zone, setZone] = useState(edit?.zone || "");
  const [pincode, setPincode] = useState(edit?.pincode || "");
  const [lat, setLat] = useState(edit?.lat?.toString() || "");
  const [lng, setLng] = useState(edit?.lng?.toString() || "");
  const [hasPickup, setHasPickup] = useState(edit?.has_pickup !== false);
  const [hasDelivery, setHasDelivery] = useState(edit?.has_delivery !== false);
  const [expressAvailable, setExpressAvailable] = useState(edit?.express_available || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!areaName.trim()) { toast.error("Area name is required"); return; }
    setSaving(true);
    try {
      const body = {
        city_id: edit ? edit.city_id : cityId,
        zone: zone.trim() || null,
        area_name: areaName.trim(),
        pincode: pincode.trim() || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        has_pickup: hasPickup,
        has_delivery: hasDelivery,
        express_available: expressAvailable,
      };
      if (edit) {
        await api.put(`/api/areas/${edit.id}`, body);
        toast.success("Area updated");
      } else {
        await api.post("/api/areas", body);
        toast.success("Area added");
      }
      onSave();
      onClose();
    } catch (e: any) {
      toast.error("Failed to save area", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Area" : "Add Area"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Area Name</Label>
            <Input value={areaName} onChange={(e) => setAreaName(e.target.value)} className="mt-1" placeholder="e.g. Horamavu" />
          </div>
          <div>
            <Label className="text-xs">Zone</Label>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} className="mt-1" placeholder="e.g. North Bangalore" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pincode</Label>
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} className="mt-1" placeholder="560043" />
            </div>
            <div>
              <Label className="text-xs">Coordinates (optional)</Label>
              <div className="grid grid-cols-2 gap-1">
                <Input value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1" placeholder="Lat" />
                <Input value={lng} onChange={(e) => setLng(e.target.value)} className="mt-1" placeholder="Lng" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={hasPickup} onChange={(e) => setHasPickup(e.target.checked)} className="rounded" />
              Pickup
            </Label>
            <Label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={hasDelivery} onChange={(e) => setHasDelivery(e.target.checked)} className="rounded" />
              Delivery
            </Label>
            <Label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={expressAvailable} onChange={(e) => setExpressAvailable(e.target.checked)} className="rounded" />
              Express
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
