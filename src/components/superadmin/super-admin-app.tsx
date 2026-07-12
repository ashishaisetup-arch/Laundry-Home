"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Database,
  Eye,
  Flag,
  Key,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  XCircle,
  Bell,
  Globe,
  Plug,
  Code,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { StatCard } from "@/components/shared/stat-card";
import { VendorOnboarding } from "./vendor-onboarding";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Super Admin",
    items: [
      { id: "overview", label: "Control Center", icon: "LayoutDashboard" },
      { id: "onboard", label: "Onboard Vendor", icon: "Store", badge: "New" },
      { id: "rbac", label: "Roles & Permissions", icon: "Shield" },
      { id: "users", label: "User Management", icon: "UserCog" },
      { id: "audit", label: "Audit Logs", icon: "ScrollText" },
      { id: "features", label: "Feature Flags", icon: "Flag" },
      { id: "integrations", label: "API & Webhooks", icon: "Plug" },
      { id: "system", label: "System Config", icon: "Settings" },
    ],
  },
];

export function SuperAdminApp() {
  const [view, setView] = useState("overview");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleNavigate = (v: string) => {
    if (v === "onboard") {
      setShowOnboarding(true);
      return;
    }
    setView(v);
  };

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={handleNavigate}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view)}
      actions={
        view === "overview" ? (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowOnboarding(true)}>
            <Store className="h-4 w-4 mr-1.5" />
            Onboard Vendor
          </Button>
        ) : view === "system" ? (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Settings saved", { description: "All system configurations updated." })}>
            <Save className="h-4 w-4 mr-1.5" />
            Save Changes
          </Button>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "overview" && <SuperAdminOverview key="overview" onOnboard={() => setShowOnboarding(true)} />}
        {view === "rbac" && <RbacMatrix key="rbac" />}
        {view === "users" && <UserManagement key="users" />}
        {view === "audit" && <AuditLogs key="audit" />}
        {view === "features" && <FeatureFlags key="features" />}
        {view === "integrations" && <Integrations key="integrations" />}
        {view === "system" && <SystemConfig key="system" />}
      </AnimatePresence>

      <VendorOnboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </AppShell>
  );
}

function pageTitle(view: string) {
  return {
    overview: "Control Center",
    rbac: "Roles & Permissions",
    users: "User Management",
    audit: "Audit Logs",
    features: "Feature Flags",
    integrations: "API & Webhooks",
    system: "System Configuration",
  }[view] || "Super Admin";
}
function pageSubtitle(view: string) {
  return {
    overview: "Super Admin · Full platform access",
    rbac: "Configure role-based access control across all modules",
    users: "Manage platform users, staff and administrators",
    audit: "Track every action across the platform",
    features: "Toggle features on/off without deploying",
    integrations: "API keys, third-party integrations and webhooks",
    system: "Global platform settings and configuration",
  }[view];
}

