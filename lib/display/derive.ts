import type {
  DisplayHistorySession,
  DisplayLivePlayer,
  DisplayPayload,
} from "@/lib/db/display";
import { seasonLabel, seasonOf } from "@/lib/stats/season";

/**
 * Everything the board and the content engine read, derived once from the
 * raw payload. Poker numbers only — house fees never enter these.
 */

export interface LiveRow {
  playerId: string;
  name: string;
  displayName: string;
  photoUrl: string | null;
  characterUrl: string | null;
  totalBuyIn: number;
  buyInCount: number;
  /** Every buy-in tonight, oldest first. Drives the timeline card. */
  buyIns: { amount: number; at: number }[];
  lastBuyInAt: number | null;
  /** Buy-ins in the last 15 minutes. */
  recentBuyIns: number;
  /** Showing the tilt aura right now. */
  tilted: boolean;
  /**
   * When the current tilt episode began. Stable for the whole episode, so
   * the alert fires once no matter how many more times they reload.
   */
  tiltStartedAt: number | null;
  isHost: boolean;
}

export interface LifetimeRow {
  playerId: string;
  name: string;
  displayName: string;
  photoUrl: string | null;
  sessions: number;
  totalProfitLoss: number;
  wins: number;
  losses: number;
  winRate: number;
  biggestWin: number;
  biggestLoss: number;
  avgProfitLoss: number;
  totalBuyIn: number;
  totalBuyInCount: number;
  /** Newest first: +1 win, -1 loss, 0 even. */
  form: number[];
  currentStreak: { kind: "win" | "loss" | "none"; length: number };
  /** The typical night. Diverges from the mean when one result dominates. */
  medianNight: number;
  /** Longest runs ever, not just the current one. */
  longestWinStreak: number;
  longestLossStreak: number;
  /** Nights played since their last winning one. Null if they never have. */
  nightsSinceLastWin: number | null;
  /** Nights played as a share of nights held since their debut, 0–1. */
  attendanceRate: number;
  /** Nights they finished top of the table, and their average position. */
  timesFirst: number;
  avgFinishPosition: number;
  /**
   * Average share of the night's money they put in, against the share they
   * left with. The pot is zero-sum, so the two are directly comparable.
   */
  potShareIn: number;
  potShareOut: number;
  /** Population standard deviation of nightly results — how swingy they are. */
  volatility: number;
  /**
   * Nights survived on a single buy-in, out of nights the app actually timed.
   * Backfill collapses buy-ins into one row, so it's excluded — otherwise
   * every historical night would look like discipline.
   */
  rockNights: { nights: number; outOf: number };
  /** Nights they were first to reload, out of nights anyone reloaded. */
  firstToReload: { nights: number; outOf: number };
  /** Their most and least profitable table size, once there's enough to say. */
  bestTableSize: { size: number; avg: number; sessions: number } | null;
  worstTableSize: { size: number; avg: number; sessions: number } | null;
  /** Profit per hour across sessions with a duration. */
  profitPerHour: number | null;
  /** False once archived — keeps them out of the filler pool. */
  isActive: boolean;
}

export interface GroupFacts {
  sessions: number;
  totalMoney: number;
  biggestPot: number;
  avgPot: number;
  avgDurationMs: number | null;
  byWeekday: number[];
  busiestWeekday: number | null;
  firstSession: number | null;
  totalBuyInCount: number;
  avgPlayersPerNight: number;
  avgPotPerPlayer: number;
  /** Share of timed player-nights that involved a reload, 0–1. */
  rebuyRate: number;
  totalHoursPlayed: number;
  /** The most people ever round the table, and when. */
  biggestTable: { size: number; at: number } | null;
  /** Money across the table per hour played. */
  moneyPerHour: number | null;
}

export interface Derived {
  live: {
    sessionId: string;
    startedAt: number;
    rows: LiveRow[];
    pot: number;
    playerCount: number;
  } | null;
  lifetime: LifetimeRow[];
  group: GroupFacts;
  /**
   * The current season only — the same windows the shared page uses, derived
   * from dates so the board needs nothing new from the database.
   *
   * Standings are seasonal because "who's winning" is a season question.
   * Everything else on the board — records, per-player facts, how much has
   * moved across this table — stays all-time, because "what this table has
   * done" isn't.
   */
  season: {
    label: string;
    standings: LifetimeRow[];
    sessions: number;
    totalMoney: number;
  };
}

const TILT_WINDOW_MS = 15 * 60 * 1000; // two buy-ins this close starts it
const TILT_HOLD_MS = 5 * 60 * 1000; // aura lasts this long after the last one

