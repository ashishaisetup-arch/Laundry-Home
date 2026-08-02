-- Super Admin: customer-visible feature toggles (stored in system_config JSON)
-- Defaults: all customer features enabled. Missing keys resolve to enabled.

update system_config
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{customer}',
  coalesce(config->'customer', '{
    "enableSubscriptions": true,
    "enableCoupons": true,
    "enableWallet": true,
    "enableLoyalty": true,
    "enableFavorites": true,
    "enableReviews": true,
    "enableDiscover": true,
    "enableOrders": true
  }'::jsonb)
)
where id = 1;