-- ============================================================================
-- Migration 00022: Service Catalog Overhaul
-- Replaces flat services table with hierarchical category → service → items
-- + vendor-specific pricing overrides.
-- ============================================================================

-- ============================================================================
-- 1. Drop old services table and obsolete enums
-- ============================================================================
drop table if exists services cascade;
drop type if exists service_pricing_type;
drop type if exists service_category;

-- ============================================================================
-- 2. New tables
-- ============================================================================

-- 2a. Service Categories
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  icon text,
  display_order integer not null default 0,
  is_active boolean not null default true
);

-- 2b. Core Services
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references service_categories(id) on delete cascade,
  name text not null,
  description text,
  unit text not null check (unit in ('kg', 'item', 'flat')),
  image_url text,
  taxable boolean not null default true,
  display_order integer not null default 0,
  is_active boolean not null default true
);

-- 2c. Service Items (items/garments with default pricing per service)
create table if not exists service_items (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  item_name text not null,
  item_category text,
  unit text not null default 'item' check (unit in ('item', 'kg')),
  default_price integer not null,
  estimated_time text,
  is_active boolean not null default true,
  unique(service_id, item_name)
);

-- 2d. Vendor Service Price Overrides
create table if not exists vendor_service_prices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  item_id uuid not null references service_items(id) on delete cascade,
  price integer not null,
  is_active boolean not null default true,
  unique(vendor_id, service_id, item_id)
);

-- 2e. Add service_ids to vendors (alongside legacy services_offered)
do $$ begin
  alter table vendors add column service_ids uuid[] default '{}';
exception when duplicate_column then null;
end $$;

-- ============================================================================
-- 3. Indexes
-- ============================================================================
create index if not exists idx_services_category on services(category_id);
create index if not exists idx_service_items_service on service_items(service_id);
create index if not exists idx_service_items_category on service_items(item_category);
create index if not exists idx_vendor_service_prices_vendor on vendor_service_prices(vendor_id);
create index if not exists idx_vendor_service_prices_service on vendor_service_prices(service_id);
create index if not exists idx_vendor_service_prices_item on vendor_service_prices(item_id);

-- ============================================================================
-- 4. RLS Policies
-- ============================================================================
alter table service_categories enable row level security;
alter table services enable row level security;
alter table service_items enable row level security;
alter table vendor_service_prices enable row level security;

do $$ declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('service_categories','services','service_items','vendor_service_prices')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Service catalog: publicly readable
create policy "Service categories public read"
  on service_categories for select using (true);
create policy "Services public read"
  on services for select using (true);
create policy "Service items public read"
  on service_items for select using (true);

-- Service catalog: admin/superadmin write
create policy "Service categories admin write"
  on service_categories for all using (get_user_role() in ('admin','superadmin'));
create policy "Services admin write"
  on services for all using (get_user_role() in ('admin','superadmin'));
create policy "Service items admin write"
  on service_items for all using (get_user_role() in ('admin','superadmin'));

-- Vendor service prices: vendor reads own, admin reads all
create policy "Vendor service prices read own"
  on vendor_service_prices for select
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
    or get_user_role() in ('admin','superadmin')
  );

create policy "Vendor service prices write own"
  on vendor_service_prices for all
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
    or get_user_role() in ('admin','superadmin')
  );

-- ============================================================================
-- 5. Seed data
-- ============================================================================

