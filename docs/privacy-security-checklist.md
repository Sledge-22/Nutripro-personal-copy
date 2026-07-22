# Nutripro privacy & security checklist

Completed frontend checks

- Community posts/comments only use safe author display fields:
  - name
  - role
  - profile picture
  - country code/name/flag
- Community display does not render:
  - email
  - auth_user_id
  - account status
  - last_login_at
  - password reset fields
  - privacy consent fields
- Student profile page is self-only through the current signed-in user flow.
- Student course detail access uses the active student identity and enrollment checks.
- Student progress, certificates, and assignment submission views are scoped to the logged-in student flow.
- Admin routes remain separated from student routes in frontend routing and access checks.
- Audit log sanitization removes sensitive keys recursively.
- Audit CSV export sanitizes sensitive keys before download.
- No service role key is exposed in frontend code.
- No plaintext passwords are stored in `public.users`.
- Demo Mode has been removed.
- Production login is required.

Frontend query hygiene completed

- Tightened several broad Supabase selects in user-facing or privacy-sensitive paths:
  - community posts/comments/votes
  - certificates
  - student/course-related enrollment reads
  - auth/profile user lookups

GDPR request workflow status

- GDPR request tracker exists in Admin Settings → Privacy & Data Requests.
- User data export exists as a JSON download for admin-handled requests.
- Deletion/anonymization is tracked for manual review only in the current version.
- Hard deletion is not automated yet.
- Supabase Auth deletion remains a manual task or a future Edge Function workflow.
- Audit logs record GDPR request actions without exporting sensitive payload contents.

Manual Supabase / RLS review still required

- Frontend route protection improves the user experience, but Supabase Row Level Security policies or secure Edge Functions are still needed for production-grade enforcement.
- Confirm RLS prevents students from reading:
  - other students' `public.users` rows
  - other students' assignment submissions
  - other students' progress
  - other students' certificates
  - admin audit logs
- Confirm only admins can read/write:
  - admin audit logs
  - user management fields such as role/status
  - course builder / assignment review / certificate management flows
- Confirm community tables only expose intended rows and fields through RLS or safe views.
- Confirm no unsafe public write policies exist.

Optional SQL idea if a safe public profile view is useful later

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

Do not include in public-safe profile views

- email
- auth_user_id
- status for private account management purposes
- last_login_at
- password reset fields
- privacy consent fields
- invitation tokens or security tokens