/**
 * Work out whether someone is currently on tilt.
 *
 * An episode starts on the second buy-in inside a 15-minute window, and
 * runs for 5 minutes from the most recent buy-in. Reloading while already
 * tilted pushes the end back rather than starting a fresh episode — which
 * is what keeps the alert from firing again on the third and fourth.
 */
function tiltState(
  times: number[],
  now: number,
): { tilted: boolean; startedAt: number | null } {
  const s = [...times].sort((a, b) => a - b);
  let expiry: number | null = null;
  let episodeStart: number | null = null;

  for (let i = 0; i < s.length; i += 1) {
    const t = s[i];
    if (expiry !== null && t <= expiry) {
      // Reloaded mid-episode — extend it, keep the original start.
      expiry = t + TILT_HOLD_MS;
      continue;
    }
    // Previous episode (if any) has lapsed.
    expiry = null;
    episodeStart = null;
    if (i > 0 && t - s[i - 1] <= TILT_WINDOW_MS) {
      expiry = t + TILT_HOLD_MS;
      episodeStart = t;
    }
  }

  const tilted = expiry !== null && now <= expiry;
  return { tilted, startedAt: tilted ? episodeStart : null };
}

function nameOf(p: { name: string; nickname: string | null }): string {
  return p.nickname?.trim() || p.name;
}

// Season windows are derived from dates, so the board can scope itself
// without the payload carrying any season data.


export function derive(payload: DisplayPayload, now = Date.now()): Derived {
  const season = seasonOf(now);
  const seasonHistory = payload.history.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= season.startsAt && t < season.endsAt;
  });

  return {
    live: deriveLive(payload, now),
    lifetime: deriveLifetime(payload.history),
    group: deriveGroup(payload.history),
    season: {
      label: seasonLabel(season),
      standings: deriveLifetime(seasonHistory),
      sessions: seasonHistory.length,
      totalMoney: seasonHistory.reduce(
        (sum, s) => sum + s.players.reduce((a, p) => a + p.total_buy_in, 0),
        0,
      ),
    },
  };
}

function deriveLive(payload: DisplayPayload, now: number): Derived["live"] {
  const s = payload.live;
  if (!s) return null;

  const rows: LiveRow[] = s.players.map((p: DisplayLivePlayer) => {
    const times = p.buy_ins.map((b) => new Date(b.at).getTime());
    const recent = times.filter((t) => now - t <= TILT_WINDOW_MS).length;
    const tilt = tiltState(times, now);
    return {
      playerId: p.player_id,
      name: p.name,
      displayName: nameOf(p),
      photoUrl: p.photo_url,
      characterUrl: p.character_url ?? null,
      totalBuyIn: p.total_buy_in,
      buyInCount: p.buy_ins.length,
      buyIns: [...p.buy_ins]
        .map((b) => ({ amount: b.amount, at: new Date(b.at).getTime() }))
        .sort((a, b) => a.at - b.at),
      lastBuyInAt: times.length ? Math.max(...times) : null,
      recentBuyIns: recent,
      tilted: tilt.tilted,
      tiltStartedAt: tilt.startedAt,
      isHost: p.player_id === s.host_player_id,
    };
  });

  return {
    sessionId: s.id,
    startedAt: new Date(s.started_at).getTime(),
    rows,
    pot: rows.reduce((sum, r) => sum + r.totalBuyIn, 0),
    playerCount: rows.length,
  };
}

/** Extra accumulators kept alongside each LifetimeRow while building it. */
interface Acc {
  pls: number[];
  positions: number[];
  shareIn: number[];
  shareOut: number[];
  tableSizes: Map<number, { sessions: number; total: number }>;
  firstIndex: number;
  rockNights: number;
  timedNights: number;
  firstToReload: number;
  reloadNights: number;
  timedProfit: number;
  timedMs: number;
}

