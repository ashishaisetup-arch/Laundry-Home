-- Add payment_details JSONB column to orders for storing gateway-specific fields
alter table orders add column if not exists payment_details jsonb default '{}'::jsonb;

-- Index for querying payment gateway references
create index if not exists idx_orders_payment_details on orders using gin (payment_details);
