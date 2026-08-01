-- ============================================================
--  Migration 004 — sessions shared from the public app
--  Run once in the Supabase SQL Editor. Safe to re-run.
--
--  Deliberately a separate table from `sessions`. Other people's games
--  must never mix into your roster, your stats, or the display.
-- ============================================================

create table if not exists shared_sessions (
  id            uuid primary key default gen_random_uuid(),
  received_at   timestamptz not null default now(),
  started_at    timestamptz,
  ended_at      timestamptz,
  player_count  integer not null default 0,
  total_pot     integer not null default 0,
  /** Full session: players, buy-ins with timestamps, chips, settlements. */
  payload       jsonb not null,
  user_agent    text
);

create index if not exists idx_shared_sessions_received
  on shared_sessions(received_at desc);

alter table shared_sessions enable row level security;

-- Anyone using the public app can send a session in...
drop policy if exists "public can share a session" on shared_sessions;
create policy "public can share a session" on shared_sessions
  for insert to anon, authenticated with check (true);

-- ...but only you can read them back.
drop policy if exists "host reads shared sessions" on shared_sessions;
create policy "host reads shared sessions" on shared_sessions
  for select to authenticated using (true);

drop policy if exists "host deletes shared sessions" on shared_sessions;
create policy "host deletes shared sessions" on shared_sessions
  for delete to authenticated using (true);
