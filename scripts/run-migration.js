const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL environment variable.");
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, "..", "supabase", "migrations", "00001_schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log("Connecting to Supabase database...");
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected. Running migration...");
    await client.query(sql);
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
