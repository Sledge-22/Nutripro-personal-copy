# Nutripro Supabase RLS and database security review

Last updated: July 21, 2026

This is a planning and review document for Step 7.

Core security principle

- Frontend route protection improves the user experience, but production data security must be enforced with Supabase Row Level Security policies, database views, or secure Edge Functions.
- The app should not be considered production-secure only because React routes are protected.

Current status

- Production login is active.
- Demo Mode has been removed.
- No service role key is exposed in frontend code.
- No plaintext passwords are stored in `public.users`.
- Some privacy-sensitive frontend queries were already tightened.
- RLS still needs manual review and rollout in Supabase before production hardening is complete.

Tables reviewed

## `public.users`

What it stores

- app profile row matched to Supabase Auth
- name, email, username
- role, status
- profile picture, country, bio
- privacy consent state
- invitation / onboarding state
- login / password-change metadata

Sensitive fields

- `email`
- `auth_user_id`
- `role`
- `status`
- `last_login_at`
- `must_change_password`
- `password_updated_at`
- `privacy_policy_accepted`
- `privacy_policy_accepted_at`
- `privacy_policy_version`
- `privacy_consent_reminder_dismissed`
- `privacy_consent_reminder_dismissed_at`

Recommended access

- user can read own row
- user can update only safe own-profile fields
- admins can read/update users for management
- students should not read other users' private rows
- community should not read directly from full `public.users`

RLS

- should be enabled

Recommended approach

- use `public.users` for authenticated admin/self profile logic
- use a safe public profile view for community display

Safer public profile view proposal

```sql
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
```

Do not expose in public-safe profile views

- `email`
- `auth_user_id`
- `status`
- `last_login_at`
- password reset / onboarding fields
- privacy consent fields

## `public.courses`

What it stores

- course title, description, status
- optional image fields

Recommended access

- admins can create/update/delete all courses
- students can only read published courses they are enrolled in
- students should not update courses

RLS

- should be enabled

## `public.modules`

What it stores

- module title, description, sort order
- pdf/video URLs and storage metadata
- external media link fields
- assignment requirement flag

Recommended access

- admins manage all modules
- students read modules only for courses they are enrolled in
- students should not write modules

RLS

- should be enabled

## `public.enrollments`

What it stores

- `student_id`
- `course_id`
- `status`
- enrollment timestamps

Recommended access

- students read only rows where `student_id = current_profile_id()`
- admins manage all rows
- students must not insert/update/delete enrollments directly

RLS

- should be enabled

## `public.student_progress`

What it stores

- per-student module completion / progress data

Recommended access

- students can read/update only their own progress
- admins can read progress where needed

RLS

- should be enabled

## `public.module_assignments`

What it stores

- assignment title / instructions
- bilingual content fields
- module linkage
- submission type / assignment config

Recommended access

- admins manage all assignments
- students can read assignments only for enrolled course modules

RLS

- should be enabled

## `public.assignment_submissions`

What it stores

- student submission metadata
- file path / file public URL / file type / file size
- grade
- admin feedback
- review timestamps

Recommended access

- students can create/read only their own submissions
- students must not read other students' submissions
- admins can read/review/update all submissions

RLS

- should be enabled

Storage note

- assignment submission files should be private
- do not rely on public bucket access for grading files in production

## `public.certificates`

What it stores

- student certificate records
- course title / course id
- certificate number
- issue date / status

Recommended access

- students read only their own certificates
- admins manage all certificates

RLS

- should be enabled

## `public.community_posts`

What it stores

- community post content
- author display fields
- moderation flags
- optional PDF attachment metadata

Recommended access

- authenticated users can read visible posts
- users can create posts as themselves
- users can update/delete their own posts only if allowed by product rules
- admins can moderate all posts
- removed posts should stay hidden from student feed

RLS

- should be enabled

## `public.community_comments`

What it stores

- comment body
- author display fields
- moderation fields

Recommended access

- authenticated users can read visible comments
- users can create comments as themselves
- users can edit/delete only own comments if allowed
- admins can moderate all comments

RLS

- should be enabled

## `public.community_votes`

What it stores

- per-user vote records for posts/comments

Recommended access

- authenticated users can read or write only what is necessary for vote state
- users should only create/update/delete their own vote row
- admins typically do not need broad write access here

