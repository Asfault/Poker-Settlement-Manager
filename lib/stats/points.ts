import type { SessionSummary } from "@/lib/db/stats";

/**
 * Points — a host-only statistic, nothing more.
 *
 * Each night, players are placed by that night's poker P/L and scored
 * 100 / 70 / 50 / 40 / 30 / 20 / 10 for 1st–7th and 5 for 8th and below.
 * Totals are summed over whatever sessions are passed in (a season,
 * all-time, pre-season).
 *
 * This does NOT decide anything. The season championship stays P/L-based
 * (`lib/stats/season.ts`); points appear only in the host's own leaderboard
 * and never on the shared link, the TV or the summary image. The host was
 * explicit about all three.
 */

const TABLE = [100, 70, 50, 40, 30, 20, 10];
const FLOOR = 5;

/** Points for a 1-based finishing position. */
export function pointsForPosition(position: number): number {
  return TABLE[position - 1] ?? FLOOR;
}

/**
 * One night's points. Players level on P/L split the points for the places
 * they share — two tied for 2nd get (70 + 50) / 2 = 60 each. Giving both the
 * higher figure was offered and turned down: it hands out points nobody
 * earned.
 */
export function nightPoints(
  players: { playerId: string; profitLoss: number }[],
): Map<string, number> {
  const ranked = [...players].sort((a, b) => b.profitLoss - a.profitLoss);
  const out = new Map<string, number>();
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1].profitLoss === ranked[i].profitLoss) {
      j += 1;
    }
    // Positions i+1 .. j+1 are shared.
    let sum = 0;
    for (let pos = i + 1; pos <= j + 1; pos += 1) sum += pointsForPosition(pos);
    const each = sum / (j - i + 1);
    for (let k = i; k <= j; k += 1) out.set(ranked[k].playerId, each);
    i = j + 1;
  }
  return out;
}

/** Total points per player across the sessions given. */
export function computePoints(sessions: SessionSummary[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    for (const [id, pts] of nightPoints(s.players)) {
      totals.set(id, (totals.get(id) ?? 0) + pts);
    }
  }
  return totals;
}

/** "410", or "412.5" when a tie left a fraction. One decimal at most. */
export function formatPoints(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
