-- RBAC: roles and role_permissions tables

-- 1. Roles
create table if not exists roles (
  name text primary key,
  label text not null,
  description text,
  is_system_role boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Role permissions (one row per role x resource x action)
create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null references roles(name) on delete cascade,
  resource text not null,
  action text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(role, resource, action)
);

-- Seed roles
insert into roles (name, label, description) values
  ('customer',   'Customer',     'End users who place laundry orders'),
  ('vendor',     'Vendor',       'Laundry service providers'),
  ('delivery',   'Delivery Exec','Delivery personnel for pickup/drop-off'),
  ('admin',      'Admin',        'Platform administrators with elevated access'),
  ('superadmin', 'Super Admin',  'Full platform control with all permissions')
on conflict (name) do nothing;

-- Seed default permissions for each role
-- Resources: users, vendors, orders, system_config, features, audit_logs, integrations, rbac, campaigns, reports
-- Actions: view, create, edit, delete, manage

do $$ declare
  r text;
begin
  -- Super Admin: everything allowed
  for r in select unnest(array['users','vendors','orders','system_config','features','audit_logs','integrations','rbac','campaigns','reports']) loop
    insert into role_permissions (role, resource, action, allowed) values
      ('superadmin', r, 'view',   true),
      ('superadmin', r, 'create', true),
      ('superadmin', r, 'edit',   true),
      ('superadmin', r, 'delete', true),
      ('superadmin', r, 'manage', true)
    on conflict (role, resource, action) do nothing;
  end loop;

  -- Admin: most things allowed, no manage on rbac, system_config
  for r in select unnest(array['users','vendors','orders','features','audit_logs','integrations','campaigns','reports']) loop
    insert into role_permissions (role, resource, action, allowed) values
      ('admin', r, 'view',   true),
      ('admin', r, 'create', true),
      ('admin', r, 'edit',   true),
      ('admin', r, 'delete', true)
    on conflict (role, resource, action) do nothing;
  end loop;
  -- Admin: view-only on rbac, system_config
  insert into role_permissions (role, resource, action, allowed) values
    ('admin', 'rbac', 'view', true),
    ('admin', 'system_config', 'view', true)
  on conflict (role, resource, action) do nothing;

  -- Vendor: orders + basic vendor profile
  for r in select unnest(array['orders']) loop
    insert into role_permissions (role, resource, action, allowed) values
      ('vendor', r, 'view',   true),
      ('vendor', r, 'create', true),
      ('vendor', r, 'edit',   true)
    on conflict (role, resource, action) do nothing;
  end loop;
  insert into role_permissions (role, resource, action, allowed) values
    ('vendor', 'vendors', 'view', true),
    ('vendor', 'vendors', 'edit', true)
  on conflict (role, resource, action) do nothing;

  -- Delivery: view orders, view vendors
  insert into role_permissions (role, resource, action, allowed) values
    ('delivery', 'orders', 'view', true),
    ('delivery', 'orders', 'edit', true),
    ('delivery', 'vendors', 'view', true)
  on conflict (role, resource, action) do nothing;

  -- Customer: place/view orders, view vendors
  insert into role_permissions (role, resource, action, allowed) values
    ('customer', 'orders', 'view',   true),
    ('customer', 'orders', 'create', true),
    ('customer', 'vendors', 'view',  true)
  on conflict (role, resource, action) do nothing;
end $$;

-- RLS
alter table roles enable row level security;
alter table role_permissions enable row level security;

do $$ begin
  drop policy if exists "Roles admin access" on roles;
  create policy "Roles admin access"
    on roles for all
    using (get_user_role() in ('admin','superadmin'));
end $$;

do $$ begin
  drop policy if exists "Roles readable by all" on roles;
  create policy "Roles readable by all"
    on roles for select
    using (true);
end $$;

do $$ begin
  drop policy if exists "Role permissions admin write" on role_permissions;
  create policy "Role permissions admin write"
    on role_permissions for all
    using (get_user_role() in ('admin','superadmin'));
end $$;

do $$ begin
  drop policy if exists "Role permissions readable by all" on role_permissions;
  create policy "Role permissions readable by all"
    on role_permissions for select
    using (true);
end $$;
