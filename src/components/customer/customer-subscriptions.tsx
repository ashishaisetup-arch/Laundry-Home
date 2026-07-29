import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Wallet,
  Gift,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSubscriptionPlans } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

export function CustomerSubscriptions() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState<string | null>(null);
  const { data: plans, loading } = useSubscriptionPlans();

  const handleSubscribe = async (plan: { id: string; name: string }) => {
    try {
      await api.post("/api/subscriptions", {
        plan_id: plan.id,
        billing_interval: billing,
      });
      setSubscribed(plan.name);
      toast.success(`Subscribed to ${plan.name}!`, {
        description: `Your ${billing} plan is now active. Welcome to hassle-free laundry.`,
      });
    } catch (err: any) {
      toast.error("Subscription failed", { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscribed banner */}
      {subscribed && (
        <Card className="p-4 shadow-soft bg-tonal-accent border-primary/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">You&apos;re subscribed to {subscribed}</p>
              <p className="text-xs text-muted-foreground">Your plan is active. Manage or cancel anytime from Payments.</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSubscribed(null)}>Cancel plan</Button>
          </div>
        </Card>
      )}

      {/* Billing toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Choose your plan</h3>
          <p className="text-sm text-muted-foreground">Save 17% with annual billing. Cancel anytime.</p>
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              billing === "monthly" ? "bg-background shadow-soft" : "text-muted-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-all flex items-center gap-1.5",
              billing === "yearly" ? "bg-background shadow-soft" : "text-muted-foreground"
            )}
          >
            Yearly
            <Badge variant="secondary" className="text-[9px] py-0 h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              −17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 shadow-soft animate-pulse">
              <div className="h-11 w-11 rounded-xl bg-muted mb-3" />
              <div className="h-5 w-24 bg-muted rounded mb-2" />
              <div className="h-3 w-40 bg-muted rounded mb-4" />
              <div className="h-8 w-20 bg-muted rounded mb-4" />
              <div className="h-9 w-full bg-muted rounded mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => <div key={j} className="h-3 w-full bg-muted rounded" />)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
      <div className="grid md:grid-cols-3 gap-4">
        {(plans || []).map((plan) => {
          const isSelected = selectedPlan === plan.name;
          const isSubscribed = subscribed === plan.name;
          return (
            <motion.div
              key={plan.id}
              whileHover={{ y: -4 }}
              className={cn(plan.popular && "md:-mt-4")}
              onClick={() => setSelectedPlan(plan.name)}
            >
              <Card className={cn(
                "relative overflow-hidden p-6 shadow-soft transition-all cursor-pointer",
                plan.popular && !isSelected && "shadow-lift ring-2 ring-primary",
                isSelected && "ring-2 ring-primary shadow-lift",
                isSubscribed && "ring-2 ring-emerald-400"
              )}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                    ★ MOST POPULAR
                  </div>
                )}
                {isSubscribed && (
                  <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg">
                    ✓ ACTIVE
                  </div>
                )}
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-3", plan.color)}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold">{plan.name}</h4>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                <div className="mt-4 mb-4">
                  <span className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                    ₹{billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                  </span>
                  <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "month" : "year"}</span>
                </div>
                <Button
                  className={cn("w-full", isSubscribed ? "bg-emerald-500 hover:bg-emerald-600" : plan.popular || isSelected ? "bg-primary hover:bg-primary/90" : "")}
                  variant={plan.popular || isSelected ? "default" : "outline"}
                  disabled={isSubscribed}
                  onClick={(e) => { e.stopPropagation(); handleSubscribe(plan); }}
                >
                  {isSubscribed ? "✓ Subscribed" : isSelected ? `Subscribe to ${plan.name}` : `Choose ${plan.name}`}
                </Button>
                <Separator className="my-4" />
                <ul className="space-y-2">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Comparison / FAQ */}
      <Card className="p-5 shadow-soft">
        <h3 className="font-semibold mb-3">Why subscribe?</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Wallet, title: "Save up to 35%", desc: "Compared to pay-per-order pricing" },
            { icon: Zap, title: "Priority service", desc: "Skip the queue with priority pickups" },
            { icon: Gift, title: "Bonus rewards", desc: "2×–5× loyalty points boost" },
          ].map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/30">
                <b.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
