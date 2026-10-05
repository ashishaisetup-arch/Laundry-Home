import { createAdminClient } from "./supabase";

const PLATFORM_FEE = 25;
const DELIVERY_FEE = 40;
const EXPRESS_SURCHARGE = 50;
const TAX_RATE = 0.18;
const REWARD_POINTS_RATE = 100;

export interface CartItem {
  serviceId: string;
  itemId?: string;
  qty: number;
  unit?: string;
  express?: boolean;
}

export interface PricingInput {
  items: CartItem[];
  couponCode?: string;
  redeemPoints?: number;
  useWalletAmount?: number;
  userId: string;
  vendorId?: string;
  pickupArea?: string;
  pickupDate?: string;
  pickupSlot?: string;
}

export interface PricingLine {
  serviceId: string;
  itemId: string | null;
  qty: number;
  unitPrice: number;
}

export interface PricingBreakdown {
  subtotal: number;
  couponDiscount: number;
  couponCode?: string;
  subscriptionDiscount: number;
  rewardPointsUsed: number;
  rewardDiscount: number;
  walletUsed: number;
  taxableAmount: number;
  taxes: number;
  platformFee: number;
  deliveryFee: number;
  expressSurcharge: number;
  surgeCharge: number;
  total: number;
  breakdown: {
    label: string;
    amount: number;
  }[];
  lines?: PricingLine[];
}

export interface PricingApplyResult {
  walletApplied: boolean;
  walletAmount: number;
  walletTransactionId: string | null;
  paymentTransactionId: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
}

async function computeSubtotal(items: CartItem[], admin: ReturnType<typeof createAdminClient>, vendorId?: string): Promise<{ subtotal: number; hasExpress: boolean; lines: PricingLine[] }> {
  const itemMasterIds = [...new Set(items.map(i => i.itemId).filter(Boolean) as string[])];
  const serviceIds = [...new Set(items.map(i => i.serviceId).filter(Boolean) as string[])];

  // Service pricing strategy (ITEM / BAG / WEIGHT / FIXED) + bag price
  let serviceMap: Record<string, { pricing_type?: string; bag_price?: number }> = {};
  if (serviceIds.length > 0) {
    const { data: services } = await admin
      .from("services")
      .select("id, pricing_type, bag_price")
      .in("id", serviceIds);
    for (const s of services || []) serviceMap[s.id] = s;
  }

  let defaultMap: Record<string, number> = {};
  if (itemMasterIds.length > 0) {
    const { data: serviceItems } = await admin
      .from("service_items")
      .select("service_id, item_master_id, default_price")
      .in("item_master_id", itemMasterIds);
    for (const si of serviceItems || []) {
      defaultMap[`${si.service_id}|${si.item_master_id}`] = si.default_price;
    }
  }

  let vendorMap: Record<string, number> = {};
  if (vendorId && itemMasterIds.length > 0) {
    const { data: vendorPrices } = await admin
      .from("vendor_service_prices")
      .select("service_id, price, service_items!inner(item_master_id)")
      .eq("vendor_id", vendorId)
      .eq("is_active", true);
    for (const vp of vendorPrices || []) {
      const itemMasterId = (vp as any).service_items?.item_master_id;
      if (itemMasterId) {
        vendorMap[`${vp.service_id}|${itemMasterId}`] = vp.price;
      }
    }
  }

  let subtotal = 0;
  let hasExpress = false;
  const lines: PricingLine[] = [];
  for (const item of items) {
    if (!item.serviceId) continue;
    const key = `${item.serviceId}|${item.itemId || ""}`;
    const svc = serviceMap[item.serviceId] || {};
    const pricingType = svc.pricing_type || "ITEM";
    let unitPrice = 0;
    if (pricingType === "BAG") {
      unitPrice = svc.bag_price || 0;
    } else if (pricingType === "WEIGHT") {
      unitPrice = 0; // reserved — weight-based pricing not implemented yet
    } else {
      unitPrice = vendorMap[key] || defaultMap[key] || 0;
    }
    const multiplier = item.express ? 1.5 : 1;
    subtotal += unitPrice * item.qty * multiplier;
    if (item.express) hasExpress = true;
    lines.push({ serviceId: item.serviceId, itemId: item.itemId || null, qty: item.qty, unitPrice });
  }
  return { subtotal, hasExpress, lines };
}

