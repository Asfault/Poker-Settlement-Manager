-- ============================================================
--  Migration 014 — active roster in the shared payload
--  Run in the Supabase SQL Editor. Safe to re-run.
--
--  At the start of a season there are no sessions, so there are no
--  players either — the shared page had nothing to draw and showed an
--  empty message, which reads as broken rather than as a season about to
--  begin.
--
--  This adds the active roster so the page can show everyone on ₹0. It's
--  names and photos only: no history, no totals, nothing that would leak
--  across the season boundary.
-- ============================================================

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
  roster jsonb;
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

  -- Active roster only. Archived players stop appearing on the shared
  -- side entirely, the same way they drop out of the leaderboard.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', pl.id,
        'name', pl.name,
        'photo_url', pl.photo_url
      )
      order by pl.name
    ), '[]'::jsonb
  ) into roster
  from players pl
  where pl.is_active = true;

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
    'roster', roster,
    'seasons_start_from', seasons_from,
    'season_meta', meta,
    'season_exclusions', exclusions,
    'server_time', now()
  );
end;
$$;

revoke all on function shared_stats_payload(text, text) from public;
grant execute on function shared_stats_payload(text, text) to anon, authenticated;
