import { useState } from "react";
import { Settings2, CheckCircle2, XCircle, IndianRupee, Download, Percent, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { useFetch } from "@/lib/hooks/use-fetch";
import { StatCard } from "@/components/shared/stat-card";
import { cn, formatINR } from "@/lib/utils";
import { toast } from "sonner";
import type { CommissionRule, CommissionSummary, Settlement } from "./admin-helpers";

export function AdminCommission() {
  const { data: rules, refetch: refetchRules } = useFetch<CommissionRule[]>("/api/admin/commission/rules");
  const { data: summary, refetch: refetchSummary } = useFetch<CommissionSummary>("/api/admin/commission/summary");
  const { data: settlements, refetch: refetchSettlements } = useFetch<Settlement[]>("/api/admin/commission/settlements");
  const [addingRule, setAddingRule] = useState(false);
  const [creatingSettlement, setCreatingSettlement] = useState(false);
  const [newRule, setNewRule] = useState({ type: "fixed", label: "", description: "", rate: 10 });
  const [selVendor, setSelVendor] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState(0);

  const refetchAll = () => { refetchRules(); refetchSummary(); refetchSettlements(); };

  const handleAddRule = async () => {
    try {
      await api.post("/api/admin/commission/rules", newRule);
      toast.success("Rule added");
      setAddingRule(false);
      setNewRule({ type: "fixed", label: "", description: "", rate: 10 });
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to add rule", { description: e.message });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.delete(`/api/admin/commission/rules/${id}`);
      toast.success("Rule removed");
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to delete", { description: e.message });
    }
  };

  const handleEditRule = async (id: string) => {
    try {
      await api.patch(`/api/admin/commission/rules/${id}`, { rate: editRate });
      toast.success("Rate updated");
      setEditingRuleId(null);
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to update", { description: e.message });
    }
  };

  const startEditing = (r: CommissionRule) => {
    setEditRate(r.rate);
    setEditingRuleId(r.id);
  };

  const handleCreateSettlement = async () => {
    if (!selVendor) { toast.error("Select a vendor"); return; }
    const v = (s.vendors || []).find((x: any) => x.id === selVendor);
    if (!v) return;
    const month = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
    try {
      await api.post("/api/admin/commission/settlements", {
        vendorId: v.id, vendorName: v.name, period: month,
        grossRevenue: v.revenue, commission: v.commission, netAmount: v.netAmount,
      });
      toast.success("Settlement record created");
      setCreatingSettlement(false);
      setSelVendor("");
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to create settlement", { description: e.message });
    }
  };

  const handleSettle = async (id: string) => {
    try {
      await api.patch(`/api/admin/commission/settlements/${id}/settle`);
      toast.success("Settlement completed");
      refetchAll();
    } catch (e: any) {
      toast.error("Failed to settle", { description: e.message });
    }
  };

  const s = summary || { totalCommission: 0, pendingSettlements: 0, settled: 0, avgRate: 10, vendors: [] };
  const allSettlements = settlements || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Commission (Month)" value={formatINR(s.totalCommission)} icon={Percent} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Pending Settlements" value={formatINR(s.pendingSettlements)} icon={Clock} accent="from-amber-500 to-orange-600" />
        <StatCard label="Settled This Month" value={formatINR(s.settled)} icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Avg Commission Rate" value={`${s.avgRate}%`} icon={IndianRupee} accent="from-violet-500 to-purple-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Commission rules */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Commission Rules</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAddingRule(!addingRule)}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              {addingRule ? "Cancel" : "Add rule"}
            </Button>
          </div>

          {addingRule && (
            <div className="mb-3 p-3 rounded-lg border border-border/60 space-y-2">
              <input value={newRule.label} onChange={(e) => setNewRule({ ...newRule, label: e.target.value })} placeholder="Rule label" className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none" />
              <input value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} placeholder="Description" className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none" />
              <div className="flex gap-2">
                <select value={newRule.type} onChange={(e) => setNewRule({ ...newRule, type: e.target.value })} className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none">
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                  <option value="promotional">Promotional</option>
                </select>
                <input type="number" value={newRule.rate} onChange={(e) => setNewRule({ ...newRule, rate: +e.target.value })} className="w-20 rounded border border-input bg-background px-2 py-1.5 text-sm outline-none" />
                <Button size="sm" onClick={handleAddRule}>Save</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(rules || []).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <Badge variant="outline" className="text-[10px] capitalize">{r.type}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground">{r.description}</p>
                </div>
                {editingRuleId === r.id ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={editRate} onChange={(e) => setEditRate(+e.target.value)} className="w-16 rounded border border-input bg-background px-1.5 py-1 text-sm text-center outline-none" />
                    <span className="text-sm font-bold text-primary">%</span>
                    <button onClick={() => handleEditRule(r.id)} className="text-emerald-600 hover:text-emerald-700"><CheckCircle2 className="h-4 w-4" /></button>
                    <button onClick={() => setEditingRuleId(null)} className="text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-bold text-primary cursor-pointer hover:text-primary/70" onClick={() => startEditing(r)} title="Click to edit">{r.rate}%</p>
                    <button onClick={() => handleDeleteRule(r.id)} className="text-muted-foreground hover:text-rose-600 transition-colors">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Settlements */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Settlements</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreatingSettlement(!creatingSettlement)}>
                <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
                {creatingSettlement ? "Cancel" : "Create settlement"}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => toast.info("Export", { description: "Download as CSV" })}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {creatingSettlement && (
            <div className="mb-3 p-3 rounded-lg border border-border/60 space-y-2">
              <select value={selVendor} onChange={(e) => setSelVendor(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none">
                <option value="">Select vendor…</option>
                {(s.vendors || []).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} — {formatINR(v.commission)}</option>
                ))}
              </select>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleCreateSettlement}>Create record</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {allSettlements.length === 0 ? (
              (s.vendors || []).slice(0, 5).map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-bold">
                    {v.name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">Commission: {formatINR(v.commission)} · Net: {formatINR(v.netAmount)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">pending</Badge>
                </div>
              ))
            ) : (
              allSettlements.map((st) => (
                <div key={st.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-bold">
                    {st.vendorName?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{st.vendorName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {st.period ? `${st.period} · ` : ""}Commission: {formatINR(st.commission)} · Net: {formatINR(st.netAmount)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    st.status === "settled" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                    st.status === "pending" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                  )}>
                    {st.status}
                  </Badge>
                  {st.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSettle(st.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Settle
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
