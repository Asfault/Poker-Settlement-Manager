import type { SessionSummary } from "@/lib/db/stats";

/**
 * Derived stats beyond the leaderboard basics in lib/db/stats.ts.
 *
 * Pure functions only — no Supabase import — so these stay cheap to reason
 * about and can be mirrored in __tests__/stats.test.mjs.
 *
 * Everything here is POKER numbers: profitLoss = chipsLeft - totalBuyIn.
 * House fees are a separate ledger and never enter any figure below, with the
 * single exception of houseFeesCollected in GroupExtras, which is explicitly
 * labelled as house money in the UI and feeds nothing else.
 *
 * Backfilled sessions have ended_at == started_at, so durationMs is 0. Any
 * time-based figure filters those out rather than treating them as instant.
 */

// ---------- Records ----------

export interface NightRecord {
  sessionId: string;
  at: number;
  name: string;
  amount: number;
}

export interface Records {
  biggestWin: NightRecord | null;
  biggestLoss: NightRecord | null;
  biggestPot: { sessionId: string; at: number; amount: number } | null;
  longestSession: { sessionId: string; at: number; ms: number } | null;
  mostBuyIns: NightRecord | null;
}

export function computeRecords(sessions: SessionSummary[]): Records {
  const out: Records = {
    biggestWin: null,
    biggestLoss: null,
    biggestPot: null,
    longestSession: null,
    mostBuyIns: null,
  };

  for (const s of sessions) {
    if (out.biggestPot === null || s.pot > out.biggestPot.amount) {
      out.biggestPot = { sessionId: s.id, at: s.startedAt, amount: s.pot };
    }

    // Backfilled nights carry an assumed duration (migration 007), not a
    // measured one. It's fine for averages; it must never win a record.
    if (
      !s.isBackfill &&
      s.durationMs !== null &&
      s.durationMs > 0 &&
      (out.longestSession === null || s.durationMs > out.longestSession.ms)
    ) {
      out.longestSession = {
        sessionId: s.id,
        at: s.startedAt,
        ms: s.durationMs,
      };
    }

    for (const p of s.players) {
      if (out.biggestWin === null || p.profitLoss > out.biggestWin.amount) {
        out.biggestWin = {
          sessionId: s.id,
          at: s.startedAt,
          name: p.name,
          amount: p.profitLoss,
        };
      }
      if (out.biggestLoss === null || p.profitLoss < out.biggestLoss.amount) {
        out.biggestLoss = {
          sessionId: s.id,
          at: s.startedAt,
          name: p.name,
          amount: p.profitLoss,
        };
      }
      // Backfill stores one aggregate buy-in row per player, so a count of 1
      // there is an artefact rather than discipline. Only real sessions count.
      if (
        !s.isBackfill &&
        (out.mostBuyIns === null || p.buyInCount > out.mostBuyIns.amount)
      ) {
        out.mostBuyIns = {
          sessionId: s.id,
          at: s.startedAt,
          name: p.name,
          amount: p.buyInCount,
        };
      }
    }

  }

  return out;
}

// ---------- Group extras ----------

export interface MonthBucket {
  /** "YYYY-MM", sortable. */
  key: string;
  label: string;
  sessions: number;
  pot: number;
}

