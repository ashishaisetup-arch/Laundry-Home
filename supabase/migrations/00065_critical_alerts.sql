-- ============================================================================
-- 00065: Critical alerting ledger — Phase 3B-3 (alerts, observational only)
-- ============================================================================
-- Alert dispatch for reconciliation transitions. Detection and alerting stay
-- strictly separate from financial state: this migration creates NO financial
-- logic, mutates NO financial state, and the alert dispatcher writes ONLY to
-- reconciliation_alerts / notifications / audit_logs.
--
-- Alert identity (deterministic from the run, never a timestamp):
--   alert_event_key = finding_id || ':' || transition || ':' || run_id
--
-- Two independent uniqueness defenses:
--   1. unique (finding_id, transition, run_id) — one alert per transition per
--      run, enforced by the database even if key generation changes.
--   2. unique (alert_event_key) — the generated string itself is unique.
-- A 23505 on either constraint means "already dispatched": every downstream
-- channel (in-app, webhook, audit) is skipped for that event.
--
-- Transitions: 'new' | 'reopened' | 'escalated' — critical severity only.
-- Repeat-open and acknowledged-critical re-detections emit no event at all.
--
-- Privileges: service-role only (mirrors the refund/financial discipline).
-- RLS enabled with NO policies, plus explicit revokes from public, anon and
-- authenticated; granted to service_role only.
-- ============================================================================

create table if not exists reconciliation_alerts (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references reconciliation_findings(id),
  alert_event_key text not null,
  transition text not null
    check (transition in ('new', 'reopened', 'escalated')),
  run_id uuid not null references reconciliation_runs(id),
  check_code text not null,
  severity text not null default 'critical',
  subject_type text not null,
  subject_id text not null,
  dispatched_at timestamptz not null default now(),
  delivery jsonb not null default '{}'::jsonb,
  constraint uq_recon_alert_event unique (finding_id, transition, run_id),
  constraint uq_recon_alert_key unique (alert_event_key)
);

alter table reconciliation_alerts enable row level security;
revoke all on reconciliation_alerts from public;
revoke all on reconciliation_alerts from anon;
revoke all on reconciliation_alerts from authenticated;
grant all on reconciliation_alerts to service_role;

create index if not exists idx_reconciliation_alerts_finding
  on reconciliation_alerts(finding_id);
create index if not exists idx_reconciliation_alerts_run
  on reconciliation_alerts(run_id);
create index if not exists idx_reconciliation_alerts_dispatched
  on reconciliation_alerts(dispatched_at desc);

-- In-app notification type for alert rows (PG12+ allows ADD VALUE inside a
-- transaction as long as the new value is not used in the same transaction).
alter type notification_type add value if not exists 'recon_alert';