// Crown icon
function Crown({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}

// ============================================================================
// Super Admin Overview
// ============================================================================
function SuperAdminOverview({ onOnboard }: { onOnboard?: () => void }) {
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
          { label: "Roles & Permissions", desc: "Manage RBAC matrix", icon: Shield, color: "from-teal-500 to-cyan-600" },
          { label: "Audit Logs", desc: "Track every action", icon: ScrollText, color: "from-violet-500 to-purple-600" },
          { label: "Feature Flags", desc: "Toggle features live", icon: Flag, color: "from-amber-500 to-orange-600" },
          { label: "API Keys", desc: "Manage integrations", icon: Key, color: "from-emerald-500 to-green-600" },
          { label: "System Config", desc: "Global settings", icon: Settings, color: "from-rose-500 to-pink-600" },
          { label: "User Management", desc: "All platform users", icon: UserCog, color: "from-sky-500 to-cyan-600" },
        ].map((a) => (
          <motion.div key={a.label} whileHover={{ y: -2 }}>
            <Card className="p-5 shadow-soft hover:shadow-lift transition-shadow">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-3", a.color)}>
                <a.icon className="h-5 w-5" />
              </div>
              <p className="font-semibold">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
            </Card>
          </motion.div>
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
              { label: "Total Users", value: "52,494", icon: Users, color: "text-teal-500" },
              { label: "Active Sessions", value: "1,284", icon: Activity, color: "text-emerald-500" },
              { label: "API Calls Today", value: "8.4M", icon: Code, color: "text-violet-500" },
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

// ============================================================================
// RBAC Matrix
// ============================================================================
function RbacMatrix() {
  const ROLES = ["Customer", "Vendor", "Vendor Staff", "Delivery Exec", "Admin", "Super Admin"];
  const MODULES = [
    "Customer Dashboard",
    "Vendor Dashboard",
    "Order Management",
    "Laundry Processing",
    "Garment Inventory",
    "Delivery Tasks",
    "Proof of Delivery",
    "Vendor Management",
    "Order Monitoring",
    "Commission Settings",
    "Customer Support",
    "Marketing Campaigns",
    "Reports & Analytics",
    "AI Features",
    "Roles & Permissions",
    "Audit Logs",
    "Feature Flags",
    "API Keys",
    "System Config",
  ];

  // -1 = no access, 0 = read only, 1 = full access
  const matrix: Record<string, number[]> = {
    Customer:      [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    Vendor:        [-1, 1, 1, 1, 1,-1,-1,-1,-1,-1,-1,-1, 1, 0,-1,-1,-1,-1,-1],
    "Vendor Staff":[-1, 0, 1, 1, 1,-1,-1,-1,-1,-1,-1,-1, 0,-1,-1,-1,-1,-1,-1],
    "Delivery Exec":[-1,-1, 0,-1,-1, 1, 1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    Admin:         [ 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1,-1,-1,-1,-1,-1],
    "Super Admin": [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-emerald-600">✓</strong> = full access · <strong className="text-amber-600">R</strong> = read only · <strong className="text-muted-foreground">—</strong> = no access
        </p>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Permission matrix saved")}>
          <Save className="h-4 w-4 mr-1.5" />
          Save Matrix
        </Button>
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[180px]">Module</th>
                {ROLES.map((r) => (
                  <th key={r} className="text-center p-3 font-medium text-xs text-muted-foreground min-w-[100px]">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, mi) => (
                <tr key={mod} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium sticky left-0 bg-card z-10">{mod}</td>
                  {ROLES.map((role) => {
                    const perm = matrix[role][mi];
                    return (
                      <td key={role} className="p-3 text-center">
                        <button
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-all hover:scale-110",
                            perm === 1 && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
                            perm === 0 && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                            perm === -1 && "bg-muted/40 text-muted-foreground/40"
                          )}
                          title={perm === 1 ? "Full access" : perm === 0 ? "Read only" : "No access"}
                        >
                          {perm === 1 ? "✓" : perm === 0 ? "R" : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// User Management
// ============================================================================
function UserManagement() {
  const users = [
    { id: "u1", name: "Aarav Mehta", email: "aarav.mehta@email.com", role: "Customer", status: "active", lastActive: "2 mins ago", joined: "Jan 2024" },
    { id: "u2", name: "FreshFold Laundry Co.", email: "owner@freshfold.co", role: "Vendor", status: "active", lastActive: "5 mins ago", joined: "Mar 2023" },
    { id: "u3", name: "Rajesh Kumar", email: "rajesh.k@delivery.co", role: "Delivery Exec", status: "active", lastActive: "now", joined: "Feb 2024" },
    { id: "u4", name: "Ananya Iyer", email: "ananya@laundryhome.com", role: "Admin", status: "active", lastActive: "1 min ago", joined: "Nov 2022" },
    { id: "u5", name: "System Admin", email: "admin@laundryhome.com", role: "Super Admin", status: "active", lastActive: "now", joined: "Jun 2022" },
    { id: "u6", name: "Priya Sharma", email: "priya.s@email.com", role: "Customer", status: "active", lastActive: "1 hour ago", joined: "Apr 2024" },
    { id: "u7", name: "Pristine Wash Hub", email: "owner@pristine.co", role: "Vendor", status: "active", lastActive: "10 mins ago", joined: "Nov 2022" },
    { id: "u8", name: "Rohan Gupta", email: "rohan.g@email.com", role: "Customer", status: "suspended", lastActive: "3 days ago", joined: "Dec 2023" },
    { id: "u9", name: "Vikram Singh", email: "vikram@laundryhome.com", role: "Admin", status: "active", lastActive: "20 mins ago", joined: "Jan 2023" },
    { id: "u10", name: "Sneha Reddy", email: "sneha.r@email.com", role: "Customer", status: "active", lastActive: "45 mins ago", joined: "May 2024" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value="52,494" change={8.4} trend="up" icon={Users} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Active Now" value="1,284" icon={Activity} accent="from-emerald-500 to-green-600" />
        <StatCard label="Suspended" value="42" icon={XCircle} accent="from-rose-500 to-pink-600" />
        <StatCard label="New This Week" value="1,842" change={12.1} trend="up" icon={UserCog} accent="from-amber-500 to-orange-600" />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search users by name, email…" className="flex-1 bg-transparent px-2 py-2 outline-none text-sm" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="delivery">Delivery Exec</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="superadmin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">User</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Role</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Last Active</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Joined</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary-surface text-primary-foreground text-[10px] font-semibold">
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      u.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30"
                    )}>
                      {u.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{u.lastActive}</td>
                  <td className="p-3 text-xs text-muted-foreground">{u.joined}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                    {u.status === "active" ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={() => toast.success(`User ${u.name} suspended`)}>
                        Suspend
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => toast.success(`User ${u.name} reactivated`)}>
                        Reactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Audit Logs
// ============================================================================
function AuditLogs() {
  const logs = [
    { id: "a1", actor: "Ananya Iyer", action: "Approved vendor", target: "UrbanFresh Laundry", time: "2 mins ago", ip: "103.21.x.x", severity: "info", icon: BadgeCheck },
    { id: "a2", actor: "System Admin", action: "Updated commission rule", target: "Premium vendor rate → 8%", time: "15 mins ago", ip: "103.21.x.x", severity: "warning", icon: Settings },
    { id: "a3", actor: "Aarav Mehta", action: "Placed order", target: "LH-2849", time: "1 hour ago", ip: "49.36.x.x", severity: "info", icon: Activity },
    { id: "a4", actor: "System", action: "Auto-suspended user", target: "Rohan Gupta (fraud detected)", time: "3 hours ago", ip: "—", severity: "critical", icon: AlertTriangle },
    { id: "a5", actor: "Vikram Singh", action: "Issued refund", target: "LH-2812 · ₹220", time: "4 hours ago", ip: "103.21.x.x", severity: "info", icon: RefreshCw },
    { id: "a6", actor: "System Admin", action: "Toggled feature flag", target: "ai_delay_prediction → ON", time: "6 hours ago", ip: "103.21.x.x", severity: "info", icon: Flag },
    { id: "a7", actor: "FreshFold Laundry", action: "Updated pricing", target: "Wash & Fold ₹55 → ₹60/kg", time: "8 hours ago", ip: "182.71.x.x", severity: "info", icon: Settings },
    { id: "a8", actor: "System", action: "Generated API key", target: "razorpay_webhook_key", time: "12 hours ago", ip: "—", severity: "warning", icon: Key },
    { id: "a9", actor: "Ananya Iyer", action: "Resolved support ticket", target: "T-2841", time: "1 day ago", ip: "103.21.x.x", severity: "info", icon: CheckCircle2 },
    { id: "a10", actor: "System Admin", action: "Modified RBAC matrix", target: "Vendor Staff → Laundry Processing (R)", time: "1 day ago", ip: "103.21.x.x", severity: "warning", icon: Shield },
    { id: "a11", actor: "System", action: "Database backup completed", target: "snapshot-2026-07-11.tar.gz (4.2GB)", time: "1 day ago", ip: "—", severity: "info", icon: Database },
    { id: "a12", actor: "Rajesh Kumar", action: "Completed delivery", target: "LH-2848", time: "2 days ago", ip: "49.36.x.x", severity: "info", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Events Today" value="2,841" icon={ScrollText} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Critical Events" value="2" icon={AlertTriangle} accent="from-rose-500 to-pink-600" />
        <StatCard label="Warnings" value="14" icon={Flag} accent="from-amber-500 to-orange-600" />
        <StatCard label="Info Events" value="2,825" icon={Activity} accent="from-emerald-500 to-green-600" />
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search audit logs…" className="flex-1 bg-transparent px-2 py-2 outline-none text-sm" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      <Card className="shadow-soft">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="font-semibold">Recent Events</h3>
          <Button variant="ghost" size="sm" className="text-xs">Export logs</Button>
        </div>
        <div className="divide-y divide-border/60">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                log.severity === "critical" && "bg-rose-50 text-rose-600 dark:bg-rose-950/30",
                log.severity === "warning" && "bg-amber-50 text-amber-600 dark:bg-amber-950/30",
                log.severity === "info" && "bg-muted text-muted-foreground"
              )}>
                <log.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{log.actor}</span>
                  <span className="text-sm text-muted-foreground">{log.action}</span>
                  <span className="text-sm font-semibold text-primary">{log.target}</span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] py-0 h-4",
                    log.severity === "critical" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                    log.severity === "warning" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                    log.severity === "info" && "border-border"
                  )}>
                    {log.severity}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{log.time} · IP: {log.ip}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs">Details</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Feature Flags
// ============================================================================
function FeatureFlags() {
  const flags = [
    { name: "ai_smart_vendor_assignment", desc: "AI auto-assigns orders to optimal vendors", enabled: true, category: "AI", rollout: "100%" },
    { name: "ai_delay_prediction", desc: "Predicts delayed orders 4+ hours in advance", enabled: true, category: "AI", rollout: "100%" },
    { name: "ai_demand_forecasting", desc: "Forecasts demand by area, day and season", enabled: true, category: "AI", rollout: "100%" },
    { name: "ai_price_estimation", desc: "Real-time price estimation for customers", enabled: true, category: "AI", rollout: "100%" },
    { name: "ai_personalized_recs", desc: "Personalized vendor and service recommendations", enabled: true, category: "AI", rollout: "85%" },
    { name: "express_delivery", desc: "12-hour express delivery option", enabled: true, category: "Customer", rollout: "100%" },
    { name: "subscription_plans", desc: "Monthly subscription plans for customers", enabled: true, category: "Customer", rollout: "50%" },
    { name: "bulk_orders", desc: "Bulk laundry orders for PGs and offices", enabled: true, category: "Customer", rollout: "100%" },
    { name: "whatsapp_notifications", desc: "Send notifications via WhatsApp Business API", enabled: true, category: "Notifications", rollout: "100%" },
    { name: "digital_signature_pod", desc: "Digital signature for proof of delivery", enabled: false, category: "Delivery", rollout: "0%" },
    { name: "multi_city_expansion", desc: "Enable multi-city vendor onboarding", enabled: true, category: "Platform", rollout: "30%" },
    { name: "gst_invoice_auto", desc: "Automatic GST invoice generation", enabled: true, category: "Payments", rollout: "100%" },
    { name: "dark_mode_beta", desc: "Dark mode theme (beta)", enabled: false, category: "UI", rollout: "0%" },
    { name: "loyalty_platinum_tier", desc: "Platinum tier for top customers", enabled: false, category: "Loyalty", rollout: "0%" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Flags" value="14" icon={Flag} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Enabled" value="11" icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Disabled" value="3" icon={XCircle} accent="from-rose-500 to-pink-600" />
        <StatCard label="Beta Rollout" value="2" icon={Eye} accent="from-amber-500 to-orange-600" />
      </div>

      <Card className="shadow-soft">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="font-semibold">All Feature Flags</h3>
          <Button variant="outline" size="sm">
            <Flag className="h-3.5 w-3.5 mr-1.5" />
            New flag
          </Button>
        </div>
        <div className="divide-y divide-border/60">
          {flags.map((f) => (
            <div key={f.name} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                f.enabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-muted text-muted-foreground"
              )}>
                {f.enabled ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">{f.name}</code>
                  <Badge variant="outline" className="text-[9px]">{f.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground">Rollout</p>
                <p className="text-sm font-semibold">{f.rollout}</p>
              </div>
              <Switch
                defaultChecked={f.enabled}
                onCheckedChange={(v) => toast.success(`Feature ${f.name} ${v ? "enabled" : "disabled"}`, { description: "Change is live for all users." })}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Integrations (API Keys & Webhooks)
// ============================================================================
function Integrations() {
  const apiKeys = [
    { name: "Razorpay", key: "rzp_live_••••••••••••4242", status: "active", lastUsed: "2 mins ago", icon: "💳" },
    { name: "Stripe", key: "sk_live_••••••••••••5555", status: "active", lastUsed: "1 hour ago", icon: "💳" },
    { name: "Twilio SMS", key: "AC••••••••••••a1b2", status: "active", lastUsed: "5 mins ago", icon: "📱" },
    { name: "WhatsApp Business", key: "wab_••••••••••••c3d4", status: "active", lastUsed: "10 mins ago", icon: "💬" },
    { name: "Google Maps", key: "AIza••••••••••••e5f6", status: "active", lastUsed: "now", icon: "🗺️" },
    { name: "SendGrid Email", key: "SG.••••••••••••g7h8", status: "active", lastUsed: "30 mins ago", icon: "✉️" },
    { name: "Firebase FCM", key: "AAAA••••••••••••i9j0", status: "active", lastUsed: "1 min ago", icon: "🔔" },
    { name: "OpenAI GLM", key: "glm_••••••••••••k1l2", status: "active", lastUsed: "8 mins ago", icon: "🤖" },
  ];

  const webhooks = [
    { url: "https://api.freshfold.co/webhooks/lh/orders", events: ["order.created", "order.updated", "order.completed"], status: "active", lastDelivery: "2 mins ago" },
    { url: "https://hooks.pristine.co/laundry-home", events: ["payment.success", "refund.issued"], status: "active", lastDelivery: "1 hour ago" },
    { url: "https://erp.royalgarment.in/lh/sync", events: ["vendor.assigned", "status.changed"], status: "active", lastDelivery: "5 mins ago" },
    { url: "https://analytics.quickclean.co/lh", events: ["order.completed"], status: "paused", lastDelivery: "2 days ago" },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              API Keys
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Third-party service credentials</p>
          </div>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Key className="h-3.5 w-3.5 mr-1.5" />
            Add key
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {apiKeys.map((k) => (
            <div key={k.name} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{k.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{k.name}</p>
                  <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">{k.status}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{k.key}</p>
                <p className="text-[10px] text-muted-foreground/70">Last used: {k.lastUsed}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              Webhooks
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Outgoing event webhooks for vendors and partners</p>
          </div>
          <Button size="sm" variant="outline">
            <Plug className="h-3.5 w-3.5 mr-1.5" />
            Add webhook
          </Button>
        </div>
        <div className="space-y-2">
          {webhooks.map((w, i) => (
            <div key={i} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-3 mb-2">
                <code className="text-xs font-mono flex-1 truncate">{w.url}</code>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  w.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                )}>
                  {w.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {w.events.map((e) => (
                  <code key={e} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{e}</code>
                ))}
                <span className="text-[10px] text-muted-foreground ml-auto">Last delivery: {w.lastDelivery}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// System Configuration
// ============================================================================
function SystemConfig() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
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
                <Input defaultValue="Laundry Home" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Support Email</Label>
                <Input defaultValue="support@laundryhome.com" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Support Phone</Label>
                <Input defaultValue="+91 80-4567-8900" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Default Currency</Label>
                <Select defaultValue="inr">
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
                <Select defaultValue="en">
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
                <Select defaultValue="ist">
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
              {[
                { label: "Allow new customer signups", desc: "Customers can self-register", on: true },
                { label: "Allow new vendor applications", desc: "Vendors can apply for onboarding", on: true },
                { label: "Maintenance mode", desc: "Show maintenance page to all users", on: false },
                { label: "Multi-city support", desc: "Enable operations in multiple cities", on: true },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <Switch defaultChecked={s.on} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Payment Configuration</h3>
            <div className="space-y-3">
              {[
                { label: "UPI", desc: "Accept UPI payments", on: true, icon: "📱" },
                { label: "Credit / Debit Cards", desc: "Visa, Mastercard, RuPay", on: true, icon: "💳" },
                { label: "Net Banking", desc: "All major Indian banks", on: true, icon: "🏦" },
                { label: "Wallet", desc: "Laundry Home wallet", on: true, icon: "👛" },
                { label: "Cash on Delivery", desc: "Pay cash when order is delivered", on: true, icon: "💵" },
                { label: "International Cards", desc: "Accept cards issued outside India", on: false, icon: "🌍" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">{p.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <Switch defaultChecked={p.on} />
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">GST Rate (%)</Label>
                <Input defaultValue="18" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Platform Fee (₹)</Label>
                <Input defaultValue="25" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Default Delivery Fee (₹)</Label>
                <Input defaultValue="40" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Min Order Value (₹)</Label>
                <Input defaultValue="150" type="number" className="mt-1.5" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Notification Channels</h3>
            <div className="space-y-3">
              {[
                { label: "Push Notifications", desc: "Mobile push via Firebase FCM", on: true, icon: Bell },
                { label: "SMS", desc: "Via Twilio", on: true, icon: Globe },
                { label: "Email", desc: "Via SendGrid", on: true, icon: Globe },
                { label: "WhatsApp", desc: "Via WhatsApp Business API", on: true, icon: Globe },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <c.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                  <Switch defaultChecked={c.on} />
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notification Events</p>
              {[
                "Booking Confirmation",
                "Vendor Acceptance",
                "Pickup Reminder (15 mins before)",
                "Order Status Changes",
                "Payment Success",
                "Delivery Reminder",
                "Promotional Offers",
                "AI Delay Alerts",
              ].map((e) => (
                <div key={e} className="flex items-center justify-between">
                  <span className="text-sm">{e}</span>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Security Settings</h3>
            <div className="space-y-3">
              {[
                { label: "Require MFA for admins", desc: "All admin users must enable 2FA", on: true },
                { label: "Require MFA for vendors", desc: "Vendors must enable 2FA for payouts", on: false },
                { label: "Session timeout (30 mins)", desc: "Auto-logout after inactivity", on: true },
                { label: "IP whitelist for admin panel", desc: "Restrict admin access to specific IPs", on: false },
                { label: "Device management", desc: "Track and limit devices per user", on: true },
                { label: "JWT refresh token rotation", desc: "Rotate refresh tokens on every use", on: true },
                { label: "Rate limiting on auth APIs", desc: "5 attempts per minute", on: true },
                { label: "Suspicious login alerts", desc: "Email user on login from new device", on: true },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
                  <Switch defaultChecked={s.on} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-4">Limits & Pricing</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Max Items Per Order</Label>
                <Input defaultValue="50" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Max Weight Per Order (kg)</Label>
                <Input defaultValue="30" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Express Surcharge (₹)</Label>
                <Input defaultValue="50" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Express Multiplier</Label>
                <Input defaultValue="1.5" type="number" step="0.1" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Free Delivery Threshold (₹)</Label>
                <Input defaultValue="500" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Max Service Radius (km)</Label>
                <Input defaultValue="10" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Default Commission Rate (%)</Label>
                <Input defaultValue="10" type="number" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">Vendor Payout Cycle (days)</Label>
                <Input defaultValue="7" type="number" className="mt-1.5" />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
