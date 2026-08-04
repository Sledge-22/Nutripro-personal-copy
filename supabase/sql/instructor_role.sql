-- Run this in Supabase SQL Editor after creating the Auth user.
-- This adds the instructor role safely without granting admin privileges.

alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (role in ('admin', 'student', 'instructor', 'support'));

create or replace function public.is_active_instructor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'instructor'
      and u.status = 'active'
  );
$$;

grant execute on function public.is_active_instructor() to authenticated;

alter table public.courses
add column if not exists created_by uuid references public.users(id) on delete set null;

alter table public.courses
add column if not exists instructor_id uuid references public.users(id) on delete set null;

create or replace function public.can_manage_course(course_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_admin()
    or exists (
      select 1
      from public.courses c
      where c.id = course_uuid
        and (
          c.created_by = public.current_profile_id()
          or c.instructor_id = public.current_profile_id()
        )
    );
$$;

grant execute on function public.can_manage_course(uuid) to authenticated;

-- Instructor course ownership policies.
-- These add instructor-owned course access without weakening student enrolled-course RLS.
alter table public.courses enable row level security;
alter table public.course_classes enable row level security;
alter table public.modules enable row level security;
alter table public.module_assignments enable row level security;
alter table public.assignment_submissions enable row level security;

drop policy if exists "Instructors can read own courses" on public.courses;
drop policy if exists "Instructors can create own courses" on public.courses;
drop policy if exists "Instructors can update own courses" on public.courses;
drop policy if exists "Instructors can read own course classes" on public.course_classes;
drop policy if exists "Instructors can create own course classes" on public.course_classes;
drop policy if exists "Instructors can update own course classes" on public.course_classes;
drop policy if exists "Instructors can read own course modules" on public.modules;
drop policy if exists "Instructors can create own course modules" on public.modules;
drop policy if exists "Instructors can update own course modules" on public.modules;
drop policy if exists "Instructors can read own module assignments" on public.module_assignments;
drop policy if exists "Instructors can create own module assignments" on public.module_assignments;
drop policy if exists "Instructors can update own module assignments" on public.module_assignments;
drop policy if exists "Instructors can manage own module assignments" on public.module_assignments;
drop policy if exists "Instructors can read own course submissions" on public.assignment_submissions;
drop policy if exists "Instructors can review own course submissions" on public.assignment_submissions;

create policy "Instructors can read own courses"
on public.courses
for select
to authenticated
using (public.can_manage_course(id));

create policy "Instructors can create own courses"
on public.courses
for insert
to authenticated
with check (
  public.is_active_instructor()
  and created_by = public.current_profile_id()
  and instructor_id = public.current_profile_id()
);

create policy "Instructors can update own courses"
on public.courses
for update
to authenticated
using (public.can_manage_course(id))
with check (
  public.is_active_admin()
  or (
    public.is_active_instructor()
    and (
      created_by = public.current_profile_id()
      or instructor_id = public.current_profile_id()
    )
  )
);

create policy "Instructors can read own course classes"
on public.course_classes
for select
to authenticated
using (public.can_manage_course(course_id));

create policy "Instructors can create own course classes"
on public.course_classes
for insert
to authenticated
with check (public.can_manage_course(course_id));

create policy "Instructors can update own course classes"
on public.course_classes
for update
to authenticated
using (public.can_manage_course(course_id))
with check (public.can_manage_course(course_id));

create policy "Instructors can read own course modules"
on public.modules
for select
to authenticated
using (public.can_manage_course(course_id));

create policy "Instructors can create own course modules"
on public.modules
for insert
to authenticated
with check (public.can_manage_course(course_id));

create policy "Instructors can update own course modules"
on public.modules
for update
to authenticated
using (public.can_manage_course(course_id))
with check (public.can_manage_course(course_id));

create policy "Instructors can read own module assignments"
on public.module_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.modules m
    where m.id = module_assignments.module_id
      and public.can_manage_course(m.course_id)
  )
);

create policy "Instructors can create own module assignments"
on public.module_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.modules m
    where m.id = module_assignments.module_id
      and public.can_manage_course(m.course_id)
  )
);

create policy "Instructors can update own module assignments"
on public.module_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.modules m
    where m.id = module_assignments.module_id
      and public.can_manage_course(m.course_id)
  )
)
with check (
  exists (
    select 1
    from public.modules m
    where m.id = module_assignments.module_id
      and public.can_manage_course(m.course_id)
  )
);

create policy "Instructors can read own course submissions"
on public.assignment_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.module_assignments ma
    join public.modules m on m.id = ma.module_id
    where ma.id = assignment_submissions.assignment_id
      and public.can_manage_course(m.course_id)
  )
);

create policy "Instructors can review own course submissions"
on public.assignment_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.module_assignments ma
    join public.modules m on m.id = ma.module_id
    where ma.id = assignment_submissions.assignment_id
      and public.can_manage_course(m.course_id)
  )
)
with check (
  exists (
    select 1
    from public.module_assignments ma
    join public.modules m on m.id = ma.module_id
    where ma.id = assignment_submissions.assignment_id
      and public.can_manage_course(m.course_id)
  )
);

