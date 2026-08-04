-- Student video viewed progress support.
-- This migration is idempotent and does not delete or overwrite existing progress rows.
-- It allows the frontend to persist "Mark video as viewed" separately from full lesson completion.

alter table if exists public.student_progress
add column if not exists updated_at timestamptz default now();

alter table if exists public.student_progress
add column if not exists video_viewed boolean not null default false;

alter table if exists public.student_progress
add column if not exists video_viewed_at timestamptz;

-- Keep updated_at populated for existing rows.
update public.student_progress
set updated_at = now()
where updated_at is null;

-- Backfill video_viewed from legacy video_completed data only if that legacy column exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_progress'
      and column_name = 'video_completed'
  ) then
    update public.student_progress
    set
      video_viewed = true,
      video_viewed_at = coalesce(video_viewed_at, updated_at, now()),
      updated_at = coalesce(updated_at, now())
    where coalesce(video_completed, false) = true;
  end if;
end $$;

-- Add a uniqueness guard for student/module upserts only when it is safe.
-- If duplicate student/module progress rows already exist, this block skips
-- the index and prints a notice so duplicates can be reviewed manually first.
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
