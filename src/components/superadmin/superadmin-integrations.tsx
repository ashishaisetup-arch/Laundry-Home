import { Key, Plug, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApiKeys, useWebhooks } from "@/lib/hooks";

export function Integrations() {
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
