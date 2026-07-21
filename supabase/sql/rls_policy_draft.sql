-- REVIEW BEFORE RUNNING IN PRODUCTION
-- Nutripro Step 7 RLS/security draft
-- This file is a starting point for staged review in Supabase.
-- Apply table-by-table in a staging project first.

-- ==================================================
-- Helper functions
-- ==================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace view public.public_user_profiles as
select
  id,
  name,
  username,
  role,
  profile_picture_url,
  country_code,
  country_name,
  country_flag
from public.users
where status = 'active';

-- ==================================================
-- users
-- ==================================================

alter table public.users enable row level security;

create policy "Users can read own profile"
on public.users
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "Users can update own profile"
on public.users
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "Admins can read users"
on public.users
for select
to authenticated
using (public.is_admin());

create policy "Admins can update users"
on public.users
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- NOTE:
-- The own-profile update policy above should be reviewed carefully.
-- Students must not be able to change role, status, auth_user_id, or other protected fields.
-- Consider replacing self-profile writes with a secure Edge Function or DB trigger safeguards.

-- ==================================================
-- enrollments
-- ==================================================

alter table public.enrollments enable row level security;

create policy "Students can read own enrollments"
on public.enrollments
for select
to authenticated
using (student_id = public.current_profile_id());

create policy "Admins can manage enrollments"
on public.enrollments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ==================================================
-- courses
-- ==================================================

alter table public.courses enable row level security;

create policy "Admins can manage courses"
on public.courses
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Students can read published enrolled courses"
on public.courses
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.enrollments
    where enrollments.course_id = courses.id
      and enrollments.student_id = public.current_profile_id()
      and coalesce(enrollments.status, 'active') <> 'inactive'
  )
);

-- ==================================================
-- modules
-- ==================================================

alter table public.modules enable row level security;

create policy "Admins can manage modules"
on public.modules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Students can read modules for enrolled published courses"
on public.modules
for select
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.enrollments on enrollments.course_id = courses.id
    where courses.id = modules.course_id
      and courses.status = 'published'
      and enrollments.student_id = public.current_profile_id()
      and coalesce(enrollments.status, 'active') <> 'inactive'
  )
);

-- ==================================================
-- student_progress
-- ==================================================

alter table public.student_progress enable row level security;

create policy "Students can read own progress"
on public.student_progress
for select
to authenticated
using (student_id = public.current_profile_id());

create policy "Students can update own progress"
on public.student_progress
for insert
to authenticated
with check (student_id = public.current_profile_id());

create policy "Students can modify own progress"
on public.student_progress
for update
to authenticated
using (student_id = public.current_profile_id())
with check (student_id = public.current_profile_id());

create policy "Admins can read progress"
on public.student_progress
for select
to authenticated
using (public.is_admin());

-- ==================================================
-- module_assignments
-- ==================================================

alter table public.module_assignments enable row level security;

create policy "Admins can manage assignments"
on public.module_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Students can read assignments for enrolled modules"
on public.module_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.modules
    join public.courses on courses.id = modules.course_id
    join public.enrollments on enrollments.course_id = courses.id
    where modules.id = module_assignments.module_id
      and courses.status = 'published'
      and enrollments.student_id = public.current_profile_id()
      and coalesce(enrollments.status, 'active') <> 'inactive'
  )
);

-- ==================================================
-- assignment_submissions
-- ==================================================

alter table public.assignment_submissions enable row level security;

create policy "Students can read own assignment submissions"
on public.assignment_submissions
for select
to authenticated
using (student_id = public.current_profile_id());

create policy "Students can create own assignment submissions"
on public.assignment_submissions
for insert
to authenticated
with check (student_id = public.current_profile_id());

create policy "Students can update own assignment submissions"
on public.assignment_submissions
for update
to authenticated
using (student_id = public.current_profile_id())
with check (student_id = public.current_profile_id());

create policy "Admins can manage assignment submissions"
on public.assignment_submissions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ==================================================
-- certificates
-- ==================================================

alter table public.certificates enable row level security;

create policy "Students can read own certificates"
on public.certificates
for select
to authenticated
using (student_id = public.current_profile_id());

create policy "Admins can manage certificates"
on public.certificates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ==================================================
-- community_posts
-- ==================================================

alter table public.community_posts enable row level security;

create policy "Authenticated users can read visible community posts"
on public.community_posts
for select
to authenticated
using (coalesce(is_removed, false) = false or public.is_admin());

create policy "Authenticated users can create own community posts"
on public.community_posts
for insert
to authenticated
with check (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
);

create policy "Users can update own community posts"
on public.community_posts
for update
to authenticated
using (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
)
with check (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
);

create policy "Users can delete own community posts"
on public.community_posts
for delete
to authenticated
using (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
);

-- ==================================================
-- community_comments
-- ==================================================

alter table public.community_comments enable row level security;

create policy "Authenticated users can read visible community comments"
on public.community_comments
for select
to authenticated
using (coalesce(is_removed, false) = false or public.is_admin());

create policy "Authenticated users can create own community comments"
on public.community_comments
for insert
to authenticated
with check (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
);

create policy "Users can update own community comments"
on public.community_comments
for update
to authenticated
using (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
)
with check (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
);

create policy "Users can delete own community comments"
on public.community_comments
for delete
to authenticated
using (
  coalesce(student_id, author_id) = public.current_profile_id()
  or public.is_admin()
);

-- ==================================================
-- community_votes
-- ==================================================

alter table public.community_votes enable row level security;

create policy "Users can manage own votes"
on public.community_votes
for all
to authenticated
using (user_id = public.current_profile_id())
with check (user_id = public.current_profile_id());

create policy "Admins can read community votes"
on public.community_votes
for select
to authenticated
using (public.is_admin());

-- ==================================================
-- admin_audit_logs
-- ==================================================

alter table public.admin_audit_logs enable row level security;

create policy "Admins can read audit logs"
on public.admin_audit_logs
for select
to authenticated
using (public.is_admin());

create policy "Admins can insert audit logs"
on public.admin_audit_logs
for insert
to authenticated
with check (public.is_admin());

-- ==================================================
-- site_settings
-- ==================================================

alter table public.site_settings enable row level security;

create policy "Admins can read site settings"
on public.site_settings
for select
to authenticated
using (public.is_admin());

create policy "Admins can update site settings"
on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ==================================================
-- course_drafts
-- ==================================================

alter table public.course_drafts enable row level security;

create policy "Admins can manage course drafts"
on public.course_drafts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ==================================================
-- Storage review notes
-- ==================================================

-- REVIEW STORAGE POLICIES SEPARATELY IN SUPABASE:
-- module-pdfs
-- module-videos
-- assignment-submissions
-- community-pdfs
-- profile-pictures
-- course-images
--
-- Recommended production direction:
-- - assignment-submissions should be private
-- - module media can be public only if intended, otherwise switch to signed URLs
-- - profile-pictures and course-images can often be public-read with restricted writes
