-- Nutripro notification support for private messaging.
-- Run after private_messaging_requests.sql and before instructor_student_messaging.sql.
--
-- This file is idempotent and non-destructive:
-- - creates notifications table if missing
-- - adds notification columns used by the frontend
-- - adds RLS policies for users to read/update their own notifications
-- - creates triggers for private message notifications

-- ==================================================
-- Required extensions
-- ==================================================

create extension if not exists pgcrypto;

-- ==================================================
-- Notifications table
-- ==================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  recipient_id uuid references public.users(id) on delete cascade,
  type text not null,
  title text,
  title_key text,
  description text,
  description_key text,
  link_path text,
  priority text not null default 'normal',
  read_at timestamptz,
  cleared_at timestamptz,
  source text default 'database',
  created_at timestamptz not null default now()
);

alter table public.notifications
add column if not exists user_id uuid references public.users(id) on delete cascade,
add column if not exists recipient_id uuid references public.users(id) on delete cascade,
add column if not exists type text,
add column if not exists title text,
add column if not exists title_key text,
add column if not exists description text,
add column if not exists description_key text,
add column if not exists link_path text,
add column if not exists priority text not null default 'normal',
add column if not exists read_at timestamptz,
add column if not exists cleared_at timestamptz,
add column if not exists source text default 'database',
add column if not exists created_at timestamptz not null default now();

create index if not exists notifications_user_created_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_recipient_created_idx
on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_type_idx
on public.notifications (type);

-- ==================================================
-- RLS policies
-- ==================================================

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Admins can manage notifications" on public.notifications;

create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (
  user_id = public.current_profile_id()
  or recipient_id = public.current_profile_id()
  or public.is_active_admin()
);

create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (
  user_id = public.current_profile_id()
  or recipient_id = public.current_profile_id()
  or public.is_active_admin()
)
with check (
  user_id = public.current_profile_id()
  or recipient_id = public.current_profile_id()
  or public.is_active_admin()
);

create policy "Admins can manage notifications"
on public.notifications
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

-- ==================================================
-- Notification insert helper
-- ==================================================

create or replace function public.create_user_notification(
  target_user_id uuid,
  notification_type text,
  notification_title_key text,
  notification_description_key text,
  notification_link_path text default null,
  notification_priority text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_notification_id uuid;
begin
  if target_user_id is null then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    recipient_id,
    type,
    title_key,
    description_key,
    link_path,
    priority,
    source,
    created_at
  )
  values (
    target_user_id,
    target_user_id,
    notification_type,
    notification_title_key,
    notification_description_key,
    notification_link_path,
    notification_priority,
    'database',
    now()
  )
  returning id into next_notification_id;

  return next_notification_id;
end;
$$;

grant execute on function public.create_user_notification(uuid, text, text, text, text, text) to authenticated;

-- ==================================================
-- Private message notification trigger
-- ==================================================

create or replace function public.notify_private_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_record public.private_conversations%rowtype;
  participant_record record;
  notification_type text;
begin
  select *
  into conversation_record
  from public.private_conversations
  where id = new.conversation_id
  limit 1;

  if conversation_record.id is null then
    return new;
  end if;

  if conversation_record.request_status = 'declined' then
    return new;
  end if;

  notification_type := case
    when conversation_record.request_status = 'pending' then 'messages.message_request'
    else 'messages.new_message'
  end;

  for participant_record in
    select participant.user_id
    from public.private_conversation_participants participant
    join public.users recipient on recipient.id = participant.user_id
    where participant.conversation_id = new.conversation_id
      and participant.user_id <> new.sender_id
      and recipient.status = 'active'
  loop
    perform public.create_user_notification(
      participant_record.user_id,
      notification_type,
      'notifications.types.' || notification_type || '.title',
      'notifications.types.' || notification_type || '.description',
      null,
      case when notification_type = 'messages.message_request' then 'high' else 'normal' end
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists private_messages_notify_insert on public.private_messages;

create trigger private_messages_notify_insert
after insert on public.private_messages
for each row
execute function public.notify_private_message_insert();
