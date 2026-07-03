# Nutripro admin auth setup

This project now supports:

- Supabase Auth sign-in with email or username
- forced password change on first login
- admin-created users through a secure Supabase Edge Function
- admin password reset through the same Edge Function

Required frontend environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_ADMIN_FUNCTION_NAME=admin-user-management`

Required Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Deploy the function:

```bash
supabase functions deploy admin-user-management
```

Run the SQL setup file:

- `supabase/sql/admin_auth_setup.sql`

Important:

- Do not put `SUPABASE_SERVICE_ROLE_KEY` in Vercel frontend environment variables.
- The service role key belongs only in Supabase Edge Function secrets or another secure backend.
- If `public.users.id` is not already aligned with `auth.users.id`, migrate that before production rollout.
