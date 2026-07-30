-- ============================================================================
-- Migration 00036: Add item_master_id FK to service_items
-- Links service_items to item_master so the catalog API can return the
-- canonical item_master.id (needed for order_items FK reference).
-- ============================================================================

-- Add the column (nullable initially)
alter table service_items
  add column if not exists item_master_id uuid references item_master(id);

-- Backfill: match by (item_category → category, item_name → item_name)
update service_items si
set item_master_id = im.id
from item_master im
where si.item_category = im.category
  and si.item_name = im.item_name;

-- Backfill: for any rows without a match (e.g. "Per Kg"), create item_master rows
insert into item_master (category, item_name, estimated_weight_kg)
select distinct si.item_category, si.item_name, si.estimated_weight_kg
from service_items si
where si.item_master_id is null
  and si.item_category is not null
on conflict (item_name, category) do nothing;

-- Second backfill pass for newly created item_master rows
update service_items si
set item_master_id = im.id
from item_master im
where si.item_master_id is null
  and si.item_category = im.category
  and si.item_name = im.item_name;

-- Also set estimated_weight_kg on item_master from service_items (reverse sync)
update item_master im
set estimated_weight_kg = si.estimated_weight_kg
from service_items si
where si.item_master_id = im.id
  and im.estimated_weight_kg is null
  and si.estimated_weight_kg is not null;

-- Make it not null once backfilled
alter table service_items
  alter column item_master_id set not null;

-- Update the service-items upsert to also set item_master_id on future writes
-- (handled in code; this just ensures existing data is consistent)
