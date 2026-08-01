-- ============================================================
--  Migration 002 — remember the order players were added in
--  Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table session_players
  add column if not exists position integer not null default 0;

-- Existing rows all default to 0, which would tie. Give them a stable
-- order based on when they were created so old sessions stop shuffling.
with ranked as (
  select
    id,
    row_number() over (
      partition by session_id
      order by created_at, id
    ) - 1 as new_position
  from session_players
)
update session_players sp
set position = ranked.new_position
from ranked
where sp.id = ranked.id
  and sp.position = 0;

create index if not exists idx_session_players_position
  on session_players(session_id, position);
