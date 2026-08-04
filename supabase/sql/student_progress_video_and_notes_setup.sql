-- Student lesson progress + private notes setup.
-- Idempotent: safe to run multiple times.
-- This script does not delete, truncate, or wipe existing progress/note data.

-- ==================================================
-- Student progress columns used by lesson completion
-- ==================================================

alter table public.student_progress
add column if not exists updated_at timestamptz default now();

alter table public.student_progress
add column if not exists video_viewed boolean not null default false;

alter table public.student_progress
add column if not exists video_viewed_at timestamptz;

alter table public.student_progress
add column if not exists completed_at timestamptz;

alter table public.student_progress
add column if not exists completed boolean default false;

alter table public.student_progress
add column if not exists status text;

alter table public.student_progress
add column if not exists progress_percent integer default 0;

-- Keep updated_at populated for existing rows.
update public.student_progress
set updated_at = now()
where updated_at is null;

-- Backfill normalized completion metadata from legacy module_completed data only if that legacy column exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_progress'
      and column_name = 'module_completed'
  ) then
    update public.student_progress
    set
      completed = true,
      status = coalesce(status, 'completed'),
      completed_at = coalesce(completed_at, updated_at, now()),
      progress_percent = greatest(coalesce(progress_percent, 0), 100),
      updated_at = coalesce(updated_at, now())
    where coalesce(module_completed, false) = true;
  end if;
end $$;

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
-- If duplicates already exist, the index is skipped and a notice is shown.
do $$
begin
  if exists (
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

-- ==================================================
-- Private student lesson notes
-- ==================================================

create table if not exists public.student_lesson_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, module_id)
);

alter table public.student_lesson_notes enable row level security;

drop policy if exists "Students can read own lesson notes" on public.student_lesson_notes;
create policy "Students can read own lesson notes"
on public.student_lesson_notes
for select
to authenticated
using (student_id = public.current_profile_id());

drop policy if exists "Students can create own lesson notes" on public.student_lesson_notes;
create policy "Students can create own lesson notes"
on public.student_lesson_notes
for insert
to authenticated
with check (student_id = public.current_profile_id());

drop policy if exists "Students can update own lesson notes" on public.student_lesson_notes;
create policy "Students can update own lesson notes"
on public.student_lesson_notes
for update
to authenticated
using (student_id = public.current_profile_id())
with check (student_id = public.current_profile_id());

drop policy if exists "Students can delete own lesson notes" on public.student_lesson_notes;
create policy "Students can delete own lesson notes"
on public.student_lesson_notes
for delete
to authenticated
using (student_id = public.current_profile_id());

create index if not exists idx_student_lesson_notes_student_id
on public.student_lesson_notes(student_id);

create index if not exists idx_student_lesson_notes_module_id
on public.student_lesson_notes(module_id);
