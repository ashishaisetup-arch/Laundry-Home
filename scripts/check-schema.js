require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try to get the current trigger function source
  const { data, error } = await supabase.rpc("get_trigger_source");
  console.log("get_trigger_source:", error ? error.message : data?.substring(0, 500));
}

main().catch(console.error);
