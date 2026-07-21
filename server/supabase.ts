import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function env(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export function createAdminClient() {
  return createClient(env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createServerClientWithCookies(
  cookieGetter: (name: string) => string | undefined,
  cookieSetter?: (name: string, value: string, options: { maxAge?: number }) => void,
  cookieRemover?: (name: string) => void,
) {
  return createServerClient(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_ANON_KEY"), {
    cookieOptions: { secure: false },
    cookies: {
      get(name: string) {
        return cookieGetter(name);
      },
      set(name, value, options) {
        cookieSetter?.(name, value, options);
      },
      remove(name) {
        cookieRemover?.(name);
      },
    },
  });
}

// Ensure RBAC tables exist (runs at server startup)
export async function ensureSystemTables() {
  const admin = createAdminClient();

  // Create roles table if not exists
  const { error: rolesErr } = await admin.rpc("exec_sql" as any, {
    query: `
      create table if not exists roles (
        name text primary key,
        label text not null,
        description text,
        is_system_role boolean not null default true,
        created_at timestamptz not null default now()
      );

      create table if not exists role_permissions (
        id uuid primary key default gen_random_uuid(),
        role text not null references roles(name) on delete cascade,
        resource text not null,
        action text not null,
        allowed boolean not null default false,
        created_at timestamptz not null default now(),
        unique(role, resource, action)
      );

      insert into roles (name, label, description) values
        ('customer',   'Customer',     'End users who place laundry orders'),
        ('vendor',     'Vendor',       'Laundry service providers'),
        ('delivery',   'Delivery Exec','Delivery personnel for pickup/drop-off'),
        ('admin',      'Admin',        'Platform administrators with elevated access'),
        ('superadmin', 'Super Admin',  'Full platform control with all permissions')
      on conflict (name) do nothing;
    `,
  });

  if (rolesErr) {
    // exec_sql rpc may not exist; fallback: try direct table access
    // Check if we can at least read roles to know if they exist
    const { data: existingRoles } = await admin.from("roles").select("name").limit(1);
    if (!existingRoles || existingRoles.length === 0) {
      console.warn("RBAC tables not yet created. Run migration 00008_rbac_tables.sql manually via Supabase dashboard SQL editor.");
    }
    return;
  }

  // Seed permissions via the admin client (safe inserts using upsert patterns)
  const allResources = ["users","vendors","orders","system_config","features","audit_logs","integrations","rbac","campaigns","reports"];
  async function seedRole(role: string, resources: string[], actions: string[], allowed: boolean) {
    for (const r of resources) {
      for (const action of actions) {
        try {
          await admin.from("role_permissions").upsert(
            { role, resource: r, action, allowed },
            { onConflict: "role,resource,action", ignoreDuplicates: false }
          );
        } catch {}
      }
    }
  }

  const allActions = ["view","create","edit","delete","manage"];
  const adminResources = ["users","vendors","orders","features","audit_logs","integrations","campaigns","reports"];
  const crud = ["view","create","edit","delete"];
  const vewEdt = ["view","edit"];
  const vewCrt = ["view","create"];

  await seedRole("superadmin", allResources, allActions, true);
  await seedRole("admin", adminResources, crud, true);
  await seedRole("admin", ["rbac","system_config"], ["view"], true);
  await seedRole("vendor", ["orders"], vewCrt, true);
  await seedRole("vendor", ["vendors"], vewEdt, true);
  await seedRole("delivery", ["orders"], vewEdt, true);
  await seedRole("delivery", ["vendors"], ["view"], true);
  await seedRole("customer", ["orders"], vewCrt, true);
  await seedRole("customer", ["vendors"], ["view"], true);

  console.log("RBAC tables and permissions seeded.");
}