import { useState } from "react";
import { Check, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRbac } from "@/lib/hooks";
import type { RolePermission } from "@/lib/hooks/useRbac";

export function RbacMatrix() {
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
