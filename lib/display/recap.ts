import type { DisplayHistorySession } from "@/lib/db/display";
import { seasonLabel, seasonOf } from "@/lib/stats/season";

/**
 * The end-of-night reveal.
 *
 * Panels 1 and 2 are facts — tonight's numbers, and the season table as it
 * now stands. Panel 3 is what tonight changed IN THE SEASON, and it only
 * reports things that actually happened. A "milestone" that fires every week
 * isn't one, so the tests are deliberately narrow.
 *
 * Everything here is scoped to the season tonight belongs to. Nothing
 * all-time reaches the recap — the host asked for that explicitly.
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
  /** What tonight did to their season total. 0 if they didn't play. */
  tonightDelta: number;
  sessions: number;
  wins: number;
  /** 0–1. */
  winRate: number;
  /** Percentage points moved tonight. 0 if they didn't play. */
  winRateDelta: number;
}

interface Record {
  sessions: number;
  wins: number;
  total: number;
}

function recordsFrom(sessions: DisplayHistorySession[]): Map<string, Record> {
  const out = new Map<string, Record>();
  for (const s of sessions) {
    for (const p of s.players) {
      const e = out.get(p.player_id) ?? { sessions: 0, wins: 0, total: 0 };
      e.sessions += 1;
      if (plOf(p) > 0) e.wins += 1;
      e.total += plOf(p);
      out.set(p.player_id, e);
    }
  }
  return out;
}

export interface RecapMilestone {
  playerId: string;
  name: string;
  photoUrl: string | null;
  characterUrl: string | null;
  headline: string;
  detail: string;
  /** "lead" is gold — taking the top spot is its own kind of news. */
  tone: "win" | "loss" | "lead";
}

export interface Recap {
  sessionId: string;
  endedAt: number;
  pot: number;
  tonight: RecapPlayer[];
  /**
   * The SEASON table after tonight, with movement. Seasonal rather than
   * all-time because that's the live competition — and within a season a
   * good night can genuinely move someone, which is what makes the reveal
   * worth watching.
   */
  standings: RecapStanding[];
  seasonLabel: string;
  /** Season nights including tonight. */
  seasonNights: number;
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

  // Standings now, against standings as they were before tonight — both
  // scoped to the season tonight belongs to. So are the milestones.
  const season = seasonOf(new Date(latest.started_at).getTime());
  const inSeason = sorted.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= season.startsAt && t < season.endsAt;
  });
  const seasonBefore = inSeason.filter((s) => s.id !== latest.id);
  const totalsAfter = totalsFrom(inSeason);
  const totalsBefore = totalsFrom(seasonBefore);
  const ranksAfter = rankOf(totalsAfter);
  const ranksBefore = rankOf(totalsBefore);

  const nameById = new Map<
    string,
    { name: string; photo: string | null; character: string | null }
  >();
  for (const s of sorted) {
    for (const p of s.players) {
      nameById.set(p.player_id, {
        name: nameOf(p),
        photo: p.photo_url,
        character: p.character_url,
      });
    }
  }

  // Win rate and W/L on this panel are the season's, matching the standings
  // beside them.
  const recAfter = recordsFrom(inSeason);
  const recBefore = recordsFrom(seasonBefore);

  const standings: RecapStanding[] = [...totalsAfter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, total]) => {
      const wasRanked = totalsBefore.has(playerId);
      const rank = ranksAfter.get(playerId) ?? 0;
      const a = recAfter.get(playerId) ?? { sessions: 0, wins: 0, total: 0 };
      const b = recBefore.get(playerId) ?? { sessions: 0, wins: 0, total: 0 };
      const rateAfter = a.sessions > 0 ? a.wins / a.sessions : 0;
      const rateBefore = b.sessions > 0 ? b.wins / b.sessions : 0;
      return {
        playerId,
        name: nameById.get(playerId)?.name ?? "—",
        photoUrl: nameById.get(playerId)?.photo ?? null,
        total,
        rank,
        // Positive = climbed. A debut has no previous position.
        movement: wasRanked ? (ranksBefore.get(playerId) ?? 0) - rank : null,
        tonightDelta: a.total - b.total,
        sessions: a.sessions,
        wins: a.wins,
        winRate: rateAfter,
        // Only meaningful for people who actually played tonight.
        winRateDelta:
          b.sessions > 0 && a.sessions !== b.sessions
            ? (rateAfter - rateBefore) * 100
            : 0,
      };
    });

  return {
    sessionId: latest.id,
    endedAt,
    pot: latest.players.reduce((s, p) => s + p.total_buy_in, 0),
    tonight,
    standings,
    seasonLabel: seasonLabel(season),
    seasonNights: inSeason.length,
    milestones: buildMilestones(
      seasonBefore,
      tonight,
      totalsAfter,
      totalsBefore,
      (id) => {
        const who = nameById.get(id);
        return {
          playerId: id,
          name: who?.name ?? "—",
          photoUrl: who?.photo ?? null,
          characterUrl: who?.character ?? null,
        };
      },
    ),
  };
}

