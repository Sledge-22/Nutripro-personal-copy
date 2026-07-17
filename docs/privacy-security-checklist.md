# Nutripro privacy and security checklist

This checklist is a working technical review. It is not legal advice and does not replace formal GDPR review.

## Product/privacy checks

- `/privacy` exists and is available in Spanish and English.
- Production users must accept the privacy notice before entering the dashboard.
- Demo access is not blocked by the privacy consent step.
- Privacy consent is intended to be stored on `public.users` using:
  - `privacy_policy_accepted`
  - `privacy_policy_accepted_at`
  - `privacy_policy_version`
- Current policy version: `2026-07-draft`

## Profile data exposure checks completed in code

- Community UI uses safe author snapshot fields such as:
  - display name
  - role label
  - country badge
  - profile image/avatar
- Community UI does not intentionally render:
  - email
  - `auth_user_id`
  - account status
  - `last_login_at`
  - password change timestamps
  - consent timestamps
- Student profile editing remains scoped to the current student flow in the app.
- Demo users do not write non-UUID ids into UUID columns in the profile save flow.

## Supabase / RLS checks still requiring manual verification

- `public.users` should not be openly readable with all columns by anonymous users.
- Students should only read/update their own private profile row.
- Admins should be the only role allowed to manage all users.
- `site_settings` writes should remain admin-only under production auth.
- Community data should use safe author snapshots or a limited public profile projection.
- Assignment submission buckets should not be publicly readable.
- Private assignment files should only be accessible to the intended student/admin flows.
- Course/admin uploads should be reviewed bucket-by-bucket for public vs private access.

## Secrets and auth checks

- Supabase service role key must never be exposed in frontend code.
- Passwords must never be stored in `public.users`.
- Password verification must remain inside Supabase Auth.
- Invitation email secrets must remain server-side only.

## Recommended SQL follow-up

```sql
alter table public.users
add column if not exists privacy_policy_accepted boolean default false,
add column if not exists privacy_policy_accepted_at timestamptz,
add column if not exists privacy_policy_version text;
```

## Optional safer public profile view

Use a limited view for public/community-facing profile reads instead of exposing full `public.users`:

```sql
create or replace view public.public_user_profiles as
select
  id,
  name,
  username,
  role,
  country_code,
  country_name,
  country_flag,
  profile_picture_url
from public.users
where status = 'active';
```

Do not include:

- `email`
- `auth_user_id`
- `must_change_password`
- `password_updated_at`
- `last_login_at`
- internal admin notes

## Manual QA checklist

- Unauthenticated visitor cannot view private user data from the UI.
- Student cannot access admin user management.
- Student cannot view another student's email or private profile details.
- Student cannot access assignment submissions belonging to others.
- Community post cards only show safe author fields.
- Privacy consent checkbox is unchecked by default.
- User cannot continue production setup without accepting the privacy notice.
- Consent timestamp and version save correctly after acceptance.
- Privacy page loads correctly in Spanish and English.
- Demo Admin access still works.
- Demo Student access still works.
