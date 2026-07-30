-- Migration 00024: Location Management System
-- Country → State → City → Service Areas → Vendor Coverage

-- ============================================================================
-- 1. Cities
-- ============================================================================
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null default 'Karnataka',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table cities enable row level security;

create policy "Cities are viewable by everyone"
  on cities for select using (true);

create policy "Cities are manageable by superadmin"
  on cities for all using (
    auth.uid() in (select id from user_profiles where role in ('superadmin','admin'))
  );

-- ============================================================================
-- 2. Service Areas (localities within a city)
-- ============================================================================
create table if not exists service_areas (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  zone text,                              -- Optional: e.g. "East Bengaluru", "Whitefield"
  area_name text not null,                -- e.g. "Horamavu", "Indiranagar"
  pincode text,
  lat numeric(10,7),
  lng numeric(10,7),
  is_active boolean not null default true,
  has_pickup boolean not null default true,
  has_delivery boolean not null default true,
  express_available boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_service_areas_city on service_areas(city_id);
create index idx_service_areas_active on service_areas(is_active);
create index idx_service_areas_pincode on service_areas(pincode);

alter table service_areas enable row level security;

create policy "Service areas are viewable by everyone"
  on service_areas for select using (true);

create policy "Service areas are manageable by superadmin"
  on service_areas for all using (
    auth.uid() in (select id from user_profiles where role in ('superadmin','admin'))
  );

-- ============================================================================
-- 3. Vendor Service Areas (M2M: which areas each vendor serves)
-- ============================================================================
create table if not exists vendor_service_areas (
  vendor_id uuid not null references vendors(id) on delete cascade,
  area_id uuid not null references service_areas(id) on delete cascade,
  primary key (vendor_id, area_id),
  created_at timestamptz not null default now()
);

alter table vendor_service_areas enable row level security;

create policy "Vendor service areas are viewable by everyone"
  on vendor_service_areas for select using (true);

create policy "Vendors can manage their own service areas"
  on vendor_service_areas for all using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "Superadmin can manage all vendor service areas"
  on vendor_service_areas for all using (
    auth.uid() in (select id from user_profiles where role in ('superadmin','admin'))
  );

-- ============================================================================
-- 4. Area Waitlist (for unsupported areas — "Notify Me")
-- ============================================================================
create table if not exists area_waitlist (
  id uuid primary key default gen_random_uuid(),
  area_name text not null,
  pincode text,
  contact text not null,                  -- email or phone
  contact_type text not null default 'email' check (contact_type in ('email','phone')),
  city_id uuid references cities(id),
  created_at timestamptz not null default now()
);

alter table area_waitlist enable row level security;

create policy "Anyone can add to waitlist"
  on area_waitlist for insert with check (true);

create policy "Superadmin can view waitlist"
  on area_waitlist for select using (
    auth.uid() in (select id from user_profiles where role in ('superadmin','admin'))
  );

-- ============================================================================
-- 5. Seed Data — Bangalore with Phase 1–3 areas
-- ============================================================================
do $$
declare
  bengaluru_id uuid;
begin
  -- Create city
  insert into cities (name, state, is_active)
  values ('Bengaluru', 'Karnataka', true)
  on conflict do nothing
  returning id into bengaluru_id;

  -- If city already exists, fetch its id
  if bengaluru_id is null then
    select id into bengaluru_id from cities where name = 'Bengaluru' and state = 'Karnataka' limit 1;
  end if;

  -- Insert areas (only if they don't already exist)
  insert into service_areas (city_id, zone, area_name, pincode, lat, lng, express_available) values
    -- Phase 1 — East Bengaluru
    (bengaluru_id, 'East Bengaluru', 'Horamavu',         '560043', 13.0208, 77.6583, true),
    (bengaluru_id, 'East Bengaluru', 'Hennur',           '560043', 13.0300, 77.6500, true),
    (bengaluru_id, 'East Bengaluru', 'Kalyan Nagar',     '560043', 13.0200, 77.6400, true),
    (bengaluru_id, 'East Bengaluru', 'Ramamurthy Nagar', '560016', 13.0100, 77.6700, false),
    (bengaluru_id, 'East Bengaluru', 'Banaswadi',        '560043', 13.0100, 77.6500, true),
    (bengaluru_id, 'East Bengaluru', 'KR Puram',         '560036', 12.9980, 77.7000, false),
    (bengaluru_id, 'East Bengaluru', 'Battarahalli',     '560049', 13.0000, 77.6800, false),
    (bengaluru_id, 'East Bengaluru', 'Kasturi Nagar',    '560043', 13.0150, 77.6600, false),
    -- Phase 2 — Whitefield
    (bengaluru_id, 'Whitefield', 'Whitefield',           '560066', 12.9698, 77.7500, true),
    (bengaluru_id, 'Whitefield', 'Kadugodi',             '560067', 12.9950, 77.7650, false),
    (bengaluru_id, 'Whitefield', 'Hoodi',                '560048', 12.9680, 77.7150, false),
    (bengaluru_id, 'Whitefield', 'Varthur',              '560087', 12.9460, 77.7400, false),
    (bengaluru_id, 'Whitefield', 'Brookefield',          '560037', 12.9690, 77.7100, true),
    (bengaluru_id, 'Whitefield', 'Mahadevapura',         '560048', 12.9680, 77.7000, false),
    -- Phase 3 — Indiranagar
    (bengaluru_id, 'Central Bengaluru', 'Indiranagar',   '560038', 12.9719, 77.6413, true),
    (bengaluru_id, 'Central Bengaluru', 'Domlur',        '560071', 12.9600, 77.6400, false),
    (bengaluru_id, 'Central Bengaluru', 'CV Raman Nagar','560093', 12.9800, 77.6600, false),
    (bengaluru_id, 'Central Bengaluru', 'Old Airport Road', '560017', 12.9600, 77.6500, false),
    (bengaluru_id, 'Central Bengaluru', 'Ulsoor',        '560008', 12.9800, 77.6200, false),
    -- Existing areas from old KNOWN_AREAS (keep for backward compat)
    (bengaluru_id, 'South Bengaluru', 'Koramangala',     '560034', 12.9352, 77.6245, true),
    (bengaluru_id, 'South Bengaluru', 'HSR Layout',      '560102', 12.9116, 77.6389, true),
    (bengaluru_id, 'South Bengaluru', 'Jayanagar',       '560011', 12.9250, 77.5938, true),
    (bengaluru_id, 'South Bengaluru', 'BTM Layout',      '560076', 12.9166, 77.6101, true),
    (bengaluru_id, 'South Bengaluru', 'JP Nagar',        '560078', 12.9063, 77.5857, false),
    (bengaluru_id, 'South Bengaluru', 'Electronic City', '560100', 12.8399, 77.6770, false),
    (bengaluru_id, 'West Bengaluru', 'Vijay Nagar',     '560040', 12.9700, 77.5300, false),
    (bengaluru_id, 'West Bengaluru', 'Kengeri',          '560060', 12.9100, 77.4800, false),
    (bengaluru_id, 'West Bengaluru', 'Yeshwanthpur',     '560022', 13.0200, 77.5450, false),
    (bengaluru_id, 'West Bengaluru', 'Malleshwaram',     '560003', 13.0031, 77.5710, false),
    (bengaluru_id, 'West Bengaluru', 'Rajajinagar',      '560010', 12.9900, 77.5527, false),
    (bengaluru_id, 'West Bengaluru', 'Basavanagudi',     '560004', 12.9400, 77.5700, false),
    (bengaluru_id, 'North Bengaluru', 'Hebbal',          '560024', 13.0358, 77.5970, false),
    (bengaluru_id, 'North Bengaluru', 'RT Nagar',        '560032', 13.0200, 77.5950, false),
    (bengaluru_id, 'Central Bengaluru', 'MG Road',      '560001', 12.9750, 77.6067, true),
    (bengaluru_id, 'East Bengaluru', 'Marathahalli',     '560037', 12.9591, 77.6974, true)
  on conflict do nothing;

  -- Insert waitlist entries for areas we know users have asked about
  -- (empty for now — will be populated by user signups)
end $$;
