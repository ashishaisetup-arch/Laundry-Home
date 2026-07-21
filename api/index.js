"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/api-entry.ts
var api_entry_exports = {};
__export(api_entry_exports, {
  default: () => api_entry_default
});
module.exports = __toCommonJS(api_entry_exports);

// server/app.ts
var import_express38 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_cookie_parser = __toESM(require("cookie-parser"));

// server/supabase.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_ssr = require("@supabase/ssr");
function env(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}
function createAdminClient() {
  return (0, import_supabase_js.createClient)(env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
function createServerClientWithCookies(cookieGetter, cookieSetter, cookieRemover) {
  return (0, import_ssr.createServerClient)(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_ANON_KEY"), {
    cookieOptions: { secure: false },
    cookies: {
      get(name) {
        return cookieGetter(name);
      },
      set(name, value, options) {
        cookieSetter?.(name, value, options);
      },
      remove(name) {
        cookieRemover?.(name);
      }
    }
  });
}

// server/middleware/auth.ts
var protectedRoutes = /* @__PURE__ */ new Set([
  "/api/orders",
  "/api/addresses",
  "/api/reviews",
  "/api/delivery-tasks",
  "/api/notifications",
  "/api/wallet"
]);
async function authMiddleware(req, res, next) {
  const pathname = req.path;
  const needsProtection = Array.from(protectedRoutes).some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/services") && !pathname.startsWith("/api/coupons") && !pathname.startsWith("/api/vendors") && !pathname.startsWith("/api/slots") && !pathname.startsWith("/api/seed") && !pathname.startsWith("/api/admin") && !pathname.startsWith("/api/vendor") && !pathname.startsWith("/api/subscriptions/plans") && !pathname.startsWith("/api/geocode");
  if (!needsProtection) return next();
  try {
    const cookieGetter = (name) => {
      const val = req.cookies?.[name];
      if (!val && name !== "sb-zuayfacnytoougyvvvcl-auth-token" && !name.startsWith("sb-zuayfacnytoougyvvvcl-auth-token.")) {
      }
      return val;
    };
    const supabase = createServerClientWithCookies(cookieGetter);
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    if (getUserError) {
      console.error("getUser error:", getUserError.message);
    }
    if (!user) {
      console.log("Auth fail:", {
        cookies: req.cookies ? Object.keys(req.cookies) : "no cookies",
        authCookie: req.cookies?.["sb-zuayfacnytoougyvvvcl-auth-token"] ? "exists" : "missing"
      });
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// server/routes/addresses.ts
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = req.body;
    const admin = createAdminClient();
    if (body.is_default) {
      await admin.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }
    const { data, error } = await admin.from("addresses").insert({ ...body, user_id: user.id }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { error } = await admin.from("addresses").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var addresses_default = router;

// server/routes/auth.ts
var import_express2 = require("express");
var router2 = (0, import_express2.Router)();
router2.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" })
    );
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }
    res.json({ session: data.session, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/signup", async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: role || "customer" }
    });
    if (error) {
      if (error.message?.toLowerCase().includes("already registered")) {
        const { data: users } = await supabase.auth.admin.listUsers();
        const existing = (users?.users || []).find((u) => u.email === email);
        if (existing) {
          const profileUpdates = {};
          if (name) profileUpdates.name = name;
          if (phone) profileUpdates.phone = phone;
          if (role) profileUpdates.role = role;
          if (Object.keys(profileUpdates).length > 0) {
            try {
              await supabase.from("user_profiles").update(profileUpdates).eq("id", existing.id);
            } catch {
            }
          }
          res.json({ user: { id: existing.id } });
          return;
        }
      }
      res.status(400).json({ error: error.message });
      return;
    }
    if (phone && data.user) {
      try {
        await supabase.from("user_profiles").update({ phone }).eq("id", data.user.id);
      } catch {
      }
    }
    res.status(201).json({ user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/logout", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      void 0,
      (name) => res.clearCookie(name, { path: "/" })
    );
    await supabase.auth.signOut();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/session", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" })
    );
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      res.status(401).json({ error: sessionError.message });
      return;
    }
    if (!session) {
      res.json({ user: null, session: null });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.json({ user: null, session: null });
      return;
    }
    const admin = createAdminClient();
    let { data: profile } = await admin.from("user_profiles").select("*").eq("id", user.id).single();
    if (!profile) {
      const meta = user.user_metadata || {};
      const name = meta.name || user.email?.split("@")[0] || "User";
      const { data: newProfile, error: insertErr } = await admin.from("user_profiles").insert({
        id: user.id,
        role: meta.role || "customer",
        name,
        email: user.email || "",
        phone: user.phone || meta.phone || "",
        avatar: meta.avatar || ""
      }).select().single();
      if (!insertErr) profile = newProfile;
    }
    res.json({ session, user, profile: profile || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/otp", async (req, res) => {
  try {
    const { phone } = req.body;
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" })
    );
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.patch("/profile", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies(
      (name2) => req.cookies?.[name2],
      (name2, value, options) => res.cookie(name2, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name2) => res.clearCookie(name2, { path: "/" })
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { name, phone, email } = req.body;
    const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (name !== void 0) updates.name = name;
    if (phone !== void 0) updates.phone = phone;
    if (email !== void 0) updates.email = email;
    const admin = createAdminClient();
    const { error } = await admin.from("user_profiles").update(updates).eq("id", user.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const { data: profile } = await admin.from("user_profiles").select("*").eq("id", user.id).single();
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/callback", (req, res) => {
  const host = req.headers.host || "localhost:8080";
  const proto = req.headers["x-forwarded-proto"] || "http";
  const base = `${proto}://${host}`;
  res.redirect(`${base}/?${new URLSearchParams(req.query).toString()}`);
});
var auth_default = router2;

// server/routes/orders.ts
var import_express3 = require("express");

// server/pricing.ts
var PLATFORM_FEE = 25;
var DELIVERY_FEE = 40;
var EXPRESS_SURCHARGE = 50;
var TAX_RATE = 0.18;
var REWARD_POINTS_RATE = 100;
var SERVICES = {
  wash_fold: { basePrice: 60, pricingType: "per_kg", expressMultiplier: 1.5 },
  wash_iron: { basePrice: 15, pricingType: "per_piece", expressMultiplier: 1.5 },
  dry_cleaning: { basePrice: 120, pricingType: "per_piece", expressMultiplier: 1.8 },
  steam_ironing: { basePrice: 18, pricingType: "per_piece", expressMultiplier: 1.6 },
  premium_care: { basePrice: 250, pricingType: "per_piece", expressMultiplier: 2 },
  delicate_care: { basePrice: 180, pricingType: "per_piece", expressMultiplier: 1.8 },
  shoe_cleaning: { basePrice: 149, pricingType: "per_piece", expressMultiplier: 1.5 },
  blanket: { basePrice: 199, pricingType: "per_piece", expressMultiplier: 1.4 },
  curtain: { basePrice: 220, pricingType: "per_piece", expressMultiplier: 1.4 },
  carpet: { basePrice: 499, pricingType: "per_piece", expressMultiplier: 1.3 },
  bulk: { basePrice: 45, pricingType: "per_kg", expressMultiplier: 1.2 }
};
function computeSubtotal(items) {
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
async function calculatePricing(input) {
  const admin = createAdminClient();
  const steps = [];
  const { subtotal, hasExpress } = computeSubtotal(input.items);
  steps.push({ label: "Subtotal", amount: subtotal });
  let remaining = subtotal;
  let couponDiscount = 0;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    const { data: coupon } = await admin.from("coupons").select("*").eq("code", code).single();
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
  const { data: subscriptions } = await admin.from("user_subscriptions").select("*, subscription_plans!inner(savings_pct)").eq("user_id", input.userId).eq("status", "active").limit(1);
  if (subscriptions && subscriptions.length > 0) {
    const savingsPct = subscriptions[0].subscription_plans?.savings_pct || 0;
    if (savingsPct > 0) {
      subscriptionDiscount = Math.round(remaining * savingsPct / 100);
      steps.push({ label: `Subscription (${savingsPct}% off)`, amount: -subscriptionDiscount });
    }
  }
  remaining -= subscriptionDiscount;
  let rewardPointsUsed = 0;
  let rewardDiscount = 0;
  if (input.redeemPoints && input.redeemPoints > 0) {
    const { data: profile } = await admin.from("user_profiles").select("loyalty_points").eq("id", input.userId).single();
    const availablePoints = profile?.loyalty_points || 0;
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
    const isPeak = hour >= 17 && hour <= 20 || hour >= 8 && hour <= 10;
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
    taxes,
    platformFee,
    deliveryFee,
    expressSurcharge,
    surgeCharge,
    total,
    breakdown: steps
  };
}
async function applyPricingToOrder(orderData, pricing, userId) {
  const admin = createAdminClient();
  if (pricing.rewardPointsUsed > 0) {
    const { data: profile } = await admin.from("user_profiles").select("loyalty_points").eq("id", userId).single();
    const current = profile?.loyalty_points || 0;
    if (current >= pricing.rewardPointsUsed) {
      await admin.from("user_profiles").update({ loyalty_points: current - pricing.rewardPointsUsed }).eq("id", userId);
    }
  }
  if (pricing.walletUsed > 0) {
    const { data: profile } = await admin.from("user_profiles").select("wallet_balance").eq("id", userId).single();
    const balance = profile?.wallet_balance || 0;
    if (balance >= pricing.walletUsed) {
      await admin.from("user_profiles").update({ wallet_balance: balance - pricing.walletUsed }).eq("id", userId);
      await admin.from("wallet_transactions").insert({
        user_id: userId,
        amount: -pricing.walletUsed,
        type: "debit",
        description: `Payment for order ${orderData.code}`
      });
    }
  }
  if (pricing.couponCode) {
    const { data: coupon } = await admin.from("coupons").select("id, used_count").eq("code", pricing.couponCode.toUpperCase()).single();
    if (coupon) {
      await admin.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);
    }
  }
}

// server/routes/orders.ts
var KNOWN_AREAS = {
  "Indiranagar": { lat: 12.9719, lng: 77.6413 },
  "Koramangala": { lat: 12.9352, lng: 77.6245 },
  "HSR Layout": { lat: 12.9116, lng: 77.6389 },
  "Jayanagar": { lat: 12.925, lng: 77.5938 },
  "BTM Layout": { lat: 12.9166, lng: 77.6101 },
  "Whitefield": { lat: 12.9698, lng: 77.75 },
  "MG Road": { lat: 12.975, lng: 77.6067 },
  "Marathahalli": { lat: 12.9591, lng: 77.6974 },
  "Electronic City": { lat: 12.8399, lng: 77.677 },
  "JP Nagar": { lat: 12.9063, lng: 77.5857 },
  "Horamavu": { lat: 13.0208, lng: 77.6583 },
  "Hebbal": { lat: 13.0358, lng: 77.597 },
  "Banashankari": { lat: 12.925, lng: 77.5468 },
  "Rajajinagar": { lat: 12.99, lng: 77.5527 },
  "Malleshwaram": { lat: 13.0031, lng: 77.571 },
  "Basavanagudi": { lat: 12.94, lng: 77.57 },
  "Yeshwanthpur": { lat: 13.02, lng: 77.545 },
  "Vijay Nagar": { lat: 12.97, lng: 77.53 },
  "RT Nagar": { lat: 13.02, lng: 77.595 },
  "Kengeri": { lat: 12.91, lng: 77.48 }
};
var STAGES = [
  "placed",
  "vendor_assigned",
  "vendor_accepted",
  "pickup_scheduled",
  "pickup_completed",
  "laundry_received",
  "sorting",
  "tagging",
  "washing",
  "drying",
  "ironing",
  "dry_cleaning",
  "quality_inspection",
  "packing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
  "completed"
];
var router3 = (0, import_express3.Router)();
router3.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    const deliveryExecutiveId = req.query.deliveryExecutiveId;
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 20;
    const isAdminQuery = req.query.admin === "true";
    const user = req.user;
    let customerId = req.query.customerId;
    if (!customerId && user && !vendorId && !deliveryExecutiveId && !isAdminQuery) customerId = user.id;
    const admin = createAdminClient();
    let query = admin.from("orders").select("*").limit(limit).order("created_at", { ascending: false });
    if (customerId) query = query.eq("customer_id", customerId);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (deliveryExecutiveId) query = query.eq("delivery_executive_id", deliveryExecutiveId);
    if (status) query = query.eq("status", status);
    console.log("[orders] GET", { vendorId, deliveryExecutiveId, customerId, status, limit, isAdminQuery });
    const { data, error } = await query;
    if (error) {
      console.error("[orders] DB error:", error.message);
      res.status(500).json({ error: error.message });
      return;
    }
    console.log("[orders] returning", data?.length || 0, "orders");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/pricing", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const pricing = await calculatePricing({
      items: req.body.items || [],
      couponCode: req.body.couponCode,
      redeemPoints: req.body.redeemPoints,
      useWalletAmount: req.body.useWalletAmount,
      userId: user.id,
      pickupArea: req.body.pickupArea || req.body.pickup_area,
      pickupDate: req.body.pickupDate || req.body.pickup_date,
      pickupSlot: req.body.pickupSlot || req.body.pickup_slot
    });
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = req.body;
    const adminClient = createAdminClient();
    const code = `LH-${Date.now().toString(36).toUpperCase()}`;
    const hasVendor = body.vendor_id && body.vendor_id !== "00000000-0000-0000-0000-000000000001" && body.vendor_id !== "00000000-0000-0000-0000-000000000002";
    let vendorName = body.vendor_name || "Vendor";
    let vendorLogoInitials = body.vendor_logo_initials || "";
    let vendorLogoColor = body.vendor_logo_color || "bg-primary-surface";
    if (hasVendor) {
      const { data: vendor } = await adminClient.from("vendors").select("name, logo_initials, logo_color").eq("id", body.vendor_id).single();
      if (vendor) {
        vendorName = vendor.name;
        vendorLogoInitials = vendor.logo_initials;
        vendorLogoColor = vendor.logo_color;
      }
    }
    const pickupAreaKey = body.pickup_area;
    const pickupCoords = KNOWN_AREAS[pickupAreaKey];
    const vendorAreaKey = vendorName ? Object.keys(KNOWN_AREAS).find(
      (k) => vendorName.toLowerCase().includes(k.toLowerCase())
    ) : void 0;
    const vendorCoords = vendorAreaKey ? KNOWN_AREAS[vendorAreaKey] : void 0;
    const pricing = await calculatePricing({
      items: body.items || [],
      couponCode: body.couponCode,
      redeemPoints: body.redeemPoints || body.redeem_points,
      useWalletAmount: body.useWalletAmount || body.use_wallet_amount || 0,
      userId: user.id,
      pickupArea: body.pickup_area,
      pickupDate: body.pickup_date,
      pickupSlot: body.pickup_slot
    });
    const orderData = {
      code,
      customer_id: user.id,
      customer_name: body.customer_name || "Customer",
      customer_avatar: body.customer_avatar || "",
      vendor_id: hasVendor ? body.vendor_id : null,
      vendor_name: vendorName,
      vendor_logo_initials: vendorLogoInitials,
      vendor_logo_color: vendorLogoColor,
      status: hasVendor ? "vendor_assigned" : "placed",
      current_stage_index: hasVendor ? 1 : 0,
      items: body.items || [],
      pickup_address: body.pickup_address || "",
      pickup_area: body.pickup_area || "",
      pickup_date: body.pickup_date || "",
      pickup_slot: body.pickup_slot || "",
      delivery_date: body.delivery_date || "",
      delivery_slot: body.delivery_slot || "",
      estimated_delivery_at: body.estimated_delivery_at || null,
      amount: pricing.subtotal,
      taxes: pricing.taxes,
      platform_fee: pricing.platformFee,
      delivery_fee: pricing.deliveryFee,
      total: pricing.total,
      coupon_code: pricing.couponCode || null,
      coupon_discount: pricing.couponDiscount || 0,
      subscription_discount: pricing.subscriptionDiscount || 0,
      reward_points_used: pricing.rewardPointsUsed || 0,
      wallet_used: pricing.walletUsed || 0,
      express_surcharge: pricing.expressSurcharge || 0,
      surge_charge: pricing.surgeCharge || 0,
      pricing_breakdown: pricing,
      payment_method: body.payment_method || "cod",
      payment_status: pricing.walletUsed >= pricing.total ? "paid" : "pending",
      pickup_lat: pickupCoords?.lat || null,
      pickup_lng: pickupCoords?.lng || null,
      delivery_lat: vendorCoords?.lat || null,
      delivery_lng: vendorCoords?.lng || null,
      express: body.express || false,
      notes: body.notes || null,
      garment_count: body.garment_count || 0,
      weight_kg: body.weight_kg || null
    };
    const { data, error } = await adminClient.from("orders").insert(orderData).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    await applyPricingToOrder(orderData, pricing, user.id);
    const { data: stages } = await adminClient.from("order_stage_definitions").select("*").order("sort_order");
    if (stages) {
      const doneUpTo = hasVendor ? 1 : 0;
      const stageEvents = stages.map((s, i) => ({
        order_id: data.id,
        stage: s.stage,
        label: s.label,
        timestamp: i <= doneUpTo ? (/* @__PURE__ */ new Date()).toISOString() : null,
        done: i <= doneUpTo
      }));
      await adminClient.from("order_stage_events").insert(stageEvents);
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const { data: stages } = await supabase.from("order_stage_events").select("*").eq("order_id", id).order("stage");
    res.json({ ...order, stages: stages || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const supabase = createAdminClient();
    const { data: order, error: fetchErr } = await supabase.from("orders").select("*").eq("id", id).single();
    if (fetchErr) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const updatePayload = {};
    if (body.currentStageIndex !== void 0) {
      const newIndex = body.currentStageIndex;
      const currentIndex = order.current_stage_index;
      if (newIndex < currentIndex) {
        res.status(400).json({ error: "Cannot revert to a previous stage" });
        return;
      }
      if (newIndex > STAGES.length - 1) {
        res.status(400).json({ error: "Invalid stage index" });
        return;
      }
      if (order.status === "cancelled") {
        res.status(400).json({ error: "Order is cancelled" });
        return;
      }
      const { data: stages } = await supabase.from("order_stage_events").select("*").eq("order_id", id).order("stage");
      if (stages) {
        for (let i = currentIndex; i <= newIndex; i++) {
          if (stages[i]) {
            await supabase.from("order_stage_events").update({ done: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", stages[i].id);
          }
        }
      }
      updatePayload.status = STAGES[newIndex];
      updatePayload.current_stage_index = newIndex;
      if (STAGES[newIndex] === "pickup_scheduled" && order.status !== "pickup_scheduled") {
        const { data: existing } = await supabase.from("delivery_tasks").select("id").eq("order_id", id).eq("type", "pickup").limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("delivery_tasks").insert({
            type: "pickup",
            order_id: id,
            order_code: order.code,
            customer_name: order.customer_name || "Customer",
            vendor_name: order.vendor_name || "",
            address: order.pickup_address || "",
            area: order.pickup_area || "",
            slot: order.pickup_slot || "",
            amount: order.total || 0,
            items: "",
            status: "pending"
          });
        }
      }
      if (STAGES[newIndex] === "ready_for_dispatch" && order.status !== "ready_for_dispatch") {
        const { data: existing } = await supabase.from("delivery_tasks").select("id").eq("order_id", id).eq("type", "delivery").limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("delivery_tasks").insert({
            type: "delivery",
            order_id: id,
            order_code: order.code,
            customer_name: order.customer_name || "Customer",
            vendor_name: order.vendor_name || "",
            address: order.pickup_address || "",
            area: order.pickup_area || "",
            slot: order.delivery_slot || "",
            amount: order.total || 0,
            items: "",
            status: "pending"
          });
        }
      }
    }
    if (body.status && !updatePayload.status) updatePayload.status = body.status;
    const { data, error } = await supabase.from("orders").update(updatePayload).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data: order, error: fetchErr } = await supabase.from("orders").select("*").eq("id", id).single();
    if (fetchErr) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (order.status !== "vendor_assigned") {
      res.status(400).json({ error: "Can only reject orders at 'vendor_assigned' stage" });
      return;
    }
    const { data: vendors } = await supabase.from("vendors").select("id, name, logo_initials, logo_color").eq("area", order.pickup_area).neq("id", order.vendor_id).limit(5);
    if (!vendors || vendors.length === 0) {
      res.json({ message: "No alternative vendors available", order });
      return;
    }
    const nextVendor = vendors[0];
    const { data, error } = await supabase.from("orders").update({
      vendor_id: nextVendor.id,
      vendor_name: nextVendor.name,
      vendor_logo_initials: nextVendor.logo_initials,
      vendor_logo_color: nextVendor.logo_color
    }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/:id/assign-delivery", async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_executive_id } = req.body;
    const supabase = createAdminClient();
    if (!delivery_executive_id) {
      const { data: order2, error: orderErr2 } = await supabase.from("orders").update({ delivery_executive_id: null, delivery_executive_name: null }).eq("id", id).select().single();
      if (orderErr2) {
        res.status(400).json({ error: orderErr2.message });
        return;
      }
      await supabase.from("delivery_tasks").update({ exec_id: null }).eq("order_id", id);
      res.json(order2);
      return;
    }
    const { data: profile, error: profileErr } = await supabase.from("user_profiles").select("name").eq("id", delivery_executive_id).single();
    if (profileErr || !profile) {
      res.status(404).json({ error: "Delivery executive not found" });
      return;
    }
    const { data: order, error: orderErr } = await supabase.from("orders").update({
      delivery_executive_id,
      delivery_executive_name: profile.name
    }).eq("id", id).select().single();
    if (orderErr) {
      res.status(400).json({ error: orderErr.message });
      return;
    }
    await supabase.from("delivery_tasks").update({ exec_id: delivery_executive_id }).eq("order_id", id).is("exec_id", null);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data: order } = await supabase.from("orders").select("status, customer_id, vendor_id, delivery_executive_id, code, total").eq("id", id).single();
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const nonCancelable = ["completed", "cancelled", "delivered", "out_for_delivery"];
    if (nonCancelable.includes(order.status)) {
      res.status(400).json({ error: `Cannot cancel order in '${order.status}' status` });
      return;
    }
    const { data, error } = await supabase.from("orders").update({ status: "cancelled", payment_status: "refunded" }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    await supabase.from("delivery_tasks").update({ status: "cancelled" }).eq("order_id", id).in("status", ["pending", "heading_to_pickup", "picked_up", "heading_to_vendor", "reached_vendor", "ready_for_delivery", "out_for_delivery"]);
    await supabase.from("notifications").insert({
      user_id: order.customer_id,
      type: "payment",
      title: "Order Cancelled",
      body: `Order #${order.code} has been cancelled. Refund of \u20B9${order.total || 0} will be processed in 3-5 business days.`,
      channel: "push"
    });
    if (order.vendor_id) {
      const { data: vendor } = await supabase.from("vendors").select("owner_id").eq("id", order.vendor_id).single();
      if (vendor?.owner_id) {
        await supabase.from("notifications").insert({
          user_id: vendor.owner_id,
          type: "booking",
          title: "Order Cancelled",
          body: `Order #${order.code} was cancelled by the customer.`,
          channel: "push"
        });
      }
    }
    if (order.delivery_executive_id) {
      await supabase.from("notifications").insert({
        user_id: order.delivery_executive_id,
        type: "delivery",
        title: "Delivery Cancelled",
        body: `Order #${order.code} has been cancelled. No delivery needed.`,
        channel: "push"
      });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var orders_default = router3;

// server/routes/vendors.ts
var import_express4 = require("express");
var KNOWN_AREAS2 = {
  "Indiranagar": { lat: 12.9719, lng: 77.6413 },
  "Koramangala": { lat: 12.9352, lng: 77.6245 },
  "HSR Layout": { lat: 12.9116, lng: 77.6389 },
  "Jayanagar": { lat: 12.925, lng: 77.5938 },
  "BTM Layout": { lat: 12.9166, lng: 77.6101 },
  "Whitefield": { lat: 12.9698, lng: 77.75 },
  "MG Road": { lat: 12.975, lng: 77.6067 },
  "Marathahalli": { lat: 12.9591, lng: 77.6974 },
  "Electronic City": { lat: 12.8399, lng: 77.677 },
  "JP Nagar": { lat: 12.9063, lng: 77.5857 },
  "Horamavu": { lat: 13.0208, lng: 77.6583 },
  "Hebbal": { lat: 13.0358, lng: 77.597 },
  "Banashankari": { lat: 12.925, lng: 77.5468 },
  "Rajajinagar": { lat: 12.99, lng: 77.5527 },
  "Malleshwaram": { lat: 13.0031, lng: 77.571 },
  "Basavanagudi": { lat: 12.94, lng: 77.57 },
  "Yeshwanthpur": { lat: 13.02, lng: 77.545 },
  "Vijay Nagar": { lat: 12.97, lng: 77.53 },
  "RT Nagar": { lat: 13.02, lng: 77.595 },
  "Kengeri": { lat: 12.91, lng: 77.48 }
};
function findClosestAreaForVendor(areaName, userLat, userLng) {
  const nameL = areaName.toLowerCase();
  let best = null;
  for (const [name, coords] of Object.entries(KNOWN_AREAS2)) {
    const nameSimilar = name.toLowerCase().includes(nameL) || nameL.includes(name.toLowerCase());
    const d = haversineKm(userLat, userLng, coords.lat, coords.lng);
    if (nameSimilar && (!best || d < best.dist)) {
      best = { ...coords, dist: d };
    }
  }
  if (best && best.dist < 15) return { lat: best.lat, lng: best.lng };
  return null;
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var router4 = (0, import_express4.Router)();
router4.get("/", async (req, res) => {
  try {
    const area = req.query.area;
    const isOpen = req.query.isOpen;
    const service = req.query.service;
    const ownerId = req.query.owner_id;
    const lat = req.query.lat;
    const lng = req.query.lng;
    const radiusKm = parseFloat(req.query.radiusKm) || 5;
    const limit = parseInt(req.query.limit) || 50;
    const supabase = createAdminClient();
    let query = supabase.from("vendors").select("*").limit(limit);
    if (area) query = query.eq("area", area);
    if (isOpen === "true") query = query.eq("is_open", true);
    if (service) query = query.contains("services_offered", [service]);
    if (ownerId) query = query.eq("owner_id", ownerId);
    query = query.order("rating", { ascending: false });
    let { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (data && lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        data = data.filter((v) => {
          let coords = KNOWN_AREAS2[v.area];
          if (!coords) {
            const closest = findClosestAreaForVendor(v.area, userLat, userLng);
            if (!closest) return false;
            coords = closest;
          }
          const d = haversineKm(userLat, userLng, coords.lat, coords.lng);
          v.distance_km = parseFloat(d.toFixed(1));
          return d <= radiusKm;
        });
        data.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendors").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendors").select("*").eq("id", id).single();
    if (error) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendors").update(req.body).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendors_default = router4;

// server/routes/delivery-tasks.ts
var import_express5 = require("express");
var TASK_TO_ORDER_STAGE = {
  heading_to_pickup: { status: "pickup_scheduled", index: 3 },
  picked_up: { status: "pickup_completed", index: 4 },
  ready_for_delivery: { status: "ready_for_dispatch", index: 14 },
  out_for_delivery: { status: "out_for_delivery", index: 15 },
  delivered: { status: "delivered", index: 16 }
};
function generateOTP() {
  return Math.floor(1e3 + Math.random() * 9e3).toString();
}
async function completeOrder(supabase, orderId) {
  const { data: stages } = await supabase.from("order_stage_events").select("*").eq("order_id", orderId).order("stage");
  if (stages && stages[17]) {
    await supabase.from("order_stage_events").update({ done: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", stages[17].id);
  }
  await supabase.from("orders").update({ status: "completed", current_stage_index: 17 }).eq("id", orderId);
}
var router5 = (0, import_express5.Router)();
router5.get("/", async (req, res) => {
  try {
    const execId = req.query.execId;
    const status = req.query.status;
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createAdminClient();
    let query = admin.from("delivery_tasks").select("*, order:order_id(pickup_lat, pickup_lng, delivery_lat, delivery_lng)").order("created_at", { ascending: false });
    if (execId) query = query.eq("exec_id", execId);
    else if (user) query = query.eq("exec_id", user.id);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const tasks = (data || []).map((t) => {
      const { order, ...rest } = t;
      return {
        ...rest,
        pickup_lat: order?.pickup_lat ?? null,
        pickup_lng: order?.pickup_lng ?? null,
        delivery_lat: order?.delivery_lat ?? null,
        delivery_lng: order?.delivery_lng ?? null
      };
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const newStatus = req.body.status;
    const { data: task, error: fetchErr } = await supabase.from("delivery_tasks").select("*").eq("id", id).single();
    if (fetchErr) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const { data, error } = await supabase.from("delivery_tasks").update(req.body).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (newStatus && TASK_TO_ORDER_STAGE[newStatus]) {
      const mapping = TASK_TO_ORDER_STAGE[newStatus];
      const orderId = task.order_id;
      const { data: stages } = await supabase.from("order_stage_events").select("*").eq("order_id", orderId).order("stage");
      if (stages && stages[mapping.index]) {
        await supabase.from("order_stage_events").update({ done: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", stages[mapping.index].id);
      }
      const orderUpdate = {
        status: mapping.status,
        current_stage_index: mapping.index
      };
      if (newStatus === "heading_to_pickup" || newStatus === "out_for_delivery") {
        let execId = task.exec_id;
        if (!execId) {
          const cookieClient = createServerClientWithCookies((name) => req.cookies?.[name]);
          const { data: { user } } = await cookieClient.auth.getUser();
          execId = user?.id;
        }
        if (execId) {
          const { data: existingOrder } = await supabase.from("orders").select("delivery_executive_id").eq("id", orderId).single();
          if (existingOrder && !existingOrder.delivery_executive_id) {
            const { data: profile } = await supabase.from("user_profiles").select("name").eq("id", execId).single();
            if (profile) {
              orderUpdate.delivery_executive_id = execId;
              orderUpdate.delivery_executive_name = profile.name;
            }
          }
        }
      }
      await supabase.from("orders").update(orderUpdate).eq("id", orderId);
    }
    if (newStatus === "delivered") {
      await completeOrder(supabase, task.order_id);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/:id/otp", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("*").eq("id", id).single();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    let otp = task.delivery_otp;
    if (!otp) {
      otp = generateOTP();
      await admin.from("delivery_tasks").update({ delivery_otp: otp }).eq("id", id);
    }
    res.json({ otp, masked: otp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/:id/verify-otp", async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    if (!otp) {
      res.status(400).json({ error: "OTP is required" });
      return;
    }
    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("*").eq("id", id).single();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (task.delivery_otp !== otp) {
      res.status(400).json({ error: "Invalid OTP", verified: false });
      return;
    }
    await admin.from("delivery_tasks").update({
      otp_verified: true,
      delivery_otp: null
    }).eq("id", id);
    if (task.status === "delivered") {
      await completeOrder(admin, task.order_id);
    }
    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/:id/photo", async (req, res) => {
  try {
    const { id } = req.params;
    let { photo_url, photo_data } = req.body;
    if (!photo_url && !photo_data) {
      res.status(400).json({ error: "photo_url or photo_data is required" });
      return;
    }
    if (photo_data && !photo_url) {
      photo_url = photo_data;
    }
    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("photos").eq("id", id).single();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const existingPhotos = task.photos || [];
    await admin.from("delivery_tasks").update({
      photos: [...existingPhotos, photo_url]
    }).eq("id", id);
    res.json({ photos: [...existingPhotos, photo_url] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/:id/signature", async (req, res) => {
  try {
    const { id } = req.params;
    const { signature_data } = req.body;
    if (!signature_data) {
      res.status(400).json({ error: "signature_data is required" });
      return;
    }
    const admin = createAdminClient();
    const { data: task } = await admin.from("delivery_tasks").select("signature").eq("id", id).single();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    await admin.from("delivery_tasks").update({
      signature: signature_data
    }).eq("id", id);
    res.json({ signature: signature_data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var delivery_tasks_default = router5;

// server/routes/delivery-executives.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
function toRad(deg) {
  return deg * Math.PI / 180;
}
function haversineKm2(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
router6.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("user_profiles").select("id, name, email, phone, avatar, is_available, current_lat, current_lng, max_daily_orders").eq("role", "delivery").order("name");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const execIds = (data || []).map((e) => e.id);
    let workloads = {};
    if (execIds.length > 0) {
      const { data: counts } = await admin.from("delivery_tasks").select("exec_id, status").in("exec_id", execIds);
      const activeStatuses = /* @__PURE__ */ new Set(["pending", "heading_to_pickup", "picked_up", "heading_to_vendor", "reached_vendor", "ready_for_delivery", "out_for_delivery"]);
      for (const row of counts || []) {
        if (activeStatuses.has(row.status)) {
          workloads[row.exec_id] = (workloads[row.exec_id] || 0) + 1;
        }
      }
    }
    const result = (data || []).map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone,
      avatar: e.avatar,
      isAvailable: e.is_available,
      currentLat: e.current_lat ? Number(e.current_lat) : null,
      currentLng: e.current_lng ? Number(e.current_lng) : null,
      maxDailyOrders: e.max_daily_orders,
      assignedOrders: workloads[e.id] || 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/available", async (req, res) => {
  try {
    const admin = createAdminClient();
    const pickupLat = req.query.pickup_lat ? parseFloat(req.query.pickup_lat) : null;
    const pickupLng = req.query.pickup_lng ? parseFloat(req.query.pickup_lng) : null;
    const orderId = req.query.order_id || null;
    const { data, error } = await admin.from("user_profiles").select("id, name, email, phone, avatar, is_available, current_lat, current_lng, max_daily_orders").eq("role", "delivery").eq("is_available", true).order("name");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const execIds = (data || []).map((e) => e.id);
    let workloads = {};
    if (execIds.length > 0) {
      const { data: counts } = await admin.from("delivery_tasks").select("exec_id, status").in("exec_id", execIds);
      const activeStatuses = /* @__PURE__ */ new Set(["pending", "heading_to_pickup", "picked_up", "heading_to_vendor", "reached_vendor", "ready_for_delivery", "out_for_delivery"]);
      for (const row of counts || []) {
        if (activeStatuses.has(row.status)) {
          workloads[row.exec_id] = (workloads[row.exec_id] || 0) + 1;
        }
      }
    }
    let excludeExecId = null;
    if (orderId) {
      const { data: order } = await admin.from("orders").select("delivery_executive_id").eq("id", orderId).single();
      excludeExecId = order?.delivery_executive_id || null;
    }
    const result = (data || []).filter((e) => e.id !== excludeExecId).map((e) => {
      const assigned = workloads[e.id] || 0;
      const maxOrders = e.max_daily_orders || 10;
      const capacityPct = maxOrders > 0 ? assigned / maxOrders : 1;
      let distanceKm = 0;
      if (pickupLat != null && pickupLng != null && e.current_lat != null && e.current_lng != null) {
        distanceKm = haversineKm2(
          pickupLat,
          pickupLng,
          Number(e.current_lat),
          Number(e.current_lng)
        );
      }
      const workloadScore = capacityPct * 60;
      const distanceScore = distanceKm > 0 ? Math.min(distanceKm / 20, 1) * 40 : 0;
      const score = workloadScore + distanceScore;
      return {
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        avatar: e.avatar,
        isAvailable: e.is_available,
        currentLat: e.current_lat ? Number(e.current_lat) : null,
        currentLng: e.current_lng ? Number(e.current_lng) : null,
        maxDailyOrders: maxOrders,
        assignedOrders: assigned,
        distanceKm: Math.round(distanceKm * 10) / 10,
        score: Math.round(score * 100) / 100
      };
    }).sort((a, b) => a.score - b.score);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/earnings", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString();
    const { data: allTasks } = await admin.from("delivery_tasks").select("*").eq("exec_id", user.id).in("status", ["delivered"]).order("updated_at", { ascending: false });
    const tasks = allTasks || [];
    const todayTasks = tasks.filter((t) => new Date(t.updated_at) >= today);
    const todayEarnings = todayTasks.reduce((sum, t) => sum + (t.amount || 0), 0);
    const weekTasks = tasks.filter((t) => new Date(t.updated_at) >= weekStart);
    const weekEarnings = weekTasks.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalTrips = tasks.length;
    const avgPerTrip = totalTrips > 0 ? Math.round(weekEarnings / totalTrips) : 0;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dayTasks = tasks.filter((t) => {
        const tDate = new Date(t.updated_at);
        return tDate >= dayStart && tDate <= dayEnd;
      });
      const dayEarnings = dayTasks.reduce((sum, t) => sum + (t.amount || 0), 0);
      weekDays.push({ day: dayLabel, earnings: dayEarnings });
    }
    const { data: txns } = await admin.from("wallet_transactions").select("*").eq("user_id", user.id).eq("type", "credit").order("created_at", { ascending: false }).limit(20);
    const recentPayouts = (txns || []).map((t) => ({
      id: t.id,
      amount: t.amount,
      method: t.method || "bank transfer",
      status: t.status || "completed",
      date: t.created_at,
      description: t.description || "Delivery earnings"
    }));
    res.json({
      todayEarnings,
      weekEarnings,
      totalTrips,
      avgPerTrip,
      weekChart: weekDays,
      recentPayouts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var delivery_executives_default = router6;

// server/routes/notifications.ts
var import_express7 = require("express");
var router7 = (0, import_express7.Router)();
router7.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router7.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("notifications").update(req.body).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var notifications_default = router7;

// server/routes/slots.ts
var import_express8 = require("express");
var router8 = (0, import_express8.Router)();
var DEFAULT_PICKUP_SLOTS = [
  { slot: "7:00 AM - 9:00 AM", available: true, premium: false },
  { slot: "9:00 AM - 11:00 AM", available: true, premium: false },
  { slot: "11:00 AM - 1:00 PM", available: true, premium: false },
  { slot: "1:00 PM - 3:00 PM", available: true, premium: true },
  { slot: "3:00 PM - 5:00 PM", available: true, premium: false },
  { slot: "5:00 PM - 7:00 PM", available: true, premium: false }
];
var DEFAULT_DELIVERY_SLOTS = [
  { slot: "7:00 AM - 9:00 AM", available: true },
  { slot: "9:00 AM - 11:00 AM", available: true },
  { slot: "11:00 AM - 1:00 PM", available: true },
  { slot: "1:00 PM - 3:00 PM", available: true },
  { slot: "3:00 PM - 5:00 PM", available: true },
  { slot: "5:00 PM - 7:00 PM", available: true }
];
router8.get("/", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data: pickup, error: psErr } = await supabase.from("pickup_slots").select("*").order("slot");
    if (psErr) {
      res.status(500).json({ error: psErr.message });
      return;
    }
    const { data: delivery, error: dsErr } = await supabase.from("delivery_slots").select("*").order("slot");
    if (dsErr) {
      res.status(500).json({ error: dsErr.message });
      return;
    }
    if (pickup && pickup.length > 0 && delivery && delivery.length > 0) {
      res.json({ pickup, delivery });
      return;
    }
    if (!pickup || pickup.length === 0) {
      await supabase.from("pickup_slots").upsert(DEFAULT_PICKUP_SLOTS, { onConflict: "slot" });
    }
    if (!delivery || delivery.length === 0) {
      await supabase.from("delivery_slots").upsert(DEFAULT_DELIVERY_SLOTS, { onConflict: "slot" });
    }
    const { data: seededPickup } = await supabase.from("pickup_slots").select("*").order("slot");
    const { data: seededDelivery } = await supabase.from("delivery_slots").select("*").order("slot");
    res.json({ pickup: seededPickup || [], delivery: seededDelivery || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var slots_default = router8;

// server/routes/wallet.ts
var import_express9 = require("express");
var router9 = (0, import_express9.Router)();
router9.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("wallet_balance, loyalty_points").eq("id", user.id).maybeSingle();
    const { data: transactions } = await admin.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    res.json({ balance: profile?.wallet_balance || 0, loyalty_points: profile?.loyalty_points || 0, transactions: transactions || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router9.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { amount, method } = req.body;
    const admin = createAdminClient();
    await admin.from("wallet_transactions").insert({
      user_id: user.id,
      type: "credit",
      amount,
      method,
      description: "Wallet top-up",
      status: "success"
    });
    const { data: profile } = await admin.from("user_profiles").select("wallet_balance").eq("id", user.id).single();
    const newBalance = (profile?.wallet_balance || 0) + amount;
    await admin.from("user_profiles").update({ wallet_balance: newBalance }).eq("id", user.id);
    res.json({ balance: newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var wallet_default = router9;

// server/routes/reviews.ts
var import_express10 = require("express");
var router10 = (0, import_express10.Router)();
router10.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    const orderId = req.query.orderId;
    let userId = req.query.userId;
    if (!userId && !vendorId && !orderId) {
      const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }
    const admin = createAdminClient();
    let query = admin.from("reviews").select("*").order("created_at", { ascending: false });
    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (orderId) query = query.eq("order_id", orderId);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router10.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("reviews").insert({ ...req.body, user_id: user.id }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var reviews_default = router10;

// server/routes/services.ts
var import_express11 = require("express");
var router11 = (0, import_express11.Router)();
router11.get("/", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("services").select("*").order("sort_order");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var services_default = router11;

// server/routes/coupons.ts
var import_express12 = require("express");
var router12 = (0, import_express12.Router)();
router12.get("/", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("coupons").select("*").eq("active", true).order("max_discount", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var coupons_default = router12;

// server/routes/admin.ts
var import_express13 = require("express");
var router13 = (0, import_express13.Router)();
var DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
router13.get("/kpis", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();
    const [usersRes, vendorsRes, ordersRes, reviewsRes, todayOrdersRes] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("vendors").select("id, verified, is_open"),
      supabase.from("orders").select("total, status, created_at"),
      supabase.from("reviews").select("rating"),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStr)
    ]);
    const totalUsers = usersRes.count || 0;
    const vendors = vendorsRes.data || [];
    const totalVendors = vendors.length;
    const verifiedVendors = vendors.filter((v) => v.verified).length;
    const activeVendors = vendors.filter((v) => v.verified && v.is_open).length;
    const orders = ordersRes.data || [];
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const liveOrders = orders.filter(
      (o) => [
        "placed",
        "vendor_assigned",
        "vendor_accepted",
        "pickup_scheduled",
        "pickup_completed",
        "laundry_received",
        "sorting",
        "tagging",
        "washing",
        "drying",
        "ironing",
        "dry_cleaning",
        "quality_inspection",
        "packing",
        "ready_for_dispatch",
        "out_for_delivery"
      ].includes(o.status)
    ).length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered" || o.status === "completed").length;
    const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
    const deliveryRate = totalOrders > 0 ? Math.round(deliveredOrders / totalOrders * 100) : 0;
    const reviews = reviewsRes.data || [];
    const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2) : "0.00";
    const todayOrders = todayOrdersRes.count || 0;
    const kpis = [
      { label: "Total Users", value: totalUsers.toLocaleString(), change: 0, trend: "up", icon: "Users", accent: "from-teal-500 to-cyan-600", spark: [40, 60, 45, 70, 65, 80, 75] },
      { label: "Active Vendors", value: String(activeVendors), change: 0, trend: "up", icon: "Store", accent: "from-emerald-500 to-green-600", spark: [30, 40, 35, 50, 45, 55, 52] },
      { label: "Live Orders", value: String(liveOrders), change: 0, trend: "up", icon: "Activity", accent: "from-violet-500 to-purple-600", spark: [80, 90, 85, 95, 100, 110, liveOrders] },
      { label: "Revenue (MTD)", value: `\u20B9${(totalRevenue / 1e5).toFixed(1)}L`, change: 0, trend: "up", icon: "IndianRupee", accent: "from-amber-500 to-orange-600", spark: [50, 60, 55, 70, 65, 75, 70] },
      { label: "Avg Rating", value: `${avgRating}\u2605`, change: 0, trend: "flat", icon: "Smile", accent: "from-sky-500 to-blue-600", spark: [42, 45, 44, 46, 45, 47, Math.round(parseFloat(avgRating) * 10)] },
      { label: "Delivery Rate", value: `${deliveryRate}%`, change: 0, trend: "up", icon: "Percent", accent: "from-teal-500 to-cyan-600", spark: [70, 75, 72, 78, 76, 80, deliveryRate] },
      { label: "Cancellation Rate", value: totalOrders > 0 ? `${(cancelledOrders / totalOrders * 100).toFixed(1)}%` : "0%", change: 0, trend: "down", icon: "XCircle", accent: "from-rose-500 to-pink-600", spark: [10, 8, 12, 6, 9, 7, Math.round(cancelledOrders / Math.max(totalOrders, 1) * 100)] },
      { label: "Today's Orders", value: String(todayOrders), change: 0, trend: "up", icon: "Clock", accent: "from-indigo-500 to-violet-600", spark: [10, 15, 12, 18, 14, 20, todayOrders] }
    ];
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router13.get("/analytics", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const sevenDaysAgo = /* @__PURE__ */ new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const startStr = sevenDaysAgo.toISOString();
    const sixMonthsAgo = /* @__PURE__ */ new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const monthStartStr = sixMonthsAgo.toISOString();
    const [allOrdersRes, recentOrdersRes] = await Promise.all([
      supabase.from("orders").select("total, created_at, status, pickup_area, items"),
      supabase.from("orders").select("total, created_at").gte("created_at", startStr).neq("status", "cancelled")
    ]);
    const allOrders = allOrdersRes.data || [];
    const recentOrders = recentOrdersRes.data || [];
    const monthBuckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      monthBuckets[key] = { revenue: 0, commission: 0, orders: 0 };
    }
    const completedOrders = allOrders.filter(
      (o) => !["cancelled"].includes(o.status) && o.total > 0
    );
    for (const o of completedOrders) {
      const d = new Date(o.created_at);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (monthBuckets[key]) {
        monthBuckets[key].revenue += o.total;
        monthBuckets[key].commission += Math.round(o.total * 0.1);
        monthBuckets[key].orders += 1;
      }
    }
    const revenueChart = Object.entries(monthBuckets).map(([month, data]) => ({
      month,
      revenue: Math.round(data.revenue / 1e5 * 10) / 10,
      commission: Math.round(data.commission / 1e5 * 10) / 10,
      orders: data.orders
    }));
    const areaBuckets = {};
    for (const o of completedOrders) {
      const area = o.pickup_area || "Other";
      if (!areaBuckets[area]) areaBuckets[area] = { area, orders: 0, revenue: 0 };
      areaBuckets[area].orders += 1;
      areaBuckets[area].revenue += o.total || 0;
    }
    const areaDemand = Object.values(areaBuckets).sort((a, b) => b.orders - a.orders).slice(0, 10).map((a) => ({
      area: a.area,
      orders: a.orders,
      growth: 0
    }));
    const dayBuckets = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      dayBuckets[DAY_LABELS[d.getDay()]] = { pickups: 0, deliveries: 0 };
    }
    for (const o of recentOrders) {
      const d = new Date(o.created_at);
      const label = DAY_LABELS[d.getDay()];
      if (dayBuckets[label]) {
        dayBuckets[label].deliveries += 1;
      }
    }
    const weeklyTrend = DAY_LABELS.map((day) => ({
      day,
      pickups: dayBuckets[day]?.deliveries || 0,
      deliveries: Math.round((dayBuckets[day]?.deliveries || 0) * 0.45)
    }));
    const serviceBuckets = {};
    for (const o of completedOrders) {
      const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items || [];
      for (const item of items) {
        const name = item.serviceName || "Other";
        serviceBuckets[name] = (serviceBuckets[name] || 0) + 1;
      }
    }
    const totalServices = Object.values(serviceBuckets).reduce((s, c) => s + c, 0);
    const COLORS2 = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316", "#22c55e"];
    const serviceDemand = Object.entries(serviceBuckets).sort((a, b) => b[1] - a[1]).map(([name, count], i) => ({
      name,
      value: totalServices > 0 ? Math.round(count / totalServices * 100) : 0,
      color: COLORS2[i % COLORS2.length]
    }));
    res.json({
      revenue: revenueChart,
      areaDemand,
      serviceDemand,
      weeklyTrend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router13.get("/orders", async (req, res) => {
  try {
    const supabase = createAdminClient();
    let query = supabase.from("orders").select("*");
    if (req.query.status) {
      const status = req.query.status;
      if (status === "active") {
        query = query.not("status", "eq", "completed").not("status", "eq", "cancelled");
      } else if (status === "delayed") {
        query = query.or("ai_prediction->>delayRisk.eq.high,ai_prediction->>delayRisk.eq.medium");
      } else {
        query = query.eq("status", status);
      }
    }
    if (req.query.vendor_id) {
      query = query.eq("vendor_id", req.query.vendor_id);
    }
    if (req.query.delivery_executive_id) {
      query = query.eq("delivery_executive_id", req.query.delivery_executive_id);
    }
    if (req.query.payment_status) {
      query = query.eq("payment_status", req.query.payment_status);
    }
    if (req.query.pickup_area) {
      query = query.ilike("pickup_area", `%${req.query.pickup_area}%`);
    }
    if (req.query.search) {
      const term = `%${req.query.search}%`;
      query = query.or(`code.ilike.${term},customer_name.ilike.${term},vendor_name.ilike.${term}`);
    }
    if (req.query.delay_risk) {
      query = query.filter("ai_prediction->>delayRisk", "eq", req.query.delay_risk);
    }
    if (req.query.from_date) {
      query = query.gte("created_at", req.query.from_date);
    }
    if (req.query.to_date) {
      query = query.lte("created_at", req.query.to_date);
    }
    if (req.query.express) {
      query = query.eq("express", req.query.express === "true");
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 200;
    const offset = (page - 1) * limit;
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_default = router13;

// server/routes/vendor-analytics.ts
var import_express14 = require("express");
var router14 = (0, import_express14.Router)();
var COLORS = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316"];
var DAY_LABELS2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
router14.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    if (!vendorId) {
      res.status(400).json({ error: "vendorId required" });
      return;
    }
    const supabase = createAdminClient();
    const [vendorRes, ordersRes, reviewsRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).single(),
      supabase.from("orders").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10),
      supabase.from("reviews").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(20)
    ]);
    res.json({ vendor: vendorRes.data, recentOrders: ordersRes.data || [], reviews: reviewsRes.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.get("/weekly-revenue", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    if (!vendorId) {
      res.status(400).json({ error: "vendorId required" });
      return;
    }
    const supabase = createAdminClient();
    const sevenDaysAgo = /* @__PURE__ */ new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const startStr = sevenDaysAgo.toISOString();
    const { data: orders } = await supabase.from("orders").select("total, created_at, status").eq("vendor_id", vendorId).gte("created_at", startStr).neq("status", "cancelled");
    const dayBuckets = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      dayBuckets[DAY_LABELS2[d.getDay()]] = { revenue: 0, orders: 0 };
    }
    for (const o of orders || []) {
      const d = new Date(o.created_at);
      const label = DAY_LABELS2[d.getDay()];
      if (dayBuckets[label]) {
        dayBuckets[label].revenue += o.total || 0;
        dayBuckets[label].orders += 1;
      }
    }
    const result = DAY_LABELS2.map((day) => ({
      day,
      revenue: dayBuckets[day]?.revenue || 0,
      orders: dayBuckets[day]?.orders || 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.get("/service-revenue", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    if (!vendorId) {
      res.status(400).json({ error: "vendorId required" });
      return;
    }
    const supabase = createAdminClient();
    const { data: orders } = await supabase.from("orders").select("items, total").eq("vendor_id", vendorId).neq("status", "cancelled");
    const serviceBuckets = {};
    let totalRevenue = 0;
    for (const o of orders || []) {
      if (!o.total) continue;
      totalRevenue += o.total;
      const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items || [];
      if (items.length > 0) {
        const orderItemTotal = items.reduce((s, i) => s + (i.unitPrice || 0) * (i.qty || 0), 0);
        for (const item of items) {
          const name = item.serviceName || "Other";
          const proportion = orderItemTotal > 0 ? (item.unitPrice || 0) * (item.qty || 0) / orderItemTotal : 0;
          serviceBuckets[name] = (serviceBuckets[name] || 0) + (o.total || 0) * proportion;
        }
      }
    }
    const entries = Object.entries(serviceBuckets).sort((a, b) => b[1] - a[1]);
    const result = entries.map(([name, revenue], i) => ({
      name,
      revenue: Math.round(revenue),
      percentage: totalRevenue > 0 ? Math.round(revenue / totalRevenue * 100) : 0,
      color: COLORS[i % COLORS.length]
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.get("/stats", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    if (!vendorId) {
      res.status(400).json({ error: "vendorId required" });
      return;
    }
    const supabase = createAdminClient();
    const sevenDaysAgo = /* @__PURE__ */ new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const startStr = sevenDaysAgo.toISOString();
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();
    const [ordersRes, reviewsRes, allOrdersRes] = await Promise.all([
      supabase.from("orders").select("total, created_at, customer_id, status").eq("vendor_id", vendorId).neq("status", "cancelled"),
      supabase.from("reviews").select("rating").eq("vendor_id", vendorId),
      supabase.from("orders").select("total, created_at, customer_id").eq("vendor_id", vendorId).neq("status", "cancelled")
    ]);
    const allOrders = ordersRes.data || [];
    const totalOrdersThisWeek = allOrders.filter((o) => o.created_at >= startStr).length;
    const weeklyRevenue = allOrders.filter((o) => o.created_at >= startStr).reduce((s, o) => s + (o.total || 0), 0);
    const ordersThisWeek = allOrders.filter((o) => o.created_at >= startStr);
    const avgOrderValue = ordersThisWeek.length > 0 ? Math.round(weeklyRevenue / ordersThisWeek.length) : 0;
    const uniqueCustomers = new Set(allOrders.map((o) => o.customer_id));
    const repeatCustomers = allOrdersRes.data ? Array.from(uniqueCustomers).filter(
      (cid) => (allOrdersRes.data || []).filter((o) => o.customer_id === cid).length > 1
    ).length : 0;
    const repeatRate = uniqueCustomers.size > 0 ? Math.round(repeatCustomers / uniqueCustomers.size * 100) : 0;
    const reviews = reviewsRes.data || [];
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const ratingBuckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      const star = Math.round(r.rating);
      if (star >= 1 && star <= 5) ratingBuckets[star]++;
    }
    const totalReviews = reviews.length;
    const todayOrders = allOrders.filter((o) => o.created_at >= todayStr).length;
    const todayRevenue = allOrders.filter((o) => o.created_at >= todayStr).reduce((s, o) => s + (o.total || 0), 0);
    res.json({
      totalOrdersThisWeek,
      weeklyRevenue,
      avgOrderValue,
      repeatRate,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews,
      ratingBuckets,
      todayOrders,
      todayRevenue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.get("/inventory", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    if (!vendorId) {
      res.status(400).json({ error: "vendorId required" });
      return;
    }
    const supabase = createAdminClient();
    const { data } = await supabase.from("garment_inventory").select("*").eq("vendor_id", vendorId);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_analytics_default = router14;

// server/routes/subscriptions.ts
var import_express15 = require("express");
var router15 = (0, import_express15.Router)();
router15.get("/plans", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("subscription_plans").select("*").order("price");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const plans = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.description || "",
      monthlyPrice: p.interval === "monthly" ? p.price : Math.round(p.price / 12),
      yearlyPrice: p.interval === "yearly" ? p.price : p.price * 12,
      features: p.services_included || [],
      popular: p.savings_pct > 15,
      color: p.name === "Premium" ? "from-violet-500 to-purple-600" : p.name === "Ultimate" ? "from-amber-500 to-orange-600" : "from-teal-500 to-cyan-600"
    }));
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router15.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("user_subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router15.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("user_subscriptions").insert({ ...req.body, user_id: user.id, status: "active" }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router15.delete("/:id", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { error } = await admin.from("user_subscriptions").update({ status: "cancelled" }).eq("id", req.params.id).eq("user_id", user.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var subscriptions_default = router15;

// server/routes/vendor-staff.ts
var import_express16 = require("express");
var router16 = (0, import_express16.Router)();
router16.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    const admin = createAdminClient();
    let query = admin.from("vendor_staff").select("*").order("name");
    if (vendorId) query = query.eq("vendor_id", vendorId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router16.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("vendor_staff").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router16.patch("/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("vendor_staff").update(req.body).eq("id", req.params.id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router16.delete("/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("vendor_staff").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_staff_default = router16;

// server/routes/garments.ts
var import_express17 = require("express");
var router17 = (0, import_express17.Router)();
router17.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    const admin = createAdminClient();
    let query = admin.from("garment_inventory").select("*").order("name");
    if (vendorId) query = query.eq("vendor_id", vendorId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router17.post("/", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("garment_inventory").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router17.patch("/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("garment_inventory").update(req.body).eq("id", req.params.id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router17.delete("/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("garment_inventory").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var garments_default = router17;

// server/routes/wallet-methods.ts
var import_express18 = require("express");
var router18 = (0, import_express18.Router)();
router18.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("payment_methods").select("*").eq("user_id", user.id).order("is_default", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router18.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    if (req.body.is_default) {
      await admin.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
    }
    const { data, error } = await admin.from("payment_methods").insert({ ...req.body, user_id: user.id }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router18.patch("/:id/default", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    await admin.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
    await admin.from("payment_methods").update({ is_default: true }).eq("id", req.params.id).eq("user_id", user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router18.delete("/:id", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { error } = await admin.from("payment_methods").delete().eq("id", req.params.id).eq("user_id", user.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var wallet_methods_default = router18;

// server/routes/coupon-validate.ts
var import_express19 = require("express");
var router19 = (0, import_express19.Router)();
router19.post("/", async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      res.status(400).json({ error: "Coupon code required" });
      return;
    }
    const admin = createAdminClient();
    const { data: coupon, error } = await admin.from("coupons").select("*").eq("code", code.toUpperCase()).single();
    if (error || !coupon) {
      res.status(404).json({ error: "Invalid coupon code" });
      return;
    }
    if (!coupon.active) {
      res.status(400).json({ error: "Coupon expired" });
      return;
    }
    if (subtotal < coupon.min_order) {
      res.status(400).json({ error: `Min order \u20B9${coupon.min_order} required` });
      return;
    }
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
      res.status(400).json({ error: "Coupon usage limit reached" });
      return;
    }
    let discount = 0;
    if (coupon.type === "percentage") {
      discount = Math.min(subtotal * coupon.discount_pct / 100, coupon.max_discount);
    } else {
      discount = Math.min(coupon.max_discount, subtotal);
    }
    res.json({ valid: true, discount, coupon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var coupon_validate_default = router19;

// server/routes/support-tickets.ts
var import_express20 = require("express");
var router20 = (0, import_express20.Router)();
router20.get("/", async (req, res) => {
  try {
    const status = req.query.status;
    const supabase = createAdminClient();
    let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router20.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_tickets").insert({
      ...req.body,
      user_id: req.body.user_id || user?.id,
      status: "open"
    }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router20.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = createAdminClient();
    const update = { ...req.body, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    const { data, error } = await admin.from("support_tickets").update(update).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router20.post("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    if (!assigned_to) {
      res.status(400).json({ error: "assigned_to is required" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_tickets").update({
      assigned_to,
      status: "in_progress",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router20.post("/:id/respond", async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    if (!response) {
      res.status(400).json({ error: "response is required" });
      return;
    }
    const admin = createAdminClient();
    const { data: ticket } = await admin.from("support_tickets").select("*").eq("id", id).single();
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const existing = ticket.responses || [];
    const { data, error } = await admin.from("support_tickets").update({
      responses: [...existing, { by: req.body.by || "admin", message: response, at: (/* @__PURE__ */ new Date()).toISOString() }],
      status: "waiting_on_customer",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router20.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("support_tickets").update({
      status: "closed",
      resolved_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var support_tickets_default = router20;

// server/routes/admin-campaigns.ts
var import_express21 = require("express");
var router21 = (0, import_express21.Router)();
router21.get("/", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").select("*").order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router21.post("/", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router21.patch("/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("campaigns").update(req.body).eq("id", req.params.id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_campaigns_default = router21;

// server/routes/admin-features.ts
var import_express22 = require("express");
var router22 = (0, import_express22.Router)();
router22.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("feature_flags").select("*").order("key");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router22.patch("/:key", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("feature_flags").update({ enabled: req.body.enabled, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("key", req.params.key).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_features_default = router22;

// server/routes/admin-audit-logs.ts
var import_express23 = require("express");
var router23 = (0, import_express23.Router)();
router23.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const admin = createAdminClient();
    const { data, error } = await admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_audit_logs_default = router23;

// server/routes/admin-integrations.ts
var import_express24 = require("express");
var import_crypto = __toESM(require("crypto"));
var router24 = (0, import_express24.Router)();
router24.get("/api-keys", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("api_keys").select("*").order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router24.post("/api-keys", async (req, res) => {
  try {
    const admin = createAdminClient();
    const keyValue = `lh_${import_crypto.default.randomBytes(24).toString("hex")}`;
    const { data, error } = await admin.from("api_keys").insert({ ...req.body, key_value: keyValue }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router24.delete("/api-keys/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("api_keys").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router24.get("/webhooks", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("webhooks").select("*").order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router24.post("/webhooks", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("webhooks").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router24.delete("/webhooks/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("webhooks").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_integrations_default = router24;

// server/routes/admin-reports.ts
var import_express25 = require("express");
var router25 = (0, import_express25.Router)();
router25.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data: reports, error: rErr } = await admin.from("reports").select("*").order("created_at", { ascending: false });
    if (rErr) {
      res.status(500).json({ error: rErr.message });
      return;
    }
    const { data: scheduled, error: sErr } = await admin.from("scheduled_reports").select("*, report_id(*)").order("created_at", { ascending: false });
    if (sErr) {
      res.status(500).json({ error: sErr.message });
      return;
    }
    res.json({ reports: reports || [], scheduled: scheduled || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router25.post("/", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("reports").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router25.post("/scheduled", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("scheduled_reports").insert(req.body).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router25.delete("/scheduled/:id", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("scheduled_reports").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_reports_default = router25;

// server/routes/admin-users.ts
var import_express26 = require("express");
var router26 = (0, import_express26.Router)();
router26.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data: profiles, error } = await admin.from("user_profiles").select("id, name, email, phone, role, avatar, suspended, created_at, updated_at").order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const users = (profiles || []).map((p) => ({
      id: p.id,
      name: p.name || "User",
      email: p.email || "",
      role: p.role || "customer",
      phone: p.phone || "",
      avatar: p.avatar || "",
      status: p.suspended ? "suspended" : "active",
      lastActive: p.updated_at || p.created_at,
      joined: p.created_at
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router26.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const admin = createAdminClient();
    const updates = {};
    if (name !== void 0) updates.name = name;
    if (email !== void 0) updates.email = email;
    if (role !== void 0) updates.role = role;
    if (status !== void 0) {
      updates.suspended = status === "suspended";
    }
    updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await admin.from("user_profiles").update(updates).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone || "",
      avatar: data.avatar || "",
      status: data.suspended ? "suspended" : "active",
      lastActive: data.updated_at,
      joined: data.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_users_default = router26;

// server/routes/admin-config.ts
var import_express27 = require("express");
var router27 = (0, import_express27.Router)();
router27.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("system_config").select("config").eq("id", 1).single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data?.config || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router27.patch("/", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { data: existing, error: getErr } = await admin.from("system_config").select("config").eq("id", 1).single();
    if (getErr) {
      res.status(500).json({ error: getErr.message });
      return;
    }
    const current = existing?.config || {};
    const merged = { ...current };
    for (const [section, values] of Object.entries(req.body)) {
      if (typeof values === "object" && values !== null && !Array.isArray(values)) {
        merged[section] = { ...merged[section] || {}, ...values };
      } else {
        merged[section] = values;
      }
    }
    const { data, error } = await admin.from("system_config").update({ config: merged }).eq("id", 1).select("config").single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data?.config || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_config_default = router27;

// server/routes/admin-rbac.ts
var import_express28 = require("express");
var router28 = (0, import_express28.Router)();
router28.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data: roles, error: rolesErr } = await admin.from("roles").select("*").order("name");
    if (rolesErr) {
      res.status(500).json({ error: rolesErr.message });
      return;
    }
    const { data: permissions, error: permErr } = await admin.from("role_permissions").select("*").order("resource");
    if (permErr) {
      res.status(500).json({ error: permErr.message });
      return;
    }
    const permissionByRole = {};
    for (const p of permissions || []) {
      if (!permissionByRole[p.role]) permissionByRole[p.role] = [];
      permissionByRole[p.role].push(p);
    }
    res.json({ roles: roles || [], permissions: permissions || [], permissionByRole });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router28.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { allowed } = req.body;
    const admin = createAdminClient();
    const { data, error } = await admin.from("role_permissions").update({ allowed: !!allowed }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_rbac_default = router28;

// server/routes/admin-commission.ts
var import_express29 = require("express");
var router29 = (0, import_express29.Router)();
function getConfig(supabase) {
  return supabase.from("system_config").select("config").eq("id", 1).single().then((r) => r.data?.config || {});
}
function saveConfig(supabase, config) {
  return supabase.from("system_config").update({ config }).eq("id", 1);
}
var DEFAULT_RULES = [
  { id: "default-1", type: "fixed", label: "Standard rate", description: "Applies to all vendors by default", rate: 10, priority: 0, active: true },
  { id: "default-2", type: "percentage", label: "Premium vendor rate", description: "Vendors with rating > 4.7", rate: 8, priority: 1, active: true },
  { id: "default-3", type: "percentage", label: "New vendor rate", description: "First 3 months after onboarding", rate: 5, priority: 2, active: true },
  { id: "default-4", type: "promotional", label: "Weekend promo", description: "Fri-Sun, until 31 Jul", rate: 7, priority: 3, active: true }
];
async function ensureRules(supabase) {
  const config = await getConfig(supabase);
  const existing = config.commission?.rules;
  if (existing && Array.isArray(existing) && existing.length > 0) return config;
  config.commission = { ...config.commission || {}, rules: DEFAULT_RULES };
  await saveConfig(supabase, config);
  return config;
}
router29.get("/rules", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    res.json(config.commission?.rules || DEFAULT_RULES);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.post("/rules", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    const rules = (config.commission?.rules || []).filter((r) => r.id && !r.id.startsWith("default-"));
    const newRule = { id: crypto.randomUUID(), ...req.body, active: true };
    rules.push(newRule);
    config.commission = { ...config.commission || {}, rules };
    const { error } = await saveConfig(supabase, config);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(newRule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.patch("/rules/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    const rules = config.commission?.rules || [];
    const idx = rules.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }
    rules[idx] = { ...rules[idx], ...req.body };
    config.commission = { ...config.commission || {}, rules };
    const { error } = await saveConfig(supabase, config);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(rules[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.delete("/rules/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    let rules = (config.commission?.rules || []).filter((r) => r.id !== req.params.id);
    config.commission = { ...config.commission || {}, rules };
    const { error } = await saveConfig(supabase, config);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.get("/settlements", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    res.json(config.commission?.settlements || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.post("/settlements", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    const settlements = config.commission?.settlements || [];
    const st = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    settlements.unshift(st);
    config.commission = { ...config.commission || {}, settlements };
    const { error } = await saveConfig(supabase, config);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(st);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.patch("/settlements/:id/settle", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    const settlements = config.commission?.settlements || [];
    const idx = settlements.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Settlement not found" });
      return;
    }
    settlements[idx].status = "settled";
    settlements[idx].settledAt = (/* @__PURE__ */ new Date()).toISOString();
    config.commission = { ...config.commission || {}, settlements };
    const { error } = await saveConfig(supabase, config);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(settlements[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router29.get("/summary", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data: vendors, error: vErr } = await supabase.from("vendors").select("id, name, monthly_revenue, rating, logo_initials, logo_color");
    if (vErr) {
      res.status(500).json({ error: vErr.message });
      return;
    }
    const totalMonthlyRevenue = (vendors || []).reduce((s, v) => s + (v.monthly_revenue || 0), 0);
    const totalCommission = Math.round(totalMonthlyRevenue * 0.1);
    const config = await getConfig(supabase);
    const settlements = config.commission?.settlements || [];
    const settledFromDb = settlements.filter((s) => s.status === "settled").reduce((sum, s) => sum + (s.commission || 0), 0);
    const pendingSettlements = Math.max(0, totalCommission - settledFromDb);
    res.json({
      totalCommission,
      pendingSettlements,
      settled: settledFromDb,
      avgRate: 10,
      vendors: (vendors || []).map((v) => ({
        id: v.id,
        name: v.name,
        logoInitials: v.logo_initials,
        logoColor: v.logo_color,
        revenue: v.monthly_revenue || 0,
        commission: Math.round((v.monthly_revenue || 0) * 0.1),
        netAmount: Math.round((v.monthly_revenue || 0) * 0.9),
        status: "pending"
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var admin_commission_default = router29;

// server/routes/order-stages.ts
var import_express30 = require("express");
var router30 = (0, import_express30.Router)();
router30.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("order_stage_definitions").select("*").order("sort_order");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var order_stages_default = router30;

// server/routes/chat.ts
var import_express31 = require("express");
var router31 = (0, import_express31.Router)();
router31.get("/", async (req, res) => {
  try {
    const admin = createAdminClient();
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await admin.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data || []).reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router31.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("chat_messages").insert({ ...req.body, user_id: user.id }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router31.post("/ask", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }
    const admin = createAdminClient();
    await admin.from("chat_messages").insert({ role: "user", content, user_id: user.id }).select().single();
    const { data: profiles } = await admin.from("user_profiles").select("name, role").eq("id", user.id).limit(1);
    const profile = profiles?.[0];
    const userName = profile?.name || "User";
    const userRole = profile?.role || "customer";
    const lower = content.toLowerCase();
    let reply = "";
    if (/\border\b/.test(lower) && /(status|track|where|follow|update)/.test(lower)) {
      const { data: orders } = await admin.from("orders").select("code, status, total, created_at, pickup_area, vendor_name").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(5);
      if (orders && orders.length > 0) {
        reply = `Here are your recent orders:
${orders.map(
          (o, i) => `${i + 1}. **${o.code}** \u2014 ${o.status.replace(/_/g, " ")} (\u20B9${o.total}) at ${o.pickup_area || "\u2014"}`
        ).join("\n")}`;
      } else {
        reply = "You don't have any orders yet. Head to **Book Pickup** to place your first order!";
      }
    } else if (/(vendor|laundromat|shop|store|service)/.test(lower) && /(near|find|list|show|available)/.test(lower)) {
      const { data: vendors } = await admin.from("vendors").select("name, area, rating, is_open").eq("verified", true).limit(10);
      if (vendors && vendors.length > 0) {
        const open = vendors.filter((v) => v.is_open);
        reply = `We have **${vendors.length} verified vendors**. Currently **${open.length}** are open:
${vendors.slice(0, 6).map(
          (v) => `\u2022 **${v.name}** \u2014 ${v.area || "\u2014"} ${v.is_open ? "\u{1F7E2} Open" : "\u{1F534} Closed"} ${v.rating ? "\u2605" + v.rating : ""}`
        ).join("\n")}${vendors.length > 6 ? `
\u2026and ${vendors.length - 6} more.` : ""}`;
      } else {
        reply = "No vendors are currently available in your area. Check back soon!";
      }
    } else if (/(price|cost|rate|how much|pricing|charges)/.test(lower)) {
      const { data: services } = await admin.from("services").select("name, base_price, unit").limit(10);
      if (services && services.length > 0) {
        reply = `Our pricing:
${services.map(
          (s) => `\u2022 **${s.name}** \u2014 \u20B9${s.base_price}/${s.unit || "item"}`
        ).join("\n")}

*Prices may vary by vendor. Check the booking page for exact quotes.*`;
      } else {
        reply = "Visit the **Book Pickup** page to see service pricing in your area.";
      }
    } else if (/(wallet|balance|money|payment|pay)/.test(lower)) {
      const { data: wallets } = await admin.from("wallets").select("balance, points").eq("user_id", user.id).limit(1);
      const wallet = wallets?.[0];
      if (wallet) {
        reply = `Your wallet balance is **\u20B9${wallet.balance || 0}** with **${wallet.points || 0} loyalty points**.`;
      } else {
        reply = "You don't have a wallet yet. It will be created when you make your first payment.";
      }
    } else if (/(help|hi|hello|hey)/.test(lower)) {
      reply = `Hello **${userName}**! \u{1F44B} I can help you with:
\u2022 **Track orders** \u2014 say "order status"
\u2022 **Find vendors** \u2014 say "nearby vendors"
\u2022 **Check pricing** \u2014 say "pricing"
\u2022 **Wallet balance** \u2014 say "my balance"

What would you like to know?`;
    } else {
      const { data: recentOrders } = await admin.from("orders").select("code, status").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(1);
      const recentOrder = recentOrders?.[0];
      reply = `Thanks for reaching out, **${userName}**! I can check order status, find vendors, show pricing, or help with your wallet.

${recentOrder ? `Your most recent order **${recentOrder.code}** is **${recentOrder.status.replace(/_/g, " ")}**.` : ""}

How can I assist you today?`;
    }
    const { data: saved } = await admin.from("chat_messages").insert({
      role: "assistant",
      content: reply,
      user_id: user.id
    }).select().single();
    res.json({ reply: saved?.content || reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var chat_default = router31;

// server/routes/favorites.ts
var import_express32 = require("express");
var router32 = (0, import_express32.Router)();
router32.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("favorite_vendors").select("vendor_id, created_at, vendors(*)").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router32.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { vendor_id } = req.body;
    if (!vendor_id) {
      res.status(400).json({ error: "vendor_id required" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("favorite_vendors").insert({ user_id: user.id, vendor_id }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router32.delete("/:vendor_id", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { vendor_id } = req.params;
    const admin = createAdminClient();
    const { error } = await admin.from("favorite_vendors").delete().eq("user_id", user.id).eq("vendor_id", vendor_id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var favorites_default = router32;

// server/routes/geocode.ts
var import_express33 = require("express");
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 60 * 60 * 1e3;
function getCached(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, ttl: Date.now() + CACHE_TTL_MS });
}
var lastNominatimCall = 0;
async function nominatimFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1e3 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  const res = await fetch(url, {
    headers: {
      "User-Agent": "LaundryHomeApp/1.0 (demo)",
      "Accept-Language": "en"
    }
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  return res.json();
}
var KNOWN_AREAS3 = {
  "Indiranagar": { lat: 12.9719, lng: 77.6413, displayName: "Indiranagar, Bengaluru", pincode: "560038" },
  "Koramangala": { lat: 12.9352, lng: 77.6245, displayName: "Koramangala, Bengaluru", pincode: "560034" },
  "HSR Layout": { lat: 12.9116, lng: 77.6389, displayName: "HSR Layout, Bengaluru", pincode: "560102" },
  "Jayanagar": { lat: 12.925, lng: 77.5938, displayName: "Jayanagar, Bengaluru", pincode: "560011" },
  "BTM Layout": { lat: 12.9166, lng: 77.6101, displayName: "BTM Layout, Bengaluru", pincode: "560076" },
  "Whitefield": { lat: 12.9698, lng: 77.75, displayName: "Whitefield, Bengaluru", pincode: "560066" },
  "MG Road": { lat: 12.975, lng: 77.6067, displayName: "MG Road, Bengaluru", pincode: "560001" },
  "Marathahalli": { lat: 12.9591, lng: 77.6974, displayName: "Marathahalli, Bengaluru", pincode: "560037" },
  "Electronic City": { lat: 12.8399, lng: 77.677, displayName: "Electronic City, Bengaluru", pincode: "560100" },
  "JP Nagar": { lat: 12.9063, lng: 77.5857, displayName: "JP Nagar, Bengaluru", pincode: "560078" },
  "Horamavu": { lat: 13.0208, lng: 77.6583, displayName: "Horamavu, Bengaluru", pincode: "560043" },
  "Hebbal": { lat: 13.0358, lng: 77.597, displayName: "Hebbal, Bengaluru", pincode: "560024" },
  "Banashankari": { lat: 12.925, lng: 77.5468, displayName: "Banashankari, Bengaluru", pincode: "560050" },
  "Rajajinagar": { lat: 12.99, lng: 77.5527, displayName: "Rajajinagar, Bengaluru", pincode: "560010" },
  "Malleshwaram": { lat: 13.0031, lng: 77.571, displayName: "Malleshwaram, Bengaluru", pincode: "560003" },
  "Basavanagudi": { lat: 12.94, lng: 77.57, displayName: "Basavanagudi, Bengaluru", pincode: "560004" },
  "Yeshwanthpur": { lat: 13.02, lng: 77.545, displayName: "Yeshwanthpur, Bengaluru", pincode: "560022" },
  "Vijay Nagar": { lat: 12.97, lng: 77.53, displayName: "Vijay Nagar, Bengaluru", pincode: "560040" },
  "RT Nagar": { lat: 13.02, lng: 77.595, displayName: "RT Nagar, Bengaluru", pincode: "560032" },
  "Kengeri": { lat: 12.91, lng: 77.48, displayName: "Kengeri, Bengaluru", pincode: "560060" }
};
function findClosestArea(lat, lng) {
  let closest = null;
  for (const [name, info] of Object.entries(KNOWN_AREAS3)) {
    const d = haversineKm3(lat, lng, info.lat, info.lng);
    if (!closest || d < closest.distance) {
      closest = { name, pincode: info.pincode, lat: info.lat, lng: info.lng, distance: d };
    }
  }
  return closest;
}
var router33 = (0, import_express33.Router)();
router33.get("/reverse", async (req, res) => {
  try {
    const lat = req.query.lat;
    const lng = req.query.lng;
    if (!lat || !lng) {
      res.status(400).json({ error: "lat and lng required" });
      return;
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const cacheKey = `reverse:${latNum.toFixed(5)},${lngNum.toFixed(5)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    for (const [name, info] of Object.entries(KNOWN_AREAS3)) {
      const d = haversineKm3(latNum, lngNum, info.lat, info.lng);
      if (d < 1) {
        const result2 = { area: name, city: "Bengaluru", pincode: info.pincode, lat: info.lat, lng: info.lng };
        setCache(cacheKey, result2);
        res.json(result2);
        return;
      }
    }
    const data = await nominatimFetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&addressdetails=1`
    );
    if (!data || data.error) {
      const closest = findClosestArea(latNum, lngNum);
      if (closest) {
        const result2 = { area: closest.name, city: "Bengaluru", pincode: closest.pincode, lat: latNum, lng: lngNum };
        setCache(cacheKey, result2);
        res.json(result2);
        return;
      }
      res.json({ area: "Unknown", city: "Bengaluru", pincode: "560001", lat: latNum, lng: lngNum });
      return;
    }
    const addr = data.address || {};
    const nominatimArea = addr.suburb || addr.neighbourhood || addr.locality || addr.town || addr.city || "";
    const city = addr.city || addr.town || addr.county || "Bengaluru";
    const pincode = addr.postcode || "560001";
    const isKnown = Object.keys(KNOWN_AREAS3).some(
      (k) => k.toLowerCase() === nominatimArea.toLowerCase()
    );
    let area = nominatimArea || "Unknown";
    if (!isKnown) {
      const closest = findClosestArea(latNum, lngNum);
      if (closest && closest.distance < 3) {
        area = closest.name;
      }
    }
    const result = { area, city, pincode, lat: latNum, lng: lngNum };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router33.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 2) {
      res.json([]);
      return;
    }
    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const results = [];
    const ql = q.toLowerCase();
    for (const [name, info] of Object.entries(KNOWN_AREAS3)) {
      if (name.toLowerCase().includes(ql) || info.pincode.startsWith(q)) {
        results.push({ label: info.displayName, area: name, city: "Bengaluru", pincode: info.pincode, lat: info.lat, lng: info.lng });
      }
    }
    try {
      const data = await nominatimFetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&countrycodes=in`
      );
      if (Array.isArray(data)) {
        for (const item of data) {
          const addr = item.address || {};
          const name = addr.suburb || addr.neighbourhood || addr.locality || addr.town || addr.city || item.display_name?.split(",")[0] || q;
          const cityName = addr.city || addr.town || addr.county || "Bengaluru";
          const pincode2 = addr.postcode || "";
          const alreadyExists = results.some((r) => r.area.toLowerCase() === name.toLowerCase());
          if (!alreadyExists) {
            const fallbackPincode = pincode2 || "560001";
            results.push({ label: item.display_name || name, area: name, city: cityName, pincode: fallbackPincode, lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
          }
        }
      }
    } catch {
    }
    setCache(cacheKey, results);
    res.json(results.slice(0, 6));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function haversineKm3(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var geocode_default = router33;

// server/routes/routing.ts
var import_express34 = require("express");
var ORS_BASE = "https://api.openrouteservice.org/v2";
var router34 = (0, import_express34.Router)();
router34.get("/directions", async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENROUTESERVICE_API_KEY not configured" });
      return;
    }
    const { start_lat, start_lng, end_lat, end_lng, profile } = req.query;
    if (!start_lat || !start_lng || !end_lat || !end_lng) {
      res.status(400).json({ error: "start_lat, start_lng, end_lat, end_lng are required" });
      return;
    }
    const orsProfile = profile || "driving-car";
    const coords = `${start_lng},${start_lat}|${end_lng},${end_lat}`;
    const response = await fetch(
      `${ORS_BASE}/directions/${orsProfile}/json?coordinates=${coords}`,
      {
        headers: {
          Authorization: apiKey,
          Accept: "application/json, application/geo+json"
        }
      }
    );
    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: "OpenRouteService error", detail: text });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router34.get("/geocode/search", async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENROUTESERVICE_API_KEY not configured" });
      return;
    }
    const { text } = req.query;
    if (!text) {
      res.status(400).json({ error: "text query param is required" });
      return;
    }
    const response = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(text)}&boundary.country=IND&size=5`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) {
      const text2 = await response.text();
      res.status(response.status).json({ error: "Geocode error", detail: text2 });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var routing_default = router34;

// server/routes/delivery-location.ts
var import_express35 = require("express");
var router35 = (0, import_express35.Router)();
router35.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { lat, lng, heading, speed, accuracy } = req.body;
    if (lat == null || lng == null) {
      res.status(400).json({ error: "lat and lng are required" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("delivery_live_locations").upsert(
      {
        exec_id: user.id,
        lat,
        lng,
        heading: heading || null,
        speed: speed || null,
        accuracy: accuracy || null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "exec_id" }
    ).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router35.get("/:execId", async (req, res) => {
  try {
    const { execId } = req.params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("delivery_live_locations").select("*").eq("exec_id", execId).single();
    if (error && error.code !== "PGRST116") {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var delivery_location_default = router35;

// server/routes/vendor-onboarding.ts
var import_express36 = require("express");
var router36 = (0, import_express36.Router)();
router36.post("/approve", async (req, res) => {
  try {
    const { vendor_id, owner_id } = req.body;
    if (!vendor_id) {
      res.status(400).json({ error: "vendor_id is required" });
      return;
    }
    const admin = createAdminClient();
    const { data: vendor, error: fetchErr } = await admin.from("vendors").select("*").eq("id", vendor_id).single();
    if (fetchErr || !vendor) {
      res.status(404).json({ error: "Vendor not found" });
      return;
    }
    const { data, error } = await admin.from("vendors").update({
      kyc_status: "approved",
      verified: true,
      is_open: true
    }).eq("id", vendor_id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (owner_id) {
      await admin.from("user_profiles").update({ role: "vendor" }).eq("id", owner_id);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router36.post("/reject", async (req, res) => {
  try {
    const { vendor_id, reason } = req.body;
    if (!vendor_id) {
      res.status(400).json({ error: "vendor_id is required" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("vendors").update({
      kyc_status: "rejected",
      verified: false,
      rejection_reason: reason || null
    }).eq("id", vendor_id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router36.get("/pending", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("vendors").select("*, owner:owner_id(id, name, email, phone)").in("kyc_status", ["pending", "not_submitted"]).order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_onboarding_default = router36;

// server/routes/payments.ts
var import_express37 = require("express");
var router37 = (0, import_express37.Router)();
router37.post("/create-order", async (req, res) => {
  try {
    const { amount, currency, order_id } = req.body;
    if (!amount || !order_id) {
      res.status(400).json({ error: "amount and order_id are required" });
      return;
    }
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: currency || "INR",
        receipt: order_id,
        payment_capture: 1
      })
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.description || "Razorpay error" });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router37.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing payment verification fields" });
      return;
    }
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const crypto3 = await import("crypto");
    const expectedSig = crypto3.createHmac("sha256", razorpayKeySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }
    const admin = createAdminClient();
    const update = {
      payment_status: "paid",
      razorpay_payment_id,
      razorpay_order_id
    };
    if (order_id) {
      await admin.from("orders").update(update).eq("id", order_id);
    }
    res.json({ success: true, payment_id: razorpay_payment_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router37.post("/wallet/add", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valid amount required" });
      return;
    }
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    await admin.rpc("add_wallet_funds", { user_id: user.id, amount });
    await admin.from("wallet_transactions").insert({
      user_id: user.id,
      type: "credit",
      amount,
      description: "Wallet top-up via payment gateway"
    });
    const { data: profile } = await admin.from("user_profiles").select("wallet_balance").eq("id", user.id).single();
    res.json({ balance: profile?.wallet_balance || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var payments_default = router37;

// server/app.ts
var app = (0, import_express38.default)();
app.use((0, import_cors.default)({ origin: true, credentials: true }));
app.use(import_express38.default.json());
app.use((0, import_cookie_parser.default)());
app.use(authMiddleware);
app.get("/api", (_req, res) => res.json({ message: "Laundry Home API" }));
app.use("/api/auth", auth_default);
app.use("/api/orders", orders_default);
app.use("/api/vendors", vendors_default);
app.use("/api/addresses", addresses_default);
app.use("/api/delivery-tasks", delivery_tasks_default);
app.use("/api/delivery-executives", delivery_executives_default);
app.use("/api/notifications", notifications_default);
app.use("/api/slots", slots_default);
app.use("/api/wallet", wallet_default);
app.use("/api/reviews", reviews_default);
app.use("/api/services", services_default);
app.use("/api/coupons", coupons_default);
app.use("/api/admin", admin_default);
app.use("/api/vendor/analytics", vendor_analytics_default);
app.use("/api/subscriptions", subscriptions_default);
app.use("/api/vendor/staff", vendor_staff_default);
app.use("/api/garments", garments_default);
app.use("/api/wallet/methods", wallet_methods_default);
app.use("/api/coupons/validate", coupon_validate_default);
app.use("/api/support/tickets", support_tickets_default);
app.use("/api/admin/campaigns", admin_campaigns_default);
app.use("/api/admin/features", admin_features_default);
app.use("/api/admin/audit-logs", admin_audit_logs_default);
app.use("/api/admin/integrations", admin_integrations_default);
app.use("/api/admin/reports", admin_reports_default);
app.use("/api/admin/users", admin_users_default);
app.use("/api/admin/config", admin_config_default);
app.use("/api/admin/rbac", admin_rbac_default);
app.use("/api/admin/commission", admin_commission_default);
app.use("/api/order-stages", order_stages_default);
app.use("/api/chat", chat_default);
app.use("/api/favorites", favorites_default);
app.use("/api/geocode", geocode_default);
app.use("/api/routing", routing_default);
app.use("/api/delivery/location", delivery_location_default);
app.use("/api/vendor/onboarding", vendor_onboarding_default);
app.use("/api/payments", payments_default);
var app_default = app;

// server/api-entry.ts
var api_entry_default = app_default;
