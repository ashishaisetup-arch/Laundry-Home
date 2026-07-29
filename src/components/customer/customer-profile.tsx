import { useState, useEffect, useCallback, useRef } from "react";
import {
  MapPin,
  Plus,
  Search,
  Navigation,
  Trash2,
  User,
  Smartphone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";
import { useAddresses } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

export function CustomerProfile() {
  const { userName, userEmail, userPhone, userAvatar, role: userRole, setProfile } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState(userPhone);
  const [saving, setSaving] = useState(false);

  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const addrList = addresses || [];
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", line: "", area: "", city: "", pincode: "" });
  const [profileAddrCoords, setProfileAddrCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingProfileAddr, setGeocodingProfileAddr] = useState(false);

  // ---- Dynamic area search with suggestions ----
  const [addrSearchQuery, setAddrSearchQuery] = useState("");
  const [addrSuggestions, setAddrSuggestions] = useState<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>([]);
  const [addrSearching, setAddrSearching] = useState(false);
  const addrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectForProfileAddress = useCallback(async () => {
    if (!navigator.geolocation) return;
    setGeocodingProfileAddr(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await api.get<{ area: string; city: string; pincode: string; lat: number; lng: number }>(
            `/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (result?.area) {
            setNewAddr((prev) => ({ ...prev, area: result.area, city: result.city, pincode: result.pincode }));
            setAddrSearchQuery(result.area);
            setProfileAddrCoords({ lat: result.lat, lng: result.lng });
          }
        } catch {
          // silent — user can type manually
        } finally {
          setGeocodingProfileAddr(false);
        }
      },
      () => setGeocodingProfileAddr(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (showAddAddr && !newAddr.area) detectForProfileAddress();
  }, [showAddAddr, newAddr.area, detectForProfileAddress]);

  useEffect(() => {
    if (!showAddAddr) { setAddrSearchQuery(""); setAddrSuggestions([]); return; }
  }, [showAddAddr]);

  useEffect(() => {
    if (addrSearchQuery.length < 2) { setAddrSuggestions([]); return; }
    setAddrSearching(true);
    if (addrTimerRef.current) clearTimeout(addrTimerRef.current);
    addrTimerRef.current = setTimeout(async () => {
      try {
        const results = await api.get<Array<{ label: string; area: string; city: string; pincode: string; lat: number; lng: number }>>(
          `/api/geocode/search?q=${encodeURIComponent(addrSearchQuery)}`
        );
        setAddrSuggestions(results || []);
      } catch {
        setAddrSuggestions([]);
      } finally {
        setAddrSearching(false);
      }
    }, 300);
    return () => { if (addrTimerRef.current) clearTimeout(addrTimerRef.current); };
  }, [addrSearchQuery]);

  const selectAddrSuggestion = (s: typeof addrSuggestions[number]) => {
    setNewAddr((prev) => ({ ...prev, area: s.area, city: s.city, pincode: s.pincode }));
    setProfileAddrCoords({ lat: s.lat, lng: s.lng });
    setAddrSearchQuery(s.area);
    setAddrSuggestions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setProfile(name, phone);
      setEditing(false);
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error("Failed to update profile", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(userName);
    setPhone(userPhone);
    setEditing(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile card */}
      <Card className="p-6 shadow-soft">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
              {userAvatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{userName}</h2>
            <p className="text-sm text-muted-foreground">{userRole}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {userEmail || "—"}
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            {editing ? (
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            ) : (
              <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {userName}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            {editing ? (
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter your phone number" className="mt-1" />
            ) : (
              <p className="text-sm font-medium mt-0.5 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                {userPhone || "—"}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <User className="h-4 w-4 mr-1.5" />
              Edit Profile
            </Button>
          )}
        </div>
      </Card>

      {/* Saved addresses */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Saved Addresses</h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowAddAddr(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add new
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {addrList.map((addr) => (
            <div key={addr.id} className="group rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">{addr.label}</span>
                {addr.isDefault && <Badge variant="secondary" className="text-[10px] py-0 h-4">Default</Badge>}
                <button
                  onClick={async () => {
                    try {
                      await api.delete(`/api/addresses/${addr.id}`);
                      refetchAddresses();
                      toast.success("Address deleted", { description: `${addr.label} address removed.` });
                    } catch (err: any) {
                      toast.error("Failed to delete address", { description: err.message });
                    }
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-600"
                  title="Delete address"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{addr.line}</p>
              <p className="text-xs text-muted-foreground">{addr.area}, {addr.city} - {addr.pincode}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Address Dialog */}
      <Dialog open={showAddAddr} onOpenChange={(o) => { setShowAddAddr(o); if (!o) { setProfileAddrCoords(null); setAddrSearchQuery(""); setAddrSuggestions([]); } }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Add New Address</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add New Address</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Save a new pickup/delivery address</p>
          </div>
          <div className="space-y-3 pt-2">
            {/* ═══ Location ═══ */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Location</p>

              {/* Auto-detect button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mb-2"
                onClick={detectForProfileAddress}
                disabled={geocodingProfileAddr}
              >
                {geocodingProfileAddr ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5" />
                )}
                {geocodingProfileAddr ? "Detecting…" : "Auto-fill my current location"}
              </Button>

              {/* Dynamic search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                <Input
                  value={addrSearchQuery}
                  onChange={(e) => setAddrSearchQuery(e.target.value)}
                  placeholder="Search area or enter pincode..."
                  className="pl-8"
                />
                {addrSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                )}
              </div>

              {/* Suggestions dropdown */}
              {addrSuggestions.length > 0 && (
                <div className="mt-1 border border-border rounded-lg bg-background shadow-lg max-h-48 overflow-y-auto z-20">
                  {addrSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={() => selectAddrSuggestion(s)}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.area}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.label !== s.area ? s.label : `${s.city}${s.pincode ? `, ${s.pincode}` : ""}`}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}


            </div>

            {/* ═══ Address Details ═══ */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Address Details</p>
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} placeholder="Home, Work, etc." className="mt-1" />
              </div>
              <div className="mt-2">
                <Label className="text-xs">Address Line</Label>
                <Input value={newAddr.line} onChange={(e) => setNewAddr({ ...newAddr, line: e.target.value })} placeholder="Flat / House no, Street" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} placeholder="Bengaluru" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Pincode</Label>
                  <Input value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="560038" className="mt-1" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowAddAddr(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!newAddr.label || !newAddr.line || !newAddr.area || !newAddr.city || newAddr.pincode.length < 6}
              onClick={async () => {
                try {
                  const payload = profileAddrCoords
                    ? { ...newAddr, lat: profileAddrCoords.lat, lng: profileAddrCoords.lng }
                    : newAddr;
                  await api.post("/api/addresses", payload);
                  refetchAddresses();
                  setNewAddr({ label: "", line: "", area: "", city: "", pincode: "" });
                  setProfileAddrCoords(null);
                  setShowAddAddr(false);
                  toast.success("Address added", { description: "New address saved successfully." });
                } catch (err: any) {
                  toast.error("Failed to add address", { description: err.message });
                }
              }}
            >
              Save Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
