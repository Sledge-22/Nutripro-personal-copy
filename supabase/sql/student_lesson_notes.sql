-- Private student lesson/module notes.
-- Run after the auth/RLS helpers exist:
-- public.current_profile_id() and public.is_admin().

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
