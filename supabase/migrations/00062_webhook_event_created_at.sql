-- ============================================================================
-- 00062: payment_webhook_events.created_at — Phase 3B-1 support
-- ============================================================================
-- C7 (webhook_processing_anomaly) must detect webhook rows stuck in 'pending'
-- for longer than webhookPendingWarnMin, but payment_webhook_events only had
-- processed_at (null while pending), leaving pending rows unageable.
--
-- Observational only: a NOT NULL DEFAULT now() timestamp plus a composite
-- index for the status + age scan. No financial data or behavior changes.
--
-- Note: existing rows get created_at = migration time, so any pending rows
-- already stuck before this migration report age from the migration moment
-- (conservative — never older than reality).
-- ============================================================================

alter table payment_webhook_events
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_payment_webhook_events_status_created_at
  on payment_webhook_events (status, created_at);
