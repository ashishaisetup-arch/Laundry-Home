-- Add delivery executive profile fields to user_profiles
alter table user_profiles
  add column if not exists is_available boolean not null default true,
  add column if not exists current_lat numeric(10,7),
  add column if not exists current_lng numeric(10,7),
  add column if not exists max_daily_orders integer not null default 10;

-- Index for querying available execs
create index if not exists idx_user_profiles_role_available
  on user_profiles(role, is_available)
  where role = 'delivery';

-- Index for workload counting on delivery_tasks
create index if not exists idx_delivery_tasks_exec_status
  on delivery_tasks(exec_id, status);
