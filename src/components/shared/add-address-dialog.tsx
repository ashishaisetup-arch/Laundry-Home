import { useState, useCallback, useEffect } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AddressAutocomplete, type PlaceResult } from "@/components/shared/address-autocomplete";
import { useGoogleMapsAvailable } from "@/lib/hooks/useGoogleMaps";
import { api } from "@/lib/api/client";
import { formatAddress } from "@/lib/address";
import type { Address } from "@/lib/types";
import { toast } from "sonner";

interface AddAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (address: Address) => void;
}

interface FormState {
  label: string;
  buildingName: string;
  flatNo: string;
  line: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
}

const EMPTY_FORM: FormState = {
  label: "",
  buildingName: "",
  flatNo: "",
  line: "",
  area: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  place_id: "",
  lat: null,
  lng: null,
};

export function AddAddressDialog({ open, onOpenChange, onSaved }: AddAddressDialogProps) {
  const googleAvailable = useGoogleMapsAvailable();
  const [googleFailed, setGoogleFailed] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<PlaceResult | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setEdited(new Set());
      setPlace(null);
      setGoogleFailed(false);
    }
  }, [open]);

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setEdited((prev) => new Set(prev).add(field));
  }, []);

  const handlePlaceSelect = useCallback(
    (p: PlaceResult | null) => {
      setPlace(p);
      if (!p) return;
      const area = p.area.split(", ").pop() || p.area;
      setForm((prev) => {
        const next = { ...prev };
        if (!edited.has("buildingName") && p.building) next.buildingName = p.building;
        if (!edited.has("line")) next.line = p.streetAddress || p.formattedAddress;
        if (!edited.has("area")) next.area = area;
        if (!edited.has("city")) next.city = p.city;
        if (!edited.has("state")) next.state = p.state;
        if (!edited.has("pincode")) next.pincode = p.pincode;
        next.place_id = p.placeId;
        next.lat = p.latitude || null;
        next.lng = p.longitude || null;
        return next;
      });
    },
    [edited]
  );

  const canSave =
    form.label.trim() !== "" &&
    form.line.trim() !== "" &&
    form.area.trim() !== "" &&
    form.city.trim() !== "" &&
    form.pincode.length === 6;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        label: form.label.trim(),
        building_name: form.buildingName.trim(),
        flat_no: form.flatNo.trim(),
        line: form.line.trim(),
        area: form.area.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode,
        full_address: formatAddress(form),
      };
      if (form.place_id) payload.place_id = form.place_id;
      if (form.lat != null && form.lng != null) {
        payload.lat = form.lat;
        payload.lng = form.lng;
      }
      const addr = await api.post<Address>("/api/addresses", payload);
      onSaved?.(addr);
      onOpenChange(false);
      toast.success("Address added", { description: "New address saved successfully." });
    } catch (err: any) {
      toast.error("Failed to add address", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const useGoogleMaps = googleAvailable && !googleFailed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">Add New Address</DialogTitle>
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add New Address</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Search for your apartment/house and we'll fill in the rest</p>
        </div>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">Label</Label>
            <Input value={form.label} onChange={(e) => setField("label", e.target.value)} placeholder="Home, Work, etc." className="mt-1" />
          </div>

          {useGoogleMaps && (
            <APIProvider
              apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
              libraries={["places"]}
              onError={() => setGoogleFailed(true)}
            >
              <div>
                <Label className="text-xs">Search Address</Label>
                <div className="mt-1">
                  <AddressAutocomplete
                    value={place ? place.streetAddress || place.formattedAddress : ""}
                    onChange={handlePlaceSelect}
                    placeholder="Search apartment, house or full address..."
                  />
                </div>
              </div>
            </APIProvider>
          )}

          <div>
            <Label className="text-xs">Apartment / Building / House Name</Label>
            <Input value={form.buildingName} onChange={(e) => setField("buildingName", e.target.value)} placeholder="Prestige Shantiniketan" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Flat / Door No.</Label>
            <Input value={form.flatNo} onChange={(e) => setField("flatNo", e.target.value)} placeholder="Flat No 202" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Street</Label>
            <Input value={form.line} onChange={(e) => setField("line", e.target.value)} placeholder="Street / Road name" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Area / Locality</Label>
            <Input value={form.area} onChange={(e) => setField("area", e.target.value)} placeholder="Horamavu" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Landmark (optional)</Label>
            <Input value={form.landmark} onChange={(e) => setField("landmark", e.target.value)} placeholder="e.g. Near Phoenix Mall" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Bengaluru" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Input value={form.state} onChange={(e) => setField("state", e.target.value)} placeholder="Karnataka" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Pincode</Label>
            <Input value={form.pincode} onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="560113" className="mt-1" />
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="flex-1" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save Address"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}