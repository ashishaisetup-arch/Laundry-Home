require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

async function main() {
  // Check trigger function definition
  const res = await fetch(process.env.VITE_SUPABASE_URL + "/rest/v1/rpc/get_trigger_def", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({}),
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text.substring(0, 500));
}
main().catch(console.error);
