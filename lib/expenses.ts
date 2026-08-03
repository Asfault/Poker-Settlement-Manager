/**
 * Session expenses — food, drinks, whatever gets ordered mid-game.
 *
 * The fourth ledger. Like the house fee, it's a pure transfer: it never
 * touches buy-ins or chip counts, so poker P/L stays clean and no stat ever
 * sees a rupee of it. It only affects who hands whom cash at the end.
 *
 * An expense IS its list of shares. There is no separate total, so the
 * payer's credit is by definition the sum of what everyone owes them, and the
 * ledger is zero-sum by construction rather than by validation.
 *
 * The payer needn't be one of the people splitting it — Hari can order for
 * Ram and Kula without eating, and is then owed the whole amount.
 */

export interface ExpenseShare {
  playerId: string;
  /** What this player owes the payer. Always positive. */
  amount: number;
}

export interface SessionExpense {
  id: string;
  label: string;
  payerPlayerId: string;
  shares: ExpenseShare[];
}

/** What one expense is worth to its payer: the sum of everyone's shares. */
export function expenseTotal(expense: SessionExpense): number {
  return expense.shares.reduce((sum, s) => sum + s.amount, 0);
}

export interface ExpenseBalance {
  playerId: string;
  /** Sum of shares on expenses this player paid for. */
  paid: number;
  /** Sum of this player's own shares across all expenses. */
  owed: number;
  /** paid − owed. Positive means the table owes them. */
  balance: number;
}

/**
 * Per-player expense balances across every expense in a session.
 *
 * Always sums to zero across all players, because every rupee owed by someone
 * is a rupee credited to a payer.
 */
export function computeExpenseBalances(
  expenses: SessionExpense[],
): Map<string, ExpenseBalance> {
  const map = new Map<string, ExpenseBalance>();

  function entry(playerId: string): ExpenseBalance {
    let e = map.get(playerId);
    if (!e) {
      e = { playerId, paid: 0, owed: 0, balance: 0 };
      map.set(playerId, e);
    }
    return e;
  }

  for (const expense of expenses) {
    const total = expenseTotal(expense);
    if (total > 0) entry(expense.payerPlayerId).paid += total;
    for (const share of expense.shares) {
      entry(share.playerId).owed += share.amount;
    }
  }

  for (const e of map.values()) e.balance = e.paid - e.owed;
  return map;
}

/** Convenience: one player's net expense position, 0 if they're not involved. */
export function expenseBalanceFor(
  balances: Map<string, ExpenseBalance>,
  playerId: string,
): number {
  return balances.get(playerId)?.balance ?? 0;
}

/**
 * Split a total equally, exact to the rupee.
 *
 * Integer division leaves a remainder of up to (n − 1) rupees. Everyone gets
 * the same round-down amount and the payer absorbs the odd rupees, which
 * keeps every other number clean — they chose to order.
 *
 * The remainder is dropped rather than assigned, which is precisely how the
 * payer absorbs it: their credit is the sum of shares, so anything not
 * charged to someone is simply not recovered.
 */
export function splitEqually(
  total: number,
  playerIds: string[],
): ExpenseShare[] {
  const amount = Math.max(0, Math.round(total));
  if (playerIds.length === 0 || amount <= 0) return [];
  const each = Math.floor(amount / playerIds.length);
  if (each <= 0) return [];
  return playerIds.map((playerId) => ({ playerId, amount: each }));
}

/** Rupees the payer eats when an equal split doesn't divide cleanly. */
export function splitRemainder(total: number, count: number): number {
  const amount = Math.max(0, Math.round(total));
  if (count <= 0 || amount <= 0) return 0;
  return amount % count;
}

/**
 * Expenses a player is named in, either as payer or as someone splitting it.
 * Used to block removing them from the session — dropping their share would
 * quietly unbalance the ledger.
 */
export function expensesInvolving(
  expenses: SessionExpense[],
  playerId: string,
): SessionExpense[] {
  return expenses.filter(
    (e) =>
      e.payerPlayerId === playerId ||
      e.shares.some((s) => s.playerId === playerId),
  );
}
