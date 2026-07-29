-- Nutripro Course Builder module/lesson fields.
-- Idempotent and non-destructive: existing rows and columns are preserved.
alter table public.modules
  add column if not exists lesson_content text,
  add column if not exists pdf_url text,
  add column if not exists video_url text,
  add column if not exists embed_url text,
  add column if not exists image_url text,
  add column if not exists requires_assignment boolean not null default false,
  add column if not exists assignment_instructions text,
  add column if not exists status text not null default 'draft',
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