export async function calculatePricing(input: PricingInput): Promise<PricingBreakdown> {
  const admin = createAdminClient();
  const steps: { label: string; amount: number }[] = [];

  const { subtotal, hasExpress, lines } = await computeSubtotal(input.items, admin, input.vendorId);
  steps.push({ label: "Subtotal", amount: subtotal });
  let remaining = subtotal;

  let couponDiscount = 0;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    const { data: coupon } = await admin
      .from("coupons")
      .select("*")
      .eq("code", code)
      .single();
    if (coupon && coupon.active && remaining >= coupon.min_order) {
      if (coupon.type === "percentage") {
        couponDiscount = Math.min(remaining * coupon.discount_pct / 100, coupon.max_discount);
      } else {
        couponDiscount = Math.min(coupon.max_discount, remaining);
      }
      steps.push({ label: `Coupon (${code})`, amount: -couponDiscount });
    }
  }
  remaining -= couponDiscount;

  let subscriptionDiscount = 0;
  const { data: subscriptions } = await admin
    .from("user_subscriptions")
    .select("*, subscription_plans!inner(savings_pct)")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .limit(1);
  if (subscriptions && subscriptions.length > 0) {
    const savingsPct = (subscriptions[0] as any).subscription_plans?.savings_pct || 0;
    if (savingsPct > 0) {
      subscriptionDiscount = Math.round(remaining * savingsPct / 100);
      steps.push({ label: `Subscription (${savingsPct}% off)`, amount: -subscriptionDiscount });
    }
  }
  remaining -= subscriptionDiscount;

  let rewardPointsUsed = 0;
  let rewardDiscount = 0;
  if (input.redeemPoints && input.redeemPoints > 0) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("loyalty_points")
      .eq("id", input.userId)
      .single();
    const availablePoints = (profile as any)?.loyalty_points || 0;
    const pointsToUse = Math.min(input.redeemPoints, availablePoints);
    rewardDiscount = Math.floor(pointsToUse / REWARD_POINTS_RATE);
    rewardPointsUsed = rewardDiscount * REWARD_POINTS_RATE;
    if (rewardDiscount > 0) {
      steps.push({ label: `Reward Points (${rewardPointsUsed} pts)`, amount: -rewardDiscount });
    }
  }
  remaining -= rewardDiscount;

  const platformFee = PLATFORM_FEE;
  const deliveryFee = DELIVERY_FEE;
  steps.push({ label: "Platform Fee", amount: platformFee });
  steps.push({ label: "Delivery Fee", amount: deliveryFee });

  const expressSurcharge = hasExpress ? EXPRESS_SURCHARGE : 0;
  if (expressSurcharge > 0) {
    steps.push({ label: "Express Surcharge", amount: expressSurcharge });
  }

  let surgeCharge = 0;
  if (input.pickupSlot) {
    const hour = parseInt(input.pickupSlot.split(":")[0]);
    const isPeak = (hour >= 17 && hour <= 20) || (hour >= 8 && hour <= 10);
    if (isPeak) {
      surgeCharge = Math.round(remaining * 0.1);
      steps.push({ label: "Peak Time Surcharge (10%)", amount: surgeCharge });
    }
  }
  if (input.pickupArea) {
    const premiumAreas = ["Indiranagar", "Koramangala", "MG Road", "Whitefield", "Electronic City"];
    if (premiumAreas.includes(input.pickupArea)) {
      const areaSurcharge = Math.round(remaining * 0.05);
      surgeCharge += areaSurcharge;
      steps.push({ label: `Premium Area (${input.pickupArea})`, amount: areaSurcharge });
    }
  }

  const taxableAmount = remaining + platformFee + deliveryFee + expressSurcharge + surgeCharge;
  const taxes = Math.round(taxableAmount * TAX_RATE);
  steps.push({ label: "GST (18%)", amount: taxes });

  const total = taxableAmount + taxes;
  steps.push({ label: "Total", amount: total });

  return {
    subtotal,
    couponDiscount,
    couponCode: input.couponCode,
    subscriptionDiscount,
    rewardPointsUsed,
    rewardDiscount,
    walletUsed: input.useWalletAmount || 0,
    taxableAmount,
    taxes,
    platformFee,
    deliveryFee,
    expressSurcharge,
    surgeCharge,
    total,
    breakdown: steps,
    lines,
  };
}

export async function applyPricingToOrder(
  orderId: string,
  orderCode: string,
  pricing: PricingBreakdown,
  userId: string
): Promise<PricingApplyResult> {
  const admin = createAdminClient();

  const emptyResult: PricingApplyResult = {
    walletApplied: false,
    walletAmount: 0,
    walletTransactionId: null,
    paymentTransactionId: null,
    balanceBefore: null,
    balanceAfter: null,
  };

  if (pricing.rewardPointsUsed > 0) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("loyalty_points")
      .eq("id", userId)
      .single();
    const current = (profile as any)?.loyalty_points || 0;
    if (current >= pricing.rewardPointsUsed) {
      await admin
        .from("user_profiles")
        .update({ loyalty_points: current - pricing.rewardPointsUsed })
        .eq("id", userId);
    }
  }

  let walletResult = emptyResult;

  if (pricing.walletUsed > 0) {
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "apply_order_wallet_payment",
      { p_order_id: orderId, p_amount: pricing.walletUsed }
    );

    if (rpcError) {
      throw new Error(`Wallet payment RPC failed: ${rpcError.message}`);
    }

    if (!rpcResult?.success) {
      if (rpcResult?.error === "insufficient_balance") {
        throw new Error(
          `Insufficient wallet balance: need ₹${pricing.walletUsed}, have ₹${rpcResult.wallet_balance}`
        );
      }
      if (rpcResult?.error === "amount_exceeds_remaining") {
        throw new Error(
          `Amount ₹${pricing.walletUsed} exceeds remaining payable ₹${rpcResult.remaining}`
        );
      }
      throw new Error(`Wallet payment failed: ${rpcResult?.error}`);
    }

    walletResult = {
      walletApplied: true,
      walletAmount: pricing.walletUsed,
      walletTransactionId: rpcResult.wallet_transaction_id || null,
      paymentTransactionId: rpcResult.payment_transaction_id || null,
      balanceBefore: rpcResult.balance_before ?? null,
      balanceAfter: rpcResult.balance_after ?? null,
    };
  }

  if (pricing.couponCode) {
      const { data: coupon } = await admin
        .from("coupons")
        .select("code, used_count")
        .eq("code", pricing.couponCode.toUpperCase())
        .single();
      if (coupon) {
        await admin
          .from("coupons")
          .update({ used_count: (coupon as any).used_count + 1 })
          .eq("code", (coupon as any).code);
      }
  }

  return walletResult;
}
