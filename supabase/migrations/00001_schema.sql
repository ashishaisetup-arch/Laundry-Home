-- ============================================================================
-- Laundry Home — Supabase Database Schema
-- Migration 00001: Core tables, RLS, auth trigger, and seed data
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
do $$ begin
  create type user_role as enum ('guest','customer','vendor','delivery','admin','superadmin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type service_pricing_type as enum ('per_kg','per_piece','both');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type service_category as enum ('everyday','premium','specialty','bulk');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type order_status as enum ('placed','vendor_assigned','vendor_accepted','pickup_scheduled','pickup_completed','laundry_received','sorting','tagging','washing','drying','ironing','dry_cleaning','quality_inspection','packing','ready_for_dispatch','out_for_delivery','delivered','completed','cancelled');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type payment_status as enum ('paid','pending','refunded');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type task_status as enum ('pending','heading_to_pickup','picked_up','heading_to_vendor','reached_vendor','ready_for_delivery','out_for_delivery','delivered');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type task_type as enum ('pickup','delivery');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type notification_type as enum ('booking','vendor','pickup','delivery','payment','promo','system','ai');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type notification_channel as enum ('push','sms','email','whatsapp');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type coupon_type as enum ('percentage','flat');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type kyc_status as enum ('approved','pending','rejected');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type chat_role as enum ('user','assistant');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type wallet_txn_type as enum ('credit','debit');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type staff_role as enum ('manager','worker','driver','receptionist');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type subscription_interval as enum ('monthly','yearly');
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 User Profiles (extends auth.users)
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  name text,
  phone text,
  avatar text,
  wallet_balance integer default 0,
  loyalty_points integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2 Services Catalog
create table if not exists services (
  key text primary key,
  name text not null,
  description text,
  icon text not null,
  pricing_type service_pricing_type not null default 'per_kg',
  base_price integer not null,
  express_multiplier numeric(3,1) not null default 1.5,
  gradient text,
  category service_category not null default 'everyday',
  active boolean not null default true,
  sort_order integer not null default 0
);

-- 2.3 Vendors
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating numeric(2,1) not null default 4.0,
  review_count integer not null default 0,
  distance_km numeric(4,1) not null default 0,
  area text not null,
  city text not null default 'Bengaluru',
  estimated_delivery_hrs integer not null default 24,
  is_open boolean not null default true,
  tags text[] default '{}',
  services_offered text[] default '{}',
  price_level integer not null default 2 check (price_level between 1 and 3),
  logo_color text not null default 'bg-primary-surface',
  logo_initials text not null,
  capacity_used_pct integer not null default 0 check (capacity_used_pct between 0 and 100),
  repeat_customer_rate integer default 0,
  avg_turnaround_hrs numeric(5,1) default 0,
  monthly_revenue integer default 0,
  verified boolean not null default false,
  kyc_status kyc_status not null default 'pending',
  joined_date date not null default current_date,
  total_orders integer not null default 0,
  response_time_mins integer default 0,
  owner_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.4 Order Stage Definitions (the 18 predefined stages)
create table if not exists order_stage_definitions (
  stage order_status primary key,
  label text not null,
  icon text not null,
  sort_order integer not null
);

-- 2.5 Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  customer_id uuid not null references user_profiles(id),
  customer_name text not null,
  customer_avatar text,
  vendor_id uuid references vendors(id),
  vendor_name text,
  vendor_logo_initials text,
  vendor_logo_color text,
  delivery_executive_id uuid references user_profiles(id),
  delivery_executive_name text,
  status order_status not null default 'placed',
  current_stage_index integer not null default 0,
  items jsonb not null default '[]'::jsonb,
  pickup_address text,
  pickup_area text,
  pickup_date date,
  pickup_slot text,
  delivery_date date,
  delivery_slot text,
  estimated_delivery_at timestamptz,
  amount integer not null default 0,
  taxes integer not null default 0,
  platform_fee integer not null default 0,
  delivery_fee integer not null default 0,
  total integer not null default 0,
  payment_method text,
  payment_status payment_status not null default 'pending',
  express boolean not null default false,
  notes text,
  garment_count integer default 0,
  weight_kg numeric(5,1),
  ai_prediction jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.6 Order Stage Events (tracking per order)
create table if not exists order_stage_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  stage order_status not null,
  label text not null,
  timestamp timestamptz,
  done boolean not null default false
);