RLS

- should be enabled if the table remains active

Note

- if voting is no longer a visible product feature, this table should still be locked down

## `public.admin_audit_logs`

What it stores

- admin action name
- target id / target type / target email
- safe details JSON
- admin user id

Recommended access

- admins can read audit logs
- admins can insert audit logs
- students cannot read logs

RLS

- should be enabled

Security note

- audit log payloads must never include passwords, tokens, service keys, or secrets

## `public.site_settings`

What it stores

- site-level settings rows

Recommended access

- admins read/update only
- public visitors must not write settings

RLS

- should be enabled if table remains in use

Note

- `site_access_mode` is legacy cleanup territory and should be reviewed separately later

## `public.course_drafts`

What it stores

- saved course draft payloads

Recommended access

- admins read/write only their intended drafts
- if drafts are shared admin resources, admins can manage all
- students should not access drafts

RLS

- should be enabled

## `public.community_votes`

Reviewed because it still appears in code paths and should not be openly accessible even if no longer central to the UI.

## Supabase Auth helper functions recommended

Use database helper functions to simplify policies:

```sql
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
```

Important note for `public.users`

- own-profile update policies alone are not enough to safely limit what columns a student may change
- students must not be able to change:
  - `role`
  - `status`
  - `auth_user_id`
  - onboarding flags
  - privacy audit fields that should stay system-controlled
- in production, consider:
  - a secure Edge Function for self-profile updates
  - or a database trigger/check approach

Storage bucket review

Buckets found in code

- `module-pdfs`
- `module-videos`
- `assignment-submissions`
- `community-pdfs`
- `profile-pictures`
- `course-images`

Recommended access review

## `module-pdfs`

- likely public or authenticated-read only if students need direct browser access
- admins upload/manage
- if made private later, signed URLs or protected download flow will be needed

## `module-videos`

- same review as module PDFs
- if private, use signed URLs instead of public object URLs

## `assignment-submissions`

- should be private
- student uploads own submission
- student reads own submission
- admins read for grading

## `community-pdfs`

- can be authenticated-readable if community is only for logged-in users
- review whether public exposure is acceptable

## `profile-pictures`

- public read is usually acceptable if avatars are intended to display broadly
- writes should be limited to own profile or admins

## `course-images`

- public read is usually acceptable for course cards
- writes should be admin-only

Query review completed in this step

Tightened broad read-side queries where low-risk and safe:

- `src/services/userService.js`
  - `getUsers()` now uses explicit profile columns
  - `getUserById()` now uses explicit profile columns
- `src/services/enrollmentService.js`
  - enrollment reads now request explicit columns
- `src/services/courseDraftService.js`
  - draft reads now request explicit columns
- `src/services/moduleService.js`
  - module reads now request explicit columns
- `src/services/courseService.js`
  - course reads now request explicit columns

Remaining broad selects still needing later review

- admin-heavy write/update flows that return full rows after mutation
- assignment service aggregation queries
- some community mutation return paths
- certificate mutation return paths

These were left alone in this step to avoid breaking working flows unnecessarily.

Manual Supabase work still required

1. Review and adapt the SQL draft in `supabase/sql/rls_policy_draft.sql`
2. Confirm exact table schemas match the policy draft
3. Enable RLS table-by-table in a staging project first
4. Test Admin and Student flows after each table policy group
5. Add storage bucket policies separately from table RLS
6. Decide whether community author display should move fully to `public.public_user_profiles`
7. Decide whether self-profile updates should move behind a secure Edge Function

Manual test checklist

1. Logged-out user cannot access app data.
2. Student cannot access Admin routes.
3. Student cannot read User Management data.
4. Student can read only own profile.
5. Student can read only own enrollments.
6. Student can read only own assignments/submissions.
7. Student can read only own certificates.
8. Admin can access User Management.
9. Admin can access Audit Logs.
10. Audit Logs do not expose secrets.
11. Community does not show `email`, `auth_user_id`, `status`, reset fields, or privacy fields.
12. Assignment submission files are not publicly exposed unless intentionally designed that way.
13. Service role key is not present in frontend env/code.

What this step does not do

- does not auto-enable RLS
- does not auto-apply SQL
- does not add GDPR export/delete workflows
- does not redesign app flows
- does not move all writes to Edge Functions yet
