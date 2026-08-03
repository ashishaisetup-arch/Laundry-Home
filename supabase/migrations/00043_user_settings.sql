-- User settings: notification preferences + security
create table if not exists user_settings (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  order_updates boolean not null default true,
  promotions boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "Users view own settings" on user_settings;
create policy "Users view own settings"
  on user_settings for select
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

drop policy if exists "Users update own settings" on user_settings;
create policy "Users update own settings"
  on user_settings for insert
  with check (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));

drop policy if exists "Users update own settings update" on user_settings;
create policy "Users update own settings update"
  on user_settings for update
  using (user_id = auth.uid() or get_user_role() in ('admin','superadmin'));
