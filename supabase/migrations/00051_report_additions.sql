-- Report infrastructure additions
-- 1. Add cancelled_by to orders for cancellation attribution
-- 2. Add order_id to support_tickets for vendor linkage

-- 1. cancelled_by on orders
alter table orders
add column if not exists cancelled_by text
check (
  cancelled_by is null or
  cancelled_by in ('customer', 'vendor', 'admin', 'system')
);

-- 2. order_id on support_tickets
alter table support_tickets
add column if not exists order_id uuid references orders(id);

-- 3. Index for efficient vendor report queries via order join
create index if not exists idx_support_tickets_order_id
on support_tickets(order_id) where order_id is not null;
