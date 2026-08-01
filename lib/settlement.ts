import type { Player, PlayerResult, Settlement } from "./types";

export function totalBuyIn(player: Player): number {
  return player.buyIns.reduce((sum, b) => sum + b.amount, 0);
}

export function computeResults(players: Player[]): PlayerResult[] {
  return players.map((p) => {
    const totalBuy = totalBuyIn(p);
    const chips = p.chipsLeft ?? 0;
    return {
      id: p.id,
      name: p.name,
      totalBuyIn: totalBuy,
      chipsLeft: chips,
      profitLoss: chips - totalBuy,
    };
  });
}

/**
 * Greedy minimal-settlement algorithm.
 *
 * - Build payers from players with negative P/L (amounts as positives).
 * - Build receivers from players with positive P/L.
 * - Sort both by amount descending.
 * - Repeatedly settle min(top payer, top receiver) until both queues are empty.
 *
 * This produces at most max(payers, receivers) transactions and matches the
 * spec's example exactly.
 */
export function calculateSettlements(results: PlayerResult[]): Settlement[] {
  return settleBalances(
    results.map((r) => ({ name: r.name, balance: r.profitLoss })),
  );
}

/**
 * Same greedy matcher, but over arbitrary named balances rather than poker
 * P/L specifically. Host mode nets the house fee in before calling this.
 *
 * Assumes the balances sum to zero, which they always do: poker P/L is
 * zero-sum, and the house fee is a pure transfer.
 */
export function settleBalances(
  balances: { name: string; balance: number }[],
): Settlement[] {
  const payers = balances
    .filter((r) => r.balance < 0)
    .map((r) => ({ name: r.name, amount: -r.balance }))
    .sort((a, b) => b.amount - a.amount);

  const receivers = balances
    .filter((r) => r.balance > 0)
    .map((r) => ({ name: r.name, amount: r.balance }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  // Use a small epsilon tolerance for floating point safety, but our amounts
  // should always be integers in practice.
  const EPS = 0.0001;

  while (i < payers.length && j < receivers.length) {
    const pay = Math.min(payers[i].amount, receivers[j].amount);
    if (pay > EPS) {
      settlements.push({
        from: payers[i].name,
        to: receivers[j].name,
        amount: Math.round(pay),
      });
    }
    payers[i].amount -= pay;
    receivers[j].amount -= pay;
    if (payers[i].amount <= EPS) i += 1;
    if (receivers[j].amount <= EPS) j += 1;
  }

  return settlements;
}

export function biggestWinner(results: PlayerResult[]): PlayerResult | null {
  if (results.length === 0) return null;
  return results.reduce((best, r) => (r.profitLoss > best.profitLoss ? r : best), results[0]);
}