type Who = Pick<
  RecapMilestone,
  "playerId" | "name" | "photoUrl" | "characterUrl"
>;

/**
 * What tonight changed in the season, most important first.
 *
 * - Takes the lead: top of the season table now, strictly ahead of second,
 *   and wasn't top before tonight. Can go to someone who sat tonight out, if
 *   the old leader lost enough.
 * - Biggest win / worst night of the season: tonight's best (or worst)
 *   result beats every night anyone has had this season.
 * - First win of the season: at least two nights this season without one.
 * - Into profit / into the red for the season: season total crosses zero,
 *   for someone who'd already played this season.
 *
 * Nothing on the season's first night — every one of these would be
 * trivially true, and a reveal of nothing but "firsts" isn't one.
 */
function buildMilestones(
  seasonBefore: DisplayHistorySession[],
  tonight: RecapPlayer[],
  totalsAfter: Map<string, number>,
  totalsBefore: Map<string, number>,
  who: (playerId: string) => Who,
): RecapMilestone[] {
  if (seasonBefore.length === 0 || tonight.length === 0) return [];
  const out: RecapMilestone[] = [];

  // Every night anyone has had this season, before tonight.
  const priorNights = new Map<string, number[]>();
  let best: { playerId: string; pl: number; at: number } | null = null;
  let worst: { playerId: string; pl: number; at: number } | null = null;
  for (const s of seasonBefore) {
    const at = new Date(s.started_at).getTime();
    for (const p of s.players) {
      const pl = plOf(p);
      const list = priorNights.get(p.player_id) ?? [];
      list.push(pl);
      priorNights.set(p.player_id, list);
      if (best === null || pl > best.pl) best = { playerId: p.player_id, pl, at };
      if (worst === null || pl < worst.pl) worst = { playerId: p.player_id, pl, at };
    }
  }

  // Takes the lead.
  const after = [...totalsAfter.entries()].sort((a, b) => b[1] - a[1]);
  const before = [...totalsBefore.entries()].sort((a, b) => b[1] - a[1]);
  const [newLeader, runnerUp] = after;
  const oldLeader = before[0];
  if (
    newLeader &&
    newLeader[1] > 0 &&
    (!runnerUp || newLeader[1] > runnerUp[1]) &&
    (!oldLeader || oldLeader[0] !== newLeader[0])
  ) {
    out.push({
      ...who(newLeader[0]),
      headline: "Takes the lead",
      detail: oldLeader
        ? `Takes over from ${who(oldLeader[0]).name}`
        : "Top of the table",
      tone: "lead",
    });
  }

  // Season records. Tonight is sorted best first.
  const top = tonight[0];
  if (best && top.profitLoss > 0 && top.profitLoss > best.pl) {
    out.push({
      ...who(top.playerId),
      headline: "Biggest win of the season",
      detail: `${inr(top.profitLoss)} beats ${who(best.playerId).name}'s ${inr(best.pl)} on ${dayMonth(best.at)}`,
      tone: "win",
    });
  }
  const bottom = tonight[tonight.length - 1];
  if (worst && bottom.profitLoss < 0 && bottom.profitLoss < worst.pl) {
    out.push({
      ...who(bottom.playerId),
      headline: "Worst night of the season",
      detail: `${inr(bottom.profitLoss)}, worse than ${who(worst.playerId).name}'s ${inr(worst.pl)} on ${dayMonth(worst.at)}`,
      tone: "loss",
    });
  }

  // First win of the season.
  for (const p of tonight) {
    const prior = priorNights.get(p.playerId) ?? [];
    if (p.profitLoss > 0 && prior.length >= 2 && prior.every((x) => x <= 0)) {
      out.push({
        ...who(p.playerId),
        headline: "First win of the season",
        detail: `After ${prior.length} nights without one`,
        tone: "win",
      });
    }
  }

  // Crossing zero on the season, either way.
  for (const p of tonight) {
    if ((priorNights.get(p.playerId) ?? []).length === 0) continue;
    const wasAt = totalsBefore.get(p.playerId) ?? 0;
    const nowAt = totalsAfter.get(p.playerId) ?? 0;
    if (wasAt <= 0 && nowAt > 0) {
      out.push({
        ...who(p.playerId),
        headline: "Into profit for the season",
        detail: `Season now ${inr(nowAt)}`,
        tone: "win",
      });
    } else if (wasAt >= 0 && nowAt < 0) {
      out.push({
        ...who(p.playerId),
        headline: "Into the red for the season",
        detail: `Season now ${inr(nowAt)}`,
        tone: "loss",
      });
    }
  }

  return out;
}

/** "11 Sep". */
function dayMonth(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function inr(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-IN");
  return `${n < 0 ? "-" : n > 0 ? "+" : ""}₹${abs}`;
}
