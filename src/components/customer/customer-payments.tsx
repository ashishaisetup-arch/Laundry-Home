import { useState } from "react";
import {
  Wallet,
  TrendingUp,
  Ticket,
  Plus,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { usePaymentMethods } from "@/lib/hooks";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

export function CustomerPayments({ walletBalance }: { walletBalance: number }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [balance, setBalance] = useState(walletBalance);
  const { data: paymentMethods } = usePaymentMethods();

  const transactions: Array<{ id: string; desc: string; amount: number; method: string; date: string; status: string }> = [];

  const invoices: Array<{ id: string; code: string; vendor: string; date: string; amount: number; gst: string }> = [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Wallet Balance" value={formatINR(balance)} icon={Wallet} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Total Spent (6mo)" value={formatINR(0)} icon={TrendingUp} accent="from-emerald-500 to-green-600" />
        <StatCard label="Money Saved" value={formatINR(0)} icon={Ticket} accent="from-amber-500 to-orange-600" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions <Badge variant="secondary" className="ml-1.5 text-[10px]">{transactions.length}</Badge></TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="invoices">GST Invoices <Badge variant="secondary" className="ml-1.5 text-[10px]">{invoices.length}</Badge></TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Wallet card */}
            <Card className="lg:col-span-1 p-5 shadow-soft bg-primary-surface text-primary-foreground border-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-white/80">Laundry Home Wallet</p>
                <Wallet className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatINR(balance)}</p>
              <p className="text-xs text-white/70 mt-1">Available balance</p>
              <div className="flex gap-2 mt-5">
                <Button size="sm" className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => setShowTopUp(true)}>
                  Add Money
                </Button>
                <Button size="sm" variant="outline" className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10" onClick={() => setActiveTab("transactions")}>
                  History
                </Button>
              </div>
            </Card>

            {/* Payment methods preview */}
            <Card className="lg:col-span-2 p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Saved Payment Methods</h3>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab("methods")}>View all</Button>
              </div>
              <div className="space-y-2">
                {(paymentMethods || []).map((pm) => (
                  <div key={pm.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
                      {pm.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{pm.type}</p>
                      <p className="text-xs text-muted-foreground">{pm.label}</p>
                    </div>
                    {pm.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions tab */}
        <TabsContent value="transactions" className="mt-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Transaction History</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => toast.success("Statement downloaded", { description: "Your transaction statement has been exported." })}>Download statement</Button>
            </div>
            <div className="space-y-1">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    t.amount > 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                  )}>
                    {t.amount > 0 ? <Plus className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.desc}</p>
                    <p className="text-[11px] text-muted-foreground">{t.method} · {t.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", t.amount > 0 ? "text-emerald-600" : "text-foreground")}>
                      {t.amount > 0 ? "+" : ""}{formatINRDecimal(t.amount)}
                    </p>
                    <Badge variant="outline" className="text-[9px] py-0 h-4 mt-0.5 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Payment Methods tab */}
        <TabsContent value="methods" className="mt-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Saved Payment Methods</h3>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => toast.success("Add payment method", { description: "Payment method form opened." })}>
                <Plus className="h-3.5 w-3.5" />
                Add new
              </Button>
            </div>
            <div className="space-y-2">
              {(paymentMethods || []).map((pm) => (
                <div key={pm.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                    {pm.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{pm.type}</p>
                      {pm.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{pm.label}</p>
                  </div>
                  <div className="flex gap-1">
                    {!pm.isDefault && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success(`${pm.type} set as default`)}>Set default</Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={() => toast.info(`${pm.type} removed`)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Invoices tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card className="p-5 shadow-soft">
            <h3 className="font-semibold mb-3">GST Invoices</h3>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{inv.code} · {inv.vendor}</p>
                    <p className="text-[11px] text-muted-foreground">GSTIN: {inv.gst} · {inv.date}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatINRDecimal(inv.amount)}</p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.success(`Invoice ${inv.code} downloaded`, { description: "GST invoice exported as PDF." })}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top-up dialog */}
      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Add Money to Wallet</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add Money to Wallet</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Current balance: {formatINR(balance)}</p>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="500" className="mt-1" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopUpAmount(amt.toString())}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted hover:border-primary/30 transition-colors"
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowTopUp(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!topUpAmount || Number(topUpAmount) <= 0}
              onClick={async () => {
                const amt = Number(topUpAmount);
                try {
                  await api.post("/api/wallet", { amount: amt, method: "UPI" });
                  setBalance(balance + amt);
                  setTopUpAmount("");
                  setShowTopUp(false);
                  toast.success("Wallet topped up", { description: `${formatINR(amt)} added to your wallet.` });
                } catch (err: any) {
                  toast.error("Top-up failed", { description: err.message });
                }
              }}
            >
              Add {topUpAmount ? formatINR(Number(topUpAmount)) : "Money"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
