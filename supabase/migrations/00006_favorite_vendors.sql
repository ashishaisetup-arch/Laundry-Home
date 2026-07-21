-- 6.0 Favorite Vendors (customer saves vendors as favourites)
create table if not exists favorite_vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, vendor_id)
);

-- Index for fast lookups
create index if not exists idx_favorite_vendors_user on favorite_vendors(user_id);
create index if not exists idx_favorite_vendors_vendor on favorite_vendors(vendor_id);
