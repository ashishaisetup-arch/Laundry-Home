-- ============================================================================
-- Migration 00034: Add estimated_weight_kg to service_items
-- ============================================================================

alter table service_items
  add column if not exists estimated_weight_kg numeric(4,2);
