-- Certificate schema compatibility for assignment review certificate checks.
-- Idempotent: safe to run multiple times.
-- This script does not delete, truncate, or wipe certificate/submission/progress data.

-- Optional display columns used by the Nutripro certificate UI and automatic
-- certificate generation after an approved assignment review.
alter table public.certificates
add column if not exists student_name text;

alter table public.certificates
add column if not exists course_title text;

alter table public.certificates
add column if not exists issued_at timestamptz default now();

alter table public.certificates
add column if not exists updated_at timestamptz default now();

-- Backfill updated_at for existing certificate rows without changing certificate
-- ownership, numbers, files, or issue data.
update public.certificates
set updated_at = now()
where updated_at is null;
