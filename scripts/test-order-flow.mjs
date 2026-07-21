const BASE = "http://localhost:8081";

function toBase64Url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "horamavu@horamavu.com", password: "vendor123" }),
    redirect: "manual",
  });
  const loginJson = await loginRes.json();
  const session = loginJson.session;

  if (!session) {
    console.error("Login FAILED:", loginJson);
    return;
  }
  console.log("✓ Login OK — vendor:", loginJson.user?.email);

  const vendorId = "65b922a9-16ce-4211-a94e-e23969aad09f";
  const url = `${BASE}/api/orders?vendorId=${vendorId}`;
  const projectRef = "zuayfacnytoougyvvvcl";

  // The SSR cookie stores the FULL session object as base64url-encoded JSON
  const tokenJson = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
  });
  const cookieValue = toBase64Url(tokenJson);

  const cookieName = `sb-${projectRef}-auth-token`;
  console.log(`\nTrying cookie: ${cookieName}=${cookieValue.substring(0, 30)}...`);

  const ordersRes = await fetch(url, {
    headers: { Cookie: `${cookieName}=${cookieValue}` },
  });

  console.log(`Status: ${ordersRes.status}`);
  const ordersText = await ordersRes.text();
  const orders = JSON.parse(ordersText);
  if (Array.isArray(orders)) {
    console.log(`Orders found: ${orders.length}`);
    orders.forEach(o => console.log(`  ${o.code} — ${o.status} — customer: ${o.customer_id}`));
  } else {
    console.log(`Response: ${JSON.stringify(orders).substring(0, 500)}`);
  }

  // Also try the old pkce/sb-* cookie name format
  console.log("\n--- Trying alternative cookie name formats ---");
  
  const altNames = [
    `sb-access-token`,           // older Supabase SSR format
    `sb-refresh-token`,
    `sb-${projectRef}-auth-token`,  // current format
  ];
  
  for (const name of altNames) {
    const val = name === "sb-access-token" ? session.access_token : cookieValue;
    const res = await fetch(url, {
      headers: { Cookie: `${name}=${val}` },
    });
    console.log(`  ${name}: ${res.status} ${res.status === 200 ? '✓' : '✗'}`);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`    Orders: ${data.length}`);
    }
  }
}

main().catch(console.error);
