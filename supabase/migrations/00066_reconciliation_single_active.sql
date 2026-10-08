create unique index if not exists reconciliation_runs_one_active
  on reconciliation_runs (status)
  where status = 'running';
