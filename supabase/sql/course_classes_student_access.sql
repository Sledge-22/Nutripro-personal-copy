-- Course → Classes → Modules/Lessons access policies.
-- Run after public.course_classes, public.courses, public.enrollments,
-- public.current_profile_id(), and public.is_admin() exist.

alter table public.course_classes enable row level security;

drop policy if exists "Admins can manage course classes" on public.course_classes;
create policy "Admins can manage course classes"
on public.course_classes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can read enrolled course classes" on public.course_classes;
create policy "Students can read enrolled course classes"
on public.course_classes
for select
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.enrollments on enrollments.course_id = courses.id
    where courses.id = course_classes.course_id
      and courses.status = 'published'
      and enrollments.student_id = public.current_profile_id()
      and coalesce(enrollments.status, 'active') = 'active'
  )
);
