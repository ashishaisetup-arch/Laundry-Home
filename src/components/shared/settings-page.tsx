import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, Bell, Shield, KeyRound, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

export function SettingsPage() {
  const { theme, toggleTheme, pushEnabled, orderUpdatesEnabled, promotionsEnabled, fetchSettings, updateNotificationSettings, changePassword } = useAppStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [savingPush, setSavingPush] = useState(false);

  useEffect(() => {
    fetchSettings().catch(() => {});
  }, [fetchSettings]);

  const handleToggle = async (patch: { pushEnabled?: boolean; orderUpdates?: boolean; promotions?: boolean }) => {
    setSavingPush(true);
    try {
      await updateNotificationSettings(patch);
    } catch (e: any) {
      toast.error(e.message || "Failed to update notification settings");
    } finally {
      setSavingPush(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChanging(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated", { description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setChanging(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <Card className="p-6 md:p-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tonal shrink-0">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Switch between dark and light mode</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tonal shrink-0">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Receive order updates and alerts</p>
              </div>
            </div>
            <Switch
              aria-label="Push Notifications"
              checked={pushEnabled}
              disabled={savingPush}
              onCheckedChange={(v) => handleToggle({ pushEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2 pl-11">
            <div>
              <p className="text-sm font-medium">Order updates</p>
              <p className="text-xs text-muted-foreground">Status changes, pickup and delivery alerts</p>
            </div>
            <Switch
              aria-label="Order update notifications"
              checked={orderUpdatesEnabled}
              disabled={!pushEnabled || savingPush}
              onCheckedChange={(v) => handleToggle({ orderUpdates: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2 pl-11">
            <div>
              <p className="text-sm font-medium">Promotions and offers</p>
              <p className="text-xs text-muted-foreground">Deals, discounts and marketing messages</p>
            </div>
            <Switch
              aria-label="Promotions and offers notifications"
              checked={promotionsEnabled}
              disabled={!pushEnabled || savingPush}
              onCheckedChange={(v) => handleToggle({ promotions: v })}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Security</h3>
        <div className="flex items-center gap-3 pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tonal shrink-0">
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Account Security</p>
            <p className="text-xs text-muted-foreground">Password and authentication settings</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={changing}>
              {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {changing ? "Updating..." : "Change Password"}
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
