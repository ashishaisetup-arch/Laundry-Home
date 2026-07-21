
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
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
  UserCheck,
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { cn, formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useOrderStages, useAuditLogs, useFeatureFlags, useApiKeys, useWebhooks, useUsers, useSystemConfig, useVendors, useRbac } from "@/lib/hooks";
import type { AdminUser } from "@/lib/hooks/useUsers";
import type { SystemConfig } from "@/lib/hooks/useSystemConfig";
import type { RolePermission } from "@/lib/hooks/useRbac";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Super Admin",
    items: [
      { id: "overview", label: "Control Center", icon: "LayoutDashboard" },
      { id: "onboard", label: "Onboard Vendor", icon: "Store", badge: "New" },
      { id: "vendors", label: "Vendors", icon: "Store" },
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
  const { data: users } = useUsers();
  const { data: vendorsList } = useVendors();

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
        {view === "overview" && <SuperAdminOverview key="overview" onOnboard={() => setShowOnboarding(true)} onNavigate={setView} totalUsers={users?.length || 0} totalVendors={vendorsList?.length || 0} />}
        {view === "vendors" && <SuperAdminVendors key="vendors" />}
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
    vendors: "Vendors",
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
    vendors: "All platform vendors · KYC status, approvals and management",
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
function SuperAdminOverview({ onOnboard, onNavigate, totalUsers, totalVendors }: { onOnboard?: () => void; onNavigate?: (v: string) => void; totalUsers?: number; totalVendors?: number }) {
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

// ============================================================================
// Super Admin Vendors
// ============================================================================
function SuperAdminVendors() {
  const { data: vendorsList } = useVendors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const vendors = vendorsList || [];

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.area.toLowerCase().includes(search.toLowerCase()) ||
      v.city.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && v.kycStatus === "approved") ||
      (statusFilter === "pending" && v.kycStatus === "pending") ||
      (statusFilter === "rejected" && v.kycStatus === "rejected");
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, area, city\u2026"
            className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">KYC pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{filteredVendors.length}</strong> of {vendors.length} vendors
        {(search || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="ml-2 text-primary hover:underline">Clear filters</button>
        )}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Vendor</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Location</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Rating</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Orders</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Revenue</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">KYC</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">No vendors found.</td></tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-semibold", v.logoColor)}>
                          {v.logoInitials}
                        </div>
                        <div>
                          <p className="font-medium">{v.name}</p>
                          <p className="text-[11px] text-muted-foreground">Joined {new Date(v.joinedDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{v.area}, {v.city}</td>
                    <td className="p-3 text-center">
                      <span className="font-semibold">{v.rating}\u2605</span>
                      <p className="text-[10px] text-muted-foreground">{v.reviewCount}</p>
                    </td>
                    <td className="p-3 text-center font-medium">{v.totalOrders.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">{formatINR(v.monthlyRevenue)}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        v.kycStatus === "approved" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                        v.kycStatus === "pending" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                        v.kycStatus === "rejected" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                      )}>
                        {v.kycStatus}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className={cn(
                        "flex items-center justify-center gap-1.5 text-xs",
                        v.verified ? "text-emerald-600" : "text-amber-600"
                      )}>
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          v.isOpen ? "bg-emerald-500" : "bg-muted-foreground"
                        )} />
                        {v.isOpen ? "Open" : "Closed"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// RBAC Matrix
// ============================================================================
function RbacMatrix() {
  const { data, loading, togglePermission } = useRbac();
  const [toggling, setToggling] = useState<string | null>(null);

  const RESOURCE_LABELS: Record<string, string> = {
    users: "Users", vendors: "Vendors", orders: "Orders",
    system_config: "System Config", features: "Feature Flags",
    audit_logs: "Audit Logs", integrations: "Integrations",
    rbac: "Roles & Permissions", campaigns: "Campaigns", reports: "Reports",
  };
  const ACTION_LABELS: Record<string, string> = {
    view: "View", create: "Create", edit: "Edit", delete: "Delete", manage: "Manage",
  };

  const handleToggle = async (perm: RolePermission) => {
    setToggling(perm.id);
    try {
      await togglePermission(perm.id, !perm.allowed);
      toast.success(`Permission updated`, {
        description: `${RESOURCE_LABELS[perm.resource] || perm.resource} · ${ACTION_LABELS[perm.action] || perm.action} → ${!perm.allowed ? "allowed" : "denied"}`,
      });
    } catch (err: any) {
      toast.error("Failed to update permission", { description: err.message });
    } finally {
      setToggling(null);
    }
  };

  if (loading && !data) {
    return <Card className="p-8 text-center text-muted-foreground">Loading permissions...</Card>;
  }

  const roles = data?.roles || [];
  const permissions = data?.permissions || [];
  const resources = [...new Set(permissions.map((p) => p.resource))].sort();
  const actions = [...new Set(permissions.map((p) => p.action))].sort();

  return (
    <div className="space-y-4">
      <Card className="shadow-soft overflow-hidden">
        <div className="p-4 border-b border-border/60">
          <h3 className="font-semibold">Permission Matrix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Toggle permissions per role across all resources</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground min-w-[140px]">Resource</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Action</th>
                {roles.map((r) => (
                  <th key={r.name} className="text-center p-3 font-medium text-xs text-muted-foreground min-w-[100px]">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr><td colSpan={2 + roles.length} className="p-8 text-center text-muted-foreground text-sm">No permissions configured.</td></tr>
              ) : (
                resources.map((resource) => (
                  actions.map((action, ai) => {
                    const isFirst = ai === 0;
                    return (
                      <tr key={`${resource}-${action}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        {isFirst && (
                          <td className="p-3 font-medium" rowSpan={actions.length}>
                            {RESOURCE_LABELS[resource] || resource}
                          </td>
                        )}
                        <td className="p-3 text-xs text-muted-foreground">
                          {ACTION_LABELS[action] || action}
                        </td>
                        {roles.map((r) => {
                          const perm = permissions.find((p) => p.role === r.name && p.resource === resource && p.action === action);
                          const allowed = perm?.allowed ?? false;
                          return (
                            <td key={r.name} className="p-3 text-center">
                              {r.name === "superadmin" && action === "manage" ? (
                                <div className="flex items-center justify-center text-emerald-500">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                              ) : perm ? (
                                <button
                                  disabled={toggling === perm.id}
                                  onClick={() => handleToggle(perm)}
                                  className={cn(
                                    "flex items-center justify-center mx-auto w-7 h-7 rounded transition-all",
                                    allowed
                                      ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-950/30"
                                      : "bg-muted text-muted-foreground hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-950/30",
                                    toggling === perm.id && "animate-pulse"
                                  )}
                                >
                                  {allowed ? <Check className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                </button>
                              ) : (
                                <span className="text-muted-foreground/30">&mdash;</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ))
              )}
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
  const { data: users, loading, updateUser } = useUsers();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const roleDisplay: Record<string, string> = {
    customer: "Customer",
    vendor: "Vendor",
    delivery: "Delivery Exec",
    admin: "Admin",
    superadmin: "Super Admin",
  };

  const filteredUsers = (users || []).filter((u) => {
    const matchesSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleToggleStatus = async (userId: string) => {
    const user = (users || []).find((u) => u.id === userId);
    if (!user) return;
    const newStatus = user.status === "active" ? "suspended" : "active";
    try {
      await updateUser(userId, { status: newStatus });
      toast.success(`User ${user.name} ${newStatus}`, {
        description: newStatus === "suspended" ? "They can no longer access the platform." : "Access has been restored.",
      });
    } catch (err: any) {
      toast.error("Failed to update user status", { description: err.message });
    }
  };

  const handleSaveEdit = async (updated: AdminUser) => {
    try {
      await updateUser(updated.id, { name: updated.name, email: updated.email, role: updated.role });
      setEditingUser(null);
      toast.success(`User ${updated.name} updated`, { description: "Changes have been saved." });
    } catch (err: any) {
      toast.error("Failed to update user", { description: err.message });
    }
  };

  const totalUsers = (users || []).length;
  const activeUsers = (users || []).filter((u) => u.status === "active").length;
  const suspendedUsers = (users || []).filter((u) => u.status === "suspended").length;

  return (
    <div className="space-y-4">
      {loading && totalUsers === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Loading users...</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={totalUsers.toLocaleString()} icon={Users} accent="from-teal-500 to-cyan-600" />
            <StatCard label="Active" value={activeUsers.toString()} icon={Activity} accent="from-emerald-500 to-green-600" />
            <StatCard label="Suspended" value={suspendedUsers.toString()} icon={XCircle} accent="from-rose-500 to-pink-600" />
            <StatCard label="New This Week" value={totalUsers > 0 ? `${Math.round(totalUsers * 0.08)}` : "—"} icon={UserCog} accent="from-amber-500 to-orange-600" />
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name, email\u2026"
                className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <strong className="text-foreground">{filteredUsers.length}</strong> of {totalUsers} users
              {(search || roleFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}
                  className="ml-2 text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </span>
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
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                        No users match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
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
                          <Badge variant="outline" className="text-[10px]">{roleDisplay[u.role] || u.role}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={cn(
                            "text-[10px]",
                            u.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30"
                          )}>
                            {u.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "\u2014"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {u.joined ? new Date(u.joined).toLocaleDateString() : "\u2014"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingUser(u)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-7 text-xs", u.status === "active" ? "text-rose-600" : "text-emerald-600")}
                            onClick={() => handleToggleStatus(u.id)}
                          >
                            {u.status === "active" ? "Suspend" : "Reactivate"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <EditUserDialog
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveEdit}
          />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Edit User Dialog
// ============================================================================
function EditUserDialog({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSave: (u: AdminUser) => void;
}) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">Edit User</DialogTitle>
        {user && (
          <EditUserForm key={user.id} user={user} onClose={onClose} onSave={onSave} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (u: AdminUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Edit User</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Update user information and role</p>
      </div>
      <div className="space-y-3 pt-2">
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="delivery">Delivery Exec</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="superadmin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={!name || !email || !role}
          onClick={() => onSave({ ...user, name, email, role })}
        >
          Save Changes
        </Button>
      </div>
    </>
  );
}

// ============================================================================
// Audit Logs
// ============================================================================
function AuditLogs() {
  const { data: logs } = useAuditLogs(20);

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
          {(logs || []).map((log) => {
            const sev = log.action?.includes("suspend") || log.action?.includes("critical") ? "critical" :
              log.action?.includes("update") || log.action?.includes("modify") || log.action?.includes("toggle") ? "warning" : "info";
            const IconComponent = sev === "critical" ? AlertTriangle : sev === "warning" ? Flag : Activity;
            return (
            <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                sev === "critical" && "bg-rose-50 text-rose-600 dark:bg-rose-950/30",
                sev === "warning" && "bg-amber-50 text-amber-600 dark:bg-amber-950/30",
                sev === "info" && "bg-muted text-muted-foreground"
              )}>
                <IconComponent className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{log.userId?.slice(0, 8) || "System"}</span>
                  <span className="text-sm text-muted-foreground">{log.action}</span>
                  <span className="text-sm font-semibold text-primary">{log.resource}</span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] py-0 h-4",
                    sev === "critical" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                    sev === "warning" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                    sev === "info" && "border-border"
                  )}>
                    {sev}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleString()} · IP: {log.ipAddress || "—"}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs">Details</Button>
            </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Feature Flags
// ============================================================================
function FeatureFlags() {
  const { data: flags } = useFeatureFlags();

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
          {(flags || []).map((f) => (
            <div key={f.key} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                f.enabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-muted text-muted-foreground"
              )}>
                {f.enabled ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">{f.key}</code>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.description || f.label}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground">{f.enabled ? "Enabled" : "Disabled"}</p>
              </div>
              <Switch
                defaultChecked={f.enabled}
                onCheckedChange={async (v) => {
                  try {
                    await api.patch(`/api/admin/features/${f.key}`, { enabled: v });
                    toast.success(`Feature ${f.key} ${v ? "enabled" : "disabled"}`, { description: "Change submitted." });
                  } catch (err: any) {
                    toast.error("Failed to toggle", { description: err.message });
                  }
                }}
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
  const { data: apiKeys } = useApiKeys();
  const { data: webhooks } = useWebhooks();
  const keys = apiKeys || [];
  const wh = webhooks || [];

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
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Key className="h-5 w-5 text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{k.name}</p>
                  <Badge variant="outline" className={cn("text-[9px]", k.enabled ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-border")}>{k.enabled ? "active" : "disabled"}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{k.keyValue?.slice(0, 24)}...</p>
                <p className="text-[10px] text-muted-foreground/70">Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</p>
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
          {wh.map((w) => (
            <div key={w.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-3 mb-2">
                <code className="text-xs font-mono flex-1 truncate">{w.url}</code>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  w.enabled ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                )}>
                  {w.enabled ? "active" : "paused"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(w.events || []).map((e: string) => (
                  <code key={e} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{e}</code>
                ))}
                <span className="text-[10px] text-muted-foreground ml-auto">Created: {new Date(w.createdAt).toLocaleDateString()}</span>
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
  const { data: config, loading, saveConfig } = useSystemConfig();
  const [saving, setSaving] = useState(false);

  const [general, setGeneral] = useState<Record<string, any>>({});
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [notifications, setNotifications] = useState<Record<string, any>>({});
  const [notifEvents, setNotifEvents] = useState<Record<string, boolean>>({});
  const [security, setSecurity] = useState<Record<string, any>>({});
  const [limits, setLimits] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config) {
      setGeneral(config.general || {});
      setPayments(config.payments || {});
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

// Small helper components for SystemConfig
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

function PayIconToggle({ label, desc, icon: Icon, checked, onChecked }: { label: string; desc: string; icon: React.ComponentType<{ className?: string }>; checked?: boolean; onChecked: (v: boolean) => void }) {
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
