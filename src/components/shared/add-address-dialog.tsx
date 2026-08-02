import { useState, useCallback, useEffect } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AddressAutocomplete, type PlaceResult } from "@/components/shared/address-autocomplete";
import { useGoogleMapsAvailable } from "@/lib/hooks/useGoogleMaps";
import { api } from "@/lib/api/client";
import type { Address } from "@/lib/types";
import { toast } from "sonner";

interface AddAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (address: Address) => void;
}

interface FormState {
  label: string;
  flatNo: string;
  line: string;
  area: string;
  city: string;
  pincode: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
}

const EMPTY_FORM: FormState = { label: "", flatNo: "", line: "", area: "", city: "", pincode: "", place_id: "", lat: null, lng: null };

function composeFullAddress(flatNo: string, street: string, area: string, city: string, pincode: string): string {
  const head = [flatNo.trim(), street.trim(), area.trim()].filter(Boolean).join(", ");
  const tail = [city.trim(), pincode.trim()].filter(Boolean).join(" - ");
  return [head, tail].filter(Boolean).join(", ");
}

function composeGoogleAddress(flatNo: string, street: string, city: string, pincode: string): string {
  const head = [flatNo.trim(), street.trim()].filter(Boolean).join(", ");
  const tail = [city.trim(), pincode.trim()].filter(Boolean).join(" - ");
  return [head, tail].filter(Boolean).join(", ");
}

export function AddAddressDialog({ open, onOpenChange, onSaved }: AddAddressDialogProps) {
  const googleAvailable = useGoogleMapsAvailable();
  const [googleFailed, setGoogleFailed] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fullAddress, setFullAddress] = useState("");
  const [fullAddressTouched, setFullAddressTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<PlaceResult | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFullAddress("");
      setFullAddressTouched(false);
      setPlace(null);
      setGoogleFailed(false);
    }
  }, [open]);

  const handlePlaceSelect = useCallback((p: PlaceResult | null) => {
    setPlace(p);
    if (p) {
      const area = p.area.split(", ").pop() || p.area;
      setForm((prev) => {
        setFullAddress(composeGoogleAddress(prev.flatNo, p.streetAddress || p.formattedAddress, p.city, p.pincode));
        setFullAddressTouched(false);
        return {
          ...prev,
          line: p.streetAddress || p.formattedAddress,
          area,
          city: p.city,
          pincode: p.pincode,
          place_id: p.placeId,
          lat: p.latitude || null,
          lng: p.longitude || null,
        };
      });
    }
  }, []);

  const handleFlatNoChange = (value: string) => {
    setForm((prev) => ({ ...prev, flatNo: value }));
    if (place && !fullAddressTouched) {
      setFullAddress(composeGoogleAddress(value, place.streetAddress || place.formattedAddress, place.city, place.pincode));
    }
  };

  const canSave =
    form.label.trim() !== "" &&
    form.line.trim() !== "" &&
    form.area.trim() !== "" &&
    form.city.trim() !== "" &&
    form.pincode.length === 6;

  const handleSave = async () => {
    setSaving(true);
    try {
      const composed = fullAddress.trim() || composeFullAddress(form.flatNo, form.line, form.area, form.city, form.pincode);      const payload: any = {
        label: form.label.trim(),
        line: form.line.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        full_address: composed,
      };
      if (form.place_id) payload.place_id = form.place_id;
      if (form.lat != null && form.lng != null) { payload.lat = form.lat; payload.lng = form.lng; }
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
            <Input value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Home, Work, etc." className="mt-1" />
          </div>

          {googleAvailable && !googleFailed ? (
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
              <div>
                <Label className="text-xs">Flat / Unit No (optional)</Label>
                <Input value={form.flatNo} onChange={(e) => handleFlatNoChange(e.target.value)} placeholder="Flat No 202" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Full Address</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    value={fullAddress}
                    onChange={(e) => { setFullAddress(e.target.value); setFullAddressTouched(true); }}
                    placeholder="Flat No 202, LH CASA Feliz, Horamavu Agara, Bengaluru - 560113"
                    className="pl-8"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Editable — adjust if anything is missing.</p>
              </div>
            </APIProvider>
          ) : (
            <>
              <div>
                <Label className="text-xs">Flat / House no, Street</Label>
                <Input value={form.line} onChange={(e) => setForm((prev) => ({ ...prev, line: e.target.value }))} placeholder="Flat / House no, Street" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Flat / Unit No (optional)</Label>
                <Input value={form.flatNo} onChange={(e) => handleFlatNoChange(e.target.value)} placeholder="Flat 2B, Building name" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Area</Label>
                <Input value={form.area} onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))} placeholder="Horamavu" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Bengaluru" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Pincode</Label>
                  <Input value={form.pincode} onChange={(e) => setForm((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="560113" className="mt-1" />
                </div>
              </div>
            </>
          )}
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
