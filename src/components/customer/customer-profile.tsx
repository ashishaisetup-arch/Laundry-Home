import { useState } from "react";
import {
  MapPin,
  Plus,
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
import { AddAddressDialog } from "@/components/shared/add-address-dialog";
import { useAppStore } from "@/lib/store";
import { useAddresses } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { formatAddress } from "@/lib/address";

export function CustomerProfile() {
  const { userName, userEmail, userPhone, userAvatar, role: userRole, setProfile } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState(userPhone);
  const [saving, setSaving] = useState(false);

  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const addrList = addresses || [];
  const [showAddAddr, setShowAddAddr] = useState(false);

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
              <p className="text-xs text-muted-foreground">{formatAddress(addr)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Address Dialog */}
      <AddAddressDialog
        open={showAddAddr}
        onOpenChange={setShowAddAddr}
        onSaved={() => refetchAddresses()}
      />
    </div>
  );
}