function deriveLifetime(history: DisplayHistorySession[]): LifetimeRow[] {
  const map = new Map<string, LifetimeRow>();
  const acc = new Map<string, Acc>();

  // Oldest first so form builds chronologically, reversed at the end.
  const chronological = [...history].sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  chronological.forEach((session, sessionIndex) => {
    const pot = session.players.reduce((s, p) => s + p.total_buy_in, 0);
    const started = new Date(session.started_at).getTime();
    const ended = session.ended_at ? new Date(session.ended_at).getTime() : 0;
    const durationMs = ended > started ? ended - started : 0;
    const isBackfill = session.is_backfill === true;

    const ranked = [...session.players].sort(
      (a, b) => b.chips_left - b.total_buy_in - (a.chips_left - a.total_buy_in),
    );

    // Who reloaded first tonight. Backfill stamps every buy-in at the start,
    // so it can't answer this and is skipped.
    let earliest = Infinity;
    const firstReloaders = new Set<string>();
    if (!isBackfill) {
      for (const p of session.players) {
        const times = (p.buy_in_times ?? [])
          .map((t) => new Date(t).getTime())
          .sort((a, b) => a - b);
        const rebuy = times[1];
        if (rebuy === undefined) continue;
        if (rebuy < earliest) {
          earliest = rebuy;
          firstReloaders.clear();
          firstReloaders.add(p.player_id);
        } else if (rebuy === earliest) {
          firstReloaders.add(p.player_id);
        }
      }
    }
    const anyoneReloaded = firstReloaders.size > 0;

    for (const p of session.players) {
      const pl = p.total_buy_in === 0 && p.chips_left === 0
        ? 0
        : p.chips_left - p.total_buy_in;

      let e = map.get(p.player_id);
      if (!e) {
        e = {
          playerId: p.player_id,
          name: p.name,
          displayName: nameOf(p),
          photoUrl: p.photo_url,
          sessions: 0,
          totalProfitLoss: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          biggestWin: 0,
          biggestLoss: 0,
          avgProfitLoss: 0,
          totalBuyIn: 0,
          totalBuyInCount: 0,
          form: [],
          currentStreak: { kind: "none", length: 0 },
          isActive: true,
          medianNight: 0,
          longestWinStreak: 0,
          longestLossStreak: 0,
          nightsSinceLastWin: null,
          attendanceRate: 0,
          timesFirst: 0,
          avgFinishPosition: 0,
          potShareIn: 0,
          potShareOut: 0,
          volatility: 0,
          rockNights: { nights: 0, outOf: 0 },
          firstToReload: { nights: 0, outOf: 0 },
          bestTableSize: null,
          worstTableSize: null,
          profitPerHour: null,
        };
        map.set(p.player_id, e);
      }

      let a = acc.get(p.player_id);
      if (!a) {
        a = {
          pls: [],
          positions: [],
          shareIn: [],
          shareOut: [],
          tableSizes: new Map(),
          firstIndex: sessionIndex,
          rockNights: 0,
          timedNights: 0,
          firstToReload: 0,
          reloadNights: 0,
          timedProfit: 0,
          timedMs: 0,
        };
        acc.set(p.player_id, a);
      }

      a.pls.push(pl);
      // Ties share the better position — two players level are both 1st.
      a.positions.push(
        ranked.findIndex((r) => r.chips_left - r.total_buy_in === pl) + 1,
      );
      if (pot > 0) {
        a.shareIn.push(p.total_buy_in / pot);
        a.shareOut.push(p.chips_left / pot);
      }
      const size = session.players.length;
      const bucket = a.tableSizes.get(size) ?? { sessions: 0, total: 0 };
      bucket.sessions += 1;
      bucket.total += pl;
      a.tableSizes.set(size, bucket);

      if (!isBackfill) {
        a.timedNights += 1;
        if (p.buy_in_count === 1) a.rockNights += 1;
        if (anyoneReloaded) {
          a.reloadNights += 1;
          if (firstReloaders.has(p.player_id)) a.firstToReload += 1;
        }
      }
      if (durationMs > 0) {
        a.timedProfit += pl;
        a.timedMs += durationMs;
      }

      e.name = p.name;
      e.displayName = nameOf(p);
      e.photoUrl = p.photo_url;
      e.isActive = p.is_active !== false;
      e.sessions += 1;
      e.totalProfitLoss += pl;
      e.totalBuyIn += p.total_buy_in;
      e.totalBuyInCount += p.buy_in_count;
      if (pl > 0) {
        e.wins += 1;
        e.form.push(1);
      } else if (pl < 0) {
        e.losses += 1;
        e.form.push(-1);
      } else {
        e.form.push(0);
      }
      if (pl > e.biggestWin) e.biggestWin = pl;
      if (pl < e.biggestLoss) e.biggestLoss = pl;
    }
  });

  const totalSessions = chronological.length;

  return [...map.values()]
    .map((e) => {
      const form = [...e.form].reverse();
      const a = acc.get(e.playerId);
      const chronForm = e.form;

      const sizes = a
        ? [...a.tableSizes.entries()]
            // One night at a table size says nothing.
            .filter(([, v]) => v.sessions >= 2)
            .map(([size, v]) => ({
              size,
              sessions: v.sessions,
              avg: v.total / v.sessions,
            }))
            .sort((x, y) => y.avg - x.avg)
        : [];

      return {
        ...e,
        winRate: e.sessions > 0 ? e.wins / e.sessions : 0,
        avgProfitLoss: e.sessions > 0 ? e.totalProfitLoss / e.sessions : 0,
        form: form.slice(0, 12),
        currentStreak: streakOf(form),
        medianNight: median(a?.pls ?? []),
        longestWinStreak: longestRun(chronForm, 1),
        longestLossStreak: longestRun(chronForm, -1),
        nightsSinceLastWin: nightsSinceLastWin(chronForm),
        attendanceRate:
          a && totalSessions - a.firstIndex > 0
            ? e.sessions / (totalSessions - a.firstIndex)
            : 0,
        timesFirst: a ? a.positions.filter((x) => x === 1).length : 0,
        avgFinishPosition: mean(a?.positions ?? []),
        potShareIn: mean(a?.shareIn ?? []),
        potShareOut: mean(a?.shareOut ?? []),
        volatility: stdDev(a?.pls ?? []),
        rockNights: {
          nights: a?.rockNights ?? 0,
          outOf: a?.timedNights ?? 0,
        },
        firstToReload: {
          nights: a?.firstToReload ?? 0,
          outOf: a?.reloadNights ?? 0,
        },
        // Only interesting when there's a contrast to draw.
        bestTableSize: sizes.length >= 2 ? sizes[0] : null,
        worstTableSize: sizes.length >= 2 ? sizes[sizes.length - 1] : null,
        profitPerHour:
          a && a.timedMs > 0 ? a.timedProfit / (a.timedMs / 3600000) : null,
      };
    })
    .sort((a, b) => b.totalProfitLoss - a.totalProfitLoss);
}

