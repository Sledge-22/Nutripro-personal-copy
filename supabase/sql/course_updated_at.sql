-- Add a safe updated_at column to courses for pages/features that want
-- last-modified timestamps. This migration is idempotent and does not
-- delete or overwrite existing course data.

alter table public.courses
add column if not exists updated_at timestamptz default now();

-- Backfill updated_at from created_at when possible so existing courses
-- have a useful timestamp without changing their ownership or content.
update public.courses
set updated_at = created_at
where updated_at is null
  and created_at is not null;

-- Final fallback for any rows without created_at.
update public.courses
set updated_at = now()
where updated_at is null;
