-- ============================================================================
-- Migration 00025: Locations master table + Place ID support
--
-- Creates a centralized locations table that acts as a Google Places cache
-- and normalized geography reference. All place_id and coordinate storage
-- converges on this table rather than scattering across addresses, vendors,
-- orders, and service_areas.
-- ============================================================================

-- 1. Locations Master Table
--    Written once, read many times. Insert-only: no update/delete policies needed
--    (Google Place IDs are permanent identifiers).
-- ============================================================================
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  place_id text unique not null,
  formatted_address text,
  locality text,                          -- e.g. "Horamavu" (area / sub-locality level 1)
  sub_locality text,                      -- e.g. "Horamavu Main Road" (more granular)
  city text,                              -- e.g. "Bengaluru"
  state text not null default 'Karnataka',
  country text not null default 'India',
  pincode text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  plus_code text,                         -- Google Plus Code (optional)
  created_at timestamptz not null default now()
);

create index if not exists idx_locations_place_id on locations(place_id);
create index if not exists idx_locations_city on locations(city);
create index if not exists idx_locations_coords on locations(latitude, longitude);

alter table locations enable row level security;

do $$ begin
  create policy "Locations are readable by all authenticated users"
    on locations for select using (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Locations are insertable by any user"
    on locations for insert with check (true);
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 2. Schema updates to existing tables
--    All new columns are nullable / have defaults so existing data is unaffected.
-- ============================================================================

-- 2a. addresses — add place_id, location_id, and support columns
alter table addresses
  add column if not exists place_id text,
  add column if not exists location_id uuid references locations(id),
  add column if not exists address_type text not null default 'home',
  add column if not exists landmark text;

create index if not exists idx_addresses_place_id on addresses(place_id);
create index if not exists idx_addresses_location on addresses(location_id);

-- 2b. vendors — add location_id and denormalized coordinates (for fast haversine)
alter table vendors
  add column if not exists location_id uuid references locations(id),
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7);

create index if not exists idx_vendors_location on vendors(location_id);

-- 2c. service_areas — add location_id and place_id
alter table service_areas
  add column if not exists location_id uuid references locations(id),
  add column if not exists place_id text;

create index if not exists idx_service_areas_location on service_areas(location_id);

-- 2d. orders — add pickup and delivery location references
alter table orders
  add column if not exists pickup_location_id uuid references locations(id),
  add column if not exists delivery_location_id uuid references locations(id);

create index if not exists idx_orders_pickup_location on orders(pickup_location_id);
create index if not exists idx_orders_delivery_location on orders(delivery_location_id);

-- ============================================================================
-- 3. Data migration: backfill locations for existing service_areas
--    We generate synthetic place_ids ("osm_" + area id) for OSM-sourced areas.
-- ============================================================================
do $$
declare
  area_record record;
  new_location_id uuid;
begin
  for area_record in
    select * from service_areas
    where lat is not null and lng is not null
      and location_id is null
  loop
    -- Check if a location already exists for this OSM place_id
    select id into new_location_id from locations
    where place_id = 'osm_' || area_record.id;

    if new_location_id is null then
      insert into locations (
        place_id, formatted_address, locality, city, state, pincode,
        latitude, longitude
      ) values (
        'osm_' || area_record.id,
        area_record.area_name || ', Bengaluru, Karnataka',
        area_record.area_name,
        'Bengaluru',
        'Karnataka',
        area_record.pincode,
        area_record.lat,
        area_record.lng
      )
      returning id into new_location_id;
    end if;

    -- Link the service_area to its location
    update service_areas
    set location_id = new_location_id,
        place_id = 'osm_' || area_record.id
    where id = area_record.id;
  end loop;
end $$;
