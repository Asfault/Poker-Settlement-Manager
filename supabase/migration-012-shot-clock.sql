-- ============================================================
--  Migration 012 — the 30-second shot clock
--  Run in the Supabase SQL Editor. Safe to re-run.
--
--  The host taps one button; the TV counts down from 30 and, at zero,
--  goes red and declares the hand dead.
--
--  Only the START TIME is stored. The duration is a constant in the app,
--  and the display works out what's left from `server_time`, which
--  display_live already returns. That matters: a TV with a wrong clock
--  would otherwise count down from the wrong number, and TVs very often
--  have a wrong clock.
--
--  Null means no clock running. Stopping early just nulls it.
-- ============================================================

alter table sessions
  add column if not exists clock_started_at timestamptz;

-- ---------- Expose it to the display ----------

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
      s.clock_started_at,
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
