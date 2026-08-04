-- Student lesson progression/completion support.
-- This migration is idempotent and does not delete or overwrite progress rows.
-- It adds optional completion metadata columns that the frontend can use to
-- recognize completed lessons consistently after refresh.

alter table if exists public.student_progress
add column if not exists completed boolean default false,
add column if not exists status text,
add column if not exists completed_at timestamptz,
add column if not exists progress_percent integer default 0,
add column if not exists updated_at timestamptz default now();

-- Backfill normalized completion metadata from existing module_completed values.
update public.student_progress
set
  completed = true,
  status = coalesce(status, 'completed'),
  completed_at = coalesce(completed_at, updated_at, now()),
  progress_percent = greatest(coalesce(progress_percent, 0), 100),
  updated_at = coalesce(updated_at, now())
where coalesce(module_completed, false) = true;

-- Keep updated_at populated for all existing rows.
update public.student_progress
set updated_at = now()
where updated_at is null;

-- Add a uniqueness guard for upserts only when it is safe.
-- If duplicate student/module progress rows already exist, this block skips
-- the index and prints a notice so duplicates can be reviewed manually.
do $$
begin
  if to_regclass('public.student_progress') is null then
    raise notice 'public.student_progress does not exist yet; skipping unique index.';
  elsif exists (
    select 1
    from public.student_progress
    where student_id is not null
      and module_id is not null
    group by student_id, module_id
    having count(*) > 1
  ) then
    raise notice 'Duplicate student_progress rows exist; unique index was not created. Review duplicates manually before adding the index.';
  else
    create unique index if not exists student_progress_student_module_uidx
    on public.student_progress (student_id, module_id);
  end if;
end $$;
