alter table orders
  add column if not exists delivery_address text,
  add column if not exists delivery_area text;
