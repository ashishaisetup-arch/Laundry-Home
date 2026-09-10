import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

// ============================================================================
// GET /api/wallet
// Returns wallet balance, loyalty points, and recent transactions.
// ============================================================================

router.get("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("wallet_balance, loyalty_points")
      .eq("id", user.id)
      .maybeSingle();

    const { data: transactions } = await admin
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    res.json({
      balance: profile?.wallet_balance || 0,
      loyaltyPoints: profile?.loyalty_points || 0,
      transactions: transactions || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/wallet (DISABLED)
// Direct wallet funding is no longer allowed for security reasons.
// Use POST /api/payments/wallet/topup/create-order instead.
//
// PHASE 1 DEPLOYMENT NOTE:
// The existing frontend (customer-payments.tsx) calls this endpoint.
// It will now receive a 405 until Phase 2 replaces the caller with
// the proper Razorpay checkout flow.
// ============================================================================

router.post("/", async (_req: Request, res: Response) => {
  res.status(405).json({
    error: "Direct wallet top-up is disabled. Use /api/payments/wallet/topup/create-order instead.",
  });
});

export default router;