export interface GroupExtras {
  avgPlayersPerNight: number;
  totalBuyInCount: number;
  /** Average buy-ins taken per player per night. 1.0 means nobody rebuys. */
  buyInsPerPlayerNight: number;
  /** Share of player-nights where someone bought in more than once, 0–1. */
  rebuyRate: number;
  avgPotPerPlayer: number;
  /** House money. Never enters any P/L figure — display only. */
  houseFeesCollected: number;
  byMonth: MonthBucket[];
  /** Total time at the table, across every session that has a duration. */
  totalHoursPlayed: number;
  avgHoursPlayed: number;
  /**
   * How many of those nights use the assumed backfill duration rather than a
   * measured one. Surfaced in the UI so the figure isn't passed off as exact.
   */
  assumedDurationSessions: number;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function computeGroupExtras(sessions: SessionSummary[]): GroupExtras {
  let playerNights = 0;
  let buyInCount = 0;
  let rebuyNights = 0;
  let realBuyInNights = 0;
  let fees = 0;
  let pot = 0;
  let durationMs = 0;
  let durationCount = 0;
  let assumed = 0;

  const months = new Map<string, MonthBucket>();

  for (const s of sessions) {
    playerNights += s.players.length;
    pot += s.pot;

    if (s.durationMs !== null && s.durationMs > 0) {
      durationMs += s.durationMs;
      durationCount += 1;
      if (s.isBackfill) assumed += 1;
    }

    // The host doesn't pay their own fee (see lib/houseFee.ts).
    const paying = s.players.filter(
      (p) => p.playerId !== s.hostPlayerId,
    ).length;
    fees += s.houseFeePerPlayer * paying;

    for (const p of s.players) {
      buyInCount += p.buyInCount;
      // Backfill collapses buy-ins into one row, so rebuy rate would read as
      // zero for every historical night. Exclude them from the denominator.
      if (!s.isBackfill) {
        realBuyInNights += 1;
        if (p.buyInCount > 1) rebuyNights += 1;
      }
    }

    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = months.get(key);
    if (existing) {
      existing.sessions += 1;
      existing.pot += s.pot;
    } else {
      months.set(key, {
        key,
        label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        sessions: 1,
        pot: s.pot,
      });
    }
  }

  const n = sessions.length;

  return {
    avgPlayersPerNight: n > 0 ? playerNights / n : 0,
    totalBuyInCount: buyInCount,
    buyInsPerPlayerNight: playerNights > 0 ? buyInCount / playerNights : 0,
    rebuyRate: realBuyInNights > 0 ? rebuyNights / realBuyInNights : 0,
    avgPotPerPlayer: playerNights > 0 ? pot / playerNights : 0,
    houseFeesCollected: fees,
    byMonth: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)),
    totalHoursPlayed: durationMs / 3600000,
    avgHoursPlayed: durationCount > 0 ? durationMs / durationCount / 3600000 : 0,
    assumedDurationSessions: assumed,
  };
}

// ---------- House ledger ----------

export interface HouseRow {
  sessionId: string;
  at: number;
  perPlayer: number;
  payers: number;
  collected: number;
}

export interface HouseLedger {
  total: number;
  /** Newest first. */
  rows: HouseRow[];
}

/**
 * What the host has collected in table fees.
 *
 * This is the *other* ledger — a pure transfer, not poker. It never touches
 * buy-ins, chips, P/L or anything on the stats page. It lives here only so
 * there's one honest record of it. See lib/houseFee.ts for the model.
 */
export function computeHouseLedger(sessions: SessionSummary[]): HouseLedger {
  const rows = sessions
    .map((s) => {
      // The host doesn't pay their own fee.
      const payers = s.players.filter(
        (p) => p.playerId !== s.hostPlayerId,
      ).length;
      return {
        sessionId: s.id,
        at: s.startedAt,
        perPlayer: s.houseFeePerPlayer,
        payers,
        collected: s.houseFeePerPlayer * payers,
      };
    })
    .filter((r) => r.collected > 0)
    .sort((a, b) => b.at - a.at);

  return {
    total: rows.reduce((sum, r) => sum + r.collected, 0),
    rows,
  };
}

// ---------- Player extras ----------

export interface Streak {
  type: "W" | "L" | "E";
  length: number;
}

export interface PlayerExtras {
  playerId: string;
  /** Profit as a share of everything they ever put on the table. */
  roi: number;
  currentStreak: Streak | null;
  longestWinStreak: number;
  longestLossStreak: number;
  /** 1 = finished top of the table. Averaged across nights played. */
  avgFinishPosition: number;
  timesFirst: number;
  timesLast: number;
  /** Null when they've only ever played backfilled nights. */
  profitPerHour: number | null;
  /** Population standard deviation of nightly P/L — how swingy they are. */
  volatility: number;
  /** Nights played as a share of nights held since their first appearance. */
  attendanceRate: number;
  /** Running total of P/L, oldest first. For the cumulative chart. */
  cumulative: { at: number; total: number }[];
  /**
   * The typical night. More honest than the mean when one huge result would
   * otherwise drag the average around.
   */
  medianNight: number;
  /**
   * Nights played since their last winning night. 0 if they won last time
   * out, null if they've never won.
   */
  nightsSinceLastWin: number | null;
  /** Results grouped by how many were at the table. */
  byTableSize: TableSizeRow[];
  /**
   * Average minutes into a night at which this player rebuys, and how many
   * rebuys that average is built from. Null when they've never rebought in a
   * session the app actually timed.
   */
  rebuyTiming: { avgMinute: number; samples: number } | null;
  /**
   * Nights survived on a single buy-in, out of the timed nights they played.
   * Backfilled sessions are excluded — they collapse every player's buy-ins
   * into one row, which would make the whole table look like rocks.
   */
  rockNights: { nights: number; outOf: number };
  /**
   * How often they were first at the table to reload, out of the timed nights
   * where anyone reloaded at all.
   */
  firstToReload: { nights: number; outOf: number };
  /**
   * Average share of the night's pot they put in, and the share they left
   * with. The pot is zero-sum, so the two are directly comparable: taking out
   * more than you put in is the whole game. Both 0–1.
   */
  potShareIn: number;
  potShareOut: number;
}

