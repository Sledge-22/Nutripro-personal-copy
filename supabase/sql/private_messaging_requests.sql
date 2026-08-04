-- Nutripro private messaging request foundation.
-- Run after instructor_role.sql.
--
-- This file is idempotent and non-destructive:
-- - creates private messaging tables if missing
-- - adds request-status fields if missing
-- - creates request accept/decline RPC helpers
-- - replaces RLS policies for private messaging without deleting data

-- ==================================================
-- Required extensions
-- ==================================================

create extension if not exists pgcrypto;

-- ==================================================
-- Current profile helper
-- ==================================================

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.status = 'active'
    and (
      u.auth_user_id = auth.uid()
      or u.id = auth.uid()
    )
  limit 1;
$$;

grant execute on function public.current_profile_id() to authenticated;

-- ==================================================
-- Tables and request columns
-- ==================================================

create table if not exists public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  subject text,
  status text not null default 'open',
  request_status text not null default 'none',
  requested_by uuid references public.users(id) on delete set null,
  requested_to uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  declined_at timestamptz,
  reported_at timestamptz,
  reported_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.private_conversations
add column if not exists subject text,
add column if not exists status text not null default 'open',
add column if not exists request_status text not null default 'none',
add column if not exists requested_by uuid references public.users(id) on delete set null,
add column if not exists requested_to uuid references public.users(id) on delete set null,
add column if not exists accepted_at timestamptz,
add column if not exists declined_at timestamptz,
add column if not exists reported_at timestamptz,
add column if not exists reported_by uuid references public.users(id) on delete set null,
add column if not exists created_by uuid references public.users(id) on delete set null,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.private_conversations
drop constraint if exists private_conversations_request_status_check;

alter table public.private_conversations
add constraint private_conversations_request_status_check
check (request_status in ('none', 'pending', 'accepted', 'declined')) not valid;

alter table public.private_conversations
drop constraint if exists private_conversations_status_check;

alter table public.private_conversations
add constraint private_conversations_status_check
check (status in ('open', 'closed', 'archived')) not valid;

create table if not exists public.private_conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

alter table public.private_conversation_participants
add column if not exists conversation_id uuid references public.private_conversations(id) on delete cascade,
add column if not exists user_id uuid references public.users(id) on delete cascade,
add column if not exists role text,
add column if not exists last_read_at timestamptz,
add column if not exists created_at timestamptz not null default now();

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.private_messages
add column if not exists conversation_id uuid references public.private_conversations(id) on delete cascade,
add column if not exists sender_id uuid references public.users(id) on delete cascade,
add column if not exists body text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists deleted_at timestamptz;

create index if not exists private_conversations_updated_at_idx
on public.private_conversations (updated_at desc);

create index if not exists private_conversation_participants_conversation_idx
on public.private_conversation_participants (conversation_id);

create index if not exists private_conversation_participants_user_idx
on public.private_conversation_participants (user_id);

create index if not exists private_messages_conversation_created_idx
on public.private_messages (conversation_id, created_at);

-- ==================================================
-- Non-recursive access helpers
-- ==================================================

create or replace function public.is_conversation_participant(conversation_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.private_conversation_participants participant
    join public.users profile on profile.id = participant.user_id
    where participant.conversation_id = conversation_uuid
      and participant.user_id = public.current_profile_id()
      and profile.status = 'active'
  );
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

create or replace function public.can_access_private_conversation(conversation_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_admin()
    or public.is_conversation_participant(conversation_uuid);
$$;

grant execute on function public.can_access_private_conversation(uuid) to authenticated;

create or replace function public.can_send_private_message(conversation_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_admin()
    or exists (
      select 1
      from public.private_conversations c
      join public.private_conversation_participants p
        on p.conversation_id = c.id
        and p.user_id = public.current_profile_id()
      join public.users u
        on u.id = p.user_id
        and u.status = 'active'
      where c.id = conversation_uuid
        and c.status = 'open'
        and coalesce(c.request_status, 'none') in ('none', 'accepted')
    );
$$;

grant execute on function public.can_send_private_message(uuid) to authenticated;

-- ==================================================
-- Request response RPC helpers
-- ==================================================

create or replace function public.respond_private_message_request(
  target_conversation_id uuid,
  response_action text
)
returns table (conversation_id uuid, request_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text;
begin
  if response_action = 'accept' then
    next_status := 'accepted';
  elsif response_action = 'decline' then
    next_status := 'declined';
  else
    raise exception 'Invalid response action.';
  end if;

  update public.private_conversations c
  set request_status = next_status,
      accepted_at = case when next_status = 'accepted' then now() else c.accepted_at end,
      declined_at = case when next_status = 'declined' then now() else c.declined_at end,
      updated_at = now()
  where c.id = target_conversation_id
    and c.request_status = 'pending'
    and (
      c.requested_to = public.current_profile_id()
      or public.is_active_admin()
    );

  if not found then
    raise exception 'Message request could not be updated.';
  end if;

  return query select target_conversation_id, next_status;
end;
$$;

grant execute on function public.respond_private_message_request(uuid, text) to authenticated;

create or replace function public.accept_message_request(conversation_uuid uuid)
returns table (conversation_id uuid, request_status text)
language sql
security definer
set search_path = public
as $$
  select *
  from public.respond_private_message_request(conversation_uuid, 'accept');
$$;

grant execute on function public.accept_message_request(uuid) to authenticated;

create or replace function public.decline_message_request(conversation_uuid uuid)
returns table (conversation_id uuid, request_status text)
language sql
security definer
set search_path = public
as $$
  select *
  from public.respond_private_message_request(conversation_uuid, 'decline');
$$;

grant execute on function public.decline_message_request(uuid) to authenticated;

-- ==================================================
-- RLS policies
-- ==================================================

alter table public.private_conversations enable row level security;
alter table public.private_conversation_participants enable row level security;
alter table public.private_messages enable row level security;

drop policy if exists "Private conversations are readable by admins and participants" on public.private_conversations;
drop policy if exists "Active users can create private conversations they own" on public.private_conversations;
drop policy if exists "Admins can update private conversations" on public.private_conversations;
drop policy if exists "Admins can delete private conversations" on public.private_conversations;
drop policy if exists "Private conversation participants are readable by admins and participants" on public.private_conversation_participants;
drop policy if exists "Admins can manage private conversation participants" on public.private_conversation_participants;
drop policy if exists "Private messages are readable by admins and participants" on public.private_messages;
drop policy if exists "Participants can send private messages" on public.private_messages;
drop policy if exists "Admins can manage private messages" on public.private_messages;

create policy "Private conversations are readable by admins and participants"
on public.private_conversations
for select
to authenticated
using (public.can_access_private_conversation(id));

create policy "Active users can create private conversations they own"
on public.private_conversations
for insert
to authenticated
with check (
  created_by = public.current_profile_id()
);

create policy "Admins can update private conversations"
on public.private_conversations
for update
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

create policy "Admins can delete private conversations"
on public.private_conversations
for delete
to authenticated
using (public.is_active_admin());

create policy "Private conversation participants are readable by admins and participants"
on public.private_conversation_participants
for select
to authenticated
using (public.can_access_private_conversation(conversation_id));

create policy "Admins can manage private conversation participants"
on public.private_conversation_participants
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

create policy "Private messages are readable by admins and participants"
on public.private_messages
for select
to authenticated
using (public.can_access_private_conversation(conversation_id));

create policy "Participants can send private messages"
on public.private_messages
for insert
to authenticated
with check (
  sender_id = public.current_profile_id()
  and public.can_send_private_message(conversation_id)
);

create policy "Admins can manage private messages"
on public.private_messages
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());
