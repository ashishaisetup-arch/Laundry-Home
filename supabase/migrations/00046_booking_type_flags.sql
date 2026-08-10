-- ============================================================================
-- Migration 00046: Booking-type feature flags
-- Super Admin can enable/disable the booking modes shown to customers:
--   enableCountItems  — Count Individual Items
--   enableLaundryBag  — Laundry Bag
--   enableMixedBooking — Mixed Order
-- Missing keys resolve to enabled (see server customer-config defaults).
-- ============================================================================

update system_config
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{customer}',
  coalesce(config->'customer', '{}'::jsonb)
    || '{"enableCountItems": true, "enableLaundryBag": true, "enableMixedBooking": true}'::jsonb
)
where id = 1;
