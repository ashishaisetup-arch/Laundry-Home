import { Router, Request, Response } from "express";
import { createAdminClient, createServerClientWithCookies } from "../supabase";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const admin = createAdminClient();
    const limit = parseInt(req.query.limit as string) || 50;
    const { data, error } = await admin.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json((data || []).reverse());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = createAdminClient();
    const { data, error } = await admin.from("chat_messages").insert({ ...req.body, user_id: user.id }).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/ask", async (req: Request, res: Response) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { content } = req.body;
    if (!content) { res.status(400).json({ error: "Message content is required" }); return; }

    const admin = createAdminClient();

    // Save user message
    await admin.from("chat_messages").insert({ role: "user", content, user_id: user.id }).select().single();

    // Get user profile for context
    const { data: profiles } = await admin.from("user_profiles").select("name, role").eq("id", user.id).limit(1);
    const profile = profiles?.[0];
    const userName = profile?.name || "User";
    const userRole = profile?.role || "customer";

    // Generate contextual response
    const lower = content.toLowerCase();
    let reply = "";

    if (/\border\b/.test(lower) && /(status|track|where|follow|update)/.test(lower)) {
      const { data: orders } = await admin
        .from("orders")
        .select("code, status, total, created_at, pickup_area, vendor_name")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (orders && orders.length > 0) {
        reply = `Here are your recent orders:\n${orders.map((o: any, i: number) =>
          `${i + 1}. **${o.code}** — ${o.status.replace(/_/g, " ")} (₹${o.total}) at ${o.pickup_area || "—"}`
        ).join("\n")}`;
      } else {
        reply = "You don't have any orders yet. Head to **Book Pickup** to place your first order!";
      }
    } else if (/(vendor|laundromat|shop|store|service)/.test(lower) && /(near|find|list|show|available)/.test(lower)) {
      const { data: vendors } = await admin
        .from("vendors")
        .select("name, area, rating, is_open")
        .eq("verified", true)
        .limit(10);
      if (vendors && vendors.length > 0) {
        const open = vendors.filter((v: any) => v.is_open);
        reply = `We have **${vendors.length} verified vendors**. Currently **${open.length}** are open:\n${
          vendors.slice(0, 6).map((v: any) =>
            `• **${v.name}** — ${v.area || "—"} ${v.is_open ? "🟢 Open" : "🔴 Closed"} ${v.rating ? "★" + v.rating : ""}`
          ).join("\n")
        }${vendors.length > 6 ? `\n…and ${vendors.length - 6} more.` : ""}`;
      } else {
        reply = "No vendors are currently available in your area. Check back soon!";
      }
    } else if (/(price|cost|rate|how much|pricing|charges)/.test(lower)) {
      const { data: services } = await admin.from("services").select("name, base_price, unit").limit(10);
      if (services && services.length > 0) {
        reply = `Our pricing:\n${services.map((s: any) =>
          `• **${s.name}** — ₹${s.base_price}/${s.unit || "item"}`
        ).join("\n")}\n\n*Prices may vary by vendor. Check the booking page for exact quotes.*`;
      } else {
        reply = "Visit the **Book Pickup** page to see service pricing in your area.";
      }
    } else if (/(wallet|balance|money|payment|pay)/.test(lower)) {
      const { data: wallets } = await admin.from("wallets").select("balance, points").eq("user_id", user.id).limit(1);
      const wallet = wallets?.[0];
      if (wallet) {
        reply = `Your wallet balance is **₹${wallet.balance || 0}** with **${wallet.points || 0} loyalty points**.`;
      } else {
        reply = "You don't have a wallet yet. It will be created when you make your first payment.";
      }
    } else if (/(help|hi|hello|hey)/.test(lower)) {
      reply = `Hello **${userName}**! 👋 I can help you with:\n• **Track orders** — say "order status"\n• **Find vendors** — say "nearby vendors"\n• **Check pricing** — say "pricing"\n• **Wallet balance** — say "my balance"\n\nWhat would you like to know?`;
    } else {
      const { data: recentOrders } = await admin
        .from("orders")
        .select("code, status")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const recentOrder = recentOrders?.[0];
      reply = `Thanks for reaching out, **${userName}**! I can check order status, find vendors, show pricing, or help with your wallet.\n\n${
        recentOrder ? `Your most recent order **${recentOrder.code}** is **${recentOrder.status.replace(/_/g, " ")}**.` : ""
      }\n\nHow can I assist you today?`;
    }

    // Save AI reply
    const { data: saved } = await admin.from("chat_messages").insert({
      role: "assistant",
      content: reply,
      user_id: user.id,
    }).select().single();

    res.json({ reply: saved?.content || reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
