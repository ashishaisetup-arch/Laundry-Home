import { motion } from "framer-motion";
import { Wallet, Gift, Plus, Navigation, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderCard } from "@/components/shared/order-card";
import { useAppStore } from "@/lib/store";
import { cn, formatINR } from "@/lib/utils";
import { toast } from "sonner";

interface CustomerDashboardProps {
  onTrack: (id: string) => void;
  onBook: () => void;
  onNavigate: (view: string) => void;
  onCancel?: (orderId: string) => void;
}

export function CustomerDashboard({ onTrack, onBook, onNavigate, onCancel }: CustomerDashboardProps) {
  const { userName, walletBalance, loyaltyPoints, orders } = useAppStore();
  const firstName = userName.split(" ")[0];
  const activeOrders = (orders || []).filter((o) => !["completed", "cancelled"].includes(o.status));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 md:p-8 bg-primary-surface text-primary-foreground border-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/80">Good afternoon,</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {firstName} 👋
              </h2>
              <p className="text-sm text-white/80 mt-1">
                You have <strong>{activeOrders.length} active orders</strong> · Next delivery today at 8:00 PM
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[110px]">
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <Wallet className="h-3.5 w-3.5" />
                  Wallet
                </div>
                <p className="text-lg font-bold mt-0.5">{formatINR(walletBalance)}</p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur p-3 min-w-[110px]">
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <Gift className="h-3.5 w-3.5" />
                  Loyalty
                </div>
                <p className="text-lg font-bold mt-0.5">{loyaltyPoints} pts</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Book Pickup", icon: Plus, color: "from-teal-500 to-cyan-600", onClick: onBook },
          { label: "Track Order", icon: Navigation, color: "from-emerald-500 to-green-600", onClick: () => activeOrders[0] ? onTrack(activeOrders[0].id) : toast("No active orders") },
          { label: "Find Vendors", icon: MapPin, color: "from-violet-500 to-purple-600", onClick: () => onNavigate("discover") },
          { label: "Offers", icon: Ticket, color: "from-amber-500 to-orange-600", onClick: () => onNavigate("coupons") },
        ].map((a) => (
          <motion.button
            key={a.label}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={a.onClick}
            className="text-left"
          >
            <Card className="p-4 shadow-soft hover:shadow-lift transition-shadow">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white mb-2.5", a.color)}>
                <a.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">{a.label}</p>
            </Card>
          </motion.button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Orders
          </h3>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => onNavigate("orders")}>View all</Button>
        </div>
        {activeOrders.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {activeOrders.slice(0, 2).map((order) => (
              <OrderCard key={order.id} order={order} onClick={() => onTrack(order.id)} onCancel={onCancel} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-medium">No active orders</p>
            <p className="text-sm mt-1">Place your first order to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
}
