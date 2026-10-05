"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
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

// server/supabase.ts
var supabase_exports = {};
__export(supabase_exports, {
  createAdminClient: () => createAdminClient,
  createServerClientWithCookies: () => createServerClientWithCookies,
  ensureSystemTables: () => ensureSystemTables
});
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
async function ensureSystemTables() {
  const admin = createAdminClient();
  const { error: rolesErr } = await admin.rpc("exec_sql", {
    query: `
      create table if not exists roles (
        name text primary key,
        label text not null,
        description text,
        is_system_role boolean not null default true,
        created_at timestamptz not null default now()
      );

      create table if not exists role_permissions (
        id uuid primary key default gen_random_uuid(),
        role text not null references roles(name) on delete cascade,
        resource text not null,
        action text not null,
        allowed boolean not null default false,
        created_at timestamptz not null default now(),
        unique(role, resource, action)
      );

      insert into roles (name, label, description) values
        ('customer',   'Customer',     'End users who place laundry orders'),
        ('vendor',     'Vendor',       'Laundry service providers'),
        ('delivery',   'Delivery Exec','Delivery personnel for pickup/drop-off'),
        ('admin',      'Admin',        'Platform administrators with elevated access'),
        ('superadmin', 'Super Admin',  'Full platform control with all permissions')
      on conflict (name) do nothing;
    `
  });
  if (rolesErr) {
    const { data: existingRoles } = await admin.from("roles").select("name").limit(1);
    if (!existingRoles || existingRoles.length === 0) {
      console.warn("RBAC tables not yet created. Run migration 00008_rbac_tables.sql manually via Supabase dashboard SQL editor.");
    }
    return;
  }
  const allResources = ["users", "vendors", "orders", "system_config", "features", "audit_logs", "integrations", "rbac", "campaigns", "reports"];
  async function seedRole(role, resources, actions, allowed) {
    for (const r of resources) {
      for (const action of actions) {
        try {
          await admin.from("role_permissions").upsert(
            { role, resource: r, action, allowed },
            { onConflict: "role,resource,action", ignoreDuplicates: false }
          );
        } catch {
        }
      }
    }
  }
  const allActions = ["view", "create", "edit", "delete", "manage"];
  const adminResources = ["users", "vendors", "orders", "features", "audit_logs", "integrations", "campaigns", "reports"];
  const crud = ["view", "create", "edit", "delete"];
  const vewEdt = ["view", "edit"];
  const vewCrt = ["view", "create"];
  await seedRole("superadmin", allResources, allActions, true);
  await seedRole("admin", adminResources, crud, true);
  await seedRole("admin", ["rbac", "system_config"], ["view"], true);
  await seedRole("vendor", ["orders"], vewCrt, true);
  await seedRole("vendor", ["vendors"], vewEdt, true);
  await seedRole("delivery", ["orders"], vewEdt, true);
  await seedRole("delivery", ["vendors"], ["view"], true);
  await seedRole("customer", ["orders"], vewCrt, true);
  await seedRole("customer", ["vendors"], ["view"], true);
  console.log("RBAC tables and permissions seeded.");
}
var import_supabase_js, import_ssr;
var init_supabase = __esm({
  "server/supabase.ts"() {
    "use strict";
    import_supabase_js = require("@supabase/supabase-js");
    import_ssr = require("@supabase/ssr");
  }
});

// server/api-entry.ts
var api_entry_exports = {};
__export(api_entry_exports, {
  default: () => api_entry_default
});
module.exports = __toCommonJS(api_entry_exports);