// ---------- small maths ----------

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Longest consecutive run of `value`. Form is oldest-first here. */
function longestRun(form: number[], value: number): number {
  let best = 0;
  let run = 0;
  for (const f of form) {
    if (f === value) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Nights played since the last win. 0 if they won last time, null if never. */
function nightsSinceLastWin(formOldestFirst: number[]): number | null {
  let count = 0;
  for (let i = formOldestFirst.length - 1; i >= 0; i -= 1) {
    if (formOldestFirst[i] > 0) return count;
    count += 1;
  }
  return null;
}

/** Run of consecutive wins or losses at the top of the (newest-first) form. */
function streakOf(formNewestFirst: number[]): LifetimeRow["currentStreak"] {
  if (formNewestFirst.length === 0) return { kind: "none", length: 0 };
  const first = formNewestFirst[0];
  if (first === 0) return { kind: "none", length: 0 };
  let n = 0;
  for (const f of formNewestFirst) {
    if (f !== first) break;
    n += 1;
  }
  return { kind: first > 0 ? "win" : "loss", length: n };
}

function deriveGroup(history: DisplayHistorySession[]): GroupFacts {
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  let totalMoney = 0;
  let biggestPot = 0;
  let durationSum = 0;
  let durationCount = 0;
  let buyInCount = 0;
  let playerNights = 0;
  let rebuyNights = 0;
  let timedPlayerNights = 0;
  let biggestTable: GroupFacts["biggestTable"] = null;
  const starts: number[] = [];

  for (const s of history) {
    const pot = s.players.reduce((sum, p) => sum + p.total_buy_in, 0);
    totalMoney += pot;
    if (pot > biggestPot) biggestPot = pot;
    buyInCount += s.players.reduce((sum, p) => sum + p.buy_in_count, 0);
    playerNights += s.players.length;

    if (biggestTable === null || s.players.length > biggestTable.size) {
      biggestTable = {
        size: s.players.length,
        at: new Date(s.started_at).getTime(),
      };
    }

    // Backfill collapses buy-ins into one row, so a rebuy rate that counted
    // it would read as zero for the entire history.
    if (s.is_backfill !== true) {
      for (const p of s.players) {
        timedPlayerNights += 1;
        if (p.buy_in_count > 1) rebuyNights += 1;
      }
    }

    const started = new Date(s.started_at).getTime();
    starts.push(started);
    byWeekday[new Date(started).getDay()] += 1;

    if (s.ended_at) {
      const d = new Date(s.ended_at).getTime() - started;
      if (d > 0) {
        durationSum += d;
        durationCount += 1;
      }
    }
  }

  const max = Math.max(...byWeekday);
  return {
    sessions: history.length,
    totalMoney,
    biggestPot,
    avgPot: history.length ? Math.round(totalMoney / history.length) : 0,
    avgDurationMs: durationCount ? durationSum / durationCount : null,
    byWeekday,
    busiestWeekday: max > 0 ? byWeekday.indexOf(max) : null,
    firstSession: starts.length ? Math.min(...starts) : null,
    totalBuyInCount: buyInCount,
    avgPlayersPerNight: history.length ? playerNights / history.length : 0,
    avgPotPerPlayer: playerNights ? totalMoney / playerNights : 0,
    rebuyRate: timedPlayerNights ? rebuyNights / timedPlayerNights : 0,
    totalHoursPlayed: durationSum / 3600000,
    biggestTable,
    moneyPerHour:
      durationSum > 0 ? totalMoney / (durationSum / 3600000) : null,
  };
}
