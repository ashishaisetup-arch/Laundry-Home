-- ============================================================================
-- Migration 00037: Add grouping column to service_categories
-- Replaces hardcoded MAIN_CATEGORY_SLUGS / ADDON_CATEGORY_SLUGS
-- Superadmin sets grouping when creating a category.
-- ============================================================================

alter table service_categories
  add column if not exists grouping text not null default 'main'
  check (grouping in ('main', 'addon'));

-- Tag existing categories
update service_categories set grouping = 'main'
where slug in ('wash', 'dry-cleaning', 'iron', 'fold', 'home-care');

update service_categories set grouping = 'addon'
where slug in ('special-cleaning', 'premium-services');
