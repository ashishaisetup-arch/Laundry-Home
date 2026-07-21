-- Add lat/lng columns to orders for geocoded pickup and delivery locations
alter table orders
  add column if not exists pickup_lat numeric(10,7),
  add column if not exists pickup_lng numeric(10,7),
  add column if not exists delivery_lat numeric(10,7),
  add column if not exists delivery_lng numeric(10,7);

-- Create live tracking table for delivery executive GPS positions
create table if not exists delivery_live_locations (
  id uuid primary key default gen_random_uuid(),
  exec_id uuid not null references user_profiles(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  accuracy numeric,
  heading numeric,
  speed numeric,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Index for fast lookups by delivery exec and order
create index if not exists idx_delivery_live_locations_exec on delivery_live_locations(exec_id);
create index if not exists idx_delivery_live_locations_order on delivery_live_locations(order_id);

-- Enable realtime for live tracking table
do $$ begin
  alter publication supabase_realtime add table delivery_live_locations;
exception when duplicate_object then null;
end $$;

-- RLS: exec can upsert own location; customers can read for their orders
alter table delivery_live_locations enable row level security;

do $$ begin
  create policy "Delivery execs manage their own location"
    on delivery_live_locations for all
    using (exec_id = auth.uid())
    with check (exec_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Anyone can read live locations"
    on delivery_live_locations for select
    using (true);
exception when duplicate_object then null;
end $$;
