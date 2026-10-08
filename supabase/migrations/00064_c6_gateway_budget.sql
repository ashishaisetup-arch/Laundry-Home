-- ============================================================================
-- 00064: raise C6 gateway time budget 10000 -> 20000 (Phase 3B-2)
-- ============================================================================
-- 00063 seeded the C6 limits; measured live Preview latency showed the
-- aggregate budget was simply too small for the observed workload:
--   15 lookups x ~620ms Razorpay latency + 13 x 100ms delays ~= 10.7s
-- With a 10s budget every run truncated at lookup 14/15 and (correctly)
-- wrote nothing, leaving C6 permanently observationally inert. 15s would
-- leave too little margin for normal latency variance; 20s gives ~2x
-- headroom. Per-request timeout stays 5000ms (effective timeout remains
-- min(gatewayLookupTimeoutMs, remainingBudget)) — the problem was aggregate
-- budget, not individual call patience. Caps/delays unchanged:
--   gatewayMaxLookupsPerRun = 30, gatewayLookupDelayMs = 100,
--   gatewayLookupTimeoutMs  = 5000
--
-- Idempotent: no-op once the value is already 20000. Deep-merge guard
-- preserves every other reconciliation key.

update system_config
set config = config || jsonb_build_object(
  'reconciliation',
  coalesce(config -> 'reconciliation', '{}'::jsonb) || '{
    "gatewayTimeBudgetMs": 20000
  }'::jsonb
)
where id = 1
  and coalesce((config -> 'reconciliation' ->> 'gatewayTimeBudgetMs')::numeric, 0) <> 20000;
