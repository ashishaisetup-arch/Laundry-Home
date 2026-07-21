import { motion } from "framer-motion";
import { Moon, Sun, Bell, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

export function SettingsPage() {
  const { theme, toggleTheme } = useAppStore();

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
        <div className="flex items-center gap-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tonal shrink-0">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Push Notifications</p>
            <p className="text-xs text-muted-foreground">Receive order updates and alerts</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Security</h3>
        <div className="flex items-center gap-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tonal shrink-0">
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Account Security</p>
            <p className="text-xs text-muted-foreground">Password and authentication settings</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