-- Keep instructor messaging limited until instructor-course assignments exist.
-- Instructors can see active admins as recipients. Students still use the
-- existing admin/classmate recipient rules.
create or replace function public.get_private_message_recipients()
returns table (
  id uuid,
  name text,
  username text,
  email text,
  role text,
  status text,
  recipient_group text,
  shared_course_title text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select u.id, u.role, u.status
    from public.users u
    where u.id = public.current_profile_id()
    limit 1
  ),
  active_admins as (
    select u.id, u.name, u.username, u.email, u.role, u.status, 'admins'::text as recipient_group, null::text as shared_course_title
    from public.users u
    where u.role = 'admin'
      and u.status = 'active'
      and u.id <> (select id from me)
  ),
  eligible_classmates as (
    select distinct other_user.id,
      other_user.name,
      other_user.username,
      other_user.email,
      other_user.role,
      other_user.status,
      'classmates'::text as recipient_group,
      c.title as shared_course_title
    from me
    join public.enrollments my_enrollment
      on my_enrollment.student_id = me.id
      and coalesce(my_enrollment.status, 'active') = 'active'
    join public.enrollments other_enrollment
      on other_enrollment.course_id = my_enrollment.course_id
      and coalesce(other_enrollment.status, 'active') = 'active'
      and other_enrollment.student_id <> me.id
    join public.users other_user
      on other_user.id = other_enrollment.student_id
      and other_user.role = 'student'
      and other_user.status = 'active'
    left join public.courses c on c.id = my_enrollment.course_id
    where me.role = 'student'
      and me.status = 'active'
  )
  select * from active_admins
  where (select role from me) in ('student', 'instructor')
  union all
  select * from eligible_classmates
  where (select role from me) = 'student';
$$;

grant execute on function public.get_private_message_recipients() to authenticated;

-- Conversation creation guard:
-- - active admins can message active users
-- - students can message admins and shared-course classmates
-- - instructors can message active admins only until instructor-course assignment exists
create or replace function public.create_private_conversation(
  recipient_user_id uuid,
  conversation_subject text,
  first_message text
)
returns table (conversation_id uuid, request_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_profile public.users%rowtype;
  recipient_profile public.users%rowtype;
  next_conversation_id uuid;
  next_request_status text := 'none';
  allowed boolean := false;
begin
  select * into sender_profile
  from public.users
  where id = public.current_profile_id()
  limit 1;

  select * into recipient_profile
  from public.users
  where id = recipient_user_id
  limit 1;

  if sender_profile.id is null or sender_profile.status <> 'active' then
    raise exception 'Current user is not active.';
  end if;

  if recipient_profile.id is null or recipient_profile.status <> 'active' then
    raise exception 'Recipient is not active.';
  end if;

  if sender_profile.id = recipient_profile.id then
    raise exception 'You cannot message yourself.';
  end if;

  if sender_profile.role = 'admin' then
    allowed := true;
  elsif recipient_profile.role = 'admin' then
    allowed := true;
  elsif sender_profile.role = 'student' and recipient_profile.role = 'student' then
    allowed := exists (
      select 1
      from public.enrollments mine
      join public.enrollments theirs on theirs.course_id = mine.course_id
      where mine.student_id = sender_profile.id
        and theirs.student_id = recipient_profile.id
        and coalesce(mine.status, 'active') = 'active'
        and coalesce(theirs.status, 'active') = 'active'
    );
    next_request_status := 'pending';
  else
    allowed := false;
  end if;

  if not allowed then
    raise exception 'You are not allowed to message this recipient.';
  end if;

  insert into public.private_conversations (
    subject,
    status,
    request_status,
    requested_by,
    requested_to,
    created_by,
    created_at,
    updated_at
  )
  values (
    nullif(trim(conversation_subject), ''),
    'open',
    next_request_status,
    case when next_request_status = 'pending' then sender_profile.id else null end,
    case when next_request_status = 'pending' then recipient_profile.id else null end,
    sender_profile.id,
    now(),
    now()
  )
  returning id into next_conversation_id;

  insert into public.private_conversation_participants (conversation_id, user_id, role)
  values
    (next_conversation_id, sender_profile.id, sender_profile.role),
    (next_conversation_id, recipient_profile.id, recipient_profile.role);

  insert into public.private_messages (conversation_id, sender_id, body, created_at)
  values (next_conversation_id, sender_profile.id, first_message, now());

  return query select next_conversation_id, next_request_status;
end;
$$;

grant execute on function public.create_private_conversation(uuid, text, text) to authenticated;

-- Temporary development/testing account profile.
-- First create the Supabase Auth user manually:
--   email: instructor@nutripro.test
--   password: InstructorTemp#2026!
--   email confirmed: true
-- Then replace <PASTE_AUTH_USER_UUID_HERE> below with that Auth user UUID.
--
-- These accounts are for development/testing only and must be removed or disabled before launch.
insert into public.users (
  email,
  username,
  role,
  status,
  auth_user_id,
  must_change_password,
  privacy_policy_accepted,
  privacy_policy_version,
  privacy_policy_accepted_at,
  created_at,
  updated_at
)
values (
  'instructor@nutripro.test',
  'instructor',
  'instructor',
  'active',
  '<PASTE_AUTH_USER_UUID_HERE>',
  false,
  true,
  '2026-07-draft',
  now(),
  now(),
  now()
)
on conflict (email)
do update set
  username = excluded.username,
  role = excluded.role,
  status = excluded.status,
  auth_user_id = excluded.auth_user_id,
  must_change_password = excluded.must_change_password,
  privacy_policy_accepted = excluded.privacy_policy_accepted,
  privacy_policy_version = excluded.privacy_policy_version,
  privacy_policy_accepted_at = excluded.privacy_policy_accepted_at,
  updated_at = now();