export interface TableSizeRow {
  size: number;
  sessions: number;
  totalProfitLoss: number;
  avgProfitLoss: number;
}

/**
 * Deliberately absent: head-to-head / nemesis.
 *
 * The app records buy-ins and final chip counts, not hands. Comparing two
 * players' nightly results tells you whose scorecard was better on nights they
 * both attended — it cannot tell you that money moved between them. Ram can
 * lose his entire stack to Gita while Sita wins hers off someone else, and a
 * "Ram is down ₹4,000 to Sita" figure would look identical. Don't add it back
 * without per-hand data.
 */
export function computePlayerExtras(
  sessions: SessionSummary[],
): PlayerExtras[] {
  // Oldest first so streaks and cumulative totals build in real order.
  const chronological = [...sessions].sort((a, b) => a.startedAt - b.startedAt);

  interface Acc {
    playerId: string;
    results: number[];
    pls: number[];
    totalBuyIn: number;
    totalPl: number;
    positions: number[];
    timesFirst: number;
    timesLast: number;
    timedProfit: number;
    timedMs: number;
    firstIndex: number;
    cumulative: { at: number; total: number }[];
    tableSizes: Map<number, { sessions: number; total: number }>;
    rebuyOffsets: number[];
    rockNights: number;
    timedNights: number;
    firstToReload: number;
    reloadNights: number;
    shareIn: number[];
    shareOut: number[];
  }

  const acc = new Map<string, Acc>();

  chronological.forEach((s, sessionIndex) => {
    const ranked = [...s.players].sort((a, b) => b.profitLoss - a.profitLoss);

    // Who reloaded first tonight. Backfill stamps every buy-in at started_at,
    // so it can't answer this and is skipped entirely.
    let earliestReload = Infinity;
    const firstReloaders = new Set<string>();
    if (!s.isBackfill) {
      for (const p of s.players) {
        const firstRebuy = p.buyInTimes[1];
        if (firstRebuy === undefined) continue;
        if (firstRebuy < earliestReload) {
          earliestReload = firstRebuy;
          firstReloaders.clear();
          firstReloaders.add(p.playerId);
        } else if (firstRebuy === earliestReload) {
          firstReloaders.add(p.playerId);
        }
      }
    }
    const anyoneReloaded = firstReloaders.size > 0;

    for (const p of s.players) {
      let e = acc.get(p.playerId);
      if (!e) {
        e = {
          playerId: p.playerId,
          results: [],
          pls: [],
          totalBuyIn: 0,
          totalPl: 0,
          positions: [],
          timesFirst: 0,
          timesLast: 0,
          timedProfit: 0,
          timedMs: 0,
          firstIndex: sessionIndex,
          cumulative: [],
          tableSizes: new Map(),
          rebuyOffsets: [],
          rockNights: 0,
          timedNights: 0,
          firstToReload: 0,
          reloadNights: 0,
          shareIn: [],
          shareOut: [],
        };
        acc.set(p.playerId, e);
      }

      if (!s.isBackfill) {
        e.timedNights += 1;
        if (p.buyInCount === 1) e.rockNights += 1;
        if (anyoneReloaded) {
          e.reloadNights += 1;
          if (firstReloaders.has(p.playerId)) e.firstToReload += 1;
        }
      }

      // The pot is zero-sum, so share in and share out are comparable.
      if (s.pot > 0) {
        e.shareIn.push(p.totalBuyIn / s.pot);
        e.shareOut.push(p.chipsLeft / s.pot);
      }

      const size = s.players.length;
      const bucket = e.tableSizes.get(size) ?? { sessions: 0, total: 0 };
      bucket.sessions += 1;
      bucket.total += p.profitLoss;
      e.tableSizes.set(size, bucket);

      // Every buy-in after the first, as minutes from the start of the night.
      // Backfill stamps one aggregate row at started_at, so it's excluded —
      // including it would claim every historical rebuy happened at minute 0.
      if (!s.isBackfill) {
        for (const t of p.buyInTimes.slice(1)) {
          const minutes = (t - s.startedAt) / 60000;
          if (minutes >= 0) e.rebuyOffsets.push(minutes);
        }
      }

      e.results.push(p.profitLoss > 0 ? 1 : p.profitLoss < 0 ? -1 : 0);
      e.pls.push(p.profitLoss);
      e.totalBuyIn += p.totalBuyIn;
      e.totalPl += p.profitLoss;
      e.cumulative.push({ at: s.startedAt, total: e.totalPl });

      // Ties share the better position — two players on +500 are both 1st.
      const position =
        ranked.findIndex((r) => r.profitLoss === p.profitLoss) + 1;
      e.positions.push(position);
      if (position === 1) e.timesFirst += 1;
      if (
        s.players.length > 1 &&
        p.profitLoss === ranked[ranked.length - 1].profitLoss
      ) {
        e.timesLast += 1;
      }

      if (s.durationMs !== null && s.durationMs > 0) {
        e.timedProfit += p.profitLoss;
        e.timedMs += s.durationMs;
      }
    }
  });

  const totalSessions = chronological.length;

  return [...acc.values()].map((e) => {
    return {
      playerId: e.playerId,
      roi: e.totalBuyIn > 0 ? e.totalPl / e.totalBuyIn : 0,
      currentStreak: currentStreak(e.results),
      longestWinStreak: longestRun(e.results, 1),
      longestLossStreak: longestRun(e.results, -1),
      avgFinishPosition: mean(e.positions),
      timesFirst: e.timesFirst,
      timesLast: e.timesLast,
      profitPerHour:
        e.timedMs > 0 ? e.timedProfit / (e.timedMs / 3600000) : null,
      volatility: stdDev(e.pls),
      // Nights available to them = every night from their debut onwards.
      attendanceRate:
        totalSessions - e.firstIndex > 0
          ? e.results.length / (totalSessions - e.firstIndex)
          : 0,
      cumulative: e.cumulative,
      medianNight: median(e.pls),
      nightsSinceLastWin: nightsSinceLastWin(e.results),
      byTableSize: [...e.tableSizes.entries()]
        .map(([size, v]) => ({
          size,
          sessions: v.sessions,
          totalProfitLoss: v.total,
          avgProfitLoss: v.total / v.sessions,
        }))
        .sort((a, b) => a.size - b.size),
      rebuyTiming:
        e.rebuyOffsets.length > 0
          ? {
              avgMinute: mean(e.rebuyOffsets),
              samples: e.rebuyOffsets.length,
            }
          : null,
      rockNights: { nights: e.rockNights, outOf: e.timedNights },
      firstToReload: { nights: e.firstToReload, outOf: e.reloadNights },
      potShareIn: mean(e.shareIn),
      potShareOut: mean(e.shareOut),
    };
  });
}

// ---------- Small maths helpers ----------

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Middle value; the mean of the middle two on an even count. */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * How many nights they've played since last winning one. Results are oldest
 * first. Returns 0 if the most recent night was a win, null if never.
 */
export function nightsSinceLastWin(results: number[]): number | null {
  let count = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] > 0) return count;
    count += 1;
  }
  return null;
}

export function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Length of the run of identical results at the end of the list. */
export function currentStreak(results: number[]): Streak | null {
  if (results.length === 0) return null;
  const last = results[results.length - 1];
  let len = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) {
    len += 1;
  }
  return { type: last > 0 ? "W" : last < 0 ? "L" : "E", length: len };
}

/** Longest consecutive run of `value` anywhere in the list. */
export function longestRun(results: number[], value: number): number {
  let best = 0;
  let run = 0;
  for (const r of results) {
    if (r === value) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}
