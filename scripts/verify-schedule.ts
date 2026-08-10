import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { createAdminClient } from "../server/supabase";

const admin = createAdminClient();
const BASE = "http://localhost:8080";
const EMAIL = "e2e.pricing.test@laundryhome.app";
const PASSWORD = "Test@12345";

function toBase64Url(str: string) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function check(ok: boolean, label: string, extra?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("=== 0. Test customer + login ===");
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  let userId = existing?.users.find((u) => u.email === EMAIL)?.id;
  if (!userId) {
    const { data: created } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    userId = created.user.id;
  }
  await admin.from("user_profiles").upsert(
    { id: userId, name: "E2E Schedule Test", phone: "9999999999" },
    { onConflict: "id" }
  );
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookies = (loginRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]);
  const cookie = setCookies.join("; ");
  check(!!cookie, "login session obtained");

  console.log("\n=== 1. Catalog: services by slug ===");
  const { data: services } = await admin.from("services").select("id, name, slug");
  const wash = services!.find((x) => x.name === "Wash & Fold")!;
  const addons = {
    sameDay: services!.find((x) => x.slug === "same_day_delivery")!,
    twentyFourHour: services!.find((x) => x.slug === "24_hour_delivery")!,
    express: services!.find((x) => x.slug === "express_pickup")!,
  };
  check(!!wash && !!addons.sameDay && !!addons.twentyFourHour && !!addons.express, "time add-ons resolvable by slug",
    Object.entries(addons).map(([k, v]) => `${k}=${v.slug}`).join(", "));

  const { data: washItem } = await admin.from("service_items").select("item_master_id").match({ service_id: wash.id, item_name: "Shirt" }).single();
  async function addonItem(svcId: string) {
    const { data } = await admin.from("service_items").select("item_master_id").match({ service_id: svcId }).limit(1).maybeSingle();
    return data?.item_master_id;
  }

  const today = iso(new Date());
  const tomorrow = iso(new Date(Date.now() + 86400000));
  const body = (extra: Record<string, unknown>) => ({
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
    ],
    pickup_area: "Horamavu",
    pickup_address: "123, 5th Cross, Horamavu",
    payment_method: "cod",
    vendor_id: null,
    ...extra,
  });

  async function place(label: string, payload: Record<string, unknown>, expectStatus: number) {
    const res = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body(payload)),
    });
    const json = await res.json();
    check(res.status === expectStatus, label, res.status === expectStatus ? json.code || "ok" : `${res.status} -> ${JSON.stringify(json).substring(0, 200)}`);
    return json;
  }

  console.log("\n=== 2. 24 Hour Delivery: valid next-day equivalent window ===");
  const ok24 = await place("24h addon, pickup today 9-11 / delivery tomorrow 9-11", {
    pickup_date: today, pickup_slot: "9:00 AM - 11:00 AM",
    delivery_date: tomorrow, delivery_slot: "9:00 AM - 11:00 AM",
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
      { serviceId: addons.twentyFourHour.id, itemId: await addonItem(addons.twentyFourHour.id), qty: 1 },
    ],
  }, 201);
  if (ok24.code) {
    check(ok24.pickup_mode === "scheduled", `order.pickup_mode = scheduled (got ${ok24.pickup_mode})`);
    check(ok24.delivery_speed === "24_hour", `order.delivery_speed = 24_hour (got ${ok24.delivery_speed})`);
  }

  console.log("\n=== 3. 24 Hour Delivery: slot beyond pickup window end rejected ===");
  await place("24h addon, delivery slot ends after pickup window end", {
    pickup_date: today, pickup_slot: "9:00 AM - 11:00 AM",
    delivery_date: tomorrow, delivery_slot: "1:00 PM - 3:00 PM",
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
      { serviceId: addons.twentyFourHour.id, itemId: await addonItem(addons.twentyFourHour.id), qty: 1 },
    ],
  }, 400);

  console.log("\n=== 4. Same Day Delivery: valid same-day schedule ===");
  const okSame = await place("same-day addon, pickup 9-11 / delivery today 11-1", {
    pickup_date: today, pickup_slot: "9:00 AM - 11:00 AM",
    delivery_date: today, delivery_slot: "11:00 AM - 1:00 PM",
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
      { serviceId: addons.sameDay.id, itemId: await addonItem(addons.sameDay.id), qty: 1 },
    ],
  }, 201);
  if (okSame.code) check(okSame.delivery_speed === "same_day", `order.delivery_speed = same_day (got ${okSame.delivery_speed})`);

  console.log("\n=== 5. Same Day Delivery: delivery on a different date rejected ===");
  await place("same-day addon, delivery tomorrow", {
    pickup_date: today, pickup_slot: "9:00 AM - 11:00 AM",
    delivery_date: tomorrow, delivery_slot: "11:00 AM - 1:00 PM",
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
      { serviceId: addons.sameDay.id, itemId: await addonItem(addons.sameDay.id), qty: 1 },
    ],
  }, 400);

  console.log("\n=== 6. Express Pickup: valid today + express slot ===");
  const okExpress = await place("express addon, pickup today express slot / delivery tomorrow 9-11", {
    pickup_date: today, pickup_slot: "Express Pickup (within 30 mins)",
    delivery_date: tomorrow, delivery_slot: "9:00 AM - 11:00 AM",
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
      { serviceId: addons.express.id, itemId: await addonItem(addons.express.id), qty: 1 },
    ],
  }, 201);
  if (okExpress.code) check(okExpress.pickup_mode === "express", `order.pickup_mode = express (got ${okExpress.pickup_mode})`);

  console.log("\n=== 7. Express Pickup: non-today pickup rejected ===");
  await place("express addon, pickup tomorrow", {
    pickup_date: tomorrow, pickup_slot: "Express Pickup (within 30 mins)",
    delivery_date: tomorrow, delivery_slot: "9:00 AM - 11:00 AM",
    items: [
      { serviceId: wash.id, itemId: washItem?.item_master_id, qty: 1, unit: "pc", specialInstructions: [] },
      { serviceId: addons.express.id, itemId: await addonItem(addons.express.id), qty: 1 },
    ],
  }, 400);

  console.log("\n=== 8. Standard order: unknown slot string rejected ===");
  await place("no addons, bogus slot format", {
    pickup_date: today, pickup_slot: "09:00-11:00",
    delivery_date: tomorrow, delivery_slot: "09:00-11:00",
  }, 400);

  console.log("\n=== 9. Standard order: valid schedule accepted ===");
  const okStd = await place("no addons, canonical slots", {
    pickup_date: today, pickup_slot: "9:00 AM - 11:00 AM",
    delivery_date: tomorrow, delivery_slot: "9:00 AM - 11:00 AM",
  }, 201);
  if (okStd.code) check(okStd.delivery_speed === "standard", `order.delivery_speed = standard (got ${okStd.delivery_speed})`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
