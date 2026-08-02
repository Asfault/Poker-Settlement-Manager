-- ============================================================
--  Migration 009 — pays_house_fee in the shared payload
--  Run in the Supabase SQL Editor. Safe to re-run.
--
--  The shared page now shows each night's summary, including the
--  settlements exactly as they happened — fees included, because that's
--  the cash that actually changed hands.
--
--  Reproducing them needs `pays_house_fee` per player: the fee is
--  per-player so guests can be exempted (see lib/houseFee.ts), and
--  assuming "everyone except the host pays" would print settlements that
--  never occurred on any night where someone was let off.
--
--  This only adds one field to migration 008's function. Everything else
--  is unchanged.
--
--  Still deliberately absent: any lifetime total of fees collected. The
--  per-night fee is visible so the numbers add up; the aggregate is not,
--  and lives only on the host's own display settings page.
-- ============================================================

create or replace function shared_stats_payload(p_slug text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not shared_stats_ok(p_slug, p_password) then
    return jsonb_build_object('ok', false);
  end if;

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
  ) y;

  return jsonb_build_object(
    'ok', true,
    'sessions', result,
    'server_time', now()
  );
end;
$$;

revoke all on function shared_stats_payload(text, text) from public;
grant execute on function shared_stats_payload(text, text) to anon, authenticated;
