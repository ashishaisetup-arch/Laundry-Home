import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.post("/create-order", async (req: Request, res: Response) => {
  try {
    const { amount, currency, order_id } = req.body;
    if (!amount || !order_id) { res.status(400).json({ error: "amount and order_id are required" }); return; }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      res.status(503).json({ error: "Payment gateway not configured", fallback: true });
      return;
    }

    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: currency || "INR",
        receipt: order_id,
        payment_capture: 1,
      }),
    });

    const data = await response.json();
    if (!response.ok) { res.status(response.status).json({ error: data.error?.description || "Razorpay error" }); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing payment verification fields" });
      return;
    }

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const crypto = await import("crypto");
    const expectedSig = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }

    const admin = createAdminClient();
    const update: Record<string, any> = {
      payment_status: "paid",
      razorpay_payment_id,
      razorpay_order_id,
    };

    if (order_id) {
      await admin.from("orders").update(update).eq("id", order_id);
    }

    res.json({ success: true, payment_id: razorpay_payment_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/wallet/add", async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) { res.status(400).json({ error: "Valid amount required" }); return; }

    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = createAdminClient();
    await admin.rpc("add_wallet_funds" as any, { user_id: user.id, amount });

    await admin.from("wallet_transactions").insert({
      user_id: user.id,
      type: "credit",
      amount,
      description: "Wallet top-up via payment gateway",
    });

    const { data: profile } = await admin.from("user_profiles").select("wallet_balance").eq("id", user.id).single();
    res.json({ balance: profile?.wallet_balance || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
