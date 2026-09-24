-- ============================================================
--  Migration 013 — seasons
--  Run in the Supabase SQL Editor. Safe to re-run.
--
--  Seasons are DERIVED FROM THE DATE, not stored as rows with start and
--  end dates:
--
--    Winter  Dec – Feb      Summer   Mar – May
--    Monsoon Jun – Aug      Autumn   Sep – Nov
--
--  A session's season comes from its `started_at`, so there is no season
--  to start, end, or forget to start. That was the deciding factor: a
--  manual system needs an action twice every three months and failing to
--  take it is silent — a night gets played and belongs to nowhere.
--
--  The flexibility that a manual system would have bought is covered by
--  `season_meta` instead. A thin season isn't fixed by moving dates
--  (which erases what happened); it's recorded with a note and, if it
--  deserves no champion, the no_winner flag.
--
--  What IS stored here is only what can't be computed: the date seasons
--  begin from, per-season annotations, and disqualifications.
-- ============================================================

-- ---------- Where seasons begin ----------
-- Sessions before this belong to no season. They stay visible in the
-- host's All time view and never reach the shared link.

alter table app_settings
  add column if not exists seasons_start_from date;

-- ---------- Per-season annotations ----------
-- `season_id` is derived, e.g. '2026-autumn' or '2025-winter' (winter is
-- keyed on the year it STARTS in, since it spans a year boundary).

create table if not exists season_meta (
  season_id    text primary key,
  -- Overrides the generated label. "The Great Collapse" instead of
  -- "Autumn 2026".
  custom_name  text,
  -- Shown on the shared page and in the hall of fame.
  note         text,
  -- Suppresses the award regardless of the standings — for a season too
  -- thin to deserve a champion.
  no_winner    boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- ---------- Disqualifications ----------
-- The one judgement in the whole design, so the one thing stored per
-- player. A disqualified player still appears in the standings; they're
-- just not eligible for the award.

create table if not exists season_exclusions (
  season_id   text not null,
  player_id   uuid not null references players(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (season_id, player_id)
);

create index if not exists idx_season_exclusions_season
  on season_exclusions(season_id);

-- ---------- Row Level Security ----------

alter table season_meta       enable row level security;
alter table season_exclusions enable row level security;

drop policy if exists "authenticated full access" on season_meta;
create policy "authenticated full access" on season_meta
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on season_exclusions;
create policy "authenticated full access" on season_exclusions
  for all to authenticated using (true) with check (true);

-- ---------- Data API grants ----------
-- Supabase stopped auto-granting table access on 2026-10-30. Without these,
-- a fresh database (new project, branch, `supabase db reset`) leaves the
-- table unreachable from supabase-js. RLS above is still what decides who
-- can see which rows; grants only decide whether the API can try at all.
-- Idempotent, so safe to re-run on the live project.
grant select, insert, update, delete on public.season_meta to anon, authenticated, service_role;
grant select, insert, update, delete on public.season_exclusions to anon, authenticated, service_role;

-- ---------- Shared payload ----------
--
--  The shared page needs the season boundary date, the annotations and
--  the exclusions to work out its own scope and winner. It already
--  receives every completed session; it filters them client-side using
--  the same code the host page uses, so the two can't disagree.
--
--  Only what's needed is exposed: no house fees, no expenses, and
--  nothing about sessions before `seasons_start_from` beyond the rows
--  themselves, which the client discards.

create or replace function shared_stats_payload(p_slug text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  seasons_from date;
  meta jsonb;
  exclusions jsonb;
begin
  if not shared_stats_ok(p_slug, p_password) then
    return jsonb_build_object('ok', false);
  end if;

  select a.seasons_start_from into seasons_from
  from app_settings a where a.id = 1;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into meta
  from season_meta m;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into exclusions
  from season_exclusions e;

  select coalesce(jsonb_agg(y order by y.started_at desc), '[]'::jsonb)
  into result
  from (
    select
      s.id,
      s.started_at,
      s.ended_at,
      s.is_backfill,
      s.house_fee_per_player,
      s.host_player_id,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'player_id', sp.player_id,
              'display_name', sp.display_name,
              'chips_left', sp.chips_left,
              'position', sp.position,
              'pays_house_fee', sp.pays_house_fee,
              'players', jsonb_build_object(
                'name', pl.name,
                'photo_url', pl.photo_url,
                'is_active', pl.is_active
              ),
              'buy_ins', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'amount', b.amount,
                      'created_at', b.created_at
                    )
                    order by b.created_at
                  )
                  from buy_ins b
                  where b.session_player_id = sp.id
                ), '[]'::jsonb
              )
            )
            order by sp.position, pl.name
          )
          from session_players sp
          join players pl on pl.id = sp.player_id
          where sp.session_id = s.id
        ), '[]'::jsonb
      ) as session_players
    from sessions s
    where s.status = 'complete'
      and (seasons_from is null or s.started_at >= seasons_from)
  ) y;

  return jsonb_build_object(
    'ok', true,
    'sessions', result,
    'seasons_start_from', seasons_from,
    'season_meta', meta,
    'season_exclusions', exclusions,
    'server_time', now()
  );
end;
$$;

revoke all on function shared_stats_payload(text, text) from public;
grant execute on function shared_stats_payload(text, text) to anon, authenticated;

-- Set the date seasons begin from, e.g.:
-- update app_settings set seasons_start_from = '2026-09-01' where id = 1;
