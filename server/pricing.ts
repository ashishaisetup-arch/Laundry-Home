import { createAdminClient } from "./supabase";

const PLATFORM_FEE = 25;
const DELIVERY_FEE = 40;
const EXPRESS_SURCHARGE = 50;
const TAX_RATE = 0.18;
const REWARD_POINTS_RATE = 100; // 100 points = ₹1

const SERVICES: Record<string, { basePrice: number; pricingType: string; expressMultiplier: number }> = {
  wash_fold:      { basePrice: 60,  pricingType: "per_kg",   expressMultiplier: 1.5 },
  wash_iron:      { basePrice: 15,  pricingType: "per_piece", expressMultiplier: 1.5 },
  dry_cleaning:   { basePrice: 120, pricingType: "per_piece", expressMultiplier: 1.8 },
  steam_ironing:  { basePrice: 18,  pricingType: "per_piece", expressMultiplier: 1.6 },
  premium_care:   { basePrice: 250, pricingType: "per_piece", expressMultiplier: 2 },
  delicate_care:  { basePrice: 180, pricingType: "per_piece", expressMultiplier: 1.8 },
  shoe_cleaning:  { basePrice: 149, pricingType: "per_piece", expressMultiplier: 1.5 },
  blanket:        { basePrice: 199, pricingType: "per_piece", expressMultiplier: 1.4 },
  curtain:        { basePrice: 220, pricingType: "per_piece", expressMultiplier: 1.4 },
  carpet:         { basePrice: 499, pricingType: "per_piece", expressMultiplier: 1.3 },
  bulk:           { basePrice: 45,  pricingType: "per_kg",   expressMultiplier: 1.2 },
};

export interface CartItem {
  serviceKey: string;
  serviceName?: string;
  qty: number;
  unit?: string;
  unitPrice?: number;
  express?: boolean;
}

export interface PricingInput {
  items: CartItem[];
  couponCode?: string;
  redeemPoints?: number;
  useWalletAmount?: number;
  userId: string;
  pickupArea?: string;
  pickupDate?: string;
  pickupSlot?: string;
}

export interface PricingBreakdown {
  subtotal: number;
  couponDiscount: number;
  couponCode?: string;
  subscriptionDiscount: number;
  rewardPointsUsed: number;
  rewardDiscount: number;
  walletUsed: number;
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
}

function computeSubtotal(items: CartItem[]): { subtotal: number; hasExpress: boolean } {
  let subtotal = 0;
  let hasExpress = false;
  for (const item of items) {
    const svc = SERVICES[item.serviceKey];
    if (!svc) continue;
    const price = svc.basePrice * item.qty;
    const multiplier = item.express ? svc.expressMultiplier : 1;
    subtotal += price * multiplier;
    if (item.express) hasExpress = true;
  }
  return { subtotal, hasExpress };
}

export async function calculatePricing(input: PricingInput): Promise<PricingBreakdown> {
  const admin = createAdminClient();
  const steps: { label: string; amount: number }[] = [];

  // 1. Subtotal
  const { subtotal, hasExpress } = computeSubtotal(input.items);
  steps.push({ label: "Subtotal", amount: subtotal });
  let remaining = subtotal;

  // 2. Coupon discount
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

  // 3. Subscription discount
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

  // 4. Reward points
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

  // 5. Platform & delivery fees
  const platformFee = PLATFORM_FEE;
  const deliveryFee = DELIVERY_FEE;
  steps.push({ label: "Platform Fee", amount: platformFee });
  steps.push({ label: "Delivery Fee", amount: deliveryFee });

  // 6. Express surcharge
  const expressSurcharge = hasExpress ? EXPRESS_SURCHARGE : 0;
  if (expressSurcharge > 0) {
    steps.push({ label: "Express Surcharge", amount: expressSurcharge });
  }

  // 7. Surge charge
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

  // 8. Tax (GST 18% on subtotal minus discounts, plus fees and surcharges)
  const taxableAmount = remaining + platformFee + deliveryFee + expressSurcharge + surgeCharge;
  const taxes = Math.round(taxableAmount * TAX_RATE);
  steps.push({ label: "GST (18%)", amount: taxes });

  // 9. Total
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
    taxes,
    platformFee,
    deliveryFee,
    expressSurcharge,
    surgeCharge,
    total,
    breakdown: steps,
  };
}

export async function applyPricingToOrder(orderData: any, pricing: PricingBreakdown, userId: string) {
  const admin = createAdminClient();

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

  if (pricing.walletUsed > 0) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("wallet_balance")
      .eq("id", userId)
      .single();
    const balance = (profile as any)?.wallet_balance || 0;
    if (balance >= pricing.walletUsed) {
      await admin
        .from("user_profiles")
        .update({ wallet_balance: balance - pricing.walletUsed })
        .eq("id", userId);
      await admin
        .from("wallet_transactions")
        .insert({
          user_id: userId,
          amount: -pricing.walletUsed,
          type: "debit",
          description: `Payment for order ${orderData.code}`,
        });
    }
  }

  if (pricing.couponCode) {
    const { data: coupon } = await admin
      .from("coupons")
      .select("id, used_count")
      .eq("code", pricing.couponCode.toUpperCase())
      .single();
    if (coupon) {
      await admin
        .from("coupons")
        .update({ used_count: (coupon as any).used_count + 1 })
        .eq("id", (coupon as any).id);
    }
  }
}
