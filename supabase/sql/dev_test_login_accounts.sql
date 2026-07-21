-- Nutripro temporary development login accounts
-- These accounts are for development/testing only and must be removed or disabled before launch.
-- Passwords are NOT stored here. Create the matching Supabase Auth users from the Supabase Dashboard
-- or another secure server-side flow, then run this script to seed/update public.users profile rows.

insert into public.users (
  name,
  email,
  username,
  role,
  status,
  must_change_password,
  password_updated_at
)
values
  (
    'Alex Morgan',
    'admin@nutripro.test',
    'admin',
    'admin',
    'active',
    false,
    null
  ),
  (
    'Student Test',
    'student@nutripro.test',
    'student',
    'student',
    'active',
    false,
    null
  )
on conflict (email)
do update set
  name = excluded.name,
  username = excluded.username,
  role = excluded.role,
  status = excluded.status,
  must_change_password = excluded.must_change_password,
  password_updated_at = excluded.password_updated_at;

-- Link the temporary development accounts to their real Supabase Auth users
-- after those auth accounts have been created. This keeps admin checks,
-- route protection, and user-management status updates working correctly.
update public.users as profile
set auth_user_id = auth_user.id
from auth.users as auth_user
where lower(profile.email) = lower(auth_user.email)
  and lower(profile.email) in ('admin@nutripro.test', 'student@nutripro.test')
  and (profile.auth_user_id is null or profile.auth_user_id <> auth_user.id);
