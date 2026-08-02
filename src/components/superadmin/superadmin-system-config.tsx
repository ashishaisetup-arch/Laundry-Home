import { useState, useEffect, type ComponentType } from "react";
import { Save, ShieldCheck, Bell, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { useSystemConfig } from "@/lib/hooks";

function SwitchItem({ label, desc, checked, onChecked }: { label: string; desc: string; checked?: boolean; onChecked: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChecked} />
    </div>
  );
}

function PaymentToggle({ label, desc, icon, checked, onChecked }: { label: string; desc: string; icon: string; checked?: boolean; onChecked: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChecked} />
    </div>
  );
}

function PayIconToggle({ label, desc, icon: Icon, checked, onChecked }: { label: string; desc: string; icon: ComponentType<{ className?: string }>; checked?: boolean; onChecked: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChecked} />
    </div>
  );
}

function SecurityToggle({ label, desc, checked, onChecked }: { label: string; desc: string; checked?: boolean; onChecked: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChecked} />
    </div>
  );
}

export function SystemConfig() {
  const { data: config, loading, saveConfig } = useSystemConfig();
  const [saving, setSaving] = useState(false);

  const [general, setGeneral] = useState<Record<string, any>>({});
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [customer, setCustomer] = useState<Record<string, any>>({});
  const [notifications, setNotifications] = useState<Record<string, any>>({});
  const [notifEvents, setNotifEvents] = useState<Record<string, boolean>>({});
  const [security, setSecurity] = useState<Record<string, any>>({});
  const [limits, setLimits] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config) {
      setGeneral(config.general || {});
      setPayments(config.payments || {});
      setCustomer(config.customer || {});
      const notif = config.notifications || {};
      setNotifications({ push: notif.push, sms: notif.sms, email: notif.email, whatsapp: notif.whatsapp });
      setNotifEvents(notif.events || {});
      setSecurity(config.security || {});
      setLimits(config.limits || {});
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig("general", general);
      await saveConfig("payments", payments);
      await saveConfig("customer", customer);
      await saveConfig("notifications", { ...notifications, events: notifEvents });
      await saveConfig("security", security);
      await saveConfig("limits", limits);
      toast.success("Settings saved", { description: "All system configurations updated." });
    } catch (err: any) {
      toast.error("Failed to save settings", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return <Card className="p-8 text-center text-muted-foreground">Loading configuration...</Card>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="customer">Customer Features</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="limits">Limits & Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">General Settings</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Platform Name</Label>
                <Input value={general.platformName || ""} onChange={(e) => setGeneral((p) => ({ ...p, platformName: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Support Email</Label>
                <Input value={general.supportEmail || ""} onChange={(e) => setGeneral((p) => ({ ...p, supportEmail: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Support Phone</Label>
                <Input value={general.supportPhone || ""} onChange={(e) => setGeneral((p) => ({ ...p, supportPhone: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Default Currency</Label>
                <Select value={general.defaultCurrency || "inr"} onValueChange={(v) => setGeneral((p) => ({ ...p, defaultCurrency: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inr">INR (₹)</SelectItem>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="aed">AED (د.إ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Default Language</Label>
                <Select value={general.defaultLanguage || "en"} onValueChange={(v) => setGeneral((p) => ({ ...p, defaultLanguage: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिन्दी</SelectItem>
                    <SelectItem value="kn">ಕನ್ನಡ</SelectItem>
                    <SelectItem value="ta">தமிழ்</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Select value={general.timezone || "ist"} onValueChange={(v) => setGeneral((p) => ({ ...p, timezone: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ist">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="gst">Asia/Dubai (GST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <SwitchItem label="Allow new customer signups" desc="Customers can self-register" checked={general.allowSignups} onChecked={(v) => setGeneral((p) => ({ ...p, allowSignups: v }))} />
              <SwitchItem label="Allow new vendor applications" desc="Vendors can apply for onboarding" checked={general.allowVendorApps} onChecked={(v) => setGeneral((p) => ({ ...p, allowVendorApps: v }))} />
              <SwitchItem label="Maintenance mode" desc="Show maintenance page to all users" checked={general.maintenanceMode} onChecked={(v) => setGeneral((p) => ({ ...p, maintenanceMode: v }))} />
              <SwitchItem label="Multi-city support" desc="Enable operations in multiple cities" checked={general.multiCity} onChecked={(v) => setGeneral((p) => ({ ...p, multiCity: v }))} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Payment Configuration</h3>
            <div className="space-y-3">
              <PaymentToggle label="UPI" desc="Accept UPI payments" icon="📱" checked={payments.upi} onChecked={(v) => setPayments((p) => ({ ...p, upi: v }))} />
              <PaymentToggle label="Credit / Debit Cards" desc="Visa, Mastercard, RuPay" icon="💳" checked={payments.cards} onChecked={(v) => setPayments((p) => ({ ...p, cards: v }))} />
              <PaymentToggle label="Net Banking" desc="All major Indian banks" icon="🏦" checked={payments.netBanking} onChecked={(v) => setPayments((p) => ({ ...p, netBanking: v }))} />
              <PaymentToggle label="Wallet" desc="Laundry Home wallet" icon="👛" checked={payments.wallet} onChecked={(v) => setPayments((p) => ({ ...p, wallet: v }))} />
              <PaymentToggle label="Cash on Delivery" desc="Pay cash when order is delivered" icon="💵" checked={payments.cod} onChecked={(v) => setPayments((p) => ({ ...p, cod: v }))} />
              <PaymentToggle label="International Cards" desc="Accept cards issued outside India" icon="🌍" checked={payments.internationalCards} onChecked={(v) => setPayments((p) => ({ ...p, internationalCards: v }))} />
            </div>
            <Separator className="my-4" />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">GST Rate (%)</Label>
                <Input type="number" value={payments.gstRate ?? 18} onChange={(e) => setPayments((p) => ({ ...p, gstRate: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Platform Fee (₹)</Label>
                <Input type="number" value={payments.platformFee ?? 25} onChange={(e) => setPayments((p) => ({ ...p, platformFee: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Default Delivery Fee (₹)</Label>
                <Input type="number" value={payments.deliveryFee ?? 40} onChange={(e) => setPayments((p) => ({ ...p, deliveryFee: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Min Order Value (₹)</Label>
                <Input type="number" value={payments.minOrderValue ?? 150} onChange={(e) => setPayments((p) => ({ ...p, minOrderValue: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Customer-Facing Features</h3>
            <p className="text-xs text-muted-foreground mb-4">Disable options below to hide them from customers. They are all enabled by default.</p>
            <div className="space-y-3">
              <SwitchItem label="Subscription Plans" desc="Let customers browse and buy plans" checked={customer.enableSubscriptions} onChecked={(v) => setCustomer((p) => ({ ...p, enableSubscriptions: v }))} />
              <SwitchItem label="Coupons & Rewards" desc="Coupon codes and offers section" checked={customer.enableCoupons} onChecked={(v) => setCustomer((p) => ({ ...p, enableCoupons: v }))} />
              <SwitchItem label="Payments & Wallet" desc="Wallet top-up, balance and payment methods" checked={customer.enableWallet} onChecked={(v) => setCustomer((p) => ({ ...p, enableWallet: v }))} />
              <SwitchItem label="Loyalty Points" desc="Earn and redeem loyalty points at checkout" checked={customer.enableLoyalty} onChecked={(v) => setCustomer((p) => ({ ...p, enableLoyalty: v }))} />
              <SwitchItem label="Favorites" desc="Save and manage favorite vendors" checked={customer.enableFavorites} onChecked={(v) => setCustomer((p) => ({ ...p, enableFavorites: v }))} />
              <SwitchItem label="My Reviews" desc="Write and view your reviews" checked={customer.enableReviews} onChecked={(v) => setCustomer((p) => ({ ...p, enableReviews: v }))} />
              <SwitchItem label="Find Vendors" desc="Discover and browse vendors by area" checked={customer.enableDiscover} onChecked={(v) => setCustomer((p) => ({ ...p, enableDiscover: v }))} />
              <SwitchItem label="My Orders" desc="View order history and tracking" checked={customer.enableOrders} onChecked={(v) => setCustomer((p) => ({ ...p, enableOrders: v }))} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Notification Channels</h3>
            <div className="space-y-3">
              <PayIconToggle label="Push Notifications" desc="Mobile push via Firebase FCM" icon={Bell} checked={notifications.push} onChecked={(v) => setNotifications((p) => ({ ...p, push: v }))} />
              <PayIconToggle label="SMS" desc="Via Twilio" icon={Globe} checked={notifications.sms} onChecked={(v) => setNotifications((p) => ({ ...p, sms: v }))} />
              <PayIconToggle label="Email" desc="Via SendGrid" icon={Globe} checked={notifications.email} onChecked={(v) => setNotifications((p) => ({ ...p, email: v }))} />
              <PayIconToggle label="WhatsApp" desc="Via WhatsApp Business API" icon={Globe} checked={notifications.whatsapp} onChecked={(v) => setNotifications((p) => ({ ...p, whatsapp: v }))} />
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notification Events</p>
              {[
                ["bookingConfirmation", "Booking Confirmation"],
                ["vendorAcceptance", "Vendor Acceptance"],
                ["pickupReminder", "Pickup Reminder (15 mins before)"],
                ["orderStatusChanges", "Order Status Changes"],
                ["paymentSuccess", "Payment Success"],
                ["deliveryReminder", "Delivery Reminder"],
                ["promotionalOffers", "Promotional Offers"],
                ["aiDelayAlerts", "AI Delay Alerts"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch checked={notifEvents[key] ?? true} onCheckedChange={(v) => setNotifEvents((p) => ({ ...p, [key]: v }))} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Security Settings</h3>
            <div className="space-y-3">
              <SecurityToggle label="Require MFA for admins" desc="All admin users must enable 2FA" checked={security.mfaAdmins} onChecked={(v) => setSecurity((p) => ({ ...p, mfaAdmins: v }))} />
              <SecurityToggle label="Require MFA for vendors" desc="Vendors must enable 2FA for payouts" checked={security.mfaVendors} onChecked={(v) => setSecurity((p) => ({ ...p, mfaVendors: v }))} />
              <SecurityToggle label="Session timeout (30 mins)" desc="Auto-logout after inactivity" checked={security.sessionTimeout} onChecked={(v) => setSecurity((p) => ({ ...p, sessionTimeout: v }))} />
              <SecurityToggle label="IP whitelist for admin panel" desc="Restrict admin access to specific IPs" checked={security.ipWhitelist} onChecked={(v) => setSecurity((p) => ({ ...p, ipWhitelist: v }))} />
              <SecurityToggle label="Device management" desc="Track and limit devices per user" checked={security.deviceManagement} onChecked={(v) => setSecurity((p) => ({ ...p, deviceManagement: v }))} />
              <SecurityToggle label="JWT refresh token rotation" desc="Rotate refresh tokens on every use" checked={security.jwtRotation} onChecked={(v) => setSecurity((p) => ({ ...p, jwtRotation: v }))} />
              <SecurityToggle label="Rate limiting on auth APIs" desc="5 attempts per minute" checked={security.rateLimiting} onChecked={(v) => setSecurity((p) => ({ ...p, rateLimiting: v }))} />
              <SecurityToggle label="Suspicious login alerts" desc="Email user on login from new device" checked={security.suspiciousLoginAlerts} onChecked={(v) => setSecurity((p) => ({ ...p, suspiciousLoginAlerts: v }))} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Limits & Pricing</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Max Items Per Order</Label>
                <Input type="number" value={limits.maxItemsPerOrder ?? 50} onChange={(e) => setLimits((p) => ({ ...p, maxItemsPerOrder: parseInt(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Max Weight Per Order (kg)</Label>
                <Input type="number" value={limits.maxWeightKg ?? 30} onChange={(e) => setLimits((p) => ({ ...p, maxWeightKg: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Express Surcharge (₹)</Label>
                <Input type="number" value={limits.expressSurcharge ?? 50} onChange={(e) => setLimits((p) => ({ ...p, expressSurcharge: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Express Multiplier</Label>
                <Input type="number" step="0.1" value={limits.expressMultiplier ?? 1.5} onChange={(e) => setLimits((p) => ({ ...p, expressMultiplier: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Free Delivery Threshold (₹)</Label>
                <Input type="number" value={limits.freeDeliveryThreshold ?? 500} onChange={(e) => setLimits((p) => ({ ...p, freeDeliveryThreshold: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Max Service Radius (km)</Label>
                <Input type="number" value={limits.maxServiceRadiusKm ?? 10} onChange={(e) => setLimits((p) => ({ ...p, maxServiceRadiusKm: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Default Commission Rate (%)</Label>
                <Input type="number" value={limits.defaultCommissionRate ?? 10} onChange={(e) => setLimits((p) => ({ ...p, defaultCommissionRate: parseFloat(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Vendor Payout Cycle (days)</Label>
                <Input type="number" value={limits.vendorPayoutCycleDays ?? 7} onChange={(e) => setLimits((p) => ({ ...p, vendorPayoutCycleDays: parseInt(e.target.value) || 0 }))} className="mt-1.5" />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
