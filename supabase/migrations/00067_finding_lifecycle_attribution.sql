-- ============================================================================
-- 00067: Reconciliation finding lifecycle attribution + exact counts RPC
--        — Phase 3B-5a (backend lifecycle operations)
-- ============================================================================
-- Observational only: mutates NO financial state. Adds operator attribution
-- columns for acknowledge/resolve transitions and a service-role-only
-- aggregate RPC so the admin findings list can return exact counts without
-- N count queries or a truncation-prone client-side scan.
--
--   1. acknowledged_at / acknowledged_by  — first acknowledgement (never
--      overwritten by idempotent re-acknowledge)
--   2. resolved_by                        — set only by operator resolve;
--      NULL = automatic stale-resolve (the auto/admin discriminator that
--      drives reopen semantics)
--   3. get_reconciliation_finding_counts  — exact filtered aggregates;
--      EXECUTE revoked from PUBLIC/anon/authenticated, granted to
--      service_role only (never reachable from the browser)

alter table reconciliation_findings
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid
    references user_profiles(id) on delete set null,
  add column if not exists resolved_by uuid
    references user_profiles(id) on delete set null;

-- Exact aggregates for GET /api/admin/reconciliation/findings.
-- Same predicate contract as the list query: null param = no filter;
-- q is case-insensitive containment over summary OR subject_id. LIKE
-- metacharacters are escaped explicitly (escape '\') so an underscore in
-- whitelisted operator input (e.g. pay_...) is matched literally; the
-- list-side PostgREST query applies the identical escaping so RPC counts
-- and list totals can never diverge.
create or replace function public.get_reconciliation_finding_counts(
  p_status       text default null,
  p_severity     text default null,
  p_check_code   text default null,
  p_subject_type text default null,
  p_q            text default null
)
returns table (
  total        bigint,
  open         bigint,
  acknowledged bigint,
  resolved     bigint,
  info         bigint,
  warning      bigint,
  critical     bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)                                             as total,
    count(*) filter (where f.status = 'open')            as open,
    count(*) filter (where f.status = 'acknowledged')    as acknowledged,
    count(*) filter (where f.status = 'resolved')        as resolved,
    count(*) filter (where f.severity = 'info')          as info,
    count(*) filter (where f.severity = 'warning')       as warning,
    count(*) filter (where f.severity = 'critical')      as critical
  from public.reconciliation_findings f
  where (p_status       is null or f.status       = p_status)
    and (p_severity     is null or f.severity     = p_severity)
    and (p_check_code   is null or f.check_code   = p_check_code)
    and (p_subject_type is null or f.subject_type = p_subject_type)
    and (
      p_q is null
      or f.summary ilike
           '%' ||
           replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') ||
           '%'
           escape '\'
      or f.subject_id ilike
           '%' ||
           replace(replace(replace(p_q, '\', '\\'), '%', '\%'), '_', '\_') ||
           '%'
           escape '\'
    );
$$;

-- Lock EXECUTE to the server's service-role key only. Never exposed to
-- anon/authenticated (browser), hence not callable via PostgREST with a
-- public or user session key.
revoke execute on function public.get_reconciliation_finding_counts(text, text, text, text, text)
  from PUBLIC, anon, authenticated;
grant execute on function public.get_reconciliation_finding_counts(text, text, text, text, text)
  to service_role;
