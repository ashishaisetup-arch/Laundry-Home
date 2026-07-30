import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCoupons } from "@/lib/hooks";
import { formatINR } from "@/lib/utils";

export function CustomerCoupons({ loyaltyPoints }: { loyaltyPoints: number }) {
  const { data: coupons } = useCoupons();
  const couponsData = coupons || [];
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Loyalty card */}
      <Card className="relative overflow-hidden p-6 shadow-soft bg-tonal text-foreground border-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-5 w-5" />
              <p className="text-sm font-semibold">Laundry Home Rewards</p>
            </div>
            <p className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {loyaltyPoints} <span className="text-xl font-medium">pts</span>
            </p>
            <p className="text-sm text-white/80 mt-1">
              You&apos;re <strong>{5000 - loyaltyPoints} pts</strong> away from <strong>Platinum tier</strong>
            </p>
          </div>
          <div className="w-full md:w-48">
            <div className="flex justify-between text-[10px] text-white/70 mb-1">
              <span>Gold</span>
              <span>Platinum</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${(loyaltyPoints / 5000) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Coupons grid */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Available Coupons</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {couponsData.map((c) => (
            <motion.div key={c.code} whileHover={{ y: -2 }}>
              <Card className="overflow-hidden shadow-soft hover:shadow-lift transition-shadow">
                <div className="relative bg-primary-surface p-4 text-white">
                  <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-white/20" />
                  <p className="text-[10px] uppercase tracking-wider text-white/80 mb-1">Use code</p>
                  <p className="text-2xl font-bold font-mono tracking-tight">{c.code}</p>
                  <p className="text-sm mt-1">{c.description}</p>
                </div>
                <div className="p-4">
                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    <p>Min order: <strong className="text-foreground">{formatINR(c.minOrder)}</strong></p>
                    {c.type === "percentage" ? (
                      <p>Discount: <strong className="text-foreground">{c.discountPct}% off (max {formatINR(c.maxDiscount)})</strong></p>
                    ) : (
                      <p>Discount: <strong className="text-foreground">{formatINR(c.maxDiscount)} off</strong></p>
                    )}
                    <p>Expires: <strong className="text-foreground">{new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={copiedCode === c.code ? "secondary" : "outline"}
                    onClick={() => {
                      setCopiedCode(c.code);
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                  >
                    {copiedCode === c.code ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Copied!</>
                    ) : (
                      <>Apply coupon</>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
