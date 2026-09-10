import { useState, useRef, useCallback, useEffect } from "react";
import {
  Wallet,
  TrendingUp,
  Ticket,
  Plus,
  ArrowRight,
  FileText,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePaymentSummary,
  useTransactions,
  useInvoices,
  usePaymentMethods,
  useCreateTopupOrder,
  useVerifyTopupPayment,
} from "@/lib/hooks";
import type { PaymentTransactionFilters } from "@/lib/hooks";
import { cn, formatINR, formatINRDecimal } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// Razorpay script deduplication
// ============================================================================

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
  prefill?: Record<string, string>;
  theme?: Record<string, string>;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

// ============================================================================
// Constants
// ============================================================================

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2000];
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 25000;

// ============================================================================
// Loading skeleton
// ============================================================================

function PaymentPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <Card className="p-5 shadow-soft">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full mt-4" />
      </Card>
    </div>
  );
}

// ============================================================================
// Error state
// ============================================================================

function PaymentPageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <Card className="p-8 shadow-soft text-center">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h3 className="font-semibold text-lg">Failed to load payments</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Something went wrong while fetching your payment data.
        </p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </Card>
    </div>
  );
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function CustomerPayments() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [txFilters, setTxFilters] = useState<PaymentTransactionFilters>({ page: 1, limit: 20 });
  const [invoicePage, setInvoicePage] = useState(1);

  // Idempotency key: one per logical top-up intent, reset only on success/deliberate cancel
  const idempotencyKeyRef = useRef<string | null>(null);

  const getOrCreateIdempotencyKey = useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  }, []);

  const resetTopupIntent = useCallback(() => {
    idempotencyKeyRef.current = null;
  }, []);

  // Duplicate toast guard for Razorpay failure/dismiss
  const paymentFailedRef = useRef(false);

  // Data hooks
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = usePaymentSummary();

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useTransactions(txFilters);

  const {
    data: invoiceData,
    isLoading: invoiceLoading,
    error: invoiceError,
    refetch: refetchInvoice,
  } = useInvoices(invoicePage);

  const { data: paymentMethods } = usePaymentMethods();

  // Mutations
  const createTopupOrder = useCreateTopupOrder();
  const verifyTopupPayment = useVerifyTopupPayment();

  // Reset idempotency key when dialog closes (only on successful close or deliberate cancel)
  useEffect(() => {
    if (!showTopUp) {
      resetTopupIntent();
      paymentFailedRef.current = false;
    }
  }, [showTopUp, resetTopupIntent]);

  const isLoading = summaryLoading;
  const hasError = summaryError || txError || invoiceError;

  const handleRetry = useCallback(() => {
    refetchSummary();
    refetchTx();
    refetchInvoice();
  }, [refetchSummary, refetchTx, refetchInvoice]);

  const handleOpenTopUp = useCallback(() => {
    setTopUpAmount("");
    setShowTopUp(true);
  }, []);

  const handleTopUp = useCallback(async () => {
    const amt = Number(topUpAmount);
    if (isNaN(amt) || amt < MIN_AMOUNT || amt > MAX_AMOUNT) {
      toast.error("Invalid amount", {
        description: `Amount must be between ${formatINR(MIN_AMOUNT)} and ${formatINR(MAX_AMOUNT)}.`,
      });
      return;
    }

    const idempotencyKey = getOrCreateIdempotencyKey();
    paymentFailedRef.current = false;

    try {
      const order = await createTopupOrder.mutateAsync({ amount: amt, idempotencyKey });

      if (!order.success) {
        if (order.error === "payment processing in progress" || order.error === "status uncertain") {
          toast.info("Payment processing", {
            description: "Your payment is being processed. Please wait a moment.",
          });
          return;
        }
        toast.error("Failed to create order", { description: order.error });
        resetTopupIntent();
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Payment gateway unavailable", {
          description: "Could not load Razorpay. Please try again.",
        });
        resetTopupIntent();
        return;
      }

      const options: RazorpayOptions = {
        key: order.publicKeyId,
        order_id: order.razorpayOrderId,
        amount: Math.round(order.amount * 100), // rupees → paise
        currency: order.currency,
        name: "Laundry Home",
        description: "Wallet Top-up",
        handler: async (response: RazorpayResponse) => {
          try {
            const result = await verifyTopupPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transaction_id: order.transactionId,
            });

            if (result.success) {
              toast.success("Top-up successful", {
                description: `${formatINR(amt)} added to your wallet.`,
              });
              resetTopupIntent();
              setShowTopUp(false);
            } else if (result.alreadyCredited) {
              toast.info("Already credited", {
                description: "This payment was already processed.",
              });
              resetTopupIntent();
              setShowTopUp(false);
            } else {
              toast.error("Verification failed", { description: result.error });
            }
          } catch {
            toast.error("Verification failed", {
              description: "Payment was made but verification failed. Contact support.",
            });
          }
        },
        modal: {
          ondismiss: () => {
            if (!paymentFailedRef.current) {
              toast.info("Payment cancelled", {
                description: "No amount was charged.",
              });
            }
            resetTopupIntent();
            setShowTopUp(false);
          },
        },
      };

      new window.Razorpay(options).open();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Payment failed", { description: message });
      if (
        !message.includes("processing") &&
        !message.includes("uncertain")
      ) {
        resetTopupIntent();
      }
    }
  }, [
    topUpAmount,
    getOrCreateIdempotencyKey,
    resetTopupIntent,
    createTopupOrder,
    verifyTopupPayment,
  ]);

  // Razorpay failure handler — suppresses duplicate toast from dismiss callback
  const handleRazorpayFailure = useCallback(() => {
    paymentFailedRef.current = true;
    toast.error("Payment failed", { description: "No amount was charged. Please try again." });
  }, []);

  if (isLoading) return <PaymentPageSkeleton />;
  if (hasError) return <PaymentPageError onRetry={handleRetry} />;

  const walletBalance = summary?.walletBalance ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Wallet Balance" value={formatINR(walletBalance)} icon={Wallet} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Total Spent (6mo)" value={formatINR(summary?.totalSpentSixMonths ?? 0)} icon={TrendingUp} accent="from-emerald-500 to-green-600" />
        <StatCard label="Money Saved" value={formatINR(summary?.moneySaved ?? 0)} icon={Ticket} accent="from-amber-500 to-orange-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {summary?.transactionCount ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="invoices">
            GST Invoices
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {summary?.invoiceCount ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1 p-5 shadow-soft bg-primary-surface text-primary-foreground border-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-white/80">Laundry Home Wallet</p>
                <Wallet className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatINR(walletBalance)}</p>
              <p className="text-xs text-white/70 mt-1">Available balance</p>
              <div className="flex gap-2 mt-5">
                <Button size="sm" className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0" onClick={handleOpenTopUp}>
                  Add Money
                </Button>
                <Button size="sm" variant="outline" className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10" onClick={() => setActiveTab("transactions")}>
                  History
                </Button>
              </div>
            </Card>

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
            </div>
            {txLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (txData?.transactions ?? []).length === 0 ? (
              <EmptyState message="No transactions yet" />
            ) : (
              <div className="space-y-1">
                {txData?.transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      t.type === "credit" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                    )}>
                      {t.type === "credit" ? <Plus className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description ?? t.type}</p>
                      <p className="text-[11px] text-muted-foreground">{t.method ?? "—"} · {t.createdAt}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-semibold", t.type === "credit" ? "text-emerald-600" : "text-foreground")}>
                        {t.type === "credit" ? "+" : "-"}{formatINRDecimal(t.amount)}
                      </p>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 mt-0.5">
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Payment Methods tab */}
        <TabsContent value="methods" className="mt-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Saved Payment Methods</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => toast.info("Payment method management coming soon")}
              >
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
            {invoiceLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (invoiceData?.invoices ?? []).length === 0 ? (
              <EmptyState message="No invoices yet" />
            ) : (
              <div className="space-y-2">
                {invoiceData?.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{inv.invoiceNumber} {inv.vendorName ? `· ${inv.vendorName}` : ""}</p>
                      <p className="text-[11px] text-muted-foreground">{inv.invoiceDate}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatINRDecimal(inv.totalAmount)}</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                      PDF not available
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top-up dialog */}
      <Dialog open={showTopUp} onOpenChange={setShowTopUp}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Add Money to Wallet</DialogTitle>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Add Money to Wallet</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Current balance: {formatINR(walletBalance)}</p>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="500"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {PRESET_AMOUNTS.map((amt) => (
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
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                resetTopupIntent();
                setShowTopUp(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={
                !topUpAmount ||
                Number(topUpAmount) < MIN_AMOUNT ||
                Number(topUpAmount) > MAX_AMOUNT ||
                createTopupOrder.isPending
              }
              onClick={handleTopUp}
            >
              {createTopupOrder.isPending ? "Processing..." : `Add ${topUpAmount ? formatINR(Number(topUpAmount)) : "Money"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
