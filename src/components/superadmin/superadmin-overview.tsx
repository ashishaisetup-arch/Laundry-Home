import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Flag,
  Key,
  ScrollText,
  Settings,
  Shield,
  Store,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Crown } from "./superadmin-helpers";

export function SuperAdminOverview({ onOnboard, onNavigate, totalUsers, totalVendors }: { onOnboard?: () => void; onNavigate?: (v: string) => void; totalUsers?: number; totalVendors?: number }) {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-white/20 text-white border-0">
                  <Crown className="h-3 w-3 mr-1" />
                  Super Admin
                </Badge>
                <Badge className="bg-white/20 text-white border-0">● All systems operational</Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Full platform control 🛡️
              </h2>
              <p className="text-sm text-white/80 mt-1">
                Unrestricted access to all modules, configurations and platform settings.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">Uptime (30d)</p>
                <p className="text-xl font-bold mt-0.5">99.98%</p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[120px]">
                <p className="text-xs text-white/80">API latency</p>
                <p className="text-xl font-bold mt-0.5">142ms</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Onboard Vendor CTA — prominent */}
      {onOnboard && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2 }}
          onClick={onOnboard}
          className="w-full text-left"
        >
          <Card className="relative overflow-hidden p-5 shadow-soft hover:shadow-lift transition-shadow bg-tonal-accent">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-surface">
                <Store className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Onboard a New Vendor</p>
                  <Badge variant="outline" className="text-[10px] border-primary text-primary">Quick action</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Add a verified laundry vendor with KYC, services, and commission config</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        </motion.button>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Roles & Permissions", desc: "Manage RBAC matrix", icon: Shield, color: "from-teal-500 to-cyan-600", view: "rbac" },
          { label: "Audit Logs", desc: "Track every action", icon: ScrollText, color: "from-violet-500 to-purple-600", view: "audit" },
          { label: "Feature Flags", desc: "Toggle features live", icon: Flag, color: "from-amber-500 to-orange-600", view: "features" },
          { label: "API Keys", desc: "Manage integrations", icon: Key, color: "from-emerald-500 to-green-600", view: "integrations" },
          { label: "System Config", desc: "Global settings", icon: Settings, color: "from-rose-500 to-pink-600", view: "system" },
          { label: "User Management", desc: "All platform users", icon: UserCog, color: "from-sky-500 to-cyan-600", view: "users" },
        ].map((a) => (
          <motion.button
            key={a.label}
            whileHover={{ y: -2 }}
            onClick={() => onNavigate?.(a.view)}
            className="text-left"
          >
            <Card className="p-5 shadow-soft hover:shadow-lift transition-shadow cursor-pointer h-full">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-3", a.color)}>
                <a.icon className="h-5 w-5" />
              </div>
              <p className="font-semibold">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
            </Card>
          </motion.button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              System Health
            </h3>
            <Badge variant="outline" className="text-emerald-600 border-emerald-300">All healthy</Badge>
          </div>
          <div className="space-y-3">
            {[
              { name: "API Gateway", status: "operational", uptime: "99.99%", latency: "82ms" },
              { name: "Database (Primary)", status: "operational", uptime: "99.98%", latency: "12ms" },
              { name: "Redis Cache", status: "operational", uptime: "100%", latency: "3ms" },
              { name: "WebSocket Service", status: "operational", uptime: "99.95%", latency: "28ms" },
              { name: "AI Inference Service", status: "operational", uptime: "99.92%", latency: "340ms" },
              { name: "Payment Gateway (Razorpay)", status: "operational", uptime: "99.97%", latency: "180ms" },
              { name: "Notification Service", status: "degraded", uptime: "98.21%", latency: "1.2s" },
            ].map((s) => (
              <div key={s.name} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className={cn(
                  "flex h-2.5 w-2.5 rounded-full",
                  s.status === "operational" ? "bg-emerald-500" : "bg-amber-500"
                )} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">Uptime: {s.uptime} · Latency: {s.latency}</p>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  s.status === "operational" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                )}>
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Platform Stats</h3>
          <div className="space-y-3">
            {[
              { label: "Total Users", value: (totalUsers || 0).toLocaleString(), icon: Users, color: "text-teal-500" },
              { label: "Total Vendors", value: (totalVendors || 0).toLocaleString(), icon: Store, color: "text-emerald-500" },
              { label: "Active Orders", value: "—", icon: Activity, color: "text-violet-500" },
              { label: "Avg Response", value: "142ms", icon: Zap, color: "text-amber-500" },
              { label: "Error Rate", value: "0.08%", icon: AlertTriangle, color: "text-rose-500" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <s.icon className={cn("h-4 w-4", s.color)} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-bold">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
