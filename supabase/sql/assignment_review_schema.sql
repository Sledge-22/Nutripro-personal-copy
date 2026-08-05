-- Assignment review schema + RLS support.
-- Idempotent: safe to run multiple times.
-- This script does not delete, truncate, or wipe submissions/files/progress.

-- ==================================================
-- Review columns
-- ==================================================

alter table public.assignment_submissions
add column if not exists status text not null default 'submitted';

alter table public.assignment_submissions
add column if not exists grade integer;

alter table public.assignment_submissions
add column if not exists feedback text;

-- Compatibility with older frontend/data that used admin_feedback.
alter table public.assignment_submissions
add column if not exists admin_feedback text;

alter table public.assignment_submissions
add column if not exists reviewed_by uuid references public.users(id) on delete set null;

alter table public.assignment_submissions
add column if not exists reviewed_at timestamptz;

alter table public.assignment_submissions
add column if not exists graded_at timestamptz;

alter table public.assignment_submissions
add column if not exists updated_at timestamptz default now();

alter table public.assignment_submissions
add column if not exists rubric jsonb;

-- Keep timestamps populated for existing rows.
update public.assignment_submissions
set updated_at = now()
where updated_at is null;

-- Keep feedback/admin_feedback aligned without erasing existing text.
update public.assignment_submissions
set feedback = admin_feedback
where feedback is null
  and admin_feedback is not null;

update public.assignment_submissions
set admin_feedback = feedback
where admin_feedback is null
  and feedback is not null;

-- Normalize legacy review status to the launch status value.
update public.assignment_submissions
set status = 'changes_requested'
where status = 'needs_revision';

-- Normalize unsupported/null status values before adding the constraint.
update public.assignment_submissions
set status = 'submitted'
where status is null
   or status not in ('submitted', 'approved', 'changes_requested', 'rejected', 'resubmitted');

-- Replace existing status check constraints that reference status.
alter table public.assignment_submissions
drop constraint if exists assignment_submissions_status_check;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.assignment_submissions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.assignment_submissions drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.assignment_submissions
add constraint assignment_submissions_status_check
check (status in ('submitted', 'approved', 'changes_requested', 'rejected', 'resubmitted'));

alter table public.assignment_submissions
drop constraint if exists assignment_submissions_grade_range_check;

alter table public.assignment_submissions
drop constraint if exists assignment_submissions_grade_check;

alter table public.assignment_submissions
add constraint assignment_submissions_grade_check
check (grade is null or (grade >= 0 and grade <= 100));

create index if not exists idx_assignment_submissions_assignment_id
on public.assignment_submissions(assignment_id);

create index if not exists idx_assignment_submissions_student_id
on public.assignment_submissions(student_id);

create index if not exists idx_assignment_submissions_reviewed_by
on public.assignment_submissions(reviewed_by);

-- Course ownership columns are used to limit instructor review access to
-- submissions from courses they own/teach.
alter table public.courses
add column if not exists created_by uuid references public.users(id) on delete set null;

alter table public.courses
add column if not exists instructor_id uuid references public.users(id) on delete set null;

create index if not exists idx_courses_created_by
on public.courses(created_by);

create index if not exists idx_courses_instructor_id
on public.courses(instructor_id);

-- ==================================================
-- Helper functions used by RLS
-- ==================================================

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_profile_id() to authenticated;

create or replace function public.can_review_assignment_submission(submission_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users reviewer
    where reviewer.id = public.current_profile_id()
      and reviewer.status = 'active'
      and reviewer.role = 'admin'
  )
  or exists (
    select 1
    from public.assignment_submissions submission
    join public.module_assignments assignment
      on assignment.id = submission.assignment_id
    join public.modules module
      on module.id = assignment.module_id
    join public.courses course
      on course.id = module.course_id
    join public.users reviewer
      on reviewer.id = public.current_profile_id()
    where submission.id = submission_uuid
      and reviewer.status = 'active'
      and reviewer.role = 'instructor'
      and (
        course.created_by = reviewer.id
        or course.instructor_id = reviewer.id
      )
  )
$$;

grant execute on function public.can_review_assignment_submission(uuid) to authenticated;

-- Prevent students from modifying review-only fields on their own submissions.
-- Students can still submit/resubmit through the existing app flow.
create or replace function public.prevent_student_review_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile uuid;
begin
  current_profile := public.current_profile_id();

  if public.can_review_assignment_submission(old.id) then
    return new;
  end if;

  if old.student_id = current_profile then
    if new.grade is distinct from old.grade
      or new.feedback is distinct from old.feedback
      or new.admin_feedback is distinct from old.admin_feedback
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.graded_at is distinct from old.graded_at
    then
      raise exception 'Students cannot update review fields on assignment submissions.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists prevent_student_review_field_changes_trigger on public.assignment_submissions;
create trigger prevent_student_review_field_changes_trigger
before update on public.assignment_submissions
for each row
execute function public.prevent_student_review_field_changes();

-- ==================================================
-- RLS policies
-- ==================================================

alter table public.assignment_submissions enable row level security;

drop policy if exists "Students can read own assignment submissions" on public.assignment_submissions;
create policy "Students can read own assignment submissions"
on public.assignment_submissions
for select
to authenticated
using (student_id = public.current_profile_id());

drop policy if exists "Students can create own assignment submissions" on public.assignment_submissions;
create policy "Students can create own assignment submissions"
on public.assignment_submissions
for insert
to authenticated
with check (student_id = public.current_profile_id());

drop policy if exists "Students can update own assignment submissions" on public.assignment_submissions;
create policy "Students can update own assignment submissions"
on public.assignment_submissions
for update
to authenticated
using (student_id = public.current_profile_id())
with check (student_id = public.current_profile_id());

drop policy if exists "Admins and course instructors can read assignment submissions" on public.assignment_submissions;
create policy "Admins and course instructors can read assignment submissions"
on public.assignment_submissions
for select
to authenticated
using (public.can_review_assignment_submission(id));

drop policy if exists "Admins and course instructors can review assignment submissions" on public.assignment_submissions;
create policy "Admins and course instructors can review assignment submissions"
on public.assignment_submissions
for update
to authenticated
using (public.can_review_assignment_submission(id))
with check (public.can_review_assignment_submission(id));
