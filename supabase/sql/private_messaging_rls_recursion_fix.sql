-- Fix private messaging RLS recursion.
-- Run this in Supabase SQL Editor.
--
-- This migration replaces private messaging policies that can recurse on
-- private_conversation_participants with SECURITY DEFINER helper functions.
-- It does not delete conversations, participants, or messages.

-- ==================================================
-- Helper functions
-- ==================================================

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id
  from public.users
  where status = 'active'
    and (
      auth_user_id = auth.uid()
      or id = auth.uid()
    )
  limit 1;
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where role = 'admin'
      and status = 'active'
      and (
        auth_user_id = auth.uid()
        or id = auth.uid()
      )
  );
$$;

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

create or replace function public.can_access_private_conversation(conversation_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_admin()
    or public.is_conversation_participant(conversation_uuid);
$$;

-- ==================================================
-- Replace recursive policies
-- ==================================================

alter table public.private_conversations enable row level security;
alter table public.private_conversation_participants enable row level security;
alter table public.private_messages enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'private_conversations',
        'private_conversation_participants',
        'private_messages'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

-- Conversations are readable only by active admins or participants.
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

-- Participant rows are readable by active admins or users inside that conversation.
-- This policy intentionally does not query private_conversation_participants directly.
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

-- Messages are readable only by active admins or users inside that conversation.
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
  and public.can_access_private_conversation(conversation_id)
);

create policy "Admins can manage private messages"
on public.private_messages
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());
