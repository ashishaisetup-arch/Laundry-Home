import { Search, RefreshCw, ScrollText, AlertTriangle, Flag, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import { useAuditLogs } from "@/lib/hooks";

export function AuditLogs() {
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