-- 5a. Service Categories
with inserted_categories as (
  insert into service_categories (name, slug, description, icon, display_order) values
    ('Wash', 'wash', 'Everyday laundry washing services', 'droplets', 1),
    ('Dry Cleaning', 'dry-cleaning', 'Professional dry cleaning for delicate fabrics', 'sparkles', 2),
    ('Iron', 'iron', 'Professional ironing and pressing services', 'iron', 3),
    ('Fold', 'fold', 'Professional folding services', 'package', 4),
    ('Home Care', 'home-care', 'Home linen and furnishing cleaning', 'home', 5),
    ('Special Cleaning', 'special-cleaning', 'Specialized cleaning treatments', 'wand', 6),
    ('Premium Services', 'premium-services', 'Premium add-on services', 'crown', 7)
  returning id, slug
)
-- 5b. Services
, inserted_services as (
  insert into services (category_id, name, description, unit, display_order)
  select
    c.id,
    s.name,
    s.description,
    s.unit,
    s.display_order
  from (values
    -- Wash
    ('wash', 'Wash & Fold',       'Machine wash with gentle folding', 'kg', 1),
    ('wash', 'Wash & Iron',       'Machine wash with professional ironing', 'kg', 2),
    ('wash', 'Premium Wash',      'Premium wash with fabric care', 'kg', 3),
    ('wash', 'Express Wash',      'Quick turnaround wash service', 'kg', 4),
    ('wash', 'Eco Wash',          'Eco-friendly washing with biodegradable detergents', 'kg', 5),
    -- Dry Cleaning
    ('dry-cleaning', 'Dry Clean', 'Professional dry cleaning for delicate and formal wear', 'item', 1),
    -- Iron
    ('iron', 'Steam Iron',        'Steam ironing for wrinkle-free clothes', 'item', 1),
    ('iron', 'Premium Iron',      'Premium pressing with starch finish', 'item', 2),
    -- Fold
    ('fold', 'Fold Only',         'Professional folding service for clean laundry', 'kg', 1),
    -- Special Cleaning
    ('special-cleaning', 'Stain Removal',      'Targeted stain treatment and removal', 'item', 1),
    ('special-cleaning', 'Whitening',           'Brightening treatment for whites', 'item', 2),
    ('special-cleaning', 'Fabric Softener',     'Extra softening treatment', 'item', 3),
    ('special-cleaning', 'Perfume Finish',      'Long-lasting fabric perfume', 'item', 4),
    ('special-cleaning', 'Sanitization',        'High-temperature sanitization', 'item', 5),
    ('special-cleaning', 'Anti-Bacterial Wash', 'Anti-bacterial treatment', 'item', 6),
    ('special-cleaning', 'Steam Sanitization',  'Steam-based deep sanitization', 'item', 7),
    ('special-cleaning', 'Pet Hair Removal',    'Remove pet hair from fabrics', 'item', 8),
    -- Premium Services
    ('premium-services', 'Same Day Delivery',   'Guaranteed same-day delivery', 'flat', 1),
    ('premium-services', '24 Hour Delivery',    'Delivery within 24 hours', 'flat', 2),
    ('premium-services', 'Express Pickup',      'Priority pickup within 30 minutes', 'flat', 3),
    ('premium-services', 'Doorstep Ironing',    'Ironing at your doorstep', 'flat', 4),
    ('premium-services', 'Premium Packaging',   'Premium packaging with tissue and ribbon', 'flat', 5),
    ('premium-services', 'Gift Packaging',      'Gift-ready wrapping', 'flat', 6)
  ) as s(cat_slug, name, description, unit, display_order)
  join inserted_categories c on c.slug = s.cat_slug
  returning id, name, unit, (select slug from inserted_categories ic where ic.id = category_id) as cat_slug
)
-- 5c. Service Items — Clothing
, clothing_items as (
  insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time)
  select
    s.id,
    c.item_name,
    c.item_category,
    'item',
    c.default_price,
    c.estimated_time
  from (values
    -- Wash & Fold items
    ('Wash & Fold', 'Shirt',     'Men',   15, '24 hrs'),
    ('Wash & Fold', 'T-Shirt',   'Men',   12, '24 hrs'),
    ('Wash & Fold', 'Jeans',     'Men',   20, '24 hrs'),
    ('Wash & Fold', 'Trousers',  'Men',   18, '24 hrs'),
    ('Wash & Fold', 'Saree',     'Women', 25, '24 hrs'),
    ('Wash & Fold', 'Kurti',     'Women', 18, '24 hrs'),
    ('Wash & Fold', 'Lehenga',   'Women', 40, '48 hrs'),
    ('Wash & Fold', 'Dress',     'Women', 22, '24 hrs'),
    ('Wash & Fold', 'Top',       'Women', 14, '24 hrs'),
    ('Wash & Fold', 'Leggings',  'Women', 12, '24 hrs'),
    ('Wash & Fold', 'Dupatta',   'Women', 18, '24 hrs'),
    ('Wash & Fold', 'School Uniform', 'Kids', 15, '24 hrs'),
    ('Wash & Fold', 'Baby Clothes',   'Kids', 12, '24 hrs'),
    -- Wash & Iron items
    ('Wash & Iron', 'Shirt',     'Men',   20, '24 hrs'),
    ('Wash & Iron', 'T-Shirt',   'Men',   15, '24 hrs'),
    ('Wash & Iron', 'Jeans',     'Men',   25, '24 hrs'),
    ('Wash & Iron', 'Trousers',  'Men',   22, '24 hrs'),
    ('Wash & Iron', 'Suit',      'Men',   50, '48 hrs'),
    ('Wash & Iron', 'Blazer',    'Men',   45, '48 hrs'),
    ('Wash & Iron', 'Sherwani',  'Men',   80, '48 hrs'),
    ('Wash & Iron', 'Saree',     'Women', 35, '24 hrs'),
    ('Wash & Iron', 'Kurti',     'Women', 22, '24 hrs'),
    ('Wash & Iron', 'Lehenga',   'Women', 55, '48 hrs'),
    ('Wash & Iron', 'Dress',     'Women', 28, '24 hrs'),
    ('Wash & Iron', 'Top',       'Women', 18, '24 hrs'),
    ('Wash & Iron', 'Leggings',  'Women', 15, '24 hrs'),
    ('Wash & Iron', 'Dupatta',   'Women', 22, '24 hrs'),
    ('Wash & Iron', 'School Uniform', 'Kids', 18, '24 hrs'),
    ('Wash & Iron', 'Baby Clothes',   'Kids', 15, '24 hrs'),
    -- Premium Wash items
    ('Premium Wash', 'Shirt',    'Men',   25, '24 hrs'),
    ('Premium Wash', 'T-Shirt',  'Men',   20, '24 hrs'),
    ('Premium Wash', 'Jeans',    'Men',   30, '24 hrs'),
    ('Premium Wash', 'Trousers', 'Men',   28, '24 hrs'),
    ('Premium Wash', 'Saree',    'Women', 40, '24 hrs'),
    ('Premium Wash', 'Lehenga',  'Women', 60, '48 hrs'),
    ('Premium Wash', 'Dress',    'Women', 35, '24 hrs'),
    ('Premium Wash', 'School Uniform', 'Kids', 22, '24 hrs'),
    -- Express Wash items
    ('Express Wash', 'Shirt',    'Men',   30, '6 hrs'),
    ('Express Wash', 'T-Shirt',  'Men',   25, '6 hrs'),
    ('Express Wash', 'Jeans',    'Men',   35, '6 hrs'),
    ('Express Wash', 'Trousers', 'Men',   32, '6 hrs'),
    ('Express Wash', 'Saree',    'Women', 45, '6 hrs'),
    ('Express Wash', 'Kurti',    'Women', 30, '6 hrs'),
    ('Express Wash', 'Dress',    'Women', 38, '6 hrs'),
    ('Express Wash', 'School Uniform', 'Kids', 28, '6 hrs'),
    -- Eco Wash items
    ('Eco Wash', 'Shirt',       'Men',   18, '24 hrs'),
    ('Eco Wash', 'T-Shirt',     'Men',   15, '24 hrs'),
    ('Eco Wash', 'Jeans',       'Men',   22, '24 hrs'),
    ('Eco Wash', 'Trousers',    'Men',   20, '24 hrs'),
    ('Eco Wash', 'Saree',       'Women', 30, '24 hrs'),
    ('Eco Wash', 'Kurti',       'Women', 20, '24 hrs'),
    ('Eco Wash', 'Dress',       'Women', 25, '24 hrs'),
    -- Dry Clean items
    ('Dry Clean', 'Shirt',      'Men',   80, '48 hrs'),
    ('Dry Clean', 'T-Shirt',    'Men',   60, '48 hrs'),
    ('Dry Clean', 'Jeans',      'Men',   100, '48 hrs'),
    ('Dry Clean', 'Trousers',   'Men',   90, '48 hrs'),
    ('Dry Clean', 'Suit',       'Men',   200, '72 hrs'),
    ('Dry Clean', 'Blazer',     'Men',   250, '72 hrs'),
    ('Dry Clean', 'Sherwani',   'Men',   350, '72 hrs'),
    ('Dry Clean', 'Saree',      'Women', 180, '48 hrs'),
    ('Dry Clean', 'Kurti',      'Women', 100, '48 hrs'),
    ('Dry Clean', 'Lehenga',    'Women', 300, '72 hrs'),
    ('Dry Clean', 'Dress',      'Women', 150, '48 hrs'),
    ('Dry Clean', 'Top',        'Women', 70,  '48 hrs'),
    ('Dry Clean', 'Dupatta',    'Women', 100, '48 hrs'),
    -- Steam Iron items
    ('Steam Iron', 'Shirt',     'Men',   10, '12 hrs'),
    ('Steam Iron', 'T-Shirt',   'Men',   8,  '12 hrs'),
    ('Steam Iron', 'Jeans',     'Men',   12, '12 hrs'),
    ('Steam Iron', 'Trousers',  'Men',   10, '12 hrs'),
    ('Steam Iron', 'Suit',      'Men',   30, '24 hrs'),
    ('Steam Iron', 'Blazer',    'Men',   25, '24 hrs'),
    ('Steam Iron', 'Sherwani',  'Men',   50, '24 hrs'),
    ('Steam Iron', 'Saree',     'Women', 25, '12 hrs'),
    ('Steam Iron', 'Kurti',     'Women', 12, '12 hrs'),
    ('Steam Iron', 'Lehenga',   'Women', 40, '24 hrs'),
    ('Steam Iron', 'Dress',     'Women', 18, '12 hrs'),
    ('Steam Iron', 'Top',       'Women', 10, '12 hrs'),
    ('Steam Iron', 'Dupatta',   'Women', 15, '12 hrs'),
    ('Steam Iron', 'School Uniform', 'Kids', 10, '12 hrs'),
    -- Premium Iron items
    ('Premium Iron', 'Shirt',   'Men',   18, '12 hrs'),
    ('Premium Iron', 'T-Shirt', 'Men',   14, '12 hrs'),
    ('Premium Iron', 'Jeans',   'Men',   20, '12 hrs'),
    ('Premium Iron', 'Trousers','Men',   18, '12 hrs'),
    ('Premium Iron', 'Suit',    'Men',   40, '24 hrs'),
    ('Premium Iron', 'Blazer',  'Men',   35, '24 hrs'),
    ('Premium Iron', 'Sherwani','Men',   60, '24 hrs'),
    ('Premium Iron', 'Saree',   'Women', 35, '12 hrs'),
    ('Premium Iron', 'Lehenga', 'Women', 50, '24 hrs'),
    ('Premium Iron', 'Dress',   'Women', 28, '12 hrs'),
    -- Home Care items (under Wash & Fold)
    ('Wash & Fold', 'Bedsheet',      'Home Care', 40,  '48 hrs'),
    ('Wash & Fold', 'Pillow Cover',  'Home Care', 15,  '48 hrs'),
    ('Wash & Fold', 'Blanket',       'Home Care', 120, '72 hrs'),
    ('Wash & Fold', 'Quilt',         'Home Care', 200, '72 hrs'),
    ('Wash & Fold', 'Comforter',     'Home Care', 180, '72 hrs'),
    ('Wash & Fold', 'Duvet',         'Home Care', 150, '72 hrs'),
    ('Wash & Fold', 'Curtain',       'Home Care', 80,  '48 hrs'),
    ('Wash & Fold', 'Sofa Cover',    'Home Care', 100, '48 hrs'),
    ('Wash & Fold', 'Cushion Cover', 'Home Care', 25,  '48 hrs'),
    ('Wash & Fold', 'Table Cloth',   'Home Care', 50,  '48 hrs'),
    ('Wash & Fold', 'Mattress Cover','Home Care', 90,  '48 hrs'),
    -- Dry Clean home care items
    ('Dry Clean', 'Bedsheet',        'Home Care', 100, '72 hrs'),
    ('Dry Clean', 'Curtain',         'Home Care', 180, '72 hrs'),
    ('Dry Clean', 'Sofa Cover',      'Home Care', 250, '72 hrs')
  ) as c(service_name, item_name, item_category, default_price, estimated_time)
  join inserted_services s on s.name = c.service_name
  where s.unit = 'item'
  returning id, service_id, item_name, default_price
)
-- 5d. Per-kg items for kg-based services
, kg_items as (
  insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time)
  select
    s.id,
    'Per Kg',
    'General',
    'kg',
    case s.name
      when 'Wash & Fold' then 60
      when 'Wash & Iron' then 80
      when 'Premium Wash' then 120
      when 'Express Wash' then 140
      when 'Eco Wash' then 75
      when 'Fold Only' then 30
      else 60
    end,
    case s.name
      when 'Express Wash' then '6 hrs'
      else '24 hrs'
    end
  from inserted_services s
  where s.unit = 'kg'
  returning id, service_id
)
-- 5e. Flat-rate items for flat-based services
, flat_items as (
  insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time)
  select
    s.id,
    s.name,
    'Premium',
    'item',
    case s.name
      when 'Same Day Delivery' then 99
      when '24 Hour Delivery' then 49
      when 'Express Pickup' then 79
      when 'Doorstep Ironing' then 149
      when 'Premium Packaging' then 39
      when 'Gift Packaging' then 59
      else 99
    end,
    case s.name
      when 'Same Day Delivery' then 'Same day'
      when '24 Hour Delivery' then '24 hrs'
      else 'As requested'
    end
  from inserted_services s
  where s.unit = 'flat'
)
select 'Service catalog seeded successfully' as result;

-- ============================================================================
-- 6. Data cleanup: reset vendor services_offered (old text keys are invalid)
--    and populate service_ids from the seeded services
-- ============================================================================
update vendors
set
  services_offered = '{}',
  service_ids = array(
    select id from services where is_active = true order by display_order
  )
where true;

