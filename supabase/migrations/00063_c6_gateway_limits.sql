-- ============================================================================
-- 00063: C6 gateway lookup limits (Phase 3B-2)
-- ============================================================================
-- Seeds rate-limit/cap controls for the C6 gateway-vs-DB check into
-- system_config.config.reconciliation alongside the 3B-1 thresholds.
--
-- Deep-merge guard: preserves every existing reconciliation key (a shallow
-- `config || ...` would replace the whole reconciliation object). Applied
-- only when the first gateway key is absent so re-runs are no-ops.

update system_config
set config = config || jsonb_build_object(
  'reconciliation',
  coalesce(config -> 'reconciliation', '{}'::jsonb) || '{
    "gatewayMaxLookupsPerRun": 30,
    "gatewayLookupDelayMs": 100,
    "gatewayTimeBudgetMs": 10000,
    "gatewayLookupTimeoutMs": 5000
  }'::jsonb
)
where id = 1
  and not (coalesce(config -> 'reconciliation', '{}'::jsonb) ? 'gatewayMaxLookupsPerRun');
