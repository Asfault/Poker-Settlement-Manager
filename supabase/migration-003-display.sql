-- ============================================================
--  Migration 003 — public display access
--  Run once in the Supabase SQL Editor. Safe to re-run.
--
--  The display is not logged in, so it can't read the tables directly
--  (RLS blocks anon by design). Instead it calls one security-definer
--  function that checks the password server-side and returns everything
--  it needs in a single payload. No RLS holes, and the password actually
--  protects the data rather than just hiding the UI.
-- ============================================================

-- ---------- Password check ----------

create or replace function display_password_ok(pw text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_settings
    where id = 1
      and display_password is not null
      and display_password <> ''
      and display_password = pw
  );
$$;

revoke all on function display_password_ok(text) from public;
grant execute on function display_password_ok(text) to anon, authenticated;

-- ---------- Display payload ----------

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

  -- The session currently being played, if any.
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

  -- Every finished session, aggregated. Feeds the lifetime stats and
  -- the filler content.
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
              'total_buy_in', coalesce(
                (select sum(b.amount) from buy_ins b
                 where b.session_player_id = sp.id), 0
              ),
              'chips_left', coalesce(sp.chips_left, 0),
              'buy_in_count', (
                select count(*) from buy_ins b
                where b.session_player_id = sp.id
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

-- ---------- Split reads ----------
-- The live session is small and changes every few seconds; history is large
-- and only changes when a session ends. Fetching them separately lets the
-- board poll fast without re-downloading months of data each time.

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
    -- Lets the client tell whether history is worth re-fetching.
    'completed_count', (select count(*) from sessions where status = 'complete'),
    'server_time', now()
  );
end;
$$;

revoke all on function display_live(text) from public;
grant execute on function display_live(text) to anon, authenticated;
