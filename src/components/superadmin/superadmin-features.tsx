import { Flag, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useFeatureFlags } from "@/lib/hooks";

export function FeatureFlags() {
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
