-- Run this once in the Supabase dashboard's SQL Editor for this project.
-- Reports are treated as immutable snapshots: no update policy is defined.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  headline text not null check (char_length(trim(headline)) > 0 and char_length(headline) <= 200),
  report_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

create policy "select own reports" on reports
  for select using (auth.uid() = user_id);

create policy "insert own reports" on reports
  for insert with check (auth.uid() = user_id);

create policy "delete own reports" on reports
  for delete using (auth.uid() = user_id);

create index if not exists reports_user_id_created_at_idx on reports (user_id, created_at desc);
