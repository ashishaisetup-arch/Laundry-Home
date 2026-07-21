import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";

const router = Router();

function getConfig(supabase: ReturnType<typeof createAdminClient>) {
  return supabase
    .from("system_config")
    .select("config")
    .eq("id", 1)
    .single()
    .then((r) => (r.data?.config as any) || {});
}

function saveConfig(supabase: ReturnType<typeof createAdminClient>, config: any) {
  return supabase.from("system_config").update({ config }).eq("id", 1);
}

const DEFAULT_RULES = [
  { id: "default-1", type: "fixed", label: "Standard rate", description: "Applies to all vendors by default", rate: 10, priority: 0, active: true },
  { id: "default-2", type: "percentage", label: "Premium vendor rate", description: "Vendors with rating > 4.7", rate: 8, priority: 1, active: true },
  { id: "default-3", type: "percentage", label: "New vendor rate", description: "First 3 months after onboarding", rate: 5, priority: 2, active: true },
  { id: "default-4", type: "promotional", label: "Weekend promo", description: "Fri-Sun, until 31 Jul", rate: 7, priority: 3, active: true },
];

// ── Commission Rules (stored in system_config JSON) ──

async function ensureRules(supabase: ReturnType<typeof createAdminClient>) {
  const config = await getConfig(supabase);
  const existing = config.commission?.rules;
  if (existing && Array.isArray(existing) && existing.length > 0) return config;
  config.commission = { ...(config.commission || {}), rules: DEFAULT_RULES };
  await saveConfig(supabase, config);
  return config;
}

router.get("/rules", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    res.json(config.commission?.rules || DEFAULT_RULES);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    const rules = (config.commission?.rules || []).filter((r: any) => r.id && !r.id.startsWith("default-"));
    const newRule = { id: crypto.randomUUID(), ...req.body, active: true };
    rules.push(newRule);
    config.commission = { ...(config.commission || {}), rules };
    const { error } = await saveConfig(supabase, config);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(newRule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/rules/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    const rules = config.commission?.rules || [];
    const idx = rules.findIndex((r: any) => r.id === req.params.id);
    if (idx === -1) { res.status(404).json({ error: "Rule not found" }); return; }
    rules[idx] = { ...rules[idx], ...req.body };
    config.commission = { ...(config.commission || {}), rules };
    const { error } = await saveConfig(supabase, config);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(rules[idx]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    let rules = (config.commission?.rules || []).filter((r: any) => r.id !== req.params.id);
    config.commission = { ...(config.commission || {}), rules };
    const { error } = await saveConfig(supabase, config);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Settlements (stored in system_config JSON) ──

router.get("/settlements", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    res.json(config.commission?.settlements || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/settlements", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    const settlements = config.commission?.settlements || [];
    const st = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: new Date().toISOString() };
    settlements.unshift(st);
    config.commission = { ...(config.commission || {}), settlements };
    const { error } = await saveConfig(supabase, config);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(st);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/settlements/:id/settle", async (req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    const settlements = config.commission?.settlements || [];
    const idx = settlements.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) { res.status(404).json({ error: "Settlement not found" }); return; }
    settlements[idx].status = "settled";
    settlements[idx].settledAt = new Date().toISOString();
    config.commission = { ...(config.commission || {}), settlements };
    const { error } = await saveConfig(supabase, config);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json(settlements[idx]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Commission Summary (computed from live vendor data) ──

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const supabase = createAdminClient();
    const { data: vendors, error: vErr } = await supabase
      .from("vendors")
      .select("id, name, monthly_revenue, rating, logo_initials, logo_color");
    if (vErr) { res.status(500).json({ error: vErr.message }); return; }

    const totalMonthlyRevenue = (vendors || []).reduce((s, v) => s + (v.monthly_revenue || 0), 0);
    const totalCommission = Math.round(totalMonthlyRevenue * 0.1);

    const config = await getConfig(supabase);
    const settlements = config.commission?.settlements || [];
    const settledFromDb = settlements.filter((s: any) => s.status === "settled").reduce((sum: number, s: any) => sum + (s.commission || 0), 0);
    const pendingSettlements = Math.max(0, totalCommission - settledFromDb);

    res.json({
      totalCommission,
      pendingSettlements,
      settled: settledFromDb,
      avgRate: 10,
      vendors: (vendors || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        logoInitials: v.logo_initials,
        logoColor: v.logo_color,
        revenue: v.monthly_revenue || 0,
        commission: Math.round((v.monthly_revenue || 0) * 0.1),
        netAmount: Math.round((v.monthly_revenue || 0) * 0.9),
        status: "pending",
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
