-- ============================================================
--  Migration 008 — shareable stats page
--  Run in the Supabase SQL Editor. Safe to re-run.
--
--  A read-only stats page at pokeresh.com/<slug>, gated by its own
--  password — deliberately NOT the display password, so revoking the
--  shared link never kills the TV board mid-game.
--
--  Same security posture as migration 003: viewers are anon and cannot
--  read the tables (RLS blocks them). Everything comes back from one
--  security-definer function that checks the password server-side.
--
--  The slug is NOT security. Anything memorable enough to say out loud
--  is guessable. The password does the work; the slug is just branding.
-- ============================================================

alter table app_settings
  add column if not exists share_slug     text,
  add column if not exists share_password text;

-- One shared link at a time. Partial index so multiple NULLs are fine.
create unique index if not exists app_settings_share_slug_key
  on app_settings (share_slug)
  where share_slug is not null;

-- ---------- Password check ----------

create or replace function shared_stats_ok(p_slug text, p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_settings
    where id = 1
      and share_slug is not null
      and share_slug <> ''
      and share_password is not null
      and share_password <> ''
      and lower(share_slug) = lower(p_slug)
      and share_password = p_password
  );
$$;

revoke all on function shared_stats_ok(text, text) from public;
grant execute on function shared_stats_ok(text, text) to anon, authenticated;

-- ---------- Does this slug exist at all? ----------
-- Lets the page tell "wrong password" apart from "no such page", so a
-- typo'd URL 404s instead of sitting on a password prompt forever.
-- Returns only a boolean — never the slug or the password.

create or replace function shared_stats_slug_exists(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_settings
    where id = 1
      and share_slug is not null
      and share_slug <> ''
      and share_password is not null
      and share_password <> ''
      and lower(share_slug) = lower(p_slug)
  );
$$;

revoke all on function shared_stats_slug_exists(text) from public;
grant execute on function shared_stats_slug_exists(text) to anon, authenticated;

-- ---------- Payload ----------
--
--  Returns completed sessions in the SAME shape loadCompletedSessions()
--  builds from its Supabase select, so the shared page reuses the very
--  same compute functions as the host stats page. One implementation of
--  the maths, no chance of the two drifting apart.
--
--  Completed sessions only — this page is history, never the live game.

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

-- Sanity check after running:
-- select shared_stats_slug_exists('yourslug');
-- select shared_stats_payload('yourslug', 'yourpassword') -> 'ok';
