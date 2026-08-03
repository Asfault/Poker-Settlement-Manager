import type { Settlement } from "./types";
import { settleBalances } from "./settlement";
import {
  ExpenseBalance,
  SessionExpense,
  computeExpenseBalances,
} from "./expenses";

/**
 * House fee and expenses are deliberately kept OUT of the poker ledger.
 *
 * Poker P/L (chips left − buy-ins) is what feeds every lifetime stat, so it
 * has to reflect cards only. The fee and any food ordered are separate
 * transfers layered on at settlement time.
 *
 * Because poker P/L is zero-sum and both transfers are zero-sum too (every
 * rupee owed is a rupee received), the net always sums to zero and
 * settlements always balance.
 */

export interface NetRow {
  /** Roster player id. */
  playerId: string;
  /** Name shown on screens. */
  name: string;
  totalBuyIn: number;
  chipsLeft: number;
  /** Cards only. Feeds lifetime stats. Never includes the fee. */
  profitLoss: number;
  /** What this player owes the host in fees. Positive number. */
  houseFeeOwed: number;
  /** What the host collects from everyone else. Positive number. */
  houseFeeReceived: number;
  /** Sum of shares on expenses this player paid for. */
  expensePaid: number;
  /** Sum of this player's own shares across every expense. */
  expenseOwed: number;
  /**
   * profitLoss − houseFeeOwed + houseFeeReceived + expensePaid − expenseOwed.
   * Drives settlements.
   */
  net: number;
}

export interface SessionPlayerInput {
  playerId: string;
  name: string;
  totalBuyIn: number;
  chipsLeft: number;
  /** False for the host — you don't charge yourself. */
  paysHouseFee: boolean;
}

export function computeNetRows(
  players: SessionPlayerInput[],
  houseFeePerPlayer: number,
  hostPlayerId: string | null,
  /** Optional — omit on sessions where nothing was ordered. */
  expenses: SessionExpense[] = [],
): NetRow[] {
  const fee = Math.max(0, Math.round(houseFeePerPlayer));

  const payingCount = players.filter(
    (p) => p.paysHouseFee && p.playerId !== hostPlayerId,
  ).length;
  const totalCollected = fee * payingCount;

  const expenseBalances: Map<string, ExpenseBalance> =
    computeExpenseBalances(expenses);

  return players.map((p) => {
    const profitLoss = p.chipsLeft - p.totalBuyIn;
    const isHost = p.playerId === hostPlayerId;
    const owed = !isHost && p.paysHouseFee ? fee : 0;
    const received = isHost ? totalCollected : 0;
    const expense = expenseBalances.get(p.playerId);
    const expensePaid = expense?.paid ?? 0;
    const expenseOwed = expense?.owed ?? 0;
    return {
      playerId: p.playerId,
      name: p.name,
      totalBuyIn: p.totalBuyIn,
      chipsLeft: p.chipsLeft,
      profitLoss,
      houseFeeOwed: owed,
      houseFeeReceived: received,
      expensePaid,
      expenseOwed,
      net: profitLoss - owed + received + expensePaid - expenseOwed,
    };
  });
}

/** Settlements computed on the net figures, fee included. */
export function settleNet(rows: NetRow[]): Settlement[] {
  return settleBalances(rows.map((r) => ({ name: r.name, balance: r.net })));
}

/** Total fee money moving to the host this session. */
export function totalHouseFee(rows: NetRow[]): number {
  return rows.reduce((sum, r) => sum + r.houseFeeOwed, 0);
}

/** Biggest winner by poker skill, not by cash collected. */
export function topPokerWinner(rows: NetRow[]): NetRow | null {
  const winners = rows.filter((r) => r.profitLoss > 0);
  if (winners.length === 0) return null;
  return winners.reduce((best, r) => (r.profitLoss > best.profitLoss ? r : best));
}
