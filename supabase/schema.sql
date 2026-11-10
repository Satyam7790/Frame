create extension if not exists "pgcrypto";

create table if not exists public.watch_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  release_date text,
  watched_date date not null,
  rating numeric(3,1) check (rating is null or (rating >= 1 and rating <= 10)),
  notes text,
  overview text,
  genres text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists watch_entries_user_year_idx on public.watch_entries (user_id, watched_date);
create index if not exists watch_entries_title_idx on public.watch_entries (user_id, tmdb_id, media_type);
alter table public.watch_entries enable row level security;

create policy "Read own watch entries" on public.watch_entries for select using (auth.uid() = user_id);
create policy "Add own watch entries" on public.watch_entries for insert with check (auth.uid() = user_id);
create policy "Edit own watch entries" on public.watch_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own watch entries" on public.watch_entries for delete using (auth.uid() = user_id);
