-- ============================================================================
-- Migration 00045: Pricing Strategy
-- Per-service pricing strategy (ITEM / BAG / WEIGHT / FIXED) with bag_price
-- as the authoritative price for BAG-type services.
-- Seeds the Laundry Bag + Premium Laundry Bag services (BAG pricing type).
-- ============================================================================

-- 1. Pricing type on services
alter table services
  add column if not exists pricing_type text not null default 'ITEM'
  check (pricing_type in ('ITEM', 'BAG', 'WEIGHT', 'FIXED'));

-- 2. Bag price (authoritative for BAG-type services)
alter table services
  add column if not exists bag_price integer;

-- 3. Backfill: flat-rate services use the FIXED strategy
update services
set pricing_type = 'FIXED'
where unit = 'flat' and pricing_type = 'ITEM';

-- 4. Laundry Bags category (main grouping, so it appears in the booking flow)
insert into service_categories (name, slug, description, icon, display_order, grouping)
values ('Laundry Bags', 'laundry-bags', 'Fill a bag and we charge per bag', 'shopping-bag', 8, 'main')
on conflict (slug) do nothing;

-- 5. Item master rows for bags (needed as order_items.item_id FK target)
insert into item_master (category, item_name, emoji, estimated_weight_kg)
values
  ('Bags', 'Laundry Bag',          '🛍️', 1.00),
  ('Bags', 'Premium Laundry Bag',  '🛍️', 1.50)
on conflict (item_name, category) do nothing;

-- 6. Bag services (BAG pricing type)
insert into services (category_id, name, description, unit, taxable, display_order, is_active, pricing_type, bag_price)
select c.id, s.name, s.description, 'item', true, s.display_order, true, 'BAG', s.bag_price
from (select id from service_categories where slug = 'laundry-bags') c
cross join (values
  ('Laundry Bag',         'Fill a bag and we charge per bag', 1, 99),
  ('Premium Laundry Bag', 'Premium bag with priority handling', 2, 149)
) as s(name, description, display_order, bag_price)
where not exists (select 1 from services where name = s.name);

-- 7. Service items for bag services (links bag services to item_master)
--    so every order line carries a valid itemId; bag_price on the service
--    remains the source of truth for BAG pricing.
insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time, item_master_id)
select s.id, im.item_name, im.category, 'item', s.bag_price, '24 hrs', im.id
from services s
join item_master im on im.item_name = s.name and im.category = 'Bags'
where s.pricing_type = 'BAG'
  and not exists (
    select 1 from service_items si
    where si.service_id = s.id and si.item_name = im.item_name
  )
on conflict (service_id, item_name, item_category) do nothing;
