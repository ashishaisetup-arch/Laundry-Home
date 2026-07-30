import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function VendorDashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      <Card className="p-5 shadow-lift">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-bold">
              YC
            </div>
            <div>
              <p className="text-sm font-semibold">Your Company Name</p>
              <p className="text-[10px] text-muted-foreground">Vendor dashboard</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">● Live</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground">Today&apos;s Revenue</p>
            <p className="text-lg font-bold">₹0</p>
            <p className="text-[10px] text-emerald-600">Start receiving orders</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] text-muted-foreground">Orders Today</p>
            <p className="text-lg font-bold">0</p>
            <p className="text-[10px] text-emerald-600">0 pending</p>
          </div>
        </div>

        {/* Mini chart */}
        <div className="rounded-lg bg-muted/30 p-3 mb-3">
          <p className="text-[10px] text-muted-foreground mb-2">Weekly revenue</p>
          <div className="flex items-end gap-1.5 h-16">
            {[5, 10, 8, 15, 20, 12, 18].map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-teal-500 to-cyan-400"
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-muted-foreground">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground text-center py-2">No active orders yet</p>
        </div>
      </Card>
    </motion.div>
  );
}
