-- Nutripro Auth + Admin-managed users setup
-- Run this in Supabase SQL Editor after reviewing it for your project.

alter table public.users
  add column if not exists username text unique,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_updated_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create or replace function public.resolve_login_email(login_identifier text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.users
  where lower(email) = lower(login_identifier)
     or lower(username) = lower(login_identifier)
  limit 1
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and lower(role) = 'admin'
      and lower(status) = 'active'
  )
$$;

create or replace function public.guard_user_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.must_change_password is distinct from old.must_change_password
      or new.password_updated_at is distinct from old.password_updated_at
      or new.last_login_at is distinct from old.last_login_at
      or new.email is distinct from old.email
      or new.username is distinct from old.username then
      raise exception 'You are not allowed to update protected user fields.';
    end if;
  end if;

  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_guard_user_profile_updates on public.users;
create trigger trg_guard_user_profile_updates
before update on public.users
for each row
execute function public.guard_user_profile_updates();

alter table public.users enable row level security;

drop policy if exists "Authenticated users can view app profiles" on public.users;
create policy "Authenticated users can view app profiles"
on public.users
for select
to authenticated
using (true);

drop policy if exists "Users can update their own editable profile fields" on public.users;
create policy "Users can update their own editable profile fields"
on public.users
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  id = auth.uid() or public.is_admin()
);

-- If your current public.users.id values are not UUIDs matching auth.users.id,
-- stop here and migrate carefully before enabling production auth:
-- 1. back up public.users
-- 2. create matching auth users
-- 3. copy public.users rows into a new UUID-based table keyed by auth.users.id
-- 4. swap the tables only after verifying foreign keys and enrollments