// server/middleware/auth.ts
init_supabase();
var ROLE_ROUTES = {
  "/api/admin": ["admin", "superadmin"],
  "/api/vendor": ["vendor", "admin", "superadmin"],
  "/api/delivery": ["delivery", "admin", "superadmin"]
};
var PUBLIC_ROUTES = [
  "/api/auth/",
  "/api/services",
  "/api/coupons",
  "/api/vendors",
  "/api/slots",
  "/api/seed",
  "/api/subscriptions/plans",
  "/api/geocode",
  "/api/config/customer"
];
async function authMiddleware(req, res, next) {
  const pathname = req.path;
  if (!pathname.startsWith("/api/")) {
    next();
    return;
  }
  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    next();
    return;
  }
  const matchedRoleRoute = Object.entries(ROLE_ROUTES).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
  if (matchedRoleRoute) {
    try {
      const cookieGetter = (name) => req.cookies?.[name];
      const supabase = createServerClientWithCookies(cookieGetter);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      req.user = user;
      const admin = createAdminClient();
      const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
      const userRole = profile?.role || "customer";
      req.userRole = userRole;
      if (!matchedRoleRoute[1].includes(userRole)) {
        res.status(403).json({ error: "Forbidden: insufficient role" });
        return;
      }
      next();
      return;
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  try {
    const cookieGetter = (name) => req.cookies?.[name];
    const supabase = createServerClientWithCookies(cookieGetter);
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    if (getUserError) {
      console.error("getUser error:", getUserError.message);
    }
    if (!user) {
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
var import_express2 = require("express");
init_supabase();
var router = (0, import_express2.Router)();
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

// server/lib/area-cache.ts
init_supabase();
var cache = null;
var lastFetch = 0;
var TTL_MS = 5 * 60 * 1e3;
async function getAreas() {
  const now = Date.now();
  if (cache && now - lastFetch < TTL_MS) return cache;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("service_areas").select("*").eq("is_active", true);
  if (error) {
    console.error("area-cache: failed to fetch areas", error.message);
    return cache || [];
  }
  cache = (data || []).map((a) => ({
    id: a.id,
    cityId: a.city_id,
    zone: a.zone,
    areaName: a.area_name,
    pincode: a.pincode,
    lat: parseFloat(a.lat),
    lng: parseFloat(a.lng),
    isActive: a.is_active,
    hasPickup: a.has_pickup,
    hasDelivery: a.has_delivery,
    expressAvailable: a.express_available
  }));
  lastFetch = now;
  return cache;
}
function invalidateAreaCache() {
  cache = null;
  lastFetch = 0;
}
function findArea(name) {
  if (!name) return void 0;
  const q = name.trim().toLowerCase();
  return (cache || []).find(
    (a) => a.areaName.toLowerCase() === q
  );
}
function findClosestArea(lat, lng) {
  const areas = cache || [];
  if (areas.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const a of areas) {
    const d = haversineKm(lat, lng, a.lat, a.lng);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}
function findAreasWithinRadius(lat, lng, radiusKm) {
  const areas = cache || [];
  return areas.filter((a) => {
    const d = haversineKm(lat, lng, a.lat, a.lng);
    return d <= radiusKm;
  });
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// server/routes/areas.ts
var import_express3 = require("express");
init_supabase();
var router2 = (0, import_express3.Router)();
router2.get("/", async (req, res) => {
  try {
    const city = req.query.city;
    const supabase = createAdminClient();
    let query = supabase.from("service_areas").select("*, cities!inner(name, state)").eq("is_active", true);
    if (city) {
      query = query.eq("cities.name", city);
    }
    const { data, error } = await query.order("area_name");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/cities", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("cities").select("id, name, state").eq("is_active", true).order("name");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/vendor/:vendorId", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendor_service_areas").select("service_areas(*)").eq("vendor_id", req.params.vendorId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data || []).map((vsa) => vsa.service_areas).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/cities", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { name, state } = req.body;
    if (!name) {
      res.status(400).json({ error: "City name is required" });
      return;
    }
    const { data, error } = await supabase.from("cities").insert({ name, state: state || "Karnataka" }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { city_id, zone, area_name, pincode, lat, lng, has_pickup, has_delivery, express_available } = req.body;
    if (!city_id || !area_name) {
      res.status(400).json({ error: "city_id and area_name are required" });
      return;
    }
    const { data, error } = await supabase.from("service_areas").insert({
      city_id,
      zone: zone || null,
      area_name,
      pincode: pincode || null,
      lat: lat || null,
      lng: lng || null,
      has_pickup: has_pickup ?? true,
      has_delivery: has_delivery ?? true,
      express_available: express_available ?? false
    }).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    invalidateAreaCache();
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.put("/cities/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("cities").update(req.body).eq("id", req.params.id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.put("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("service_areas").update(req.body).eq("id", req.params.id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    invalidateAreaCache();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.delete("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("service_areas").update({ is_active: false }).eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    invalidateAreaCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/vendor", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { vendor_id, area_ids } = req.body;
    if (!vendor_id || !area_ids || !Array.isArray(area_ids)) {
      res.status(400).json({ error: "vendor_id and area_ids[] are required" });
      return;
    }
    await supabase.from("vendor_service_areas").delete().eq("vendor_id", vendor_id);
    if (area_ids.length > 0) {
      const { error } = await supabase.from("vendor_service_areas").insert(
        area_ids.map((area_id) => ({ vendor_id, area_id }))
      );
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.json({ success: true, assignedAreas: area_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/waitlist", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { area_name, pincode, contact, contact_type } = req.body;
    if (!area_name || !contact) {
      res.status(400).json({ error: "area_name and contact are required" });
      return;
    }
    const { data, error } = await supabase.from("area_waitlist").insert({
      area_name,
      pincode: pincode || null,
      contact,
      contact_type: contact_type || "email"
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
router2.get("/waitlist", async (req, res) => {
  try {
    const { createServerClientWithCookies: createServerClientWithCookies2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
    const cookieClient = createServerClientWithCookies2((name) => req.cookies?.[name]);
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
    if (!["admin", "superadmin"].includes(profile?.role || "customer")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { data, error } = await admin.from("area_waitlist").select("*, cities(name)").order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var areas_default = router2;

// server/routes/auth.ts
var import_express4 = require("express");
init_supabase();
var router3 = (0, import_express4.Router)();
router3.post("/login", async (req, res) => {
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
router3.post("/signup", async (req, res) => {
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
router3.post("/logout", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      void 0,
      (name) => res.clearCookie(name, { path: "/" })
    );
    await supabase.auth.signOut();
    const paths = ["/", "/api", "/auth"];
    for (const name of Object.keys(req.cookies || {})) {
      for (const p of paths) {
        res.clearCookie(name, { path: p });
        res.clearCookie(name, { path: p, domain: req.hostname });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.get("/session", async (req, res) => {
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
router3.post("/otp", async (req, res) => {
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
router3.patch("/profile", async (req, res) => {
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
router3.get("/callback", (req, res) => {
  const host = req.headers.host || "localhost:8080";
  const proto = req.headers["x-forwarded-proto"] || "http";
  const base = `${proto}://${host}`;
  res.redirect(`${base}/?${new URLSearchParams(req.query).toString()}`);
});
var auth_default = router3;

// server/pricing.ts
init_supabase();
var PLATFORM_FEE = 25;
var DELIVERY_FEE = 40;
var EXPRESS_SURCHARGE = 50;
var TAX_RATE = 0.18;
var REWARD_POINTS_RATE = 100;
async function computeSubtotal(items, admin, vendorId) {
  const itemMasterIds = [...new Set(items.map((i) => i.itemId).filter(Boolean))];
  const serviceIds = [...new Set(items.map((i) => i.serviceId).filter(Boolean))];
  let serviceMap = {};
  if (serviceIds.length > 0) {
    const { data: services } = await admin.from("services").select("id, pricing_type, bag_price").in("id", serviceIds);
    for (const s of services || []) serviceMap[s.id] = s;
  }
  let defaultMap = {};
  if (itemMasterIds.length > 0) {
    const { data: serviceItems } = await admin.from("service_items").select("service_id, item_master_id, default_price").in("item_master_id", itemMasterIds);
    for (const si of serviceItems || []) {
      defaultMap[`${si.service_id}|${si.item_master_id}`] = si.default_price;
    }
  }
  let vendorMap = {};
  if (vendorId && itemMasterIds.length > 0) {
    const { data: vendorPrices } = await admin.from("vendor_service_prices").select("service_id, price, service_items!inner(item_master_id)").eq("vendor_id", vendorId).eq("is_active", true);
    for (const vp of vendorPrices || []) {
      const itemMasterId = vp.service_items?.item_master_id;
      if (itemMasterId) {
        vendorMap[`${vp.service_id}|${itemMasterId}`] = vp.price;
      }
    }
  }
  let subtotal = 0;
  let hasExpress = false;
  const lines = [];
  for (const item of items) {
    if (!item.serviceId) continue;
    const key = `${item.serviceId}|${item.itemId || ""}`;
    const svc = serviceMap[item.serviceId] || {};
    const pricingType = svc.pricing_type || "ITEM";
    let unitPrice = 0;
    if (pricingType === "BAG") {
      unitPrice = svc.bag_price || 0;
    } else if (pricingType === "WEIGHT") {
      unitPrice = 0;
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
async function calculatePricing(input) {
  const admin = createAdminClient();
  const steps = [];
  const { subtotal, hasExpress, lines } = await computeSubtotal(input.items, admin, input.vendorId);
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
    taxableAmount,
    taxes,
    platformFee,
    deliveryFee,
    expressSurcharge,
    surgeCharge,
    total,
    breakdown: steps,
    lines
  };
}
async function applyPricingToOrder(orderId, orderCode, pricing, userId) {
  const admin = createAdminClient();
  const emptyResult = {
    walletApplied: false,
    walletAmount: 0,
    walletTransactionId: null,
    paymentTransactionId: null,
    balanceBefore: null,
    balanceAfter: null
  };
  if (pricing.rewardPointsUsed > 0) {
    const { data: profile } = await admin.from("user_profiles").select("loyalty_points").eq("id", userId).single();
    const current = profile?.loyalty_points || 0;
    if (current >= pricing.rewardPointsUsed) {
      await admin.from("user_profiles").update({ loyalty_points: current - pricing.rewardPointsUsed }).eq("id", userId);
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
          `Insufficient wallet balance: need \u20B9${pricing.walletUsed}, have \u20B9${rpcResult.wallet_balance}`
        );
      }
      if (rpcResult?.error === "amount_exceeds_remaining") {
        throw new Error(
          `Amount \u20B9${pricing.walletUsed} exceeds remaining payable \u20B9${rpcResult.remaining}`
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
      balanceAfter: rpcResult.balance_after ?? null
    };
  }
  if (pricing.couponCode) {
    const { data: coupon } = await admin.from("coupons").select("code, used_count").eq("code", pricing.couponCode.toUpperCase()).single();
    if (coupon) {
      await admin.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("code", coupon.code);
    }
  }
  return walletResult;
}

// server/lib/schedule.ts
var SCHEDULE_ADD_ON_SLUGS = {
  SAME_DAY: "same_day_delivery",
  TWENTY_FOUR_HOUR: "24_hour_delivery",
  EXPRESS_PICKUP: "express_pickup"
};
var EXPRESS_PICKUP_SLOT = "Express Pickup (within 30 mins)";
var EXPRESS_PICKUP_CUTOFF = { hours: 18, minutes: 30 };
var PICKUP_SLOTS = [
  "7:00 AM - 9:00 AM",
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM"
];
var DELIVERY_SLOTS = [...PICKUP_SLOTS];
function toMinutes(t) {
  return t.hours * 60 + t.minutes;
}
function parseSlot(slot) {
  const parts = slot.split(" - ");
  const parse = (t) => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    if (m[3]?.toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3]?.toUpperCase() === "AM" && h === 12) h = 0;
    return { hours: h, minutes: min };
  };
  const start = parse(parts[0]?.trim() || "");
  const end = parse(parts[1]?.trim() || "");
  if (!start || !end) return null;
  return { start, end };
}
function toMs(date) {
  return Date.parse(`${date}T00:00:00Z`);
}
function dateDiffDays(a, b) {
  return Math.round((toMs(a) - toMs(b)) / 864e5);
}
function todayISO(now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function expressAvailable(now) {
  return now.getHours() < EXPRESS_PICKUP_CUTOFF.hours || now.getHours() === EXPRESS_PICKUP_CUTOFF.hours && now.getMinutes() < EXPRESS_PICKUP_CUTOFF.minutes;
}
function validateSchedule(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const pickupDate = input.pickupDate;
  const deliveryDate = input.deliveryDate;
  const pickupMode = input.pickupMode || "scheduled";
  const deliverySpeed = input.deliverySpeed || "standard";
  if (!pickupDate || !deliveryDate) {
    return fail("Pickup and delivery dates are required.");
  }
  if (pickupMode === "express") {
    if (pickupDate !== todayISO(now)) {
      return fail("Express pickup is only available for today.");
    }
    if (!expressAvailable(now)) {
      return fail("Express pickup is no longer available today (cutoff is 6:30 PM).");
    }
    if (input.pickupSlot && input.pickupSlot !== EXPRESS_PICKUP_SLOT && !PICKUP_SLOTS.includes(input.pickupSlot)) {
      return fail("The selected pickup slot is not available.");
    }
  } else if (!PICKUP_SLOTS.includes(input.pickupSlot)) {
    return fail("The selected pickup slot is not available.");
  }
  if (!DELIVERY_SLOTS.includes(input.deliverySlot)) {
    return fail("The selected delivery slot is not available.");
  }
  if (dateDiffDays(deliveryDate, pickupDate) < 0) {
    return fail("Delivery cannot be scheduled before pickup.");
  }
  if (deliverySpeed === "standard" && dateDiffDays(deliveryDate, pickupDate) < 2) {
    return fail("Standard delivery requires delivery at least 48 hours after pickup.");
  }
  if (deliverySpeed === "same_day") {
    if (dateDiffDays(deliveryDate, pickupDate) !== 0) {
      return fail("Same-day delivery requires delivery on the pickup date.");
    }
    const p = parseSlot(input.pickupSlot);
    const d = parseSlot(input.deliverySlot);
    if (p && d && toMinutes(d.start) < toMinutes(p.end)) {
      return fail("The same-day delivery slot must start after the pickup window ends.");
    }
  } else if (deliverySpeed === "24_hour") {
    if (dateDiffDays(deliveryDate, pickupDate) !== 1) {
      return fail("24-hour delivery requires delivery the day after pickup.");
    }
    const p = parseSlot(input.pickupSlot);
    const d = parseSlot(input.deliverySlot);
    if (p && d && toMinutes(d.end) > toMinutes(p.end)) {
      return fail("The 24-hour delivery window must end within 24 hours of the pickup window.");
    }
  }
  return { ok: true };
}
function fail(message) {
  return { ok: false, error: "SCHEDULE_SLOT_UNAVAILABLE", message };
}

// server/lib/photo-upload.ts
var ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
var MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
var MAX_ORDER_PHOTOS = 5;
var MAX_TICKET_PHOTOS = 3;
function matchesMagic(mimeType, buf) {
  if (mimeType === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255;
  }
  if (mimeType === "image/png") {
    return buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71;
  }
  return buf.length >= 12 && buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80;
}
function validatePhotoDataUrl(dataUrl, maxBytes = MAX_PHOTO_BYTES) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "photo_data must be an image data URL" };
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    return { ok: false, error: "Unsupported image type \u2014 use JPEG, PNG or WebP" };
  }
  const mimeType = match[1];
  const base64 = match[2];
  let buf;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Invalid image data" };
  }
  if (buf.length === 0) {
    return { ok: false, error: "Invalid image data" };
  }
  if (buf.length > maxBytes) {
    return { ok: false, error: `Photo exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit` };
  }
  if (!matchesMagic(mimeType, buf)) {
    return { ok: false, error: "File content does not match its image type" };
  }
  return { ok: true, mimeType, bytes: buf.length };
}

// server/routes/vendor-reports-utils.ts
init_supabase();
async function resolveVendorId(req, res) {
  const user = req.user;
  const role = req.userRole;
  if (role === "admin" || role === "superadmin") {
    const vid = req.query.vendorId;
    if (vid) return vid;
  }
  const admin = createAdminClient();
  const { data: vendor } = await admin.from("vendors").select("id").eq("owner_id", user.id).single();
  if (!vendor) {
    res.status(404).json({ error: "Vendor profile not found" });
    return null;
  }
  return vendor.id;
}
var COLORS = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316"];
var CUSTOMER_SEGMENTS = [
  { key: "one_time", label: "One-Time", min: 1, max: 1 },
  { key: "occasional", label: "Occasional", min: 2, max: 3 },
  { key: "regular", label: "Regular", min: 4, max: 6 },
  { key: "loyal", label: "Loyal", min: 7, max: 10 },
  { key: "vip", label: "VIP", min: 11, max: Infinity }
];
var DEFAULT_TIMEZONE = "Asia/Kolkata";
var TIMEZONE_OFFSETS = {
  "Asia/Kolkata": 330,
  "Asia/Kolkata_IST": 330,
  "Asia/Karachi": 300,
  "Asia/Dubai": 240,
  "Asia/Bangkok": 420,
  "Asia/Singapore": 480,
  "Asia/Shanghai": 480,
  "Asia/Tokyo": 540,
  "Europe/London": 0,
  "Europe/Paris": 60,
  "Europe/Berlin": 60,
  "America/New_York": -300,
  "America/Chicago": -360,
  "America/Denver": -420,
  "America/Los_Angeles": -480,
  "UTC": 0
};
function getOffsetMinutes(timezone) {
  return TIMEZONE_OFFSETS[timezone] ?? 330;
}
function calendarDateToUTC(dateStr, timezone, isStart) {
  const offset = getOffsetMinutes(timezone);
  if (isStart) {
    const d = /* @__PURE__ */ new Date(`${dateStr}T00:00:00`);
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString();
  } else {
    const d = /* @__PURE__ */ new Date(`${dateStr}T23:59:59.999`);
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString();
  }
}
async function resolveBusinessTimezone(supabase, vendorId) {
  try {
    const { data: vendor } = await supabase.from("vendors").select("timezone").eq("id", vendorId).single();
    return vendor?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
function parseDateRange(req) {
  const now = /* @__PURE__ */ new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  const startStr = req.query.startDate || defaultStart.toISOString().slice(0, 10);
  const endStr = req.query.endDate || now.toISOString().slice(0, 10);
  const service = req.query.service || void 0;
  const status = req.query.status || void 0;
  return { startStr, endStr, service, status };
}
function resolveDateBoundaries(startStr, endStr, timezone) {
  return {
    startDate: calendarDateToUTC(startStr, timezone, true),
    endDate: calendarDateToUTC(endStr, timezone, false)
  };
}
function buildOrderQuery(supabase, vendorId, startDate, endDate, service, status) {
  let q = supabase.from("orders").select("*").eq("vendor_id", vendorId).gte("created_at", startDate).lte("created_at", endDate);
  if (status) q = q.eq("status", status);
  if (service) q = q.contains("items_v2", [{ serviceName: service }]);
  return q;
}
async function loadStageEvents(supabase, orderIds) {
  if (orderIds.length === 0) return {};
  const { data: events } = await supabase.from("order_stage_events").select("order_id, stage, timestamp").in("order_id", orderIds).order("timestamp", { ascending: true });
  if (!events || events.length === 0) return {};
  const byOrder = {};
  for (const e of events) {
    if (!byOrder[e.order_id]) byOrder[e.order_id] = {};
    if (!byOrder[e.order_id][e.stage]) {
      byOrder[e.order_id][e.stage] = e.timestamp;
    }
  }
  return byOrder;
}
function computeTurnaroundFromEvents(stageEvents) {
  const diffs = [];
  for (const stages of Object.values(stageEvents)) {
    const pickup = stages["pickup_completed"];
    const completion = stages["delivered"] ?? stages["completed"];
    if (pickup && completion) {
      const diff = (new Date(completion).getTime() - new Date(pickup).getTime()) / (1e3 * 60 * 60);
      if (diff >= 0) diffs.push(diff);
    }
  }
  if (diffs.length === 0) return null;
  return Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
}
function computeOnTimeRateFromEvents(stageEvents, orders) {
  const eligible = orders.filter(
    (o) => ["completed", "delivered"].includes(o.status) && o.estimated_delivery_at
  );
  if (eligible.length === 0) return null;
  let onTime = 0;
  let counted = 0;
  for (const o of eligible) {
    const stages = stageEvents[o.id];
    if (!stages) continue;
    const completion = stages["delivered"] ?? stages["completed"];
    if (completion) {
      counted++;
      if (new Date(completion).getTime() <= new Date(o.estimated_delivery_at).getTime()) {
        onTime++;
      }
    }
  }
  if (counted === 0) return null;
  return Math.round(onTime / counted * 100);
}
function computeRepeatRate(orders) {
  const customerCounts = {};
  orders.filter((o) => o.customer_id && ["completed", "delivered"].includes(o.status)).forEach((o) => {
    customerCounts[o.customer_id] = (customerCounts[o.customer_id] || 0) + 1;
  });
  const uniqueCustomers = Object.keys(customerCounts).length;
  if (uniqueCustomers === 0)
    return { repeatRate: 0, repeatCount: 0, uniqueCustomers: 0 };
  const repeatCount = Object.values(customerCounts).filter(
    (c) => c >= 2
  ).length;
  return {
    repeatRate: Math.round(repeatCount / uniqueCustomers * 100),
    repeatCount,
    uniqueCustomers
  };
}
function computeSegment(count) {
  for (const seg of CUSTOMER_SEGMENTS) {
    if (count >= seg.min && count <= seg.max) return seg.label;
  }
  return CUSTOMER_SEGMENTS[CUSTOMER_SEGMENTS.length - 1].label;
}
function computePeriodComparison(startDate, endDate, current, previous) {
  const revenueChange = previous.revenue > 0 ? Math.round(
    (current.revenue - previous.revenue) / previous.revenue * 100
  ) : 0;
  const ordersChange = previous.orders > 0 ? Math.round(
    (current.orders - previous.orders) / previous.orders * 100
  ) : 0;
  return { revenueChange, ordersChange };
}

// server/routes/orders.ts
var import_express5 = require("express");
init_supabase();
function deriveScheduleModes(serviceSlugs, orderItems) {
  const enabled = /* @__PURE__ */ new Set();
  for (const line of orderItems) {
    const slug = line.serviceId ? serviceSlugs.get(line.serviceId) : void 0;
    if (slug) enabled.add(slug);
  }
  const pickupMode = enabled.has(SCHEDULE_ADD_ON_SLUGS.EXPRESS_PICKUP) ? "express" : "scheduled";
  const deliverySpeed = enabled.has(SCHEDULE_ADD_ON_SLUGS.SAME_DAY) ? "same_day" : enabled.has(SCHEDULE_ADD_ON_SLUGS.TWENTY_FOUR_HOUR) ? "24_hour" : "standard";
  return { pickupMode, deliverySpeed };
}
function scheduleValidationPayload(body, modes) {
  return {
    pickupDate: body.pickup_date || null,
    pickupSlot: body.pickup_slot || "",
    deliveryDate: body.delivery_date || null,
    deliverySlot: body.delivery_slot || "",
    pickupMode: body.pickup_mode ?? modes.pickupMode,
    deliverySpeed: body.delivery_speed ?? modes.deliverySpeed
  };
}
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
var router4 = (0, import_express5.Router)();
router4.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    const deliveryExecutiveId = req.query.deliveryExecutiveId;
    const status = req.query.status;
    const search = req.query.search;
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
    if (search) query = query.or(`code.ilike.%${search}%,customer_name.ilike.%${search}%,vendor_name.ilike.%${search}%,status.ilike.%${search}%`);
    const startDateStr = req.query.startDate;
    const endDateStr = req.query.endDate;
    const service = req.query.service;
    const delayed = req.query.delayed === "true";
    if (startDateStr && endDateStr && vendorId) {
      const tz = await resolveBusinessTimezone(admin, vendorId);
      const { startDate, endDate } = resolveDateBoundaries(startDateStr, endDateStr, tz);
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }
    if (service) {
      query = query.contains("items_v2", [{ serviceName: service }]);
    }
    if (delayed) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      query = query.not("status", "eq", "completed").not("status", "eq", "cancelled").not("status", "eq", "delivered").not("estimated_delivery_at", "is", null).lt("estimated_delivery_at", now);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[orders] DB error:", error.message);
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/pricing", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const pricing = await calculatePricing({
      items: req.body.items || [],
      vendorId: req.body.vendorId,
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
router4.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = req.body;
    const adminClient = createAdminClient();
    const orderItems = body.items || body.orderItems || [];
    const { data: profile, error: profileErr } = await adminClient.from("user_profiles").select("name, avatar").eq("id", user.id).single();
    if (profileErr) {
      console.error("[orders] profile lookup error for user", user.id, profileErr);
    }
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
      items: orderItems,
      vendorId: body.vendorId || body.vendor_id,
      couponCode: body.couponCode,
      redeemPoints: body.redeemPoints || body.redeem_points,
      useWalletAmount: body.useWalletAmount || body.use_wallet_amount || 0,
      userId: user.id,
      pickupArea: body.pickup_area,
      pickupDate: body.pickup_date,
      pickupSlot: body.pickup_slot
    });
    const serviceIds = [...new Set(orderItems.map((i) => i.serviceId).filter(Boolean))];
    const itemIds = [...new Set(orderItems.map((i) => i.itemId).filter(Boolean))];
    const [{ data: svcRows }, { data: itemRows }] = await Promise.all([
      serviceIds.length ? adminClient.from("services").select("id, name, pricing_type, slug").in("id", serviceIds) : Promise.resolve({ data: [] }),
      itemIds.length ? adminClient.from("item_master").select("id, item_name").in("id", itemIds) : Promise.resolve({ data: [] })
    ]);
    const svcMap = new Map((svcRows || []).map((s) => [s.id, s]));
    const itemMap = new Map((itemRows || []).map((i) => [i.id, i]));
    const linePrices = new Map((pricing.lines || []).map((l) => [`${l.serviceId}|${l.itemId || ""}`, l]));
    const scheduleModes = deriveScheduleModes(
      new Map((svcRows || []).map((s) => [s.id, s.slug])),
      orderItems
    );
    const scheduleCheck = validateSchedule(scheduleValidationPayload(body, scheduleModes));
    if (!scheduleCheck.ok) {
      res.status(400).json({ error: scheduleCheck.error, message: scheduleCheck.message });
      return;
    }
    const itemsSnapshot = orderItems.map((i) => {
      const svc = svcMap.get(i.serviceId) || {};
      const line = linePrices.get(`${i.serviceId}|${i.itemId || ""}`);
      const pricingType = svc.pricing_type || "ITEM";
      return {
        serviceId: i.serviceId,
        serviceName: svc.name || "Service",
        itemId: i.itemId || null,
        itemName: i.itemId && itemMap.get(i.itemId)?.item_name || i.itemName || "",
        qty: i.qty || 0,
        unit: pricingType === "BAG" ? "bag" : i.unit || "pc",
        unitPrice: line?.unitPrice || 0,
        express: !!i.express,
        specialInstructions: i.specialInstructions || []
      };
    });
    const bagLines = itemsSnapshot.filter((i) => svcMap.get(i.serviceId)?.pricing_type === "BAG");
    const itemLines = itemsSnapshot.filter((i) => svcMap.get(i.serviceId)?.pricing_type !== "BAG");
    const bookingType = bagLines.length > 0 && itemLines.length > 0 ? "mixed" : bagLines.length > 0 ? "laundry_bag" : "count_items";
    const laundryBagQty = bagLines.reduce((sum, i) => sum + i.qty, 0);
    const orderData = {
      code,
      customer_id: user.id,
      customer_name: profile?.name || "Customer",
      customer_avatar: profile?.avatar || "",
      vendor_id: hasVendor ? body.vendor_id : null,
      vendor_name: vendorName,
      vendor_logo_initials: vendorLogoInitials,
      vendor_logo_color: vendorLogoColor,
      status: hasVendor ? "vendor_assigned" : "placed",
      current_stage_index: hasVendor ? 1 : 0,
      items: itemsSnapshot,
      booking_type: bookingType,
      laundry_bag_qty: laundryBagQty > 0 ? laundryBagQty : null,
      items_v2: true,
      pickup_address: body.pickup_address || "",
      pickup_area: body.pickup_area || "",
      pickup_date: body.pickup_date || null,
      pickup_slot: body.pickup_slot || "",
      delivery_date: body.delivery_date || null,
      delivery_slot: body.delivery_slot || "",
      pickup_mode: scheduleModes.pickupMode,
      delivery_speed: scheduleModes.deliverySpeed,
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
      payment_status: "pending",
      taxable_amount: pricing.taxableAmount,
      wallet_paid_amount: 0,
      gateway_paid_amount: 0,
      tender_type: "cod",
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
    const orderItemRows = itemsSnapshot.filter((i) => i.itemId).map((i) => ({
      order_id: data.id,
      service_id: i.serviceId,
      item_id: i.itemId,
      booking_type: svcMap.get(i.serviceId)?.pricing_type === "BAG" ? "laundry_bag" : "count_items",
      customer_qty: i.qty,
      unit_price: i.unitPrice,
      special_instructions: i.specialInstructions || []
    }));
    if (orderItemRows.length > 0) {
      const { error: itemsErr } = await adminClient.from("order_items").insert(orderItemRows);
      if (itemsErr) console.error("[orders] order_items insert error:", itemsErr.message);
    }
    let pricingResult;
    try {
      pricingResult = await applyPricingToOrder(data.id, data.code, pricing, user.id);
    } catch (walletErr) {
      await adminClient.from("orders").update({
        wallet_paid_amount: 0,
        tender_type: "cod"
      }).eq("id", data.id);
      throw walletErr;
    }
    const walletPaid = pricingResult.walletApplied ? pricingResult.walletAmount : 0;
    const gatewayPaid = 0;
    const isFullyPaid = walletPaid >= pricing.total && pricing.total > 0;
    await adminClient.from("orders").update({
      wallet_paid_amount: walletPaid,
      gateway_paid_amount: gatewayPaid,
      tender_type: walletPaid > 0 ? "wallet" : "cod",
      payment_status: isFullyPaid ? "paid" : "pending"
    }).eq("id", data.id);
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
router4.get("/:id", async (req, res) => {
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
router4.patch("/:id", async (req, res) => {
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
    const scheduleFields = ["pickup_date", "pickup_slot", "delivery_date", "delivery_slot", "pickup_mode", "delivery_speed"];
    if (scheduleFields.some((f) => body[f] !== void 0)) {
      const items = order.items || [];
      const svcIds = [...new Set(items.map((i) => i.serviceId).filter(Boolean))];
      const svcSlugs = /* @__PURE__ */ new Map();
      if (svcIds.length > 0) {
        const { data: svcRows } = await supabase.from("services").select("id, slug").in("id", svcIds);
        for (const s of svcRows || []) if (s.slug) svcSlugs.set(s.id, s.slug);
      }
      const orderModes = deriveScheduleModes(svcSlugs, items);
      const mergedBody = {
        pickup_date: body.pickup_date ?? order.pickup_date,
        pickup_slot: body.pickup_slot ?? order.pickup_slot ?? "",
        delivery_date: body.delivery_date ?? order.delivery_date,
        delivery_slot: body.delivery_slot ?? order.delivery_slot ?? "",
        pickup_mode: body.pickup_mode ?? order.pickup_mode ?? orderModes.pickupMode,
        delivery_speed: body.delivery_speed ?? order.delivery_speed ?? orderModes.deliverySpeed
      };
      const scheduleCheck = validateSchedule(scheduleValidationPayload(mergedBody, orderModes));
      if (!scheduleCheck.ok) {
        res.status(400).json({ error: scheduleCheck.error, message: scheduleCheck.message });
        return;
      }
      for (const f of scheduleFields) {
        if (body[f] !== void 0) updatePayload[f] = body[f];
      }
    }
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
router4.post("/:id/photo", async (req, res) => {
  try {
    const { id } = req.params;
    const { photo_data } = req.body;
    if (!photo_data) {
      res.status(400).json({ error: "photo_data is required" });
      return;
    }
    const check = validatePhotoDataUrl(photo_data);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }
    const supabase = createAdminClient();
    const { data: order, error: fetchErr } = await supabase.from("orders").select("photos").eq("id", id).single();
    if (fetchErr) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const existing = order.photos || [];
    if (existing.length >= MAX_ORDER_PHOTOS) {
      res.status(400).json({ error: `Photo limit reached \u2014 max ${MAX_ORDER_PHOTOS} photos per order` });
      return;
    }
    const photos = [...existing, photo_data];
    const { data, error } = await supabase.from("orders").update({ photos }).eq("id", id).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/:id/reject", async (req, res) => {
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
router4.post("/:id/assign-delivery", async (req, res) => {
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
router4.post("/:id/cancel", async (req, res) => {
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
router4.post("/reorder/:id", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { data: original, error: fetchError } = await supabase.from("orders").select("*").eq("id", id).eq("customer_id", user.id).single();
    if (fetchError || !original) return res.status(404).json({ error: "Order not found" });
    const newOrder = {
      customer_id: user.id,
      vendor_id: original.vendor_id,
      pickup_area: original.pickup_area,
      pickup_address: original.pickup_address,
      delivery_area: original.delivery_area,
      delivery_address: original.delivery_address,
      scheduled_pickup: new Date(Date.now() + 864e5).toISOString(),
      // tomorrow
      scheduled_delivery: null,
      notes: original.notes,
      total: original.total,
      status: "pending",
      current_stage_index: 0,
      garment_count: original.garment_count
    };
    const { data, error } = await supabase.from("orders").insert(newOrder).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var orders_default = router4;

// server/routes/vendors.ts
var import_express6 = require("express");
init_supabase();
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
    const d = haversineKm2(userLat, userLng, coords.lat, coords.lng);
    if (nameSimilar && (!best || d < best.dist)) {
      best = { ...coords, dist: d };
    }
  }
  if (best && best.dist < 15) return { lat: best.lat, lng: best.lng };
  return null;
}
function haversineKm2(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var router5 = (0, import_express6.Router)();
router5.get("/", async (req, res) => {
  try {
    const area = req.query.area;
    const isOpen = req.query.isOpen;
    const service = req.query.service;
    const ownerId = req.query.owner_id;
    const search = req.query.search;
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
    if (search) query = query.or(`name.ilike.%${search}%,area.ilike.%${search}%`);
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
          const d = haversineKm2(userLat, userLng, coords.lat, coords.lng);
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
router5.post("/", async (req, res) => {
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
router5.get("/:id", async (req, res) => {
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
router5.patch("/:id", async (req, res) => {
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
var vendors_default = router5;

// server/routes/delivery-tasks.ts
var import_express7 = require("express");
init_supabase();
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
var router6 = (0, import_express7.Router)();
router6.get("/", async (req, res) => {
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
router6.patch("/:id", async (req, res) => {
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
router6.post("/:id/otp", async (req, res) => {
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
router6.post("/:id/verify-otp", async (req, res) => {
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
router6.post("/:id/photo", async (req, res) => {
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
router6.post("/:id/signature", async (req, res) => {
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
var delivery_tasks_default = router6;

// server/routes/delivery-executives.ts
var import_express8 = require("express");
init_supabase();
var router7 = (0, import_express8.Router)();
function toRad(deg) {
  return deg * Math.PI / 180;
}
function haversineKm3(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
router7.get("/", async (_req, res) => {
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
    let liveLocations = {};
    if (execIds.length > 0) {
      const { data: live } = await admin.from("delivery_live_locations").select("exec_id, lat, lng, updated_at").in("exec_id", execIds);
      for (const row of live || []) {
        liveLocations[row.exec_id] = row;
      }
    }
    const result = (data || []).map((e) => {
      const live = liveLocations[e.id];
      const currentLat = live?.lat != null ? Number(live.lat) : e.current_lat ? Number(e.current_lat) : null;
      const currentLng = live?.lng != null ? Number(live.lng) : e.current_lng ? Number(e.current_lng) : null;
      return {
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        avatar: e.avatar,
        isAvailable: e.is_available,
        currentLat,
        currentLng,
        lastSeenAt: live?.updated_at || null,
        locationSource: live ? "live" : "profile",
        maxDailyOrders: e.max_daily_orders,
        assignedOrders: workloads[e.id] || 0
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router7.get("/available", async (req, res) => {
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
        distanceKm = haversineKm3(
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
router7.get("/earnings", async (req, res) => {
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
var delivery_executives_default = router7;

// server/routes/notifications.ts
var import_express9 = require("express");
init_supabase();
var router8 = (0, import_express9.Router)();
router8.get("/", async (req, res) => {
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
router8.patch("/:id", async (req, res) => {
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
var notifications_default = router8;

// server/routes/slots.ts
var import_express10 = require("express");
init_supabase();
var router9 = (0, import_express10.Router)();
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
router9.get("/", async (_req, res) => {
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
var slots_default = router9;

// server/routes/wallet.ts
var import_express11 = require("express");
init_supabase();
var router10 = (0, import_express11.Router)();
router10.get("/", async (req, res) => {
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
    res.json({
      balance: profile?.wallet_balance || 0,
      loyaltyPoints: profile?.loyalty_points || 0,
      transactions: transactions || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router10.post("/", async (_req, res) => {
  res.status(405).json({
    error: "Direct wallet top-up is disabled. Use /api/payments/wallet/topup/create-order instead."
  });
});
var wallet_default = router10;

// server/routes/reviews.ts
var import_express12 = require("express");
init_supabase();
var router11 = (0, import_express12.Router)();
router11.get("/", async (req, res) => {
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
router11.post("/", async (req, res) => {
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
var reviews_default = router11;

// server/routes/service-categories.ts
var import_express13 = require("express");
init_supabase();
var router12 = (0, import_express13.Router)();
router12.get("/", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("service_categories").select("*").order("display_order");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router12.post("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { name, slug, description, icon, display_order, is_active, grouping } = req.body;
    const { data, error } = await supabase.from("service_categories").insert({ name, slug, description, icon, display_order, is_active, grouping }).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router12.put("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { name, slug, description, icon, display_order, is_active, grouping } = req.body;
    const { data, error } = await supabase.from("service_categories").update({ name, slug, description, icon, display_order, is_active, grouping }).eq("id", req.params.id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router12.delete("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("service_categories").delete().eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var service_categories_default = router12;

// server/routes/service-items.ts
var import_express14 = require("express");
init_supabase();
var router13 = (0, import_express14.Router)();
router13.get("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    let query = supabase.from("service_items").select("*, services(name, unit)");
    if (req.query.include_inactive !== "true") {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query.order("item_name");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const result = (data || []).map((i) => ({
      id: i.id,
      serviceId: i.service_id,
      itemName: i.item_name,
      itemCategory: i.item_category,
      unit: i.unit,
      defaultPrice: i.default_price,
      estimatedTime: i.estimated_time,
      estimatedWeightKg: i.estimated_weight_kg,
      itemMasterId: i.item_master_id,
      isActive: i.is_active,
      service: i.services ? {
        id: i.services.id,
        name: i.services.name,
        unit: i.services.unit
      } : void 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router13.get("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("service_items").select("*, services(name, unit)").eq("id", req.params.id).single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const i = data;
    res.json({
      id: i.id,
      serviceId: i.service_id,
      itemName: i.item_name,
      itemCategory: i.item_category,
      unit: i.unit,
      defaultPrice: i.default_price,
      estimatedTime: i.estimated_time,
      estimatedWeightKg: i.estimated_weight_kg,
      itemMasterId: i.item_master_id,
      isActive: i.is_active,
      service: i.services ? { id: i.services.id, name: i.services.name, unit: i.services.unit } : void 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router13.post("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { serviceId, itemName, itemCategory, unit, defaultPrice, estimatedTime, estimatedWeightKg, isActive } = req.body;
    const weightKg = estimatedWeightKg ? parseFloat(estimatedWeightKg) : null;
    const { data: masterItem, error: masterErr } = await supabase.from("item_master").upsert({
      category: itemCategory,
      item_name: itemName,
      estimated_weight_kg: weightKg
    }, { onConflict: "item_name,category", ignoreDuplicates: false }).select("id").single();
    if (masterErr) {
      res.status(500).json({ error: masterErr.message });
      return;
    }
    const { data, error } = await supabase.from("service_items").upsert({
      service_id: serviceId,
      item_name: itemName,
      item_category: itemCategory,
      unit,
      default_price: defaultPrice,
      estimated_time: estimatedTime,
      estimated_weight_kg: weightKg,
      item_master_id: masterItem.id,
      is_active: isActive ?? true
    }, { onConflict: "service_id,item_name,item_category", ignoreDuplicates: false }).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router13.put("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { serviceId, itemName, itemCategory, unit, defaultPrice, estimatedTime, estimatedWeightKg, isActive } = req.body;
    const weightKg = estimatedWeightKg ? parseFloat(estimatedWeightKg) : null;
    const { data: masterItem, error: masterErr } = await supabase.from("item_master").upsert({
      category: itemCategory,
      item_name: itemName,
      estimated_weight_kg: weightKg
    }, { onConflict: "item_name,category", ignoreDuplicates: false }).select("id").single();
    if (masterErr) {
      res.status(500).json({ error: masterErr.message });
      return;
    }
    const { data, error } = await supabase.from("service_items").update({
      service_id: serviceId,
      item_name: itemName,
      item_category: itemCategory,
      unit,
      default_price: defaultPrice,
      estimated_time: estimatedTime,
      estimated_weight_kg: weightKg,
      item_master_id: masterItem.id,
      is_active: isActive
    }).eq("id", req.params.id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router13.delete("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("service_items").delete().eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var service_items_default = router13;

// server/routes/services.ts
var import_express15 = require("express");
init_supabase();
var router14 = (0, import_express15.Router)();
router14.get("/", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("services").select("*, service_items(item_name, default_price, unit)");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data || []).map(serializeService));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function serializeService(s) {
  const { service_items: items, pricing_type, bag_price, is_active, ...rest } = s;
  const unit = s.unit || "item";
  const pricingType = unit === "kg" ? "per_kg" : unit === "flat" ? "flat" : "per_piece";
  const prices = (items || []).map((i) => i.default_price).filter((p) => typeof p === "number" && p > 0);
  const basePrice = prices.length > 0 ? Math.min(...prices) : 0;
  return {
    ...rest,
    key: s.slug ?? s.id,
    unit,
    pricingType,
    basePrice,
    bagPrice: bag_price ?? void 0,
    isActive: is_active
  };
}
router14.get("/catalog", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const includeInactive = req.query.includeInactive === "true";
    let query = supabase.from("service_categories").select("*, services(*, service_items(*))").order("display_order").order("display_order", { foreignTable: "services" });
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const result = (data || []).map((cat) => {
      const services = (cat.services || []).filter((s) => includeInactive || s.is_active !== false).map((s) => {
        const { service_items: _2, pricing_type, bag_price, is_active, ...serviceRest } = s;
        return {
          ...serviceRest,
          categoryId: s.category_id,
          imageUrl: s.image_url,
          displayOrder: s.display_order,
          pricingType: pricing_type || "ITEM",
          bagPrice: bag_price ?? void 0,
          isActive: is_active,
          items: (s.service_items || []).filter((i) => includeInactive || i.is_active !== false).map((i) => ({
            id: i.id,
            serviceId: i.service_id,
            itemName: i.item_name,
            itemCategory: i.item_category,
            unit: i.unit,
            defaultPrice: i.default_price,
            estimatedTime: i.estimated_time,
            estimatedWeightKg: i.estimated_weight_kg,
            itemMasterId: i.item_master_id,
            isActive: i.is_active
          }))
        };
      });
      const { services: _, service_items: __, ...rest } = cat;
      return { ...rest, displayOrder: cat.display_order, isActive: cat.is_active, services };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.post("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { categoryId, name, description, unit, imageUrl, taxable, displayOrder, isActive, pricingType, bagPrice } = req.body;
    const { data, error } = await supabase.from("services").insert({
      category_id: categoryId,
      name,
      description,
      unit,
      image_url: imageUrl || null,
      taxable: taxable ?? true,
      display_order: displayOrder ?? 0,
      is_active: isActive ?? true,
      pricing_type: pricingType || "ITEM",
      bag_price: bagPrice ?? null
    }).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.put("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { categoryId, name, description, unit, imageUrl, taxable, displayOrder, isActive, pricingType, bagPrice } = req.body;
    const { data, error } = await supabase.from("services").update({
      category_id: categoryId,
      name,
      description,
      unit,
      image_url: imageUrl || null,
      taxable,
      display_order: displayOrder ?? 0,
      is_active: isActive,
      pricing_type: pricingType || "ITEM",
      bag_price: bagPrice ?? null
    }).eq("id", req.params.id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router14.delete("/:id", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("services").delete().eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var services_default = router14;

// server/routes/coupons.ts
var import_express16 = require("express");
init_supabase();
var router15 = (0, import_express16.Router)();
router15.get("/", async (_req, res) => {
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
var coupons_default = router15;

// server/routes/admin.ts
var import_express17 = require("express");
init_supabase();
var router16 = (0, import_express17.Router)();
var DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
router16.get("/kpis", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();
    const [usersRes, vendorsRes, ordersRes, reviewsRes, todayOrdersRes] = await Promise.all([
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("vendors").select("id, verified, is_open"),
      supabase.from("orders").select("total, status, created_at"),
      supabase.from("reviews").select("overall"),
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
    const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.overall, 0) / reviews.length).toFixed(2) : "0.00";
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
router16.get("/analytics", async (_req, res) => {
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
    const COLORS3 = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316", "#22c55e"];
    const serviceDemand = Object.entries(serviceBuckets).sort((a, b) => b[1] - a[1]).map(([name, count], i) => ({
      name,
      value: totalServices > 0 ? Math.round(count / totalServices * 100) : 0,
      color: COLORS3[i % COLORS3.length]
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
router16.get("/orders", async (req, res) => {
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
var admin_default = router16;

// server/routes/vendor-analytics.ts
var import_express18 = require("express");
init_supabase();
var router17 = (0, import_express18.Router)();
var COLORS2 = ["#0d9488", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#f97316"];
var DAY_LABELS2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
router17.get("/", async (req, res) => {
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
router17.get("/weekly-revenue", async (req, res) => {
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
router17.get("/service-revenue", async (req, res) => {
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
      color: COLORS2[i % COLORS2.length]
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router17.get("/stats", async (req, res) => {
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
      supabase.from("reviews").select("overall").eq("vendor_id", vendorId),
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
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.overall, 0) / reviews.length : 0;
    const ratingBuckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      const star = Math.round(r.overall);
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
router17.get("/inventory", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    if (!vendorId) {
      res.status(400).json({ error: "vendorId required" });
      return;
    }
    const supabase = createAdminClient();
    const { data } = await supabase.from("garment_inventory").select("*, orders!inner(vendor_id)").eq("orders.vendor_id", vendorId);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_analytics_default = router17;

// server/routes/subscriptions.ts
var import_express19 = require("express");
init_supabase();
var router18 = (0, import_express19.Router)();
router18.get("/plans", async (_req, res) => {
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
router18.get("/", async (req, res) => {
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
router18.post("/", async (req, res) => {
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
router18.delete("/:id", async (req, res) => {
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
var subscriptions_default = router18;

// server/routes/vendor-staff.ts
var import_express20 = require("express");
init_supabase();
var router19 = (0, import_express20.Router)();
router19.get("/", async (req, res) => {
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
router19.post("/", async (req, res) => {
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
router19.patch("/:id", async (req, res) => {
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
router19.delete("/:id", async (req, res) => {
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
var vendor_staff_default = router19;

// server/routes/garments.ts
var import_express21 = require("express");
init_supabase();
var router20 = (0, import_express21.Router)();
router20.get("/", async (req, res) => {
  try {
    const vendorId = req.query.vendorId;
    const admin = createAdminClient();
    let query = admin.from("garment_inventory").select("*, orders!inner(vendor_id)");
    if (vendorId) query = query.eq("orders.vendor_id", vendorId);
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
router20.patch("/:id", async (req, res) => {
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
router20.delete("/:id", async (req, res) => {
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
var garments_default = router20;

// server/routes/wallet-methods.ts
var import_express22 = require("express");
init_supabase();
var router21 = (0, import_express22.Router)();
router21.get("/", async (req, res) => {
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
router21.post("/", async (req, res) => {
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
router21.patch("/:id/default", async (req, res) => {
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
router21.delete("/:id", async (req, res) => {
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
var wallet_methods_default = router21;

// server/routes/coupon-validate.ts
var import_express23 = require("express");
init_supabase();
var router22 = (0, import_express23.Router)();
router22.post("/", async (req, res) => {
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
var coupon_validate_default = router22;

// server/routes/support-tickets.ts
var import_express24 = require("express");
init_supabase();
var router23 = (0, import_express24.Router)();
router23.get("/", async (req, res) => {
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
router23.post("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createAdminClient();
    const body = { ...req.body };
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, MAX_TICKET_PHOTOS) : [];
    for (const photo of photos) {
      const check = validatePhotoDataUrl(photo);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }
    }
    if (photos.length > 0) body.photos = photos;
    let validatedOrderId = null;
    if (body.order_id) {
      const { data: order, error: orderErr } = await admin.from("orders").select("id, customer_id").eq("id", body.order_id).single();
      if (orderErr || !order) {
        res.status(400).json({ error: "Referenced order does not exist" });
        return;
      }
      const userId = body.user_id || user?.id;
      if (userId && order.customer_id !== userId) {
        res.status(403).json({ error: "Not authorized to attach ticket to this order" });
        return;
      }
      validatedOrderId = order.id;
    }
    const { data, error } = await admin.from("support_tickets").insert({
      ...body,
      user_id: body.user_id || user?.id,
      order_id: validatedOrderId,
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
router23.patch("/:id", async (req, res) => {
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
router23.post("/:id/assign", async (req, res) => {
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
router23.post("/:id/respond", async (req, res) => {
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
router23.post("/:id/close", async (req, res) => {
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
var support_tickets_default = router23;

// server/routes/admin-campaigns.ts
var import_express25 = require("express");
init_supabase();
var router24 = (0, import_express25.Router)();
router24.get("/", async (req, res) => {
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
router24.post("/", async (req, res) => {
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
router24.patch("/:id", async (req, res) => {
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
var admin_campaigns_default = router24;

// server/routes/admin-features.ts
var import_express26 = require("express");
init_supabase();
var router25 = (0, import_express26.Router)();
router25.get("/", async (_req, res) => {
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
router25.patch("/:key", async (req, res) => {
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
var admin_features_default = router25;

// server/routes/admin-audit-logs.ts
var import_express27 = require("express");
init_supabase();
var router26 = (0, import_express27.Router)();
router26.get("/", async (req, res) => {
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
var admin_audit_logs_default = router26;

// server/routes/admin-integrations.ts
var import_express28 = require("express");
init_supabase();
var import_crypto = __toESM(require("crypto"));
var router27 = (0, import_express28.Router)();
router27.get("/api-keys", async (_req, res) => {
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
router27.post("/api-keys", async (req, res) => {
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
router27.delete("/api-keys/:id", async (req, res) => {
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
router27.get("/webhooks", async (_req, res) => {
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
router27.post("/webhooks", async (req, res) => {
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
router27.delete("/webhooks/:id", async (req, res) => {
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
var admin_integrations_default = router27;

// server/routes/admin-reports.ts
var import_express29 = require("express");
init_supabase();
var router28 = (0, import_express29.Router)();
router28.get("/", async (_req, res) => {
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
router28.post("/", async (req, res) => {
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
router28.post("/scheduled", async (req, res) => {
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
router28.delete("/scheduled/:id", async (req, res) => {
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
var admin_reports_default = router28;

// server/routes/admin-users.ts
var import_express30 = require("express");
init_supabase();
var router29 = (0, import_express30.Router)();
router29.get("/", async (_req, res) => {
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
router29.patch("/:id", async (req, res) => {
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
var admin_users_default = router29;

// server/routes/admin-config.ts
var import_express31 = require("express");
init_supabase();
var router30 = (0, import_express31.Router)();
router30.get("/", async (_req, res) => {
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
router30.patch("/", async (req, res) => {
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
var admin_config_default = router30;

// server/routes/admin-rbac.ts
var import_express32 = require("express");
init_supabase();
var router31 = (0, import_express32.Router)();
router31.get("/", async (_req, res) => {
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
router31.patch("/:id", async (req, res) => {
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
var admin_rbac_default = router31;

// server/routes/admin-commission.ts
var import_express33 = require("express");
init_supabase();
var router32 = (0, import_express33.Router)();
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
router32.get("/rules", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await ensureRules(supabase);
    res.json(config.commission?.rules || DEFAULT_RULES);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router32.post("/rules", async (req, res) => {
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
router32.patch("/rules/:id", async (req, res) => {
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
router32.delete("/rules/:id", async (req, res) => {
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
router32.get("/settlements", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const config = await getConfig(supabase);
    res.json(config.commission?.settlements || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router32.post("/settlements", async (req, res) => {
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
router32.patch("/settlements/:id/settle", async (req, res) => {
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
router32.get("/summary", async (_req, res) => {
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
var admin_commission_default = router32;

// server/routes/order-stages.ts
var import_express34 = require("express");
init_supabase();
var router33 = (0, import_express34.Router)();
router33.get("/", async (_req, res) => {
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
var order_stages_default = router33;

// server/routes/chat.ts
var import_express35 = require("express");
init_supabase();
var router34 = (0, import_express35.Router)();
router34.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await admin.from("chat_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data || []).reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router34.post("/", async (req, res) => {
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
router34.post("/ask", async (req, res) => {
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
      const { data: services } = await admin.from("services").select("name, unit").limit(10);
      if (services && services.length > 0) {
        reply = `Our pricing:
${services.map(
          (s) => `\u2022 **${s.name}** (${s.unit})`
        ).join("\n")}

*Prices may vary by vendor. Check the booking page for exact quotes.*`;
      } else {
        reply = "Visit the **Book Pickup** page to see service pricing in your area.";
      }
    } else if (/(wallet|balance|money|payment|pay)/.test(lower)) {
      const { data: profiles2 } = await admin.from("user_profiles").select("wallet_balance, loyalty_points").eq("id", user.id).limit(1);
      const wallet = profiles2?.[0];
      if (wallet) {
        reply = `Your wallet balance is **\u20B9${wallet.wallet_balance || 0}** with **${wallet.loyalty_points || 0} loyalty points**.`;
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
var chat_default = router34;

// server/routes/favorites.ts
var import_express36 = require("express");
init_supabase();
var router35 = (0, import_express36.Router)();
router35.get("/", async (req, res) => {
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
router35.post("/", async (req, res) => {
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
router35.delete("/:vendor_id", async (req, res) => {
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
var favorites_default = router35;

// server/routes/geocode.ts
var import_express37 = require("express");
var cache2 = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 60 * 60 * 1e3;
function getCached(key) {
  const entry = cache2.get(key);
  if (!entry || Date.now() > entry.ttl) {
    cache2.delete(key);
    return null;
  }
  return entry.data;
}
function setCache(key, data) {
  cache2.set(key, { data, ttl: Date.now() + CACHE_TTL_MS });
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
function findClosestArea2(lat, lng) {
  let closest = null;
  for (const [name, info] of Object.entries(KNOWN_AREAS3)) {
    const d = haversineKm4(lat, lng, info.lat, info.lng);
    if (!closest || d < closest.distance) {
      closest = { name, pincode: info.pincode, lat: info.lat, lng: info.lng, distance: d };
    }
  }
  return closest;
}
var router36 = (0, import_express37.Router)();
router36.get("/reverse", async (req, res) => {
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
      const d = haversineKm4(latNum, lngNum, info.lat, info.lng);
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
      const closest = findClosestArea2(latNum, lngNum);
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
      const closest = findClosestArea2(latNum, lngNum);
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
router36.get("/search", async (req, res) => {
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
function haversineKm4(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var geocode_default = router36;

// server/routes/routing.ts
var import_express38 = require("express");
var ORS_BASE = "https://api.openrouteservice.org/v2";
var router37 = (0, import_express38.Router)();
router37.get("/directions", async (req, res) => {
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
router37.get("/geocode/search", async (req, res) => {
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
var routing_default = router37;

// server/routes/delivery-location.ts
var import_express39 = require("express");
init_supabase();
var router38 = (0, import_express39.Router)();
router38.post("/", async (req, res) => {
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
router38.get("/:execId", async (req, res) => {
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
var delivery_location_default = router38;

// server/routes/vendor-onboarding.ts
var import_express40 = require("express");
init_supabase();
var router39 = (0, import_express40.Router)();
router39.post("/approve", async (req, res) => {
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
router39.post("/reject", async (req, res) => {
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
router39.get("/pending", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("vendors").select("*, owner:owner_id(id, name, email, phone)").in("kyc_status", ["pending"]).order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_onboarding_default = router39;

// server/routes/vendor-service-prices.ts
var import_express41 = require("express");
init_supabase();
var router40 = (0, import_express41.Router)();
async function canManageVendor(req, vendorId) {
  const admin = createAdminClient();
  const user = req.user;
  if (!user?.id) return false;
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role || "customer";
  if (role === "admin" || role === "superadmin") return true;
  const { data: vendor } = await admin.from("vendors").select("id").eq("id", vendorId).eq("owner_id", user.id).maybeSingle();
  return !!vendor;
}
router40.get("/:vendorId", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendor_service_prices").select("*, services(name, unit), service_items(item_name, unit)").eq("vendor_id", req.params.vendorId).eq("is_active", true);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const result = (data || []).map((p) => ({
      id: p.id,
      vendorId: p.vendor_id,
      serviceId: p.service_id,
      itemId: p.item_id,
      price: p.price,
      isActive: p.is_active,
      service: p.services ? { name: p.services.name, unit: p.services.unit } : void 0,
      item: p.service_items ? { itemName: p.service_items.item_name, unit: p.service_items.unit } : void 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router40.post("/", async (req, res) => {
  try {
    const { vendor_id, service_id, item_id, price } = req.body;
    if (!vendor_id || !service_id || !item_id || typeof price !== "number" || price <= 0) {
      res.status(400).json({ error: "vendor_id, service_id, item_id and a positive price are required" });
      return;
    }
    if (!await canManageVendor(req, vendor_id)) {
      res.status(403).json({ error: "Forbidden: not your vendor" });
      return;
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("vendor_service_prices").upsert(
      { vendor_id, service_id, item_id, price, is_active: true },
      { onConflict: "vendor_id,service_id,item_id", ignoreDuplicates: false }
    ).select().single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router40.delete("/:vendorId/:serviceId/:itemId", async (req, res) => {
  try {
    const { vendorId, serviceId, itemId } = req.params;
    if (!await canManageVendor(req, vendorId)) {
      res.status(403).json({ error: "Forbidden: not your vendor" });
      return;
    }
    const supabase = createAdminClient();
    const { error } = await supabase.from("vendor_service_prices").delete().eq("vendor_id", vendorId).eq("service_id", serviceId).eq("item_id", itemId);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_service_prices_default = router40;

// server/services/payment-service.ts
var import_crypto2 = __toESM(require("crypto"));
init_supabase();
var RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
var RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
var STALE_CREATING_MINUTES = 5;
function razorpayAuth() {
  return Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}
function isConfigured() {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}
function deterministicReceipt(idempotencyKey) {
  const hash = import_crypto2.default.createHash("sha256").update(idempotencyKey).digest("hex");
  return `lh_${hash.slice(0, 32)}`;
}
function isStale(createdAt, minutes) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created > minutes * 60 * 1e3;
}
async function createTopupOrder(userId, amountRupees, idempotencyKey) {
  if (!isConfigured()) {
    return { success: false, error: "Payment gateway not configured" };
  }
  if (!amountRupees || amountRupees < 10 || amountRupees > 25e3) {
    return { success: false, error: "Amount must be between \u20B910 and \u20B925,000" };
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    return { success: false, error: "Invalid idempotency key" };
  }
  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin.from("payment_transactions").insert({
    user_id: userId,
    transaction_purpose: "wallet_topup",
    amount: amountRupees,
    currency: "INR",
    gateway: "razorpay",
    gateway_order_id: null,
    payment_status: "creating",
    idempotency_key: idempotencyKey
  }).select("id, gateway_order_id, payment_status, updated_at").single();
  let txnId;
  if (insertError) {
    const { data: existing } = await admin.from("payment_transactions").select("id, gateway_order_id, payment_status, updated_at").eq("idempotency_key", idempotencyKey).single();
    if (!existing) {
      return { success: false, error: "Failed to retrieve existing payment record" };
    }
    if (existing.gateway_order_id) {
      return {
        success: true,
        transactionId: existing.id,
        razorpayOrderId: existing.gateway_order_id,
        amount: amountRupees,
        currency: "INR",
        publicKeyId: RAZORPAY_KEY_ID
      };
    }
    if (existing.payment_status === "creating" && isStale(existing.updated_at, STALE_CREATING_MINUTES)) {
      return {
        success: false,
        error: "Payment order status uncertain. Please try again later."
      };
    }
    if (existing.payment_status === "creating") {
      return {
        success: false,
        error: "Payment processing in progress. Please wait."
      };
    }
    if (existing.payment_status === "created" && !existing.gateway_order_id) {
      const { data: claimed, error: claimError } = await admin.from("payment_transactions").update({
        payment_status: "creating",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", existing.id).eq("payment_status", "created").select("id").single();
      if (claimError || !claimed) {
        return {
          success: false,
          error: "Payment processing in progress. Please wait."
        };
      }
      txnId = existing.id;
    } else {
      return {
        success: false,
        error: `Unexpected payment status: ${existing.payment_status}`
      };
    }
  } else {
    txnId = inserted.id;
  }
  const receipt = deterministicReceipt(idempotencyKey);
  const amountPaise = Math.round(amountRupees * 100);
  let response;
  try {
    response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayAuth()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        payment_capture: 1
      })
    });
  } catch (err) {
    await admin.from("payment_transactions").update({
      failure_reason: `Network error: ${err.message}`,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", txnId).eq("payment_status", "creating");
    return {
      success: false,
      error: "Payment order status uncertain. Please try again later."
    };
  }
  if (response.ok) {
    let razorpayOrder;
    try {
      razorpayOrder = await response.json();
    } catch {
      return {
        success: false,
        error: "Payment order status uncertain. Please try again later."
      };
    }
    const { error: dbUpdateError } = await admin.from("payment_transactions").update({
      gateway_order_id: razorpayOrder.id,
      payment_status: "created",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", txnId).eq("payment_status", "creating");
    if (!dbUpdateError) {
      return {
        success: true,
        transactionId: txnId,
        razorpayOrderId: razorpayOrder.id,
        amount: amountRupees,
        currency: "INR",
        publicKeyId: RAZORPAY_KEY_ID
      };
    }
    const { error: retryError } = await admin.from("payment_transactions").update({
      gateway_order_id: razorpayOrder.id,
      payment_status: "created",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", txnId).eq("payment_status", "creating");
    if (!retryError) {
      return {
        success: true,
        transactionId: txnId,
        razorpayOrderId: razorpayOrder.id,
        amount: amountRupees,
        currency: "INR",
        publicKeyId: RAZORPAY_KEY_ID
      };
    }
    console.error(
      `[payments] CRITICAL: Razorpay order created but gateway_order_id could not be persisted. transactionId=${txnId}, razorpayOrderId=${razorpayOrder.id}, error=${retryError.message}`
    );
    return {
      success: false,
      error: "Payment order created but could not be recorded. Reconciliation required."
    };
  }
  const errorBody = await response.json().catch(() => ({}));
  const errorMsg = errorBody.error?.description || "Razorpay order creation failed";
  if (response.status >= 500) {
    await admin.from("payment_transactions").update({
      failure_reason: `Razorpay 5xx: ${errorMsg}`,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", txnId).eq("payment_status", "creating");
    return {
      success: false,
      error: "Payment order status uncertain. Please try again later."
    };
  }
  await admin.from("payment_transactions").update({
    payment_status: "created",
    failure_reason: `Razorpay ${response.status}: ${errorMsg}`,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", txnId).eq("payment_status", "creating");
  return {
    success: false,
    error: errorMsg
  };
}
async function verifyTopupPayment(userId, razorpayOrderId, razorpayPaymentId, razorpaySignature, transactionId) {
  if (!isConfigured()) {
    return { success: false, error: "Payment gateway not configured" };
  }
  const admin = createAdminClient();
  const { data: txn, error: loadError } = await admin.from("payment_transactions").select("*").eq("id", transactionId).single();
  if (loadError || !txn) {
    return { success: false, error: "Payment transaction not found" };
  }
  if (txn.user_id !== userId) {
    return { success: false, error: "Unauthorized" };
  }
  if (txn.gateway_order_id !== razorpayOrderId) {
    return { success: false, error: "Order ID mismatch" };
  }
  const crypto5 = await import("crypto");
  const expectedSig = crypto5.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  if (!crypto5.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(razorpaySignature))) {
    return { success: false, error: "Invalid payment signature" };
  }
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
      headers: { Authorization: `Basic ${razorpayAuth()}` }
    });
    if (response.ok) {
      const payment = await response.json();
      if (payment.order_id !== razorpayOrderId) {
        return { success: false, error: "Payment does not belong to expected order" };
      }
    }
  } catch {
  }
  const { error: updateError } = await admin.from("payment_transactions").update({
    gateway_payment_id: razorpayPaymentId,
    gateway_signature_verified: true,
    payment_status: "pending",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", transactionId).eq("payment_status", "created");
  if (updateError) {
    return { success: false, error: `Failed to update payment record: ${updateError.message}` };
  }
  const result = await finalizeWalletTopup(transactionId);
  return result;
}
async function finalizeWalletTopup(paymentTransactionId) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("finalize_wallet_topup", {
    p_payment_transaction_id: paymentTransactionId
  });
  if (error) {
    return { success: false, error: `RPC error: ${error.message}` };
  }
  if (!data) {
    return { success: false, error: "No response from finalization" };
  }
  const result = data;
  return {
    success: result.success,
    alreadyCredited: result.already_credited || false,
    walletTransactionId: result.wallet_transaction_id || null,
    newBalance: result.new_balance,
    error: result.error
  };
}
async function markPaymentCaptureVerified(gatewayOrderId, gatewayPaymentId) {
  const admin = createAdminClient();
  const { data: txn } = await admin.from("payment_transactions").select("id").eq("gateway_order_id", gatewayOrderId).eq("transaction_purpose", "wallet_topup").single();
  if (!txn) {
    return { transactionId: null, finalized: false };
  }
  await admin.from("payment_transactions").update({
    gateway_capture_verified: true,
    gateway_payment_id: gatewayPaymentId,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", txn.id).in("payment_status", ["created", "pending", "authorized"]);
  const result = await finalizeWalletTopup(txn.id);
  return {
    transactionId: txn.id,
    finalized: result.success
  };
}
async function getPaymentSummary(userId) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("wallet_balance").eq("id", userId).single();
  const walletBalance = profile?.wallet_balance || 0;
  const sixMonthsAgo = /* @__PURE__ */ new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const { data: spendData } = await admin.from("payment_transactions").select("amount").eq("user_id", userId).eq("transaction_purpose", "order_payment").eq("payment_status", "captured").gte("created_at", sixMonthsAgo.toISOString());
  const totalSpentSixMonths = (spendData || []).reduce(
    (sum, row) => sum + (row.amount || 0),
    0
  );
  const moneySaved = 0;
  const { count: transactionCount } = await admin.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const { count: invoiceCount } = await admin.from("customer_invoices").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return {
    walletBalance,
    totalSpentSixMonths,
    moneySaved,
    transactionCount: transactionCount || 0,
    invoiceCount: invoiceCount || 0
  };
}
async function getTransactions(userId, options = {}) {
  const admin = createAdminClient();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  let query = admin.from("wallet_transactions").select("*", { count: "exact" }).eq("user_id", userId);
  if (options.type === "credit" || options.type === "debit") {
    query = query.eq("type", options.type);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) {
    return { transactions: [], total: 0, page, limit };
  }
  return {
    transactions: data || [],
    total: count || 0,
    page,
    limit
  };
}
async function getInvoices(userId, options = {}) {
  const admin = createAdminClient();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  const { data, count, error } = await admin.from("customer_invoices").select("*", { count: "exact" }).eq("user_id", userId).order("invoice_date", { ascending: false }).range(offset, offset + limit - 1);
  if (error) {
    return { invoices: [], total: 0, page, limit };
  }
  return {
    invoices: data || [],
    total: count || 0,
    page,
    limit
  };
}

// server/routes/payments.ts
var import_express42 = require("express");
init_supabase();
var crypto4 = __toESM(require("crypto"));
var router41 = (0, import_express42.Router)();
async function getAuthenticatedUser(req) {
  try {
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name]
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id } : null;
  } catch {
    return null;
  }
}
router41.post("/payments/wallet/topup/create-order", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { amount, idempotencyKey } = req.body;
    if (!amount || typeof amount !== "number") {
      res.status(400).json({ error: "Valid amount is required" });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      res.status(400).json({ error: "idempotencyKey is required" });
      return;
    }
    const result = await createTopupOrder(user.id, amount, idempotencyKey);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      success: true,
      transactionId: result.transactionId,
      razorpayOrderId: result.razorpayOrderId,
      amount: result.amount,
      currency: result.currency,
      publicKeyId: result.publicKeyId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router41.post("/payments/wallet/topup/verify", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transaction_id
    } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transaction_id) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const result = await verifyTopupPayment(
      user.id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transaction_id
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      success: true,
      alreadyCredited: result.alreadyCredited,
      walletTransactionId: result.walletTransactionId,
      newBalance: result.newBalance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router41.post("/payments/wallet/add", async (_req, res) => {
  res.status(405).json({
    error: "Direct wallet top-up is disabled. Use /api/payments/wallet/topup/create-order instead."
  });
});
router41.post("/payments/create-order", async (req, res) => {
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
    if (order_id && data.id) {
      const admin = createAdminClient();
      const { data: orderRow } = await admin.from("orders").select("payment_details").eq("id", order_id).single();
      if (orderRow) {
        const existingDetails = orderRow.payment_details || {};
        await admin.from("orders").update({
          payment_details: {
            ...existingDetails,
            razorpay_order_id: data.id
          }
        }).eq("id", order_id);
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router41.post("/payments/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      res.status(400).json({ error: "Missing payment verification fields" });
      return;
    }
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data: orderRow } = await admin.from("orders").select("id, customer_id, total, wallet_paid_amount, payment_status, payment_details").eq("id", order_id).single();
    if (!orderRow) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (orderRow.customer_id !== user.id) {
      res.status(403).json({ error: "Not your order" });
      return;
    }
    const storedRazorpayOrderId = orderRow.payment_details?.razorpay_order_id;
    if (!storedRazorpayOrderId) {
      res.status(400).json({ error: "No Razorpay order linked to this order" });
      return;
    }
    if (storedRazorpayOrderId !== razorpay_order_id) {
      res.status(400).json({ error: "Razorpay order mismatch" });
      return;
    }
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const expectedSig = crypto4.createHmac("sha256", razorpayKeySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const sigBuf = Buffer.from(expectedSig, "hex");
    const providedBuf = Buffer.from(razorpay_signature, "hex");
    if (sigBuf.length !== providedBuf.length || !crypto4.timingSafeEqual(sigBuf, providedBuf)) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }
    if (orderRow.payment_status === "paid" && orderRow.payment_details?.razorpay_payment_id === razorpay_payment_id) {
      res.json({ success: true, already_verified: true, payment_id: razorpay_payment_id });
      return;
    }
    const gatewayAmount = orderRow.total - (orderRow.wallet_paid_amount || 0);
    if (gatewayAmount <= 0) {
      res.json({ success: true, payment_id: razorpay_payment_id, note: "fully_covered_by_wallet" });
      return;
    }
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "finalize_order_gateway_payment",
      {
        p_order_id: order_id,
        p_gateway_order_id: razorpay_order_id,
        p_gateway_payment_id: razorpay_payment_id,
        p_amount: gatewayAmount
      }
    );
    if (rpcError) {
      res.status(500).json({ error: `Finalization RPC failed: ${rpcError.message}` });
      return;
    }
    if (!rpcResult?.success) {
      res.status(400).json({ error: rpcResult?.error || "Finalization failed" });
      return;
    }
    res.json({
      success: true,
      already_finalized: rpcResult.already_finalized || false,
      payment_id: razorpay_payment_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router41.get("/customer/payments/summary", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const summary = await getPaymentSummary(user.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router41.get("/customer/payments/transactions", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;
    const status = req.query.status;
    const result = await getTransactions(user.id, { page, limit, type, status });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router41.get("/customer/invoices", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await getInvoices(user.id, { page, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var payments_default = router41;

// server/routes/customer-config.ts
var import_express43 = require("express");
init_supabase();
var router42 = (0, import_express43.Router)();
var CUSTOMER_FEATURE_DEFAULTS = {
  enableSubscriptions: true,
  enableCoupons: true,
  enableWallet: true,
  enableLoyalty: true,
  enableFavorites: true,
  enableReviews: true,
  enableDiscover: true,
  enableOrders: true,
  enableCountItems: true,
  enableLaundryBag: true,
  enableMixedBooking: true
};
router42.get("/", async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("system_config").select("config").eq("id", 1).single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const customer = data?.config?.customer || {};
    const merged = {};
    for (const [key, enabled] of Object.entries(CUSTOMER_FEATURE_DEFAULTS)) {
      merged[key] = typeof customer[key] === "boolean" ? customer[key] : enabled;
    }
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var customer_config_default = router42;

// server/routes/settings.ts
var import_express44 = require("express");
init_supabase();
var router43 = (0, import_express44.Router)();
var DEFAULTS = { pushEnabled: true, orderUpdates: true, promotions: false };
router43.get("/", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from("user_settings").select("push_enabled, order_updates, promotions").eq("user_id", user.id).single();
    if (error && error.code !== "PGRST116") {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({
      notifications: {
        pushEnabled: data?.push_enabled ?? DEFAULTS.pushEnabled,
        orderUpdates: data?.order_updates ?? DEFAULTS.orderUpdates,
        promotions: data?.promotions ?? DEFAULTS.promotions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router43.patch("/notifications", async (req, res) => {
  try {
    const supabase = createServerClientWithCookies((name) => req.cookies?.[name]);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { pushEnabled, orderUpdates, promotions } = req.body;
    const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (typeof pushEnabled === "boolean") updates.push_enabled = pushEnabled;
    if (typeof orderUpdates === "boolean") updates.order_updates = orderUpdates;
    if (typeof promotions === "boolean") updates.promotions = promotions;
    const admin = createAdminClient();
    const { error } = await admin.from("user_settings").upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const { data } = await admin.from("user_settings").select("push_enabled, order_updates, promotions").eq("user_id", user.id).single();
    res.json({
      notifications: {
        pushEnabled: data?.push_enabled ?? DEFAULTS.pushEnabled,
        orderUpdates: data?.order_updates ?? DEFAULTS.orderUpdates,
        promotions: data?.promotions ?? DEFAULTS.promotions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router43.patch("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const supabase = createServerClientWithCookies(
      (name) => req.cookies?.[name],
      (name, value, options) => res.cookie(name, value, { ...options, httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
      (name) => res.clearCookie(name, { path: "/" })
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      res.status(401).json({ error: "Unauthorized: email account required to change password" });
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });
    if (signInError) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var settings_default = router43;

// server/routes/vendor-reports.ts
var import_express45 = require("express");
init_supabase();
var router44 = (0, import_express45.Router)();
router44.get("/overview", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = orders || [];
    const completedOrders = allOrders.filter((o) => ["completed", "delivered"].includes(o.status));
    const cancelledOrders = allOrders.filter((o) => o.status === "cancelled");
    const totalRevenue = completedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const aov = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;
    const orderIds = allOrders.map((o) => o.id);
    const stageEvents = await loadStageEvents(supabase, orderIds);
    const { repeatRate, repeatCount, uniqueCustomers } = computeRepeatRate(allOrders);
    const avgTurnaroundHrs = computeTurnaroundFromEvents(stageEvents);
    const onTimeRate = computeOnTimeRateFromEvents(stageEvents, allOrders);
    const cancellationRate = allOrders.length > 0 ? Math.round(cancelledOrders.length / allOrders.length * 100) : 0;
    const { data: reviews } = await supabase.from("reviews").select("overall").eq("vendor_id", vendorId).gte("created_at", startDate).lte("created_at", endDate);
    const allReviews = reviews || [];
    const avgRating = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.overall || 0), 0) / allReviews.length * 10) / 10 : 0;
    const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const prevStart = new Date(new Date(startDate).getTime() - periodMs).toISOString();
    const { data: prevOrders } = await buildOrderQuery(supabase, vendorId, prevStart, startDate, service, status);
    const prevAll = prevOrders || [];
    const prevCompleted = prevAll.filter((o) => ["completed", "delivered"].includes(o.status));
    const prevRevenue = prevCompleted.reduce((s, o) => s + (o.total || 0), 0);
    const revenueChange = prevRevenue > 0 ? Math.round((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
    const ordersChange = prevAll.length > 0 ? Math.round((allOrders.length - prevAll.length) / prevAll.length * 100) : 0;
    const delayed = allOrders.filter(
      (o) => !["completed", "cancelled", "delivered"].includes(o.status) && o.estimated_delivery_at && new Date(o.estimated_delivery_at) < /* @__PURE__ */ new Date()
    );
    const serviceMap = {};
    completedOrders.forEach((o) => {
      const items = o.items_v2 || o.items || [];
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const name = item.serviceName || item.serviceKey || "Unknown";
          serviceMap[name] = (serviceMap[name] || 0) + (item.unitPrice || 0) * (item.qty || 1);
        });
      }
    });
    const topServiceEntry = Object.entries(serviceMap).sort((a, b) => b[1] - a[1])[0];
    const dayMap = {};
    completedOrders.forEach((o) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      dayMap[day] = (dayMap[day] || 0) + (o.total || 0);
    });
    const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
    const customerCounts = {};
    allOrders.forEach((o) => {
      if (o.customer_id) customerCounts[o.customer_id] = (customerCounts[o.customer_id] || 0) + 1;
    });
    const topCustomerEntry = Object.entries(customerCounts).sort((a, b) => b[1] - a[1])[0];
    const revenueTrend = Object.entries(dayMap).map(([day, revenue]) => ({ day, revenue })).sort((a, b) => a.day.localeCompare(b.day));
    const ordersTrendMap = {};
    allOrders.forEach((o) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      ordersTrendMap[day] = (ordersTrendMap[day] || 0) + 1;
    });
    const ordersTrend = Object.entries(ordersTrendMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
    res.json({
      totalOrders: allOrders.length,
      totalRevenue,
      aov,
      avgTurnaroundHrs,
      repeatRate,
      onTimeRate,
      cancellationRate,
      avgRating,
      totalReviews: allReviews.length,
      revenueChange,
      ordersChange,
      delayedCount: delayed.length,
      topService: topServiceEntry ? { name: topServiceEntry[0], revenue: topServiceEntry[1] } : null,
      bestDay: bestDayEntry ? { day: bestDayEntry[0], revenue: bestDayEntry[1] } : null,
      mostActiveCustomer: topCustomerEntry ? { name: topCustomerEntry[0], orderCount: topCustomerEntry[1] } : null,
      revenueTrend,
      ordersTrend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/sales-revenue", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = (orders || []).filter((o) => o.status !== "cancelled");
    const subtotal = allOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const couponDiscount = allOrders.reduce((s, o) => s + (o.coupon_discount || 0), 0);
    const subscriptionDiscount = allOrders.reduce((s, o) => s + (o.subscription_discount || 0), 0);
    const refunds = allOrders.filter((o) => o.payment_status === "refunded").reduce((s, o) => s + (o.total || 0), 0);
    const platformFees = allOrders.reduce((s, o) => s + (o.platform_fee || 0), 0);
    const deliveryFees = allOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    const expressSurcharges = allOrders.reduce((s, o) => s + (o.express_surcharge || 0), 0);
    const surgeCharges = allOrders.reduce((s, o) => s + (o.surge_charge || 0), 0);
    const taxes = allOrders.reduce((s, o) => s + (o.taxes || 0), 0);
    const netOrderValue = subtotal - couponDiscount - subscriptionDiscount;
    const grossRevenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
    const estimatedCommission = Math.round(grossRevenue * 0.1);
    const estimatedVendorEarnings = grossRevenue - refunds - estimatedCommission;
    const expectedCustomerAmount = netOrderValue + platformFees + deliveryFees + expressSurcharges + surgeCharges + taxes;
    if (expectedCustomerAmount !== grossRevenue && allOrders.length > 0) {
      console.warn(`[reports] Reconciliation mismatch: expected ${expectedCustomerAmount}, got ${grossRevenue}`);
    }
    const dailyMap = {};
    allOrders.forEach((o) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, orders: 0 };
      dailyMap[day].revenue += o.total || 0;
      dailyMap[day].orders += 1;
    });
    const dailyRevenue = Object.entries(dailyMap).map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day));
    const serviceMap = {};
    allOrders.forEach((o) => {
      const items = o.items_v2 || o.items || [];
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const name = item.serviceName || item.serviceKey || "Unknown";
          serviceMap[name] = (serviceMap[name] || 0) + (item.unitPrice || 0) * (item.qty || 1);
        });
      }
    });
    const totalServiceRevenue = Object.values(serviceMap).reduce((s, v) => s + v, 0);
    const revenueByService = Object.entries(serviceMap).map(([name, revenue], i) => ({
      name,
      revenue,
      percentage: totalServiceRevenue > 0 ? Math.round(revenue / totalServiceRevenue * 100) : 0,
      color: COLORS[i % COLORS.length]
    })).sort((a, b) => b.revenue - a.revenue);
    const paymentMap = {};
    allOrders.forEach((o) => {
      const method = o.payment_method || "unknown";
      paymentMap[method] = (paymentMap[method] || 0) + (o.total || 0);
    });
    const totalPaymentRevenue = Object.values(paymentMap).reduce((s, v) => s + v, 0);
    const revenueByPaymentMethod = Object.entries(paymentMap).map(([method, revenue]) => ({
      method,
      revenue,
      percentage: totalPaymentRevenue > 0 ? Math.round(revenue / totalPaymentRevenue * 100) : 0
    }));
    const dayOfWeekMap = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    allOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const dayName = dayNames[d.getDay()];
      if (!dayOfWeekMap[dayName]) dayOfWeekMap[dayName] = { revenue: 0, orders: 0 };
      dayOfWeekMap[dayName].revenue += o.total || 0;
      dayOfWeekMap[dayName].orders += 1;
    });
    const revenueByDayOfWeek = dayNames.map((day) => ({
      day,
      revenue: dayOfWeekMap[day]?.revenue || 0,
      orders: dayOfWeekMap[day]?.orders || 0
    }));
    const sorted = [...dailyRevenue].sort((a, b) => b.revenue - a.revenue);
    const topDay = sorted[0] || null;
    const worstDay = sorted[sorted.length - 1] || null;
    const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const prevStart = new Date(new Date(startDate).getTime() - periodMs).toISOString();
    const { data: prevOrders } = await buildOrderQuery(supabase, vendorId, prevStart, startDate, service, status);
    const prevAll = (prevOrders || []).filter((o) => o.status !== "cancelled");
    const prevRevenue = prevAll.reduce((s, o) => s + (o.total || 0), 0);
    const revenueGrowth = prevRevenue > 0 ? Math.round((grossRevenue - prevRevenue) / prevRevenue * 100) : 0;
    res.json({
      subtotal,
      couponDiscount,
      subscriptionDiscount,
      netOrderValue,
      refunds,
      platformFees,
      deliveryFees,
      expressSurcharges,
      surgeCharges,
      taxes,
      grossRevenue,
      estimatedCommission,
      estimatedVendorEarnings,
      dailyRevenue,
      revenueByService,
      revenueByPaymentMethod,
      revenueByDayOfWeek,
      topDay,
      worstDay,
      revenueGrowth
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/orders-operations", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = orders || [];
    const orderIds = allOrders.map((o) => o.id);
    const stageEvents = await loadStageEvents(supabase, orderIds);
    const completedOrders = allOrders.filter((o) => ["completed", "delivered"].includes(o.status));
    const avgTurnaroundHrs = computeTurnaroundFromEvents(stageEvents);
    const onTimeRate = computeOnTimeRateFromEvents(stageEvents, allOrders);
    const delayed = allOrders.filter(
      (o) => !["completed", "cancelled", "delivered"].includes(o.status) && o.estimated_delivery_at && new Date(o.estimated_delivery_at) < /* @__PURE__ */ new Date()
    );
    const express2 = allOrders.filter((o) => o.express);
    const statusCounts = {};
    allOrders.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    const ORDER_STAGE_FLOW = [
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
    const stageIndexMap = {};
    ORDER_STAGE_FLOW.forEach((s, i) => {
      stageIndexMap[s] = i;
    });
    const funnelMilestones = [
      { key: "received", label: "Received", stage: "vendor_assigned" },
      { key: "accepted", label: "Accepted", stage: "vendor_accepted" },
      { key: "picked_up", label: "Picked Up", stage: "pickup_completed" },
      { key: "processing", label: "Processing", stage: "laundry_received" },
      { key: "ready", label: "Ready", stage: "ready_for_dispatch" },
      { key: "delivered", label: "Delivered", stage: "delivered" }
    ].map((m) => {
      const minIndex = stageIndexMap[m.stage];
      if (minIndex === void 0) {
        throw new Error(`[reports] Unknown funnel milestone stage: "${m.stage}". Check ORDER_STAGE_FLOW.`);
      }
      return { ...m, minIndex };
    });
    const funnelStages = funnelMilestones.map((m, i) => {
      const count = allOrders.filter((o) => {
        const idx = stageIndexMap[o.status];
        return idx !== void 0 && idx >= m.minIndex;
      }).length;
      const prevCount = i > 0 ? allOrders.filter((o) => {
        const idx = stageIndexMap[o.status];
        return idx !== void 0 && idx >= funnelMilestones[i - 1].minIndex;
      }).length : allOrders.length;
      return {
        stage: m.label,
        count,
        conversionRate: prevCount > 0 ? Math.round(count / prevCount * 100) : null,
        avgTimeHours: null
      };
    });
    const dayMap = {};
    allOrders.forEach((o) => {
      const day = o.created_at?.slice(0, 10) || "unknown";
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const ordersByDay = Object.entries(dayMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
    const turnaroundDiffs = [];
    for (const o of completedOrders) {
      const stages = stageEvents[o.id];
      if (!stages) continue;
      const pickup = stages["pickup_completed"];
      const completion = stages["delivered"] ?? stages["completed"];
      if (pickup && completion) {
        const hours = (new Date(completion).getTime() - new Date(pickup).getTime()) / (1e3 * 60 * 60);
        if (hours >= 0) turnaroundDiffs.push(hours);
      }
    }
    let turnaroundHistogram = [];
    if (turnaroundDiffs.length > 0) {
      const buckets = ["< 24h", "24-48h", "48-72h", "72-96h", "96h+"];
      const map = {};
      buckets.forEach((b) => map[b] = 0);
      for (const h of turnaroundDiffs) {
        if (h < 24) map["< 24h"]++;
        else if (h < 48) map["24-48h"]++;
        else if (h < 72) map["48-72h"]++;
        else if (h < 96) map["72-96h"]++;
        else map["96h+"]++;
      }
      turnaroundHistogram = buckets.map((bucket) => ({ bucket, count: map[bucket] }));
    }
    const attentionCategories = {
      pendingPickup: statusCounts["placed"] || 0,
      delayedInProgress: delayed.length,
      qualityIssues: 0,
      failedCancelled: statusCounts["cancelled"] || 0
    };
    const topDelayedOrders = delayed.slice(0, 10).map((o) => ({
      id: o.id,
      code: o.code,
      customerName: o.customer_name,
      total: o.total,
      createdAt: o.created_at
    }));
    res.json({
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      avgTurnaroundHrs,
      onTimeRate,
      delayedCount: delayed.length,
      expressOrders: express2.length,
      funnelStages,
      statusDistribution: Object.entries(statusCounts).map(([status2, count]) => ({ status: status2, count })),
      ordersByDay,
      turnaroundHistogram,
      expressVsRegular: {
        express: { count: express2.length, revenue: express2.reduce((s, o) => s + (o.total || 0), 0) },
        regular: { count: allOrders.length - express2.length, revenue: allOrders.filter((o) => !o.express).reduce((s, o) => s + (o.total || 0), 0) }
      },
      attentionCategories,
      delayedDrillDown: { status: "processing", delayed: true, startDate: startStr, endDate: endStr, service, orderStatus: status },
      topDelayedOrders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/services", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = (orders || []).filter((o) => o.status !== "cancelled");
    const serviceMap = {};
    allOrders.forEach((o) => {
      const items = o.items_v2 || o.items || [];
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const name = item.serviceName || item.serviceKey || "Unknown";
          if (!serviceMap[name]) serviceMap[name] = { orderCount: 0, revenue: 0 };
          serviceMap[name].orderCount += 1;
          serviceMap[name].revenue += (item.unitPrice || 0) * (item.qty || 1);
        });
      }
    });
    const { data: reviews } = await supabase.from("reviews").select("overall").eq("vendor_id", vendorId).gte("created_at", startDate).lte("created_at", endDate);
    const allReviews = reviews || [];
    const avgRating = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.overall || 0), 0) / allReviews.length * 10) / 10 : 0;
    const totalRevenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
    const services = Object.entries(serviceMap).map(([name, data]) => ({
      name,
      orderCount: data.orderCount,
      revenue: data.revenue,
      aov: data.orderCount > 0 ? Math.round(data.revenue / data.orderCount) : 0,
      avgTurnaroundHrs: null,
      avgRating,
      revenueShare: totalRevenue > 0 ? Math.round(data.revenue / totalRevenue * 100) : 0,
      cancellationRate: 0,
      repeatRate: 0
    })).sort((a, b) => b.revenue - a.revenue);
    const revenueByService = services.map((s, i) => ({
      name: s.name,
      revenue: s.revenue,
      color: COLORS[i % COLORS.length]
    }));
    const orderVolumeByService = services.map((s, i) => ({
      name: s.name,
      count: s.orderCount,
      color: COLORS[i % COLORS.length]
    }));
    res.json({
      topRevenueService: services[0] ? { name: services[0].name, revenue: services[0].revenue } : null,
      mostOrderedService: [...services].sort((a, b) => b.orderCount - a.orderCount)[0] ? { name: [...services].sort((a, b) => b.orderCount - a.orderCount)[0].name, orderCount: [...services].sort((a, b) => b.orderCount - a.orderCount)[0].orderCount } : null,
      highestRatedService: services[0] ? { name: services[0].name, avgRating: services[0].avgRating } : null,
      fastestService: null,
      revenueByService,
      orderVolumeByService,
      services
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/customers", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service, status } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service, status);
    const allOrders = orders || [];
    const completedOrders = allOrders.filter((o) => ["completed", "delivered"].includes(o.status));
    const customerMap = {};
    allOrders.forEach((o) => {
      const id = o.customer_id;
      if (!id) return;
      if (!customerMap[id]) customerMap[id] = { name: o.customer_name || "Unknown", orderCount: 0, totalSpend: 0, lastOrder: o.created_at };
      customerMap[id].orderCount += 1;
      customerMap[id].totalSpend += o.total || 0;
      if (o.created_at > customerMap[id].lastOrder) customerMap[id].lastOrder = o.created_at;
    });
    const totalCustomers = Object.keys(customerMap).length;
    const repeatCount = Object.values(customerMap).filter((c) => c.orderCount >= 2).length;
    const newCount = totalCustomers - repeatCount;
    const { repeatRate } = computeRepeatRate(allOrders);
    const avgSpendPerCustomer = totalCustomers > 0 ? Math.round(completedOrders.reduce((s, o) => s + (o.total || 0), 0) / totalCustomers) : 0;
    const segmentCounts = {};
    CUSTOMER_SEGMENTS.forEach((s) => segmentCounts[s.label] = 0);
    Object.values(customerMap).forEach((c) => {
      for (const seg of CUSTOMER_SEGMENTS) {
        if (c.orderCount >= seg.min && c.orderCount <= seg.max) {
          segmentCounts[seg.label]++;
          break;
        }
      }
    });
    const customerSegments = CUSTOMER_SEGMENTS.map((seg) => ({
      label: seg.label,
      count: segmentCounts[seg.label],
      percentage: totalCustomers > 0 ? Math.round(segmentCounts[seg.label] / totalCustomers * 100) : 0
    }));
    const freqMap = {};
    Object.values(customerMap).forEach((c) => {
      freqMap[c.orderCount] = (freqMap[c.orderCount] || 0) + 1;
    });
    const orderFrequencyDistribution = Object.entries(freqMap).map(([count, customers]) => ({ orderCount: Number(count), customerCount: customers })).sort((a, b) => a.orderCount - b.orderCount);
    const repeatTrend = [{ period: startStr + " to " + endStr, repeatRate }];
    const topCustomers = Object.entries(customerMap).map(([id, data]) => ({ id, ...data, avgOrder: data.orderCount > 0 ? Math.round(data.totalSpend / data.orderCount) : 0 })).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);
    res.json({
      totalCustomers,
      newCustomers: newCount,
      repeatCustomers: repeatCount,
      repeatRate,
      avgSpendPerCustomer,
      historicalCustomerValue: avgSpendPerCustomer,
      repeatVsNew: { repeat: repeatCount, new: newCount },
      repeatTrend,
      orderFrequencyDistribution,
      customerSegments,
      topCustomers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/settlements", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const supabase = createAdminClient();
    const { data: settlements } = await supabase.from("vendor_settlements").select("*").eq("vendor_id", vendorId).order("period_start", { ascending: false });
    const allSettlements = settlements || [];
    const pendingPayout = allSettlements.filter((s) => s.status === "pending" || s.status === "processing").reduce((sum, s) => sum + (s.net_payout || 0), 0);
    const settledTotal = allSettlements.filter((s) => s.status === "settled").reduce((sum, s) => sum + (s.net_payout || 0), 0);
    const totalGross = allSettlements.reduce((sum, s) => sum + (s.gross_order_value || 0), 0);
    const totalCommission = allSettlements.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
    const totalRefunds = allSettlements.reduce((sum, s) => sum + (s.refunds_amount || 0), 0);
    const totalAdjustments = allSettlements.reduce((sum, s) => sum + (s.adjustments_amount || 0), 0);
    const settlementIds = allSettlements.map((s) => s.id);
    let items = [];
    if (settlementIds.length > 0) {
      const { data } = await supabase.from("vendor_settlement_items").select("*, orders(code, customer_name)").in("settlement_id", settlementIds);
      items = data || [];
    }
    const itemsBySettlement = {};
    items.forEach((item) => {
      if (!itemsBySettlement[item.settlement_id]) itemsBySettlement[item.settlement_id] = [];
      itemsBySettlement[item.settlement_id].push(item);
    });
    res.json({
      pendingPayout,
      settledTotal,
      totalGross,
      totalCommission,
      totalRefunds,
      totalAdjustments,
      settlements: allSettlements.map((s) => ({
        ...s,
        items: itemsBySettlement[s.id] || []
      })),
      commissionRateBps: allSettlements.length > 0 ? allSettlements[0].commission_rate_bps : 1e3
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/ratings-issues", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: reviews } = await supabase.from("reviews").select("*, orders(id, code)").eq("vendor_id", vendorId).gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false });
    const allReviews = reviews || [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach((r) => {
      const star = Math.round(r.overall || 0);
      if (star >= 1 && star <= 5) distribution[star] += 1;
    });
    const avgOverall = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.overall || 0), 0) / allReviews.length * 10) / 10 : 0;
    const avgVendor = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.vendor_rating || 0), 0) / allReviews.length * 10) / 10 : 0;
    const avgPickup = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.pickup_rating || 0), 0) / allReviews.length * 10) / 10 : 0;
    const avgLaundry = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.laundry_rating || 0), 0) / allReviews.length * 10) / 10 : 0;
    const avgDelivery = allReviews.length > 0 ? Math.round(allReviews.reduce((s, r) => s + (r.delivery_rating || 0), 0) / allReviews.length * 10) / 10 : 0;
    const openIssues = (() => {
      try {
        const ticketIds = allReviews.filter((r) => (r.overall || 0) <= 3).map((r) => r.order_id).filter(Boolean);
        if (ticketIds.length === 0) return 0;
        return null;
      } catch {
        return null;
      }
    })();
    const recentNegative = allReviews.filter((r) => (r.overall || 0) <= 3).slice(0, 10).map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      overall: r.overall,
      comment: r.comment,
      createdAt: r.created_at,
      orderCode: r.orders?.code || null,
      status: null
    }));
    const issueCategories = [];
    const weekMap = {};
    allReviews.forEach((r) => {
      const d = new Date(r.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!weekMap[key]) weekMap[key] = { total: 0, count: 0 };
      weekMap[key].total += r.overall || 0;
      weekMap[key].count += 1;
    });
    const ratingTrend = Object.entries(weekMap).map(([week, v]) => ({ week, avg: Math.round(v.total / v.count * 10) / 10, count: v.count })).sort((a, b) => a.week.localeCompare(b.week));
    res.json({
      avgOverall,
      avgVendor,
      avgPickup,
      avgLaundry,
      avgDelivery,
      openIssues,
      distribution,
      ratingTrend,
      issueCategories,
      recentNegative,
      totalReviews: allReviews.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router44.get("/cancellations", async (req, res) => {
  try {
    const vendorId = await resolveVendorId(req, res);
    if (!vendorId) return;
    const { startStr, endStr, service } = parseDateRange(req);
    const supabase = createAdminClient();
    const timezone = await resolveBusinessTimezone(supabase, vendorId);
    const { startDate, endDate } = resolveDateBoundaries(startStr, endStr, timezone);
    const { data: orders } = await buildOrderQuery(supabase, vendorId, startDate, endDate, service);
    const allOrders = orders || [];
    const cancelled = allOrders.filter((o) => o.status === "cancelled");
    const cancelRate = allOrders.length > 0 ? Math.round(cancelled.length / allOrders.length * 100) : 0;
    const refundTotal = cancelled.reduce((s, o) => s + (o.total || 0), 0);
    const vendorRejections = cancelled.filter((o) => o.cancelled_by === "vendor").length;
    const customerCancellations = cancelled.filter((o) => o.cancelled_by === "customer").length;
    const reasonMap = {};
    cancelled.forEach((o) => {
      const note = o.notes || "No reason specified";
      reasonMap[note] = (reasonMap[note] || 0) + 1;
    });
    const reasonsBreakdown = Object.entries(reasonMap).map(([reason, count]) => ({
      reason,
      count,
      percentage: cancelled.length > 0 ? Math.round(count / cancelled.length * 100) : 0,
      lostRevenue: Math.round(refundTotal * count / (cancelled.length || 1))
    })).sort((a, b) => b.count - a.count).slice(0, 5);
    const weekMap = {};
    cancelled.forEach((o) => {
      const d = new Date(o.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      weekMap[key] = (weekMap[key] || 0) + 1;
    });
    const cancellationTrend = Object.entries(weekMap).map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week));
    const typeMap = {};
    cancelled.forEach((o) => {
      const type = o.cancelled_by || "unknown";
      typeMap[type] = (typeMap[type] || 0) + 1;
    });
    const cancellationByType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));
    const cancelDrillDown = { status: "cancelled", startDate, endDate };
    res.json({
      cancelledOrders: cancelled.length,
      vendorRejections,
      customerCancellations,
      cancelRate,
      refundTotal,
      estimatedLostRevenue: refundTotal,
      cancellationTrend,
      cancellationByType,
      reasonsBreakdown,
      cancelDrillDown,
      topCancelledOrders: cancelled.slice(0, 10).map((o) => ({
        id: o.id,
        code: o.code,
        customerName: o.customer_name,
        total: o.total,
        createdAt: o.created_at,
        notes: o.notes,
        cancelledBy: o.cancelled_by || null
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var vendor_reports_default = router44;

// server/routes/webhooks.ts
var import_express46 = require("express");
init_supabase();
var router45 = (0, import_express46.Router)();
var RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
router45.post("/razorpay", async (req, res) => {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn("[webhook] RAZORPAY_WEBHOOK_SECRET not configured, rejecting webhook");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing webhook signature" });
      return;
    }
    const rawBody = req.body;
    const crypto5 = await import("crypto");
    const expectedSig = crypto5.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (Buffer.byteLength(expectedSig) !== Buffer.byteLength(signature)) {
      console.warn("[webhook] Invalid signature length");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
    if (!crypto5.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
      console.warn("[webhook] Invalid signature");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
    const eventId = req.headers["x-razorpay-event-id"];
    if (!eventId) {
      res.status(400).json({ error: "Missing event ID" });
      return;
    }
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("payment_webhook_events").insert({
      gateway: "razorpay",
      event_id: eventId,
      event_type: "unknown",
      // will be updated after parsing
      payload: null,
      status: "pending"
    });
    if (insertError) {
      if (insertError.code === "23505") {
        res.json({ status: "already_processed" });
        return;
      }
      console.error("[webhook] Failed to record event:", insertError.message);
      res.status(500).json({ error: "Failed to record event" });
      return;
    }
    let event;
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      await admin.from("payment_webhook_events").update({ status: "failed", processed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("event_id", eventId);
      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }
    await admin.from("payment_webhook_events").update({
      event_type: event.event,
      payload: event.payload
    }).eq("event_id", eventId);
    switch (event.event) {
      case "payment.captured": {
        const paymentEntity = event.payload?.payment?.entity;
        if (paymentEntity) {
          const razorpayOrderId = paymentEntity.order_id;
          const razorpayPaymentId = paymentEntity.id;
          if (razorpayOrderId && razorpayPaymentId) {
            const result = await markPaymentCaptureVerified(
              razorpayOrderId,
              razorpayPaymentId
            );
            console.log(
              `[webhook] payment.captured processed: eventId=${eventId}, orderId=${razorpayOrderId}, transactionId=${result.transactionId}, finalized=${result.finalized}`
            );
          }
        }
        break;
      }
      case "payment.failed": {
        const paymentEntity = event.payload?.payment?.entity;
        if (paymentEntity) {
          const razorpayOrderId = paymentEntity.order_id;
          const failureReason = paymentEntity.error_description || "Payment failed";
          if (razorpayOrderId) {
            await admin.from("payment_transactions").update({
              payment_status: "failed",
              failure_reason: failureReason,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("gateway_order_id", razorpayOrderId).in("payment_status", ["created", "pending", "authorized"]);
            console.log(
              `[webhook] payment.failed processed: eventId=${eventId}, orderId=${razorpayOrderId}`
            );
          }
        }
        break;
      }
      case "refund.processed": {
        console.log(`[webhook] refund.processed received: eventId=${eventId}`);
        break;
      }
      default:
        console.log(`[webhook] Unhandled event type: ${event.event} (eventId=${eventId})`);
    }
    await admin.from("payment_webhook_events").update({
      status: "processed",
      processed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("event_id", eventId);
    res.json({ status: "ok" });
  } catch (err) {
    console.error("[webhook] Error:", err.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
var webhooks_default = router45;

// server/app.ts
var import_express47 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_cookie_parser = __toESM(require("cookie-parser"));
var app = (0, import_express47.default)();
app.use((0, import_cors.default)({ origin: true, credentials: true }));
app.use(
  "/api/webhooks",
  import_express47.default.raw({ type: "application/json" }),
  webhooks_default
);
app.use(import_express47.default.json());
app.use((0, import_cookie_parser.default)());
app.use(authMiddleware);
app.get("/api", (_req, res) => res.json({ message: "Laundry Home API" }));
app.use("/api/auth", auth_default);
app.use("/api/orders", orders_default);
app.use("/api/vendors", vendors_default);
app.use("/api/addresses", addresses_default);
app.use("/api/areas", areas_default);
app.use("/api/delivery-tasks", delivery_tasks_default);
app.use("/api/delivery-executives", delivery_executives_default);
app.use("/api/notifications", notifications_default);
app.use("/api/slots", slots_default);
app.use("/api/wallet", wallet_default);
app.use("/api/reviews", reviews_default);
app.use("/api/services", services_default);
app.use("/api/service-categories", service_categories_default);
app.use("/api/service-items", service_items_default);
app.use("/api/coupons/validate", coupon_validate_default);
app.use("/api/coupons", coupons_default);
app.use("/api/admin", admin_default);
app.use("/api/vendor/analytics", vendor_analytics_default);
app.use("/api/subscriptions", subscriptions_default);
app.use("/api/vendor/staff", vendor_staff_default);
app.use("/api/garments", garments_default);
app.use("/api/wallet/methods", wallet_methods_default);
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
app.use("/api/vendor-service-prices", vendor_service_prices_default);
app.use("/api", payments_default);
app.use("/api/config/customer", customer_config_default);
app.use("/api/settings", settings_default);
app.use("/api/vendor/reports", vendor_reports_default);
var app_default = app;

// server/api-entry.ts
var api_entry_default = app_default;
