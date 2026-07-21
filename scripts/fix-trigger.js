require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create a function that will fix the trigger
  // First, let's try to drop and recreate the trigger function with safe defaults
  const sql = `
  create or replace function handle_new_user()
  returns trigger
  language plpgsql
  security definer set search_path = ''
  as $$
  begin
    insert into user_profiles (id, role, name, email, phone, avatar)
    values (
      new.id,
      coalesce(
        (new.raw_user_meta_data->>'role')::user_role,
        'customer'
      ),
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
      new.email,
      coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
      coalesce(new.raw_user_meta_data->>'avatar', '')
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;
  `;

  // Try executing via a custom RPC function
  const { error } = await supabase.rpc("exec_sql", { query: sql });
  console.log("exec_sql result:", error ? "FAILED: " + error.message : "OK");

  // If that doesn't exist, try creating the users via a different method
  // Use direct REST API to create users
  console.log("Trying direct user creation...");

  const users = [
    { email: "owner@freshfold.co", password: "demo123456", user_metadata: { name: "FreshFold Laundry Co.", role: "vendor", avatar: "FF" } },
    { email: "ananya@laundryhome.com", password: "demo123456", user_metadata: { name: "Ananya Iyer", role: "admin", avatar: "AI" } },
    { email: "admin@laundryhome.com", password: "demo123456", user_metadata: { name: "System Admin", role: "superadmin", avatar: "SA" } },
  ];

  for (const u of users) {
    const res = await fetch(process.env.VITE_SUPABASE_URL + "/auth/v1/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ ...u, email_confirm: true }),
    });
    const text = await res.text();
    console.log(u.email, "=>", res.status, text.substring(0, 200));
  }
}

main().catch(console.error);
