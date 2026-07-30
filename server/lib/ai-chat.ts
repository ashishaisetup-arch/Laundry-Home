import OpenAI from "openai";
import { createAdminClient } from "../supabase";

const SYSTEM_PROMPT = `You are a helpful customer support assistant for Laundry Home, a laundry pickup & delivery service.
You help customers track orders, find nearby vendors, check pricing, and manage their wallet.
Be concise, friendly, and use emojis sparingly.
When you need real data, call the appropriate function — never make up order status or pricing.
Available functions:
- getOrderStatus(customerId): returns recent orders
- searchVendors(area?): returns nearby vendors
- checkWalletBalance(userId): returns wallet + loyalty points
- trackDelivery(orderCode): returns delivery task status`;

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export class AIChatService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async chat(userId: string, userName: string, userRole: string, content: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return this.fallbackReply(userId, userName, userRole, content);
    }

    try {
      const client = this.getClient();
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "getOrderStatus",
              description: "Get recent order status for a customer",
              parameters: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] },
            },
          },
          {
            type: "function",
            function: {
              name: "searchVendors",
              description: "Search for nearby vendors",
              parameters: { type: "object", properties: { area: { type: "string" } } },
            },
          },
          {
            type: "function",
            function: {
              name: "checkWalletBalance",
              description: "Check wallet balance and loyalty points",
              parameters: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] },
            },
          },
          {
            type: "function",
            function: {
              name: "trackDelivery",
              description: "Track a delivery by order code",
              parameters: { type: "object", properties: { orderCode: { type: "string" } }, required: ["orderCode"] },
            },
          },
        ],
        tool_choice: "auto",
        max_tokens: 500,
      });

      const choice = completion.choices[0];
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        const toolResults: string[] = [];
        for (const tc of choice.message.tool_calls) {
          const fnCall = tc as any;
          const fnName = fnCall.function?.name || "";
          let args: Record<string, any> = {};
          try { args = JSON.parse(fnCall.function?.arguments || "{}"); } catch { args = {}; }
          const result = await this.executeTool(fnName, args, userId);
          toolResults.push(`${fnName} returned: ${JSON.stringify(result)}`);
        }

        const followUp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
            { role: "assistant", content: choice.message.content || "", tool_calls: choice.message.tool_calls as any },
            ...toolResults.map((r) => ({ role: "tool" as const, tool_call_id: choice.message.tool_calls![0].id, content: r })),
          ],
          max_tokens: 500,
        });

        return followUp.choices[0].message.content || "Let me check that for you...";
      }

      return choice.message.content || "I'm not sure I understand. Can you rephrase that?";
    } catch {
      return this.fallbackReply(userId, userName, userRole, content);
    }
  }

  private async executeTool(name: string, args: Record<string, any>, userId: string): Promise<any> {
    const admin = createAdminClient();
    switch (name) {
      case "getOrderStatus": {
        const customerId = args.customerId || userId;
        const { data } = await admin
          .from("orders")
          .select("code, status, total, created_at, pickup_area, vendor_name")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(5);
        return data || [];
      }
      case "searchVendors": {
        let query = admin.from("vendors").select("name, area, rating, is_open, city").eq("verified", true).limit(10);
        if (args.area) query = query.ilike("area", `%${args.area}%`);
        const { data } = await query;
        return (data || []).map((v: any) => ({ name: v.name, area: v.area, rating: v.rating, open: v.is_open, city: v.city }));
      }
      case "checkWalletBalance": {
        const targetId = args.userId || userId;
        const { data } = await admin.from("user_profiles").select("wallet_balance, loyalty_points").eq("id", targetId).limit(1);
        return data?.[0] || { wallet_balance: 0, loyalty_points: 0 };
      }
      case "trackDelivery": {
        const { data } = await admin
          .from("delivery_tasks")
          .select("status, created_at, updated_at, delivery_otp")
          .eq("order_id", args.orderCode)
          .maybeSingle();
        return data || { status: "not_found" };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async fallbackReply(userId: string, userName: string, _userRole: string, content: string): Promise<string> {
    const admin = createAdminClient();
    const lower = content.toLowerCase();

    if (/\border\b/.test(lower) && /(status|track|where)/.test(lower)) {
      const { data: orders } = await admin
        .from("orders")
        .select("code, status, total, pickup_area")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (orders && orders.length > 0) {
        return `Here are your recent orders:\n${orders.map((o: any, i: number) =>
          `${i + 1}. **${o.code}** — ${o.status.replace(/_/g, " ")} (₹${o.total}) at ${o.pickup_area || "—"}`
        ).join("\n")}`;
      }
      return "You don't have any orders yet.";
    }

    if (/(vendor|laundromat|shop|store)/.test(lower) && /(near|find|list)/.test(lower)) {
      const { data: vendors } = await admin.from("vendors").select("name, area, rating, is_open").eq("verified", true).limit(6);
      if (vendors && vendors.length > 0) {
        return vendors.map((v: any) =>
          `• **${v.name}** — ${v.area || "—"} ${v.is_open ? "\ud83d\udfe2" : "\ud83d\udd34"} ${v.rating ? "\u2b50" + v.rating : ""}`
        ).join("\n");
      }
      return "No vendors available right now.";
    }

    if (/(wallet|balance|money)/.test(lower)) {
      const { data: profiles } = await admin.from("user_profiles").select("wallet_balance, loyalty_points").eq("id", userId).limit(1);
      const w = profiles?.[0];
      return `Your wallet balance is **₹${w?.wallet_balance || 0}** with **${w?.loyalty_points || 0} loyalty points**.`;
    }

    return `Hello **${userName}**! I can help you track orders, find vendors, check pricing, or manage your wallet. What would you like to know?`;
  }
}

export const aiChat = new AIChatService();
