import { motion } from "framer-motion";
import { Package, Sparkles } from "lucide-react";

export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[300px]">
      <div className="relative rounded-[2.5rem] border-8 border-foreground/90 bg-foreground/90 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-background">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2 text-[10px] font-semibold bg-background">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span>●●●</span>
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>

          {/* App content */}
          <div className="p-4 space-y-3 bg-aurora">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Good morning</p>
                <p className="text-sm font-bold">You 👋</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-surface text-primary-foreground text-[10px] font-bold">
                LH
              </div>
            </div>

            {/* Active order card */}
            <div className="rounded-2xl bg-white dark:bg-card p-3 shadow-soft">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-primary">LIVE ORDER</span>
                <span className="text-[10px] text-muted-foreground">LH-0000</span>
              </div>
              <p className="text-xs font-semibold mb-2">Wash & Fold + Iron</p>
              <div className="space-y-1.5">
                {["○ Pickup", "○ Sorting", "○ Washing", "○ Ironing", "○ Delivery"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className={s.startsWith("✓") ? "text-emerald-500" : s.startsWith("●") ? "text-primary font-bold" : "text-muted-foreground"}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: ["10%", "55%", "55%"] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5">ETA: Today, 8:00 PM</p>
            </div>

            {/* Service chips */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { e: "🫧", n: "Wash & Fold", p: "₹60/kg" },
                { e: "👔", n: "Iron", p: "₹15/pc" },
                { e: "✨", n: "Dry Clean", p: "₹120/pc" },
              ].map((s) => (
                <div key={s.n} className="rounded-xl bg-white dark:bg-card p-2 text-center shadow-soft">
                  <div className="text-lg">{s.e}</div>
                  <p className="text-[9px] font-semibold mt-0.5">{s.n}</p>
                  <p className="text-[8px] text-muted-foreground">{s.p}</p>
                </div>
              ))}
            </div>

            {/* Book button */}
            <button className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-semibold py-2.5">
              Book new pickup →
            </button>
          </div>
        </div>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-24 bg-foreground/90 rounded-b-2xl" />
      </div>

      {/* Floating badges */}
      <motion.div
        className="absolute -left-12 top-20 rounded-xl bg-white dark:bg-card p-2.5 shadow-lift"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-emerald-500" />
          <div>
            <p className="text-[9px] font-semibold">Picked up!</p>
            <p className="text-[8px] text-muted-foreground">2 mins ago</p>
          </div>
        </div>
      </motion.div>
      <motion.div
        className="absolute -right-8 bottom-32 rounded-xl bg-white dark:bg-card p-2.5 shadow-lift"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <div>
            <p className="text-[9px] font-semibold">AI suggests</p>
            <p className="text-[8px] text-muted-foreground">Best vendor · 4.8★</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
