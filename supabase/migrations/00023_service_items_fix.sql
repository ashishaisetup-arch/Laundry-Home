-- Migration 00023: Add missing service_items for special-cleaning services
-- and fix the base_price/min_price backward-compat fields

-- 1. Insert items for special-cleaning services (Stain Removal, Whitening, etc.)
-- These are per-item surcharge services, so they get garment-specific items.
do $$
declare
  sid uuid;
begin
  -- Stain Removal
  sid := (select id from services where name = 'Stain Removal' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 35, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 30, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 50, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 45, 'As requested'),
      (sid, 'Suit',      'Men',   'item', 80, 'As requested'),
      (sid, 'Blazer',    'Men',   'item', 75, 'As requested'),
      (sid, 'Sherwani',  'Men',   'item', 100, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 60, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 40, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 80, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 50, 'As requested'),
      (sid, 'Top',       'Women', 'item', 35, 'As requested'),
      (sid, 'Leggings',  'Women', 'item', 30, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 40, 'As requested'),
      (sid, 'School Uniform', 'Kids', 'item', 35, 'As requested'),
      (sid, 'Baby Clothes',   'Kids', 'item', 30, 'As requested')
    on conflict do nothing;
  end if;

  -- Whitening
  sid := (select id from services where name = 'Whitening' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 25, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 20, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 35, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 30, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 45, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 28, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 55, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 35, 'As requested'),
      (sid, 'Top',       'Women', 'item', 25, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 30, 'As requested'),
      (sid, 'School Uniform', 'Kids', 'item', 25, 'As requested'),
      (sid, 'Baby Clothes',   'Kids', 'item', 20, 'As requested')
    on conflict do nothing;
  end if;

  -- Fabric Softener
  sid := (select id from services where name = 'Fabric Softener' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 15, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 12, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 20, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 18, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 25, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 18, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 30, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 22, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 20, 'As requested'),
      (sid, 'Baby Clothes', 'Kids', 'item', 12, 'As requested')
    on conflict do nothing;
  end if;

  -- Perfume Finish
  sid := (select id from services where name = 'Perfume Finish' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 30, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 25, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 35, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 30, 'As requested'),
      (sid, 'Suit',      'Men',   'item', 50, 'As requested'),
      (sid, 'Blazer',    'Men',   'item', 45, 'As requested'),
      (sid, 'Sherwani',  'Men',   'item', 60, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 45, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 30, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 50, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 35, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 30, 'As requested')
    on conflict do nothing;
  end if;

  -- Sanitization
  sid := (select id from services where name = 'Sanitization' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 45, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 40, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 55, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 50, 'As requested'),
      (sid, 'Suit',      'Men',   'item', 80, 'As requested'),
      (sid, 'Blazer',    'Men',   'item', 75, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 65, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 45, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 80, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 55, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 45, 'As requested'),
      (sid, 'Baby Clothes', 'Kids', 'item', 35, 'As requested')
    on conflict do nothing;
  end if;

  -- Anti-Bacterial Wash
  sid := (select id from services where name = 'Anti-Bacterial Wash' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 40, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 35, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 50, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 45, 'As requested'),
      (sid, 'Suit',      'Men',   'item', 70, 'As requested'),
      (sid, 'Blazer',    'Men',   'item', 65, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 55, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 40, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 70, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 48, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 40, 'As requested'),
      (sid, 'Baby Clothes', 'Kids', 'item', 30, 'As requested')
    on conflict do nothing;
  end if;

  -- Steam Sanitization
  sid := (select id from services where name = 'Steam Sanitization' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 55, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 50, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 65, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 60, 'As requested'),
      (sid, 'Suit',      'Men',   'item', 100, 'As requested'),
      (sid, 'Blazer',    'Men',   'item', 90, 'As requested'),
      (sid, 'Sherwani',  'Men',   'item', 120, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 75, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 55, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 90, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 65, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 55, 'As requested'),
      (sid, 'Baby Clothes', 'Kids', 'item', 40, 'As requested')
    on conflict do nothing;
  end if;

  -- Pet Hair Removal
  sid := (select id from services where name = 'Pet Hair Removal' limit 1);
  if sid is not null then
    insert into service_items (service_id, item_name, item_category, unit, default_price, estimated_time) values
      (sid, 'Shirt',     'Men',   'item', 45, 'As requested'),
      (sid, 'T-Shirt',   'Men',   'item', 40, 'As requested'),
      (sid, 'Jeans',     'Men',   'item', 55, 'As requested'),
      (sid, 'Trousers',  'Men',   'item', 50, 'As requested'),
      (sid, 'Suit',      'Men',   'item', 80, 'As requested'),
      (sid, 'Blazer',    'Men',   'item', 75, 'As requested'),
      (sid, 'Saree',     'Women', 'item', 60, 'As requested'),
      (sid, 'Kurti',     'Women', 'item', 45, 'As requested'),
      (sid, 'Lehenga',   'Women', 'item', 75, 'As requested'),
      (sid, 'Dress',     'Women', 'item', 50, 'As requested'),
      (sid, 'Dupatta',   'Women', 'item', 45, 'As requested'),
      (sid, 'Blanket',   'Home Care', 'item', 100, 'As requested'),
      (sid, 'Quilt',     'Home Care', 'item', 120, 'As requested'),
      (sid, 'Comforter', 'Home Care', 'item', 110, 'As requested'),
      (sid, 'Sofa Cover','Home Care', 'item', 80, 'As requested')
    on conflict do nothing;
  end if;
end $$;
