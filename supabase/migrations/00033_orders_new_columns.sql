-- ============================================================================
-- Orders — new columns for booking type, verification workflow, and QR
-- ============================================================================

do $$ begin

  -- Booking type
  alter table orders add column if not exists booking_type text
    check (booking_type in ('count_items', 'laundry_bag', 'mixed'));

  -- Laundry bag qty (for bag-based or mixed orders)
  alter table orders add column if not exists laundry_bag_qty integer;

  -- Verification flags
  alter table orders add column if not exists pickup_verified boolean default false;
  alter table orders add column if not exists vendor_verified boolean default false;
  alter table orders add column if not exists customer_approved boolean default false;

  -- Weight tracking (per-order aggregate)
  alter table orders add column if not exists estimated_weight_kg numeric(5,1);
  alter table orders add column if not exists pickup_weight_kg numeric(5,1);
  alter table orders add column if not exists vendor_weight_kg numeric(5,1);

  -- QR / barcode for bag tagging
  alter table orders add column if not exists qr_code text;

  -- Flag to distinguish new v2 orders from legacy JSONB orders
  alter table orders add column if not exists items_v2 boolean default false;

exception when duplicate_column then null;
end $$;
