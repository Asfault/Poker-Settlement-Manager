-- ============================================================
--  Migration 010 — session expenses
--  Run in the Supabase SQL Editor. Safe to re-run.
--
--  Food, drinks, whatever gets ordered mid-game. A FOURTH ledger,
--  structurally like the house fee: a pure transfer that must never
--  touch buy-ins or chip counts.
--
--  This exists to close the last hole where money got smuggled through
--  the chip ledger — adding a food amount to everyone's buy-in and
--  claiming it back at the end, which corrupts P/L exactly the way the
--  old ₹200-in-the-buy-in fee method did.
--
--  KEY DESIGN POINT: there is no `total` column. An expense IS its list
--  of shares, and the payer's credit is their sum. That makes the ledger
--  zero-sum by construction — there is no second number that can
--  disagree, so settlements cannot silently stop balancing.
-- ============================================================

create table if not exists session_expenses (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  -- Free text: "Biryani", "McDonalds", "Blinkit", "Drinks".
  label            text not null,
  -- Who fronted the cash. Not required to be one of the people splitting it.
  payer_player_id  uuid not null references players(id) on delete restrict,
  created_at       timestamptz not null default now()
);

create table if not exists session_expense_shares (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references session_expenses(id) on delete cascade,
  player_id   uuid not null references players(id) on delete restrict,
  -- What this player owes the payer. Always positive.
  amount      integer not null check (amount > 0),
  created_at  timestamptz not null default now(),
  unique (expense_id, player_id)
);

create index if not exists idx_session_expenses_session
  on session_expenses(session_id);
create index if not exists idx_expense_shares_expense
  on session_expense_shares(expense_id);

-- ---------- Row Level Security ----------
-- Same posture as every other table: host only. Expenses are never exposed
-- to the display board or the shared stats link.

alter table session_expenses       enable row level security;
alter table session_expense_shares enable row level security;

drop policy if exists "authenticated full access" on session_expenses;
create policy "authenticated full access" on session_expenses
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on session_expense_shares;
create policy "authenticated full access" on session_expense_shares
  for all to authenticated using (true) with check (true);

-- Sanity check after running:
-- select * from session_expenses;
-- select * from session_expense_shares;
