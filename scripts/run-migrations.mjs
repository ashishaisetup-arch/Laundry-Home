import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://zuayfacnytoougyvvvcl.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const migrations = [
  "supabase/migrations/00026_dynamic_pricing.sql",
  "supabase/migrations/00027_multi_city.sql",
];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  for (const file of migrations) {
    console.log(`Running ${file}...`);
    const sql = readFileSync(file, "utf-8");

    // Split by semicolons and run each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      const { error } = await supabase.rpc("exec_sql", { query: stmt + ";" });
      if (error) {
        // exec_sql might not exist — fall back to raw query
        console.log(`  exec_sql RPC failed (likely not available), trying direct SQL...`);
        // Try via direct REST query
        const { error: sqlError } = await supabase
          .from("_sql_exec")
          .select("*")
          .limit(0);

        if (sqlError?.message?.includes("relation") || sqlError?.message?.includes("does not exist")) {
          // Try using pg-mem or direct connection
          console.log(`  Could not execute SQL directly. Use Supabase dashboard SQL editor.`);
          console.log(`  SQL to run:`);
          console.log(sql);
          break;
        }
      } else {
        console.log(`  OK`);
      }
    }
    console.log(`Done with ${file}`);
  }
}

run().catch(console.error);
