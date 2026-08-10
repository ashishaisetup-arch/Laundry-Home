import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { createAdminClient } from "../server/supabase";
import { calculatePricing } from "../server/pricing";

const admin = createAdminClient();

async function check(ok: boolean, label: string, extra?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("=== 1. services.pricing_type / bag_price ===");
  const { data: services, error: svcErr } = await admin
    .from("services")
    .select("id, name, pricing_type, bag_price, unit, is_active")
    .order("display_order");
  if (svcErr) return console.error("services query failed:", svcErr.message);
  const counts: Record<string, number> = {};
  for (const s of services) counts[s.pricing_type] = (counts[s.pricing_type] || 0) + 1;
  console.log("pricing_type distribution:", counts);
  const bags = services.filter((s) => s.pricing_type === "BAG");
  check(bags.length >= 2, `BAG services seeded (found ${bags.length})`, bags.map((b) => `${b.name}@₹${b.bag_price}`).join(", "));
  check(services.every((s) => !!s.pricing_type), "every service has pricing_type");

  console.log("\n=== 2. Bag service_items → item_master linkage ===");
  const bagIds = bags.map((b) => b.id);
  const { data: bagItems } = await admin
    .from("service_items")
    .select("service_id, item_name, item_master_id, default_price")
    .in("service_id", bagIds);
  check(!!bagItems && bagItems.length >= 2, "bag service_items exist", (bagItems || []).map((i) => `${i.item_name} (master=${!!i.item_master_id})`).join(", "));
  check((bagItems || []).every((i) => i.item_master_id), "every bag item linked to item_master");

  console.log("\n=== 3. system_config booking-mode flags ===");
  const { data: cfg } = await admin.from("system_config").select("config").eq("id", 1).single();
  const customer = cfg?.config?.customer || {};
  check(
    ["enableCountItems", "enableLaundryBag", "enableMixedBooking"].every((k) => typeof customer[k] === "boolean"),
    "booking-mode flags present",
    JSON.stringify({ enableCountItems: customer.enableCountItems, enableLaundryBag: customer.enableLaundryBag, enableMixedBooking: customer.enableMixedBooking })
  );

  console.log("\n=== 4. Pricing engine smoke (real catalog data) ===");
  const itemServices = services.filter((s) => s.pricing_type === "ITEM" && s.is_active !== false);
  const svcA = itemServices.find((s) => s.name === "Wash & Fold")!;
  const svcB = itemServices.find((s) => s.name === "Whitening")!;
  const flat = services.find((s) => s.pricing_type === "FIXED" && s.name === "Same Day Delivery")!;
  console.log("lookups:", { svcA: svcA?.name, svcB: svcB?.name, flat: flat?.name });

  async function firstItem(serviceId: string, itemName?: string) {
    const q = { service_id: serviceId, ...(itemName ? { item_name: itemName } : {}) };
    const { data } = await admin.from("service_items").select("item_master_id, item_name, default_price").match(q).order("default_price").limit(1);
    return data?.[0];
  }

  const itemA = await firstItem(svcA.id, "Shirt");
  const itemB = await firstItem(svcB.id, "Shirt");
  const flatItem = await firstItem(flat.id);
  console.log("items:", { a: itemA ? `${itemA.item_name}@₹${itemA.default_price}` : "none", b: itemB ? `${itemB.item_name}@₹${itemB.default_price}` : "none", flat: flatItem ? `${flatItem.item_name}@₹${flatItem.default_price}` : "none" });
  const bagSvc = bags[0];
  const bagItem = (bagItems || []).find((i) => i.service_id === bagSvc.id);
  const itemAId = itemA?.item_master_id ?? null;
  const itemBId = itemB?.item_master_id ?? null;
  const flatItemId = flatItem?.item_master_id ?? null;

  const pricing = await calculatePricing({
    items: [
      { serviceId: svcA.id, itemId: itemAId, qty: 8 },
      { serviceId: svcB.id, itemId: itemBId, qty: 3 },
      { serviceId: bagSvc.id, itemId: bagItem?.item_master_id ?? null, qty: 2 },
      { serviceId: flat.id, itemId: flatItemId, qty: 1 },
    ].filter((i) => !!i.itemId) as { serviceId: string; itemId: string; qty: number }[],
    userId: "00000000-0000-0000-0000-000000000000",
  });

  const lineText = (pricing.lines || [])
    .map((l) => `${l.serviceId === svcA.id ? "Wash&Fold" : l.serviceId === svcB.id ? "Whitening" : l.serviceId === bagSvc.id ? bagSvc.name : "SameDay"}: ${l.qty}×₹${l.unitPrice}`)
    .join(" | ");
  console.log("lines:", lineText);
  console.log("subtotal:", pricing.subtotal, "| total:", pricing.total);
  check(!!pricing.lines && pricing.lines.length === 4, "4 per-line unitPrice entries", lineText);
  const expected =
    8 * (itemA?.default_price || 0) + 3 * (itemB?.default_price || 0) + 2 * (bagSvc.bag_price || 0) + 1 * (flatItem?.default_price || 0);
  check(pricing.subtotal === expected, `subtotal correct (₹${pricing.subtotal} = ₹${expected})`);
  const bagLine = pricing.lines?.find((l) => l.serviceId === bagSvc.id);
  check(bagLine?.unitPrice === bagSvc.bag_price, `bag priced from services.bag_price (₹${bagLine?.unitPrice})`);
  const sameNameLineA = pricing.lines?.find((l) => l.serviceId === svcA.id);
  const sameNameLineB = pricing.lines?.find((l) => l.serviceId === svcB.id);
  check(
    sameNameLineA?.unitPrice === itemA?.default_price && sameNameLineB?.unitPrice === itemB?.default_price,
    `same item name priced per-service (₹${sameNameLineA?.unitPrice} vs ₹${sameNameLineB?.unitPrice})`
  );

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
