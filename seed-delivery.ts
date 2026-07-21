import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zuayfacnytoougyvvvcl.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1YXlmYWNueXRvb3VneXZ2dmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkxODE4NiwiZXhwIjoyMDk5NDk0MTg2fQ.DB40hDgWEFAOYRwiJOFxzDLHOghF-ivuuv1Vok9HleM";
const supabase = createClient(supabaseUrl, serviceKey);

const RAJU_ID = "773cca76-66cf-4fc3-b069-f9d851bc9061";

async function seed() {
  // Get a vendor to use
  const { data: vendors } = await supabase.from("vendors").select("id, name, area").limit(1);
  const vendor = vendors?.[0];
  if (!vendor) { console.error("No vendor found"); return; }
  console.log(`Using vendor: ${vendor.name} (${vendor.area})`);

  // Delete any existing tasks for Raju to start fresh
  await supabase.from("delivery_tasks").delete().eq("exec_id", RAJU_ID);

  // Create a pickup task — use an existing order or create a synthetic one
  // We'll use an existing order from Horamavu
  const { data: orders } = await supabase
    .from("orders")
    .select("id, code, customer_name, pickup_address, pickup_area, pickup_slot, total, vendor_name")
    .eq("pickup_area", "Horamavu")
    .limit(1);

  let orderId: string;
  let orderCode: string;
  let customerName: string;
  let vendorName: string;

  if (orders && orders.length > 0) {
    orderId = orders[0].id;
    orderCode = orders[0].code;
    customerName = orders[0].customer_name || "Customer";
    vendorName = orders[0].vendor_name || vendor.name;

    // Assign this order to Raju
    await supabase.from("orders").update({
      delivery_executive_id: RAJU_ID,
      delivery_executive_name: "Raju Kumar",
    }).eq("id", orderId);
  } else {
    // Create a synthetic order reference
    orderId = "00000000-0000-0000-0000-000000000001";
    orderCode = "LH-DEMO001";
    customerName = "Demo Customer";
    vendorName = vendor.name;
  }

  // Create pickup task
  const { error: pErr } = await supabase.from("delivery_tasks").insert({
    type: "pickup",
    order_id: orderId,
    order_code: orderCode,
    customer_name: customerName,
    vendor_name: vendorName,
    address: "123, 5th Cross, Indiranagar",
    area: "Indiranagar",
    slot: "09:00-11:00",
    amount: 450,
    items: "3 shirts, 2 pants",
    status: "pending",
    exec_id: RAJU_ID,
    distance_km: 2.4,
    estimated_mins: 15,
  });
  if (pErr) { console.error("Pickup insert error:", pErr.message); }
  else { console.log("Pickup task created for Indiranagar"); }

  // Create delivery task
  const { error: dErr } = await supabase.from("delivery_tasks").insert({
    type: "delivery",
    order_id: orderId,
    order_code: orderCode,
    customer_name: customerName,
    vendor_name: vendorName,
    address: "456, 12th Main, Koramangala",
    area: "Koramangala",
    slot: "14:00-16:00",
    amount: 450,
    items: "3 shirts, 2 pants",
    status: "pending",
    exec_id: RAJU_ID,
    distance_km: 5.1,
    estimated_mins: 25,
  });
  if (dErr) { console.error("Delivery insert error:", dErr.message); }
  else { console.log("Delivery task created for Koramangala"); }

  // Verify
  const { data: tasks } = await supabase.from("delivery_tasks").select("*").eq("exec_id", RAJU_ID);
  console.log(`\nTasks for Raju: ${tasks?.length || 0}`);
  for (const t of tasks || []) {
    console.log(`  ${t.type} · ${t.area} · ${t.status}`);
  }
}

seed().catch(console.error);
