-- ============================================================
--  Pokeresh — database schema
--  Run this once in the Supabase SQL Editor.
--  Safe to re-run: everything is guarded with IF NOT EXISTS.
-- ============================================================

-- ---------- Tables ----------

-- Roster of players. Stats key off `id`, never off the name,
-- so renaming someone never orphans their history.
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nickname    text,
  photo_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One poker night.
-- `house_fee_per_player` is stored per session so raising the fee
-- later never rewrites historical games.
create table if not exists sessions (
  id                    uuid primary key default gen_random_uuid(),
  started_at            timestamptz not null default now(),
  ended_at              timestamptz,
  status                text not null default 'setup'
                        check (status in ('setup','live','tally','complete')),
  house_fee_per_player  integer not null default 0,
  host_player_id        uuid references players(id) on delete set null,
  is_backfill           boolean not null default false,
  created_at            timestamptz not null default now()
);

-- Who played on a given night.
-- `display_name` snapshots the nickname at the time so an old
-- session's summary image stays accurate after a rename.
create table if not exists session_players (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  player_id       uuid not null references players(id) on delete restrict,
  display_name    text not null,
  chips_left      integer,
  pays_house_fee  boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (session_id, player_id)
);

-- Individual buy-ins. `created_at` drives tilt detection.
create table if not exists buy_ins (
  id                 uuid primary key default gen_random_uuid(),
  session_player_id  uuid not null references session_players(id) on delete cascade,
  amount             integer not null check (amount > 0),
  created_at         timestamptz not null default now()
);

-- Single-row settings table (display password, last-used house fee).
create table if not exists app_settings (
  id                    integer primary key default 1,
  display_password      text,
  last_house_fee        integer not null default 0,
  updated_at            timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ---------- Indexes ----------

create index if not exists idx_session_players_session on session_players(session_id);
create index if not exists idx_session_players_player  on session_players(player_id);
create index if not exists idx_buy_ins_session_player  on buy_ins(session_player_id);
create index if not exists idx_sessions_started_at     on sessions(started_at desc);
create index if not exists idx_sessions_status         on sessions(status);

-- ---------- Row Level Security ----------
-- Everything is locked down. Only a signed-in user (you) can touch data.
-- The public /display route gets its own read policies in a later phase.

alter table players         enable row level security;
alter table sessions        enable row level security;
alter table session_players enable row level security;
alter table buy_ins         enable row level security;
alter table app_settings    enable row level security;

-- Helper: drop-and-recreate so this file stays re-runnable.
drop policy if exists "authenticated full access" on players;
create policy "authenticated full access" on players
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on sessions;
create policy "authenticated full access" on sessions
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on session_players;
create policy "authenticated full access" on session_players
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on buy_ins;
create policy "authenticated full access" on buy_ins
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on app_settings;
create policy "authenticated full access" on app_settings
  for all to authenticated using (true) with check (true);

-- ---------- Storage bucket for player photos ----------

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- Anyone can view a photo (URLs are unguessable UUIDs).
drop policy if exists "public read player photos" on storage.objects;
create policy "public read player photos" on storage.objects
  for select to public using (bucket_id = 'player-photos');

-- Only you can upload / replace / delete.
drop policy if exists "authenticated write player photos" on storage.objects;
create policy "authenticated write player photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'player-photos');

drop policy if exists "authenticated update player photos" on storage.objects;
create policy "authenticated update player photos" on storage.objects
  for update to authenticated using (bucket_id = 'player-photos');

drop policy if exists "authenticated delete player photos" on storage.objects;
create policy "authenticated delete player photos" on storage.objects
  for delete to authenticated using (bucket_id = 'player-photos');
