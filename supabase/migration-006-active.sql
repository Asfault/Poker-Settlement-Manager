-- ============================================================
--  Migration 006 — expose is_active to the display
--  Run once in the Supabase SQL Editor. Safe to re-run.
--
--  Archived players stay in the leaderboard and in historical sessions
--  (so totals still reconcile), but the display stops generating
--  did-you-know content about someone who no longer plays.
-- ============================================================

create or replace function display_payload(pw text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  live_session jsonb;
  history jsonb;
begin
  if not display_password_ok(pw) then
    return jsonb_build_object('ok', false);
  end if;

  select (display_live(pw) -> 'live') into live_session;

  select coalesce(jsonb_agg(y order by y.started_at desc), '[]'::jsonb)
  into history
  from (
    select
      s.id,
      s.started_at,
      s.ended_at,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'player_id', sp.player_id,
              'name', pl.name,
              'nickname', pl.nickname,
              'photo_url', pl.photo_url,
              'character_url', pl.character_url,
              'is_active', pl.is_active,
              'total_buy_in', coalesce(
                (select sum(b.amount) from buy_ins b
                 where b.session_player_id = sp.id), 0
              ),
              'chips_left', coalesce(sp.chips_left, 0),
              'buy_in_count', (
                select count(*) from buy_ins b
                where b.session_player_id = sp.id
              ),
              'buy_in_times', coalesce(
                (
                  select jsonb_agg(b.created_at order by b.created_at)
                  from buy_ins b where b.session_player_id = sp.id
                ), '[]'::jsonb
              )
            )
            order by sp.position, pl.name
          )
          from session_players sp
          join players pl on pl.id = sp.player_id
          where sp.session_id = s.id
        ), '[]'::jsonb
      ) as players
    from sessions s
    where s.status = 'complete'
  ) y;

  return jsonb_build_object(
    'ok', true,
    'live', live_session,
    'history', history,
    'server_time', now()
  );
end;
$$;

revoke all on function display_payload(text) from public;
grant execute on function display_payload(text) to anon, authenticated;
