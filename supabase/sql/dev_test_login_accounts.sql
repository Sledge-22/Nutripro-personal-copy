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
