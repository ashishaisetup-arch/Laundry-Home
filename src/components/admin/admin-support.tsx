import { useState } from "react";
import { AlertTriangle, Headphones, IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { useSupportTickets } from "@/lib/hooks";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminSupport() {
  const { data: tickets } = useSupportTickets();
  const [activeTab, setActiveTab] = useState("open");

  const all = tickets || [];
  const openTickets = all.filter((t) => t.status === "open");
  const refundTickets = all.filter((t) => (t.description || "").toLowerCase().includes("refund"));
  const escalatedTickets = all.filter((t) => t.status === "escalated");
  const resolvedTickets = all.filter((t) => t.status === "resolved");

  const handleAssign = async (ticketId: string) => {
    try {
      await api.patch(`/api/support/tickets/${ticketId}`, { assignedTo: "Admin" });
      toast.success("Ticket assigned to Admin");
    } catch (err: any) {
      toast.error("Failed to assign", { description: err.message });
    }
  };

  const handleResolve = async (ticketId: string) => {
    try {
      await api.patch(`/api/support/tickets/${ticketId}`, { status: "resolved" });
      toast.success("Ticket resolved");
    } catch (err: any) {
      toast.error("Failed to resolve", { description: err.message });
    }
  };

  const renderTicket = (t: NonNullable<typeof tickets>[0]) => (
    <Card key={t.id} className="p-4 shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
          t.priority === "high" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30" :
          t.priority === "medium" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30" :
          "bg-muted text-muted-foreground"
        )}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold">#{t.id.slice(0, 8)}</span>
            <Badge variant="outline" className={cn(
              "text-[9px] py-0 h-4",
              t.priority === "high" ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30" :
              t.priority === "medium" ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30" :
              "border-border"
            )}>
              {t.priority}
            </Badge>
            {t.status === "escalated" && (
              <Badge variant="outline" className="text-[9px] py-0 h-4 border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-950/30">
                escalated
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium mt-0.5">{t.subject}</p>
          <p className="text-xs text-muted-foreground">{t.assignedTo || "Unassigned"} · {new Date(t.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {t.assignedTo ? (
            <Badge variant="secondary" className="text-[10px]">{t.assignedTo}</Badge>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAssign(t.id)}>
              Assign
            </Button>
          )}
          {t.status !== "resolved" && (
            <Button size="sm" className="bg-primary hover:bg-primary/90 h-7" onClick={() => handleResolve(t.id)}>
              Resolve
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Tickets" value={openTickets.length.toString()} icon={Headphones} accent="from-amber-500 to-orange-600" />
        <StatCard label="Pending Refunds" value={refundTickets.length.toString()} icon={IndianRupee} accent="from-rose-500 to-pink-600" />
        <StatCard label="Avg Response" value="4 mins" change={-12} trend="down" invertTrend icon={Clock} accent="from-emerald-500 to-green-600" />
        <StatCard label="Resolution Rate" value="94.2%" change={2.1} trend="up" icon={CheckCircle2} accent="from-teal-500 to-cyan-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open">Open Tickets <Badge variant="secondary" className="ml-1.5 text-[10px]">{openTickets.length}</Badge></TabsTrigger>
          <TabsTrigger value="refunds">Refunds <Badge variant="secondary" className="ml-1.5 text-[10px]">{refundTickets.length}</Badge></TabsTrigger>
          <TabsTrigger value="escalated">Escalated <Badge variant="secondary" className="ml-1.5 text-[10px]">{escalatedTickets.length}</Badge></TabsTrigger>
          <TabsTrigger value="resolved">Resolved <Badge variant="secondary" className="ml-1.5 text-[10px]">{resolvedTickets.length}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4 space-y-2">
          {openTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No open tickets. All caught up!</Card>
          ) : openTickets.map(renderTicket)}
        </TabsContent>
        <TabsContent value="refunds" className="mt-4 space-y-2">
          {refundTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No refund requests.</Card>
          ) : refundTickets.map(renderTicket)}
        </TabsContent>
        <TabsContent value="escalated" className="mt-4 space-y-2">
          {escalatedTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No escalated tickets.</Card>
          ) : escalatedTickets.map(renderTicket)}
        </TabsContent>
        <TabsContent value="resolved" className="mt-4 space-y-2">
          {resolvedTickets.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm shadow-soft">No resolved tickets yet.</Card>
          ) : resolvedTickets.map(renderTicket)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
