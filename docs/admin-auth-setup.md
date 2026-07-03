# Nutripro admin auth setup

This project now supports:

- Supabase Auth sign-in with email or username
- forced password change on first login
- admin-created users through a secure Supabase Edge Function
- admin password reset through the same Edge Function
- launch-seeding of the first Admin and Student accounts with a server-side script

Required frontend environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_ADMIN_FUNCTION_NAME=admin-user-management`

Required Supabase Edge Function secrets:

- `NUTRIPRO_SUPABASE_URL`
- `NUTRIPRO_SUPABASE_ANON_KEY`
- `NUTRIPRO_SERVICE_ROLE_KEY`

Required local-only environment variables for the launch seed script:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NUTRIPRO_ADMIN_TEMP_PASSWORD`
- `NUTRIPRO_STUDENT_TEMP_PASSWORD`

Deploy the function:

```bash
supabase functions deploy admin-user-management
```

Run the SQL setup file:

- `supabase/sql/admin_auth_setup.sql`

Run the launch seed script locally after the SQL is in place:

```bash
node scripts/seed-launch-users.mjs
```

Important:

- Do not put `NUTRIPRO_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in Vercel frontend environment variables.
- The service role key belongs only in Supabase Edge Function secrets or another secure backend.
- This setup uses `public.users.auth_user_id` as the safe bridge to `auth.users.id`, so your existing `public.users.id` values can stay in place.
