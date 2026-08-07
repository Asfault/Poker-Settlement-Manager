import type { DisplayHistorySession } from "@/lib/db/display";

/**
 * The end-of-night reveal.
 *
 * Panels 1 and 2 are facts — tonight's numbers, and the table as it now
 * stands. Panel 3 is the consequences, and it only reports things that
 * actually happened. A "milestone" that fires every week isn't one, so the
 * tests here are deliberately narrow: personal records, first wins, and
 * crossing the line between up and down for the first time.
 *
 * Poker numbers only. Fees and expenses never reach the board.
 */

export interface RecapPlayer {
  playerId: string;
  name: string;
  photoUrl: string | null;
  characterUrl: string | null;
  totalBuyIn: number;
  chipsLeft: number;
  profitLoss: number;
}

export interface RecapStanding {
  playerId: string;
  name: string;
  photoUrl: string | null;
  total: number;
  rank: number;
  /** Positive means they climbed tonight. Null if they're new to the board. */
  movement: number | null;
}

export interface RecapMilestone {
  playerId: string;
  name: string;
  photoUrl: string | null;
  characterUrl: string | null;
  headline: string;
  detail: string;
  tone: "win" | "loss";
}

export interface Recap {
  sessionId: string;
  endedAt: number;
  pot: number;
  tonight: RecapPlayer[];
  standings: RecapStanding[];
  milestones: RecapMilestone[];
}

function nameOf(p: { name: string; nickname: string | null }): string {
  return p.nickname?.trim() || p.name;
}

function plOf(p: { total_buy_in: number; chips_left: number }): number {
  return p.chips_left - p.total_buy_in;
}

/** Lifetime totals across a set of sessions, keyed by player. */
function totalsFrom(sessions: DisplayHistorySession[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessions) {
    for (const p of s.players) {
      out.set(p.player_id, (out.get(p.player_id) ?? 0) + plOf(p));
    }
  }
  return out;
}

function rankOf(totals: Map<string, number>): Map<string, number> {
  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const out = new Map<string, number>();
  ordered.forEach(([id], i) => out.set(id, i + 1));
  return out;
}

/**
 * Build the recap for the most recently finished night.
 *
 * Returns null when there's nothing to show — no history, or the newest
 * session ended longer ago than the caller's window. Deriving it from
 * `ended_at` rather than tracking state means a TV that reloads mid-recap
 * picks up where it left off.
 */
export function buildRecap(
  history: DisplayHistorySession[],
  now: number,
  windowMs: number,
): Recap | null {
  if (history.length === 0) return null;

  const sorted = [...history].sort(
    (a, b) =>
      new Date(b.ended_at ?? b.started_at).getTime() -
      new Date(a.ended_at ?? a.started_at).getTime(),
  );
  const latest = sorted[0];
  const endedAt = new Date(latest.ended_at ?? latest.started_at).getTime();
  if (now - endedAt > windowMs || now < endedAt) return null;
  if (latest.players.length === 0) return null;

  const tonight: RecapPlayer[] = latest.players
    .map((p) => ({
      playerId: p.player_id,
      name: nameOf(p),
      photoUrl: p.photo_url,
      characterUrl: p.character_url,
      totalBuyIn: p.total_buy_in,
      chipsLeft: p.chips_left,
      profitLoss: plOf(p),
    }))
    .sort((a, b) => b.profitLoss - a.profitLoss);

  // Standings now, against standings as they were before tonight.
  const before = sorted.filter((s) => s.id !== latest.id);
  const totalsAfter = totalsFrom(sorted);
  const totalsBefore = totalsFrom(before);
  const ranksAfter = rankOf(totalsAfter);
  const ranksBefore = rankOf(totalsBefore);

  const nameById = new Map<string, { name: string; photo: string | null }>();
  for (const s of sorted) {
    for (const p of s.players) {
      nameById.set(p.player_id, { name: nameOf(p), photo: p.photo_url });
    }
  }

  const standings: RecapStanding[] = [...totalsAfter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, total]) => {
      const wasRanked = totalsBefore.has(playerId);
      const rank = ranksAfter.get(playerId) ?? 0;
      return {
        playerId,
        name: nameById.get(playerId)?.name ?? "—",
        photoUrl: nameById.get(playerId)?.photo ?? null,
        total,
        rank,
        // Positive = climbed. A debut has no previous position.
        movement: wasRanked ? (ranksBefore.get(playerId) ?? 0) - rank : null,
      };
    });

  return {
    sessionId: latest.id,
    endedAt,
    pot: latest.players.reduce((s, p) => s + p.total_buy_in, 0),
    tonight,
    standings,
    milestones: buildMilestones(latest, before, tonight, totalsAfter, totalsBefore),
  };
}

function buildMilestones(
  latest: DisplayHistorySession,
  before: DisplayHistorySession[],
  tonight: RecapPlayer[],
  totalsAfter: Map<string, number>,
  totalsBefore: Map<string, number>,
): RecapMilestone[] {
  const out: RecapMilestone[] = [];

  // Everyone's previous nights, for personal records.
  const priorNights = new Map<string, number[]>();
  for (const s of before) {
    for (const p of s.players) {
      const list = priorNights.get(p.player_id) ?? [];
      list.push(plOf(p));
      priorNights.set(p.player_id, list);
    }
  }

  for (const p of tonight) {
    const prior = priorNights.get(p.playerId) ?? [];
    const base = {
      playerId: p.playerId,
      name: p.name,
      photoUrl: p.photoUrl,
      characterUrl: p.characterUrl,
    };

    // A debut is covered by the live board's own alert; skip it here.
    if (prior.length === 0) continue;

    const bestBefore = Math.max(...prior);
    const worstBefore = Math.min(...prior);

    if (p.profitLoss > 0 && p.profitLoss > bestBefore) {
      out.push({
        ...base,
        headline: "Biggest night ever",
        detail:
          bestBefore > 0
            ? `Beats their previous best of ${inr(bestBefore)}`
            : `First time above ${inr(0)} by this much`,
        tone: "win",
      });
    } else if (p.profitLoss < 0 && p.profitLoss < worstBefore) {
      out.push({
        ...base,
        headline: "Worst night ever",
        detail: `Beats — or rather doesn't — ${inr(worstBefore)}`,
        tone: "loss",
      });
    }

    // First ever win.
    if (p.profitLoss > 0 && prior.every((x) => x <= 0)) {
      out.push({
        ...base,
        headline: "First ever win",
        detail: `After ${prior.length} night${prior.length === 1 ? "" : "s"} of trying`,
        tone: "win",
      });
    }

    // Crossing the line, either way, for the first time.
    const after = totalsAfter.get(p.playerId) ?? 0;
    const priorTotal = totalsBefore.get(p.playerId) ?? 0;
    if (priorTotal <= 0 && after > 0) {
      out.push({
        ...base,
        headline: "Into profit at last",
        detail: `All-time now ${inr(after)}`,
        tone: "win",
      });
    } else if (priorTotal >= 0 && after < 0) {
      out.push({
        ...base,
        headline: "Underwater for the first time",
        detail: `All-time now ${inr(after)}`,
        tone: "loss",
      });
    }
  }

  return out;
}

function inr(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-IN");
  return `${n < 0 ? "-" : n > 0 ? "+" : ""}₹${abs}`;
}
