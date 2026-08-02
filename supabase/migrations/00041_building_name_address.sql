alter table addresses
  add column if not exists building_name text,
  add column if not exists state text;