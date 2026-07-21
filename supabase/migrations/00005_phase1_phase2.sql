-- ============================================================================
-- Phase 1: Schema additions (columns + new tables)
-- ============================================================================

-- Add columns to user_subscriptions for subscription mgmt
do $$ begin
  alter table user_subscriptions add column billing_interval text not null default 'monthly';
exception when duplicate_column then null;
end $$;
do $$ begin
  alter table user_subscriptions add column status text not null default 'active';
exception when duplicate_column then null;
end $$;

-- Add email to user_profiles
do $$ begin
  alter table user_profiles add column email text;
exception when duplicate_column then null;
end $$;

-- Add discount & coupon_code to orders
do $$ begin
  alter table orders add column discount integer not null default 0;
exception when duplicate_column then null;
end $$;
do $$ begin
  alter table orders add column coupon_code text;
exception when duplicate_column then null;
end $$;

-- Payment methods
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type text not null,
  label text not null,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Support tickets
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  subject text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'medium',
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$ begin
  create type ticket_status as enum ('open','in_progress','resolved','closed');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type ticket_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null;
end $$;

-- Campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null default 'promo',
  status text not null default 'draft',
  budget integer default 0,
  spent integer default 0,
  reach integer default 0,
  conversions integer default 0,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);
do $$ begin
  create type campaign_type as enum ('promo','seasonal','referral','reactivation');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type campaign_status as enum ('draft','active','paused','completed');
exception when duplicate_object then null;
end $$;

-- Feature flags
create table if not exists feature_flags (
  key text primary key,
  label text not null,
  description text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add columns to vendor_staff for UI display
do $$ begin
  alter table vendor_staff add column shift text default 'Morning (6 AM – 2 PM)';
exception when duplicate_column then null;
end $$;
do $$ begin
  alter table vendor_staff add column status text default 'off-duty';
exception when duplicate_column then null;
end $$;
do $$ begin
  alter table vendor_staff add column rating numeric(3,1) default 4.5;
exception when duplicate_column then null;
end $$;
do $$ begin
  alter table vendor_staff add column orders_today integer default 0;
exception when duplicate_column then null;
end $$;

-- Seed vendor staff
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Lakshmi Devi', 'worker', 'Morning (6 AM – 2 PM)', 'on-duty', 4.9, 18 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Lakshmi Devi')
limit 1;
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Mohammed Irfan', 'worker', 'Morning (6 AM – 2 PM)', 'on-duty', 4.8, 22 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Mohammed Irfan')
limit 1;
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Sunita Rao', 'worker', 'Afternoon (2 PM – 10 PM)', 'on-duty', 4.7, 14 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Sunita Rao')
limit 1;
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Arjun Nair', 'worker', 'Afternoon (2 PM – 10 PM)', 'on-duty', 4.9, 28 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Arjun Nair')
limit 1;
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Fatima Begum', 'worker', 'Evening (10 AM – 6 PM)', 'on-break', 4.6, 16 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Fatima Begum')
limit 1;
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Vijay Kumar', 'worker', 'Morning (6 AM – 2 PM)', 'off-duty', 4.5, 0 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Vijay Kumar')
limit 1;
insert into vendor_staff (vendor_id, name, role, shift, status, rating, orders_today)
select id, 'Deepa Singh', 'worker', 'Afternoon (2 PM – 10 PM)', 'off-duty', 4.4, 0 from vendors
where id is not null and not exists (select 1 from vendor_staff where name = 'Deepa Singh')
limit 1;

-- Audit logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id),
  action text not null,
  resource text not null,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- API keys & webhooks
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_value text not null unique,
  enabled boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  events text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Reports & scheduled reports
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  config jsonb default '{}',
  created_at timestamptz not null default now()
);
create table if not exists scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  schedule text not null,
  recipients text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Update handle_new_user to capture email
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = 'public, auth'
as $$
begin
  insert into public.user_profiles (id, role, name, email, phone, avatar)
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'customer'::public.user_role
    ),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'avatar', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Seed subscription plans (canonical 3) — idempotent, never deletes
insert into subscription_plans (name, description, price, interval, services_included, savings_pct)
select 'Essentials', 'Perfect for daily laundry needs', 999, 'monthly', '["20 kg Wash & Fold per month","10 pieces Wash & Iron per month","Free pickup & delivery (4x/month)","Standard 24-48hr delivery","Loyalty points 2× boost"]'::jsonb, 10
where not exists (select 1 from subscription_plans where name = 'Essentials');
insert into subscription_plans (name, description, price, interval, services_included, savings_pct)
select 'Premium', 'Best value for families', 1499, 'monthly', '["40 kg Wash & Fold per month","25 pieces Wash & Iron per month","5 pieces Dry Cleaning per month","Unlimited free pickup & delivery","Express 12hr delivery (2x/month)","Loyalty points 3× boost","Priority customer support"]'::jsonb, 20
where not exists (select 1 from subscription_plans where name = 'Premium');
insert into subscription_plans (name, description, price, interval, services_included, savings_pct)
select 'Ultimate', 'Complete laundry freedom', 2499, 'monthly', '["Unlimited Wash & Fold","Unlimited Wash & Iron","15 pieces Dry Cleaning per month","5 pieces Premium Garment Care","Unlimited express delivery","Loyalty points 5× boost + Platinum tier","Dedicated laundry concierge","Free garment damage protection"]'::jsonb, 25
where not exists (select 1 from subscription_plans where name = 'Ultimate');

-- Seed default feature flags
insert into feature_flags (key, label, description, enabled) values
  ('ai_assistant', 'AI Assistant', 'Enable AI laundry assistant', true),
  ('subscriptions', 'Subscription Plans', 'Enable subscription plans', true),
  ('live_tracking', 'Live Order Tracking', 'Real-time order tracking', true),
  ('wallet', 'Wallet System', 'Enable wallet and payments', true),
  ('referrals', 'Referral Program', 'Customer referral program', false)
on conflict (key) do nothing;
