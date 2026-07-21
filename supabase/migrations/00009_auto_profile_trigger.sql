-- Ensure user_profiles are created automatically when a new auth user signs up.
-- This covers email signup, Google OAuth, and all other auth methods.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = 'public, auth'
as $$
begin
  insert into public.user_profiles (id, role, name, email, phone, avatar)
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'customer'::public.user_role
    ),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'avatar', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
end $$;

-- Backfill profiles for existing auth users that don't have one
insert into user_profiles (id, role, name, email)
select
  au.id,
  coalesce((au.raw_user_meta_data->>'role')::user_role, 'customer'),
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'User'),
  au.email
from auth.users au
left join user_profiles up on up.id = au.id
where up.id is null
on conflict (id) do nothing;
