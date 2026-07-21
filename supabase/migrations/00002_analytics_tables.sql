-- ============================================================================
-- Migration 00002: Analytics & display tables from mock-data
-- ============================================================================

-- Service demand breakdown (for pie charts)
create table if not exists service_demand (
  id uuid primary key default gen_random_uuid(),
  service_key text not null,
  label text not null,
  percentage integer not null,
  color text
);

-- Weekly order trend (for admin charts)
create table if not exists weekly_trend (
  id uuid primary key default gen_random_uuid(),
  day text not null,
  orders integer default 0,
  revenue numeric(10,1) default 0
);

-- Vendor weekly revenue breakdown
create table if not exists vendor_weekly_revenue (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  day text not null,
  revenue numeric(10,1) default 0
);

-- Vendor service-level revenue breakdown
create table if not exists vendor_service_revenue (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  service text not null,
  revenue numeric(10,1) default 0,
  percentage integer default 0
);

-- Pickup time slots
create table if not exists pickup_slots (
  id uuid primary key default gen_random_uuid(),
  slot text not null,
  available boolean not null default true,
  premium boolean not null default false
);

-- Delivery time slots
create table if not exists delivery_slots (
  id uuid primary key default gen_random_uuid(),
  slot text not null,
  available boolean not null default true
);
