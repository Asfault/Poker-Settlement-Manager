import type {
  DisplayHistorySession,
  DisplayLivePlayer,
  DisplayPayload,
} from "@/lib/db/display";

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
  lastBuyInAt: number | null;
  /** Buy-ins in the last 15 minutes — drives the tilt alert. */
  recentBuyIns: number;
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
}

const TILT_WINDOW_MS = 15 * 60 * 1000;

function nameOf(p: { name: string; nickname: string | null }): string {
  return p.nickname?.trim() || p.name;
}

export function derive(payload: DisplayPayload, now = Date.now()): Derived {
  return {
    live: deriveLive(payload, now),
    lifetime: deriveLifetime(payload.history),
    group: deriveGroup(payload.history),
  };
}

function deriveLive(payload: DisplayPayload, now: number): Derived["live"] {
  const s = payload.live;
  if (!s) return null;

  const rows: LiveRow[] = s.players.map((p: DisplayLivePlayer) => {
    const times = p.buy_ins.map((b) => new Date(b.at).getTime());
    const recent = times.filter((t) => now - t <= TILT_WINDOW_MS).length;
    return {
      playerId: p.player_id,
      name: p.name,
      displayName: nameOf(p),
      photoUrl: p.photo_url,
      characterUrl: p.character_url ?? null,
      totalBuyIn: p.total_buy_in,
      buyInCount: p.buy_ins.length,
      lastBuyInAt: times.length ? Math.max(...times) : null,
      recentBuyIns: recent,
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

function deriveLifetime(history: DisplayHistorySession[]): LifetimeRow[] {
  const map = new Map<string, LifetimeRow>();

  // Oldest first so form builds chronologically, reversed at the end.
  const chronological = [...history].sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  for (const session of chronological) {
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
        };
        map.set(p.player_id, e);
      }

      e.name = p.name;
      e.displayName = nameOf(p);
      e.photoUrl = p.photo_url;
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
  }

  return [...map.values()]
    .map((e) => {
      const form = [...e.form].reverse();
      return {
        ...e,
        winRate: e.sessions > 0 ? e.wins / e.sessions : 0,
        avgProfitLoss: e.sessions > 0 ? e.totalProfitLoss / e.sessions : 0,
        form: form.slice(0, 12),
        currentStreak: streakOf(form),
      };
    })
    .sort((a, b) => b.totalProfitLoss - a.totalProfitLoss);
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
  const starts: number[] = [];

  for (const s of history) {
    const pot = s.players.reduce((sum, p) => sum + p.total_buy_in, 0);
    totalMoney += pot;
    if (pot > biggestPot) biggestPot = pot;
    buyInCount += s.players.reduce((sum, p) => sum + p.buy_in_count, 0);

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
  };
}
