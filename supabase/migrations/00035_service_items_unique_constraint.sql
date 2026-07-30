-- ============================================================================
-- Migration 00035: Change unique constraint on service_items
-- Allow same item_name across different categories within the same service
-- ============================================================================

alter table service_items
  drop constraint if exists service_items_service_id_item_name_key;

alter table service_items
  add constraint service_items_service_id_item_name_category_key
  unique(service_id, item_name, item_category);
