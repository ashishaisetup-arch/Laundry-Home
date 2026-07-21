require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: "admin@laundryhome.com", password: "demo123456", name: "System Admin", role: "superadmin" },
  { email: "ananya@laundryhome.com", password: "ananya123456", name: "Ananya Iyer", role: "admin" },
];

async function createUser({ email, password, name, role }) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role },
    });

    if (error) {
      if (error.message && error.message.includes("already exists")) {
        console.log(`  ↻  ${email} already exists — updating...`);
        const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
        if (listErr) { console.log(`  ✗  ${email}: ${listErr.message}`); return; }
        const existing = userList?.users?.find((u) => u.email === email);
        if (existing) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
            user_metadata: { name, role },
          });
          if (updateErr) { console.log(`  ✗  ${email}: ${updateErr.message}`); return; }
          const { error: upsertErr } = await supabase
            .from("user_profiles")
            .upsert({ id: existing.id, name, email, role, updated_at: new Date().toISOString() });
          if (!upsertErr) console.log(`  ✓  ${email} updated to ${role}`);
          else console.log(`  ✗  ${email} profile upsert: ${upsertErr.message}`);
        }
      } else {
        console.log(`  ✗  ${email}: ${JSON.stringify(error)}`);
      }
      return;
    }

    console.log(`  ✓  ${email} created as ${role} (id: ${data.user.id})`);
  } catch (e) {
    console.log(`  ✗  ${email}: unexpected error: ${e.message}`);
  }
}

(async () => {
  console.log("Creating admin users...\n");
  for (const u of USERS) {
    await createUser(u);
  }
  console.log("\nDone.");
  process.exit(0);
})();