-- 2.7 Addresses
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  label text not null,
  line text not null,
  area text not null,
  city text not null,
  pincode text not null,
  is_default boolean not null default false,
  lat numeric(10,7),
  lng numeric(10,7),
  created_at timestamptz not null default now()
);

-- 2.8 Coupons
create table if not exists coupons (
  code text primary key,
  description text,
  discount_pct integer not null default 0,
  max_discount integer not null default 0,
  min_order integer not null default 0,
  expires_at date,
  type coupon_type not null default 'percentage',
  active boolean not null default true,
  usage_limit integer default 0,
  used_count integer default 0
);

-- 2.9 User Coupons (usage tracking)
create table if not exists user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  coupon_code text not null references coupons(code),
  used_at timestamptz not null default now(),
  order_id uuid references orders(id),
  unique(user_id, coupon_code)
);

-- 2.10 Reviews
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references user_profiles(id),
  vendor_id uuid references vendors(id),
  customer_name text not null,
  customer_avatar text,
  vendor_name text,
  date date not null default current_date,
  overall integer not null check (overall between 1 and 5),
  vendor_rating integer check (vendor_rating between 1 and 5),
  pickup_rating integer check (pickup_rating between 1 and 5),
  laundry_rating integer check (laundry_rating between 1 and 5),
  delivery_rating integer check (delivery_rating between 1 and 5),
  comment text,
  images text[] default '{}',
  helpful integer default 0,
  vendor_reply text,
  created_at timestamptz not null default now()
);

-- 2.11 Delivery Tasks
create table if not exists delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  type task_type not null,
  order_id uuid not null references orders(id) on delete cascade,
  order_code text not null,
  customer_name text not null,
  customer_phone text,
  vendor_name text,
  vendor_phone text,
  address text,
  area text,
  distance_km numeric(4,1),
  slot text,
  status task_status not null default 'pending',
  estimated_mins integer,
  payment_mode text,
  amount integer default 0,
  items text,
  exec_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.12 Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type notification_type not null default 'system',
  title text not null,
  body text,
  time text,
  read boolean not null default false,
  channel notification_channel not null default 'push',
  created_at timestamptz not null default now()
);

-- 2.13 Chat Messages (AI assistant)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  role chat_role not null default 'user',
  content text not null,
  time text,
  created_at timestamptz not null default now()
);

-- 2.14 Wallet Transactions
create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type wallet_txn_type not null,
  amount integer not null,
  method text,
  description text,
  order_id uuid references orders(id),
  status text not null default 'success',
  created_at timestamptz not null default now()
);

-- 2.15 Vendor Staff
create table if not exists vendor_staff (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  name text not null,
  role staff_role not null default 'worker',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2.16 Garment Inventory
create table if not exists garment_inventory (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null,
  brand text,
  qty integer not null default 1,
  color text,
  condition text,
  notes text,
  photos integer default 0
);

-- 2.17 Subscription Plans
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null,
  interval subscription_interval not null default 'monthly',
  services_included jsonb default '[]'::jsonb,
  savings_pct integer default 0,
  active boolean not null default true
);

-- 2.18 User Subscriptions
create table if not exists user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2.19 Admin KPIs (snapshot data)
create table if not exists admin_kpis (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null,
  change numeric(5,1),
  trend text check (trend in ('up','down','flat')),
  spark integer[] default '{}',
  icon text,
  accent text,
  snapshot_date date not null default current_date
);

-- 2.20 Revenue Chart Data
create table if not exists revenue_chart_data (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  revenue numeric(10,1) not null,
  commission numeric(10,2),
  orders integer,
  year integer not null default extract(year from current_date)
);

