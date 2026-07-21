create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action text not null,
  target_type text not null,
  target_id text,
  target_email text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_admin_email_idx
on public.admin_audit_logs (admin_email);

create index if not exists admin_audit_logs_target_email_idx
on public.admin_audit_logs (target_email);
