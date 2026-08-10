-- ============================================================================
-- Migration 00047: Service slugs + order schedule modes
--
-- 1. Adds a `slug` to `services` as the canonical machine identifier for
--    time-based add-ons (never match scheduling logic on display names).
-- 2. Backfills slugs for the three time-based add-ons only.
-- 3. Adds order columns for the fulfillment mode / delivery SLA:
--      pickup_mode    - 'scheduled' | 'express'
--      delivery_speed - 'standard' | '24_hour' | 'same_day'
-- ============================================================================

alter table public.services
  add column if not exists slug text;

-- Display names stay free-form; slugs are stable machine identifiers.
create unique index if not exists services_slug_unique
  on public.services (slug)
  where slug is not null;

-- Business rule: "24-hour delivery" is defined as the next-day equivalent
-- delivery window (delivery on pickup date + 1, delivery slot end <= pickup
-- slot end). Documented here and enforced in server/lib/schedule.ts.
update public.services
set slug = 'same_day_delivery'
where name = 'Same Day Delivery'
  and slug is null;

update public.services
set slug = '24_hour_delivery'
where name = '24 Hour Delivery'
  and slug is null;

update public.services
set slug = 'express_pickup'
where name = 'Express Pickup'
  and slug is null;

alter table public.orders
  add column if not exists pickup_mode text,
  add column if not exists delivery_speed text;