-- 2.21 Area Demand Data
create table if not exists area_demand (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  orders integer default 0,
  growth numeric(5,1) default 0,
  snapshot_date date not null default current_date
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_orders_vendor on orders(vendor_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_code on orders(code);
create index if not exists idx_order_events_order on order_stage_events(order_id);
create index if not exists idx_addresses_user on addresses(user_id);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_read on notifications(user_id, read);
create index if not exists idx_reviews_vendor on reviews(vendor_id);
create index if not exists idx_reviews_user on reviews(user_id);
create index if not exists idx_delivery_tasks_exec on delivery_tasks(exec_id);
create index if not exists idx_delivery_tasks_status on delivery_tasks(status);
create index if not exists idx_wallet_txns_user on wallet_transactions(user_id);
create index if not exists idx_chat_messages_user on chat_messages(user_id);
create index if not exists idx_vendor_staff_vendor on vendor_staff(vendor_id);
create index if not exists idx_user_subscriptions_user on user_subscriptions(user_id);

-- ============================================================================
-- 4. AUTH TRIGGER — Auto-create profile on signup
-- ============================================================================
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

do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
end $$;

-- ============================================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================================
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  drop trigger if exists set_user_profiles_updated_at on user_profiles;
  create trigger set_user_profiles_updated_at
    before update on user_profiles
    for each row execute function update_updated_at_column();
end $$;

do $$
begin
  drop trigger if exists set_vendors_updated_at on vendors;
  create trigger set_vendors_updated_at
    before update on vendors
    for each row execute function update_updated_at_column();
end $$;

do $$
begin
  drop trigger if exists set_orders_updated_at on orders;
  create trigger set_orders_updated_at
    before update on orders
    for each row execute function update_updated_at_column();
end $$;

do $$
begin
  drop trigger if exists set_delivery_tasks_updated_at on delivery_tasks;
  create trigger set_delivery_tasks_updated_at
    before update on delivery_tasks
    for each row execute function update_updated_at_column();
end $$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
alter table user_profiles enable row level security;
alter table vendors enable row level security;
alter table orders enable row level security;
alter table order_stage_events enable row level security;
alter table addresses enable row level security;
alter table coupons enable row level security;
alter table user_coupons enable row level security;
alter table reviews enable row level security;
alter table delivery_tasks enable row level security;
alter table notifications enable row level security;
alter table chat_messages enable row level security;
alter table wallet_transactions enable row level security;
alter table vendor_staff enable row level security;
alter table garment_inventory enable row level security;
alter table subscription_plans enable row level security;
alter table user_subscriptions enable row level security;
alter table admin_kpis enable row level security;
alter table revenue_chart_data enable row level security;
alter table area_demand enable row level security;

-- Helper: check user role
create or replace function get_user_role()
returns user_role
language sql
stable
as $$
  select coalesce(
    (select role from user_profiles where id = auth.uid()),
    'guest'::user_role
  );
$$;

-- Drop all existing policies on application tables
do $$ declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'user_profiles','vendors','orders','order_stage_events','addresses',
        'coupons','user_coupons','reviews','delivery_tasks','notifications',
        'chat_messages','wallet_transactions','vendor_staff','garment_inventory',
        'subscription_plans','user_subscriptions','admin_kpis',
        'revenue_chart_data','area_demand'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 6.1 User Profiles: users see own profile; admins see all
create policy "Users view own profile"
  on user_profiles for select
  using (id = auth.uid() or get_user_role() in ('admin','superadmin'));

create policy "Users update own profile"
  on user_profiles for update
  using (id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 6.2 Vendors: public read; admin write
create policy "Vendors are publicly readable"
  on vendors for select
  using (true);

create policy "Vendors admin write"
  on vendors for insert
  with check (get_user_role() in ('admin','superadmin','vendor'));

create policy "Vendors admin update"
  on vendors for update
  using (get_user_role() in ('admin','superadmin','vendor'));

-- 6.3 Orders: customers see own; vendors see assigned; admins see all
create policy "Orders select"
  on orders for select
  using (
    customer_id = auth.uid()
    or vendor_id in (select id from vendors where owner_id = auth.uid())
    or delivery_executive_id = auth.uid()
    or get_user_role() in ('admin','superadmin')
  );

create policy "Orders insert"
  on orders for insert
  with check (
    customer_id = auth.uid()
    or get_user_role() in ('admin','superadmin','vendor')
  );

create policy "Orders update"
  on orders for update
  using (
    customer_id = auth.uid()
    or vendor_id in (select id from vendors where owner_id = auth.uid())
    or delivery_executive_id = auth.uid()
    or get_user_role() in ('admin','superadmin')
  );

-- 6.4 Order Stage Events: same as orders
create policy "Stage events select"
  on order_stage_events for select
  using (
    order_id in (select id from orders where customer_id = auth.uid())
    or order_id in (select id from orders where vendor_id in (select id from vendors where owner_id = auth.uid()))
    or get_user_role() in ('admin','superadmin')
  );

create policy "Stage events write"
  on order_stage_events for insert
  with check (get_user_role() in ('admin','superadmin','vendor','delivery'));

-- 6.5 Addresses: users manage own
create policy "Addresses user access"
  on addresses for all
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 6.6 Coupons: publicly readable; admin write
create policy "Coupons readable"
  on coupons for select
  using (true);

create policy "Coupons admin write"
  on coupons for all
  using (get_user_role() in ('admin','superadmin'));

-- 6.7 Reviews: public read; authenticated write
create policy "Reviews select"
  on reviews for select
  using (true);

create policy "Reviews insert"
  on reviews for insert
  with check (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 6.8 Delivery Tasks: exec sees own; admins see all
create policy "Tasks select"
  on delivery_tasks for select
  using (
    exec_id = auth.uid()
    or get_user_role() in ('admin','superadmin')
  );

create policy "Tasks update"
  on delivery_tasks for update
  using (
    exec_id = auth.uid()
    or get_user_role() in ('admin','superadmin')
  );

-- 6.9 Notifications: users see own
create policy "Notifications user access"
  on notifications for all
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 6.10 Chat Messages: users see own
create policy "Chat user access"
  on chat_messages for all
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 6.11 Wallet: users see own
create policy "Wallet user access"
  on wallet_transactions for all
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

-- 6.12 Other tables: admin access
create policy "Admin full access"
  on vendor_staff for all
  using (get_user_role() in ('admin','superadmin','vendor'));

create policy "Garment inventory vendor access"
  on garment_inventory for all
  using (get_user_role() in ('admin','superadmin','vendor'));

create policy "Subscriptions public read"
  on subscription_plans for select
  using (true);

create policy "Subscription plans admin write"
  on subscription_plans for all
  using (get_user_role() in ('admin','superadmin'));

create policy "User subscriptions own"
  on user_subscriptions for all
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

create policy "Admin KPIs admin only"
  on admin_kpis for select
  using (get_user_role() in ('admin','superadmin'));

create policy "Revenue data admin only"
  on revenue_chart_data for select
  using (get_user_role() in ('admin','superadmin'));

create policy "Area demand admin only"
  on area_demand for select
  using (get_user_role() in ('admin','superadmin'));

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Get orders for a user with their stages
create or replace function get_order_with_stages(p_order_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'order', row_to_json(o.*)::jsonb,
    'stages', coalesce(
      (select jsonb_agg(row_to_json(ose.*) order by ose.stage) from order_stage_events ose where ose.order_id = o.id),
      '[]'::jsonb
    )
  )
  from orders o
  where o.id = p_order_id;
$$;

-- Get dashboard KPIs for admin
create or replace function get_admin_dashboard()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_customers', (select count(*) from user_profiles where role = 'customer'),
    'total_vendors', (select count(*) from vendors),
    'active_orders', (select count(*) from orders where status not in ('delivered','completed','cancelled')),
    'monthly_revenue', (select coalesce(sum(total), 0) from orders where created_at >= date_trunc('month', now()))
  );
$$;

-- Get analytics for a vendor
create or replace function get_vendor_analytics(p_vendor_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_orders', (select count(*) from orders where vendor_id = p_vendor_id),
    'active_orders', (select count(*) from orders where vendor_id = p_vendor_id and status not in ('delivered','completed','cancelled')),
    'monthly_revenue', (select coalesce(sum(total), 0) from orders where vendor_id = p_vendor_id and created_at >= date_trunc('month', now())),
    'avg_rating', (select coalesce(avg(overall), 0) from reviews where vendor_id = p_vendor_id)
  );
$$;
