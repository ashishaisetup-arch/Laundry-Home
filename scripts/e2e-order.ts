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

async function check(ok: boolean, label: string, extra?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("=== 0. Test customer ===");
  let userId: string;
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  const found = existing?.users.find((u) => u.email === EMAIL);
  if (found) {
    userId = found.id;
    console.log("reusing existing test user:", userId);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (createErr) return console.error("createUser failed:", createErr.message);
    userId = created.user.id;
    console.log("created test user:", userId);
  }
  const { error: profErr } = await admin.from("user_profiles").upsert(
    { id: userId, name: "E2E Pricing Test", phone: "9999999999" },
    { onConflict: "id" }
  );
  if (profErr) console.warn("profile upsert warning:", profErr.message);

  console.log("\n=== 1. Login ===");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json();
  check(!!loginJson.session, "login session obtained");
  const setCookies = (loginRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]);
  const cookie = setCookies.join("; ");
  check(setCookies.length > 0, `server-set cookies captured (${setCookies.length})`, setCookies.map((c) => c.split("=")[0]).join(", "));

  console.log("\n=== 2. Fetch catalog (services + items) ===");
  const { data: services } = await admin.from("services").select("id, name, pricing_type, bag_price").order("display_order");
  const washFold = services!.find((x) => x.name === "Wash & Fold")!;
  const dryClean = services!.find((x) => x.name === "Dry Clean")!;
  const bag = services!.find((x) => x.pricing_type === "BAG")!;
  const flat = services!.find((x) => x.name === "Premium Packaging")!;

  async function item(serviceId: string, name?: string) {
    const { data } = await admin
      .from("service_items")
      .select("item_master_id, item_name, default_price")
      .match({ service_id: serviceId, ...(name ? { item_name: name } : {}) })
      .order("default_price")
      .limit(1);
    return data?.[0];
  }
  const i1 = await item(washFold.id, "Shirt");
  const i2 = await item(dryClean.id, "Saree");
  const i3 = await item(bag.id);
  const i4 = await item(flat.id);
  console.log("catalog:", { washFoldShirt: `${i1?.item_name}@${i1?.default_price}`, dryCleanSaree: `${i2?.item_name}@${i2?.default_price}`, bag: `${i3?.item_name}@${bag?.bag_price}`, flat: `${i4?.item_name}@${i4?.default_price}` });

  console.log("\n=== 3. Place mixed order ===");
  const items = [
    { serviceId: washFold.id, itemId: i1!.item_master_id, qty: 2, unit: "pc", specialInstructions: ["No starch"] },
    { serviceId: dryClean.id, itemId: i2!.item_master_id, qty: 1, unit: "pc" },
    { serviceId: bag.id, itemId: i3!.item_master_id, qty: 1, unit: "bag" },
    { serviceId: flat.id, itemId: i4!.item_master_id, qty: 1, unit: "flat" },
  ];
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items,
      pickup_area: "Horamavu",
      pickup_address: "123, 5th Cross, Horamavu",
      pickup_date: "2026-08-08",
      pickup_slot: "9:00 AM - 11:00 AM",
      delivery_date: "2026-08-09",
      delivery_slot: "9:00 AM - 11:00 AM",
      payment_method: "cod",
      vendor_id: null,
    }),
  });
  const order = await orderRes.json();
  check(orderRes.status === 201, `order created (HTTP ${orderRes.status})`, order.code || "");
  if (orderRes.status !== 201) {
    console.log("response:", JSON.stringify(order).substring(0, 400));
    return;
  }

  check(order.booking_type === "mixed", `booking_type = mixed (got ${order.booking_type})`);
  check(order.laundry_bag_qty === 1, `laundry_bag_qty = 1 (got ${order.laundry_bag_qty})`);
  check(order.items_v2 === true, "items_v2 = true");
  const snap = order.items || [];
  check(snap.length === 4, `snapshot has 4 lines (got ${snap.length})`);
  const bagSnap = snap.find((x: any) => x.itemName === "Laundry Bag");
  check(!!bagSnap && bagSnap.unit === "bag", `bag line unit = 'bag' (got ${bagSnap?.unit})`);
  check(snap.every((x: any) => x.serviceName && x.unitPrice > 0), "every snapshot line has serviceName + unitPrice > 0", snap.map((x: any) => `${x.serviceName}/${x.itemName}×${x.qty}@₹${x.unitPrice}`).join(" | "));

  console.log("\n=== 4. DB verification ===");
  const { data: dbOrder } = await admin.from("orders").select("*").eq("id", order.id).single();
  check(!!dbOrder, "order row exists");
  if (!dbOrder) return;
  check(dbOrder.booking_type === "mixed", "orders.booking_type = mixed");
  check(dbOrder.laundry_bag_qty === 1, "orders.laundry_bag_qty = 1");
  check(dbOrder.amount === order.amount && dbOrder.total === order.total, `amount/total persisted (₹${dbOrder.amount} / ₹${dbOrder.total})`);
  check(dbOrder.pricing_breakdown?.subtotal === order.amount, "pricing_breakdown persisted");
  const expectedSubtotal = 2 * i1!.default_price + 1 * i2!.default_price + 1 * bag.bag_price + 1 * i4!.default_price;
  check(dbOrder.amount === expectedSubtotal, `subtotal = ${expectedSubtotal} (got ₹${dbOrder.amount})`);

  const { data: orderItems } = await admin.from("order_items").select("*").eq("order_id", order.id);
  check(orderItems?.length === 4, `order_items has 4 rows (got ${orderItems?.length})`);
  const bagRow = orderItems?.find((x) => x.service_id === bag.id);
  check(!!bagRow && bagRow.unit_price === bag.bag_price && bagRow.customer_qty === 1, `bag order_item priced from bag_price (₹${bagRow?.unit_price})`);
  const wiRow = orderItems?.find((x) => x.service_id === washFold.id);
  check(!!wiRow && wiRow.unit_price === i1!.default_price, `wash&fold order_item priced ₹${wiRow?.unit_price}`);
  check((orderItems || []).every((x) => x.booking_type === "laundry_bag" || x.booking_type === "count_items"), "order_items booking_type per line");

  console.log("\n=== 5. GET /api/orders roundtrip ===");
  const getRes = await fetch(`${BASE}/api/orders`, { headers: { Cookie: cookie } });
  const orders = await getRes.json();
  const roundtrip = Array.isArray(orders) ? orders.find((o) => o.id === order.id) : orders;
  check(!!roundtrip, "order visible in GET /api/orders");
  if (roundtrip) check(roundtrip.booking_type === "mixed" && roundtrip.laundry_bag_qty === 1, "GET returns booking_type/laundry_bag_qty");

  console.log("\nDone. Order code:", order.code, "| total ₹", order.total);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
