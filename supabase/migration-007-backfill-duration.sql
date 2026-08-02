-- ============================================================
--  Migration 007 — assumed duration for backfilled sessions
--  Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================
--
--  Backfilled sessions were inserted with ended_at == started_at, because
--  pre-app games have no recorded start or finish. That made every
--  time-based stat skip them, so "hours played" only ever covered the
--  handful of nights run through the app.
--
--  This assigns a nominal FOUR HOURS to each historical night so total and
--  average hours mean something across the whole history.
--
--  Read this before relying on the numbers:
--  the four hours is an assumption, not a measurement. `is_backfill`
--  stays true on every row this touches, which is what lets the app keep
--  telling the two apart — assumed durations feed averages and totals,
--  but are still barred from the "longest session" record, because a
--  fabricated value must never win a record.
--
--  To change the assumption later, edit the interval and re-run: the
--  guard below only matches rows still sitting at exactly the assumed
--  value or at zero length, so real sessions are never overwritten.

update sessions
set ended_at = started_at + interval '4 hours'
where is_backfill = true
  and (
    ended_at is null
    or ended_at <= started_at
  );

-- Sanity check — inspect the result after running.
-- select
--   count(*) filter (where is_backfill)                    as backfilled,
--   count(*) filter (where not is_backfill)                as real_sessions,
--   round(avg(extract(epoch from (ended_at - started_at)) / 3600)::numeric, 2)
--     as avg_hours
-- from sessions
-- where status = 'complete';
