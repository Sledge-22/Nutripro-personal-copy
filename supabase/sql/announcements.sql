create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience_type text not null default 'all_students',
  course_id uuid references public.courses(id) on delete cascade,
  class_id uuid references public.course_classes(id) on delete cascade,
  priority text not null default 'normal',
  status text not null default 'published',
  created_by uuid references public.users(id) on delete set null,
  published_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements
drop constraint if exists announcements_audience_type_check;

alter table public.announcements
add constraint announcements_audience_type_check
check (audience_type in ('all_users', 'all_students', 'admins', 'course', 'class'));

alter table public.announcements
drop constraint if exists announcements_priority_check;

alter table public.announcements
add constraint announcements_priority_check
check (priority in ('normal', 'important', 'urgent'));

alter table public.announcements
drop constraint if exists announcements_status_check;

alter table public.announcements
add constraint announcements_status_check
check (status in ('draft', 'published', 'archived'));

alter table public.announcements enable row level security;

drop policy if exists "Admins can manage announcements" on public.announcements;
drop policy if exists "Users can read targeted published announcements" on public.announcements;

create policy "Admins can manage announcements"
on public.announcements
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

create policy "Users can read targeted published announcements"
on public.announcements
for select
to authenticated
using (
  status = 'published'
  and (expires_at is null or expires_at > now())
  and (
    public.is_active_admin()
    or (
      audience_type = 'all_users'
      and exists (
        select 1
        from public.users u
        where u.id = public.current_profile_id()
          and u.status = 'active'
      )
    )
    or (
      audience_type = 'all_students'
      and exists (
        select 1
        from public.users u
        where u.id = public.current_profile_id()
          and u.role = 'student'
          and u.status = 'active'
      )
    )
    or (
      audience_type = 'admins'
      and public.is_active_admin()
    )
    or (
      audience_type = 'course'
      and exists (
        select 1
        from public.users u
        join public.enrollments e on e.student_id = u.id
        where u.id = public.current_profile_id()
          and u.role = 'student'
          and u.status = 'active'
          and e.course_id = announcements.course_id
          and coalesce(e.status, 'active') = 'active'
      )
    )
    or (
      audience_type = 'class'
      and exists (
        select 1
        from public.users u
        join public.enrollments e on e.student_id = u.id
        join public.course_classes cc on cc.course_id = e.course_id
        where u.id = public.current_profile_id()
          and u.role = 'student'
          and u.status = 'active'
          and cc.id = announcements.class_id
          and coalesce(e.status, 'active') = 'active'
      )
    )
  )
);
