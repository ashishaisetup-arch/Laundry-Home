import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("wallet_balance, loyalty_points").eq("id", user.id).maybeSingle();
    const { data: transactions } = await admin.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);

    res.json({ balance: profile?.wallet_balance || 0, loyalty_points: profile?.loyalty_points || 0, transactions: transactions || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { amount, method } = req.body;
    const admin = createAdminClient();

    await admin.from("wallet_transactions").insert({
      user_id: user.id, type: "credit", amount, method, description: "Wallet top-up", status: "success",
    });

    const { data: profile } = await admin.from("user_profiles").select("wallet_balance").eq("id", user.id).single();
    const newBalance = (profile?.wallet_balance || 0) + amount;
    await admin.from("user_profiles").update({ wallet_balance: newBalance }).eq("id", user.id);

    res.json({ balance: newBalance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
