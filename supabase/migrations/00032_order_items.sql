-- ============================================================================
-- Order Items — normalized item tracking with triple-count verification
-- Replaces the JSONB `items` column on `orders`
-- ============================================================================

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid not null references services(id),
  item_id uuid not null references item_master(id),
  booking_type text not null default 'count_items' check (booking_type in ('count_items', 'laundry_bag', 'mixed')),

  -- Triple-count verification
  customer_qty integer not null default 0,
  pickup_qty integer,
  vendor_qty integer,

  -- Pricing snapshot at booking time
  unit_price integer not null default 0,

  -- Per-item special instructions (e.g. ["heavy_stains", "delicate"])
  special_instructions jsonb not null default '[]',

  -- Status in verification flow
  status text not null default 'pending' check (status in ('pending', 'matched', 'mismatch', 'approved', 'rejected')),
  remarks text,
  photo_urls jsonb default '[]',    -- verification photos

  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_service on order_items(service_id);
create index if not exists idx_order_items_item on order_items(item_id);

-- RLS
alter table order_items enable row level security;

do $$ declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Customers see their own order items
create policy "Order items customer read"
  on order_items for select
  using (
    order_id in (select id from orders where customer_id = auth.uid())
    or get_user_role() in ('admin','superadmin')
  );

-- Vendors see items for their assigned orders
create policy "Order items vendor read"
  on order_items for select
  using (
    order_id in (select id from orders where vendor_id in (select id from vendors where owner_id = auth.uid()))
    or get_user_role() in ('admin','superadmin')
  );

-- Delivery execs see items for their tasks
create policy "Order items delivery read"
  on order_items for select
  using (
    order_id in (select id from orders where delivery_executive_id = auth.uid())
    or get_user_role() in ('admin','superadmin')
  );

-- Write: customer writes on create, vendor/exec can update verification qty
create policy "Order items insert"
  on order_items for insert
  with check (
    order_id in (select id from orders where customer_id = auth.uid())
    or get_user_role() in ('admin','superadmin')
  );

create policy "Order items update"
  on order_items for update
  using (
    order_id in (select id from orders where customer_id = auth.uid())
    or order_id in (select id from orders where vendor_id in (select id from vendors where owner_id = auth.uid()))
    or order_id in (select id from orders where delivery_executive_id = auth.uid())
    or get_user_role() in ('admin','superadmin')
  );
