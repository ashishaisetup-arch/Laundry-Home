-- ============================================================================
-- 00061: Reconciliation observability — Phase 3B-1 (detection only)
-- ============================================================================
-- Observational reconciliation infrastructure. This migration creates NO
-- financial logic and mutates NO financial state. It only adds:
--
--   1. reconciliation_runs      — one row per reconciliation execution,
--                                  including a JSONB check_results summary
--                                  so failed/truncated checks are observable
--                                  and are NEVER treated as "condition cleared".
--   2. reconciliation_findings  — deduplicated findings with occurrence
--                                  counting, reopen and stale-resolve support.
--   3. threshold config         — seeded into the existing single-row
--                                  system_config under config.reconciliation.
--
-- Finding identity:
--   unique (check_code, subject_type, subject_id)
--   subject_id is TEXT so gateway identifiers (webhook event ids, refund ids)
--   can be reconciliation subjects alongside UUID rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. reconciliation_runs
-- ---------------------------------------------------------------------------
create table if not exists reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null
    check (trigger_source in ('cron', 'manual', 'test')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  checks_run text[] not null default '{}',
  findings_open integer not null default 0,
  findings_new integer not null default 0,
  findings_resolved integer not null default 0,
  -- Per-check outcome summary, e.g.:
  --   { "C1": {"status":"success","findings":0},
  --     "C8": {"status":"failed","error":"..."} }
  -- status: success | failed | truncated
  check_results jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_recon_runs_started on reconciliation_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- 2. reconciliation_findings
-- ---------------------------------------------------------------------------
create table if not exists reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  check_code text not null,
  severity text not null
    check (severity in ('info', 'warning', 'critical')),
  subject_type text not null
    check (subject_type in ('payment', 'refund', 'order', 'webhook_event', 'wallet_user')),
  subject_id text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  occurrence_count integer not null default 1,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  -- Logical identity spans subject_type: a payment, refund, order,
  -- webhook event or wallet user must not share a namespace just because
  -- their ids happen to match.
  constraint uq_recon_finding unique (check_code, subject_type, subject_id)
);

create index if not exists idx_recon_findings_status_sev
  on reconciliation_findings (status, severity);
create index if not exists idx_recon_findings_check
  on reconciliation_findings (check_code);
create index if not exists idx_recon_findings_last_seen
  on reconciliation_findings (last_detected_at desc);

-- RLS: service-role only (server-mediated reads/writes).
-- service_role bypasses RLS; no policies = no direct client access.
alter table reconciliation_runs enable row level security;
alter table reconciliation_findings enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Threshold config — seeded into system_config.config.reconciliation
--    Read by reconciliation-service with hard-coded fallback defaults.
--    Editable later via existing PATCH /api/admin/config (deep merge).
-- ---------------------------------------------------------------------------
insert into system_config (id, config)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

update system_config
set config = config || '{
  "reconciliation": {
    "refundSubmittingWarnMin": 15,
    "refundSubmittingCritMin": 60,
    "refundPendingWarnMin": 30,
    "refundProcessingWarnHours": 24,
    "paymentStuckWarnMin": 30,
    "paymentStuckCritHours": 24,
    "webhookPendingWarnMin": 5,
    "maxFindingsPerCheck": 500
  }
}'::jsonb,
updated_at = now()
where id = 1
  and not (config ? 'reconciliation');
