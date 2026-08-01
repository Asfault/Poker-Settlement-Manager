-- ============================================================
--  Migration 005 — character artwork for the display
--  Run once in the Supabase SQL Editor. Safe to re-run.
--
--  Two images per player now:
--    photo_url     — square, circular, used everywhere in the app
--    character_url — transparent PNG caricature, display table only
-- ============================================================

alter table players
  add column if not exists character_url text;

-- The display reads through security-definer functions, so they need
-- rebuilding to include the new column.

create or replace function display_live(pw text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  live_session jsonb;
begin
  if not display_password_ok(pw) then
    return jsonb_build_object('ok', false);
  end if;

  select to_jsonb(x) into live_session
  from (
    select
      s.id,
      s.started_at,
      s.status,
      s.house_fee_per_player,
      s.host_player_id,
      coalesce(
        (
          select jsonb_agg(p order by p.position, p.name)
          from (
            select
              sp.position,
              sp.player_id,
              pl.name,
              pl.nickname,
              pl.photo_url,
              pl.character_url,
              coalesce(
                (select sum(b.amount) from buy_ins b
                 where b.session_player_id = sp.id), 0
              ) as total_buy_in,
              coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object('amount', b.amount, 'at', b.created_at)
                    order by b.created_at
                  )
                  from buy_ins b where b.session_player_id = sp.id
                ), '[]'::jsonb
              ) as buy_ins
            from session_players sp
            join players pl on pl.id = sp.player_id
            where sp.session_id = s.id
          ) p
        ), '[]'::jsonb
      ) as players
    from sessions s
    where s.status in ('live', 'tally')
    order by s.started_at desc
    limit 1
  ) x;

  return jsonb_build_object(
    'ok', true,
    'live', live_session,
    'completed_count', (select count(*) from sessions where status = 'complete'),
    'server_time', now()
  );
end;
$$;

revoke all on function display_live(text) from public;
grant execute on function display_live(text) to anon, authenticated;

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
