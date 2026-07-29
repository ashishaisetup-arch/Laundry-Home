import { Megaphone, Percent, Mail, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCampaigns } from "@/lib/hooks";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminMarketing() {
  const { data: campaigns } = useCampaigns();
  const c = campaigns || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={c.length.toString()} icon={Megaphone} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Coupons Redeemed" value={c.reduce((s, x) => s + (x.conversions || 0), 0).toLocaleString()} icon={Percent} accent="from-emerald-500 to-green-600" />
        <StatCard label="Email Open Rate" value="42.8%" change={3.1} trend="up" icon={Mail} accent="from-violet-500 to-purple-600" />
        <StatCard label="Push CTR" value="8.4%" change={1.2} trend="up" icon={Bell} accent="from-amber-500 to-orange-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Active Campaigns</h3>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => toast.success("New campaign", { description: "Campaign builder opened." })}>
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              New Campaign
            </Button>
          </div>
          <div className="space-y-2">
            {c.map((camp) => (
              <div key={camp.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{camp.title}</p>
                  <p className="text-[11px] text-muted-foreground">{camp.type} · Reach: {(camp.reach || 0).toLocaleString()} · Conversions: {(camp.conversions || 0).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px]", camp.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30")}>
                  {camp.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold mb-3">Notification Channels</h3>
          <p className="text-sm text-muted-foreground text-center py-4">No channel data available</p>
        </Card>
      </div>
    </div>
  );
}
