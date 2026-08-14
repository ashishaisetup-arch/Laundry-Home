-- ============================================================================
-- Migration 00049: Vendor order photos + support ticket photos
-- Photos are stored inline as base64 data URLs (v1), matching the existing
-- delivery_tasks.photos pattern. A future migration should move these to
-- Supabase Storage and store { url, uploadedBy, uploadedAt, stage } objects.
-- ============================================================================

alter table orders
  add column if not exists photos jsonb not null default '[]'::jsonb;

alter table support_tickets
  add column if not exists photos jsonb not null default '[]'::jsonb;