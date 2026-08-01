import type { Derived, LifetimeRow, LiveRow } from "./derive";
import { formatINR } from "@/lib/format";

/**
 * Content for the slide-in player drawer.
 *
 * Four stat tiles and one chart are picked at random from pools each time,
 * so the same player looks different on their second appearance. Anything
 * without enough data behind it excludes itself.
 */

export interface StatTile {
  id: string;
  label: string;
  value: string;
  tone?: "win" | "loss" | "gold" | "neutral";
  /** Small trailing note, e.g. "of 9". */
  suffix?: string;
}

export type ChartKind = "form" | "cumulative" | "weekday";

export interface PlayerCardChart {
  kind: ChartKind;
  title: string;
  /** Form: per-session P/L, newest last. Cumulative: running total. */
  series: number[];
  /** Weekday only. */
  labels?: string[];
  footnote?: string;
}

export interface PlayerCard {
  playerId: string;
  name: string;
  characterUrl: string | null;
  photoUrl: string | null;
  tonightBuyIn: number;
  tiles: StatTile[];
  chart: PlayerCardChart | null;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Every tile this player currently has enough data to justify. */
function buildTiles(
  p: LifetimeRow | undefined,
  live: LiveRow,
  rank: number | null,
  total: number,
): StatTile[] {
  const tiles: StatTile[] = [];
  if (!p) {
    // First-ever session — nothing lifetime to show.
    tiles.push({
      id: "debut",
      label: "First night",
      value: "Debut",
      tone: "gold",
    });
    return tiles;
  }

  tiles.push({
    id: "total-pl",
    label: "All time",
    value: `${p.totalProfitLoss > 0 ? "+" : ""}${formatINR(p.totalProfitLoss)}`,
    tone: p.totalProfitLoss > 0 ? "win" : p.totalProfitLoss < 0 ? "loss" : "neutral",
  });

  tiles.push({
    id: "sessions",
    label: "Sessions",
    value: String(p.sessions),
  });

  if (p.sessions >= 2) {
    tiles.push({
      id: "win-rate",
      label: "Win rate",
      value: `${Math.round(p.winRate * 100)}%`,
    });
    tiles.push({
      id: "avg-pl",
      label: "Per night",
      value: `${p.avgProfitLoss > 0 ? "+" : ""}${formatINR(Math.round(p.avgProfitLoss))}`,
      tone: p.avgProfitLoss > 0 ? "win" : p.avgProfitLoss < 0 ? "loss" : "neutral",
    });
  }

  if (p.biggestWin > 0) {
    tiles.push({
      id: "best",
      label: "Best ever",
      value: `+${formatINR(p.biggestWin)}`,
      tone: "win",
    });
  }
  if (p.biggestLoss < 0) {
    tiles.push({
      id: "worst",
      label: "Worst ever",
      value: formatINR(p.biggestLoss),
      tone: "loss",
    });
  }

  if (p.sessions >= 2) {
    tiles.push({
      id: "reloads",
      label: "Reloads",
      value: `${(p.totalBuyInCount / p.sessions).toFixed(1)}×`,
      suffix: "a night",
    });
    tiles.push({
      id: "avg-buyin",
      label: "Avg buy-in",
      value: formatINR(Math.round(p.totalBuyIn / p.sessions)),
    });
  }

  if (rank !== null && total >= 3) {
    tiles.push({
      id: "rank",
      label: "Ranked",
      value: `#${rank}`,
      suffix: `of ${total}`,
      tone: "gold",
    });
  }

  if (p.currentStreak.kind !== "none" && p.currentStreak.length >= 2) {
    tiles.push({
      id: "streak",
      label: p.currentStreak.kind === "win" ? "Win streak" : "Losing streak",
      value: `${p.currentStreak.length}`,
      suffix: "in a row",
      tone: p.currentStreak.kind === "win" ? "win" : "loss",
    });
  }

  tiles.push({
    id: "staked",
    label: "Total staked",
    value: formatINR(p.totalBuyIn),
    tone: "gold",
  });

  return tiles;
}

function buildCharts(
  p: LifetimeRow | undefined,
  perSession: number[],
  weekday: { labels: string[]; values: number[] } | null,
): PlayerCardChart[] {
  const charts: PlayerCardChart[] = [];
  if (!p || perSession.length < 3) return charts;

  charts.push({
    kind: "form",
    title: `Last ${Math.min(8, perSession.length)} nights`,
    series: perSession.slice(-8),
    footnote: `Up in ${p.wins} of ${p.sessions}`,
  });

  // Running total across every session.
  let running = 0;
  const cumulative = perSession.map((v) => (running += v));
  charts.push({
    kind: "cumulative",
    title: "Profit over time",
    series: cumulative,
    footnote: `${p.sessions} sessions`,
  });

  if (weekday && weekday.values.filter((v) => v !== 0).length >= 2) {
    charts.push({
      kind: "weekday",
      title: "By day of week",
      series: weekday.values,
      labels: weekday.labels,
    });
  }

  return charts;
}

/** Build a drawer for one player currently at the table. */
export function buildPlayerCard(
  derived: Derived,
  live: LiveRow,
  history: { startedAt: number; profitLoss: number }[],
): PlayerCard {
  const lifetime = derived.lifetime.find((l) => l.playerId === live.playerId);
  const rankIndex = derived.lifetime.findIndex(
    (l) => l.playerId === live.playerId,
  );

  const chronological = [...history].sort((a, b) => a.startedAt - b.startedAt);
  const perSession = chronological.map((h) => h.profitLoss);

  // P/L grouped by weekday.
  const byDay = new Array(7).fill(0) as number[];
  const seenDay = new Array(7).fill(false) as boolean[];
  for (const h of chronological) {
    const d = new Date(h.startedAt).getDay();
    byDay[d] += h.profitLoss;
    seenDay[d] = true;
  }
  const dayIdx = seenDay.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  const weekday =
    dayIdx.length >= 2
      ? {
          labels: dayIdx.map((i) => WEEKDAY[i]),
          values: dayIdx.map((i) => byDay[i]),
        }
      : null;

  const tiles = shuffle(
    buildTiles(
      lifetime,
      live,
      rankIndex >= 0 ? rankIndex + 1 : null,
      derived.lifetime.length,
    ),
  ).slice(0, 4);

  const charts = buildCharts(lifetime, perSession, weekday);
  const chart = charts.length ? charts[Math.floor(Math.random() * charts.length)] : null;

  return {
    playerId: live.playerId,
    name: live.displayName,
    characterUrl: live.characterUrl,
    photoUrl: live.photoUrl,
    tonightBuyIn: live.totalBuyIn,
    tiles,
    chart,
  };
}

/** Per-session P/L history for one player, pulled from the payload. */
export function historyFor(
  derived: Derived,
  playerId: string,
  rawHistory: { started_at: string; players: { player_id: string; total_buy_in: number; chips_left: number }[] }[],
): { startedAt: number; profitLoss: number }[] {
  void derived;
  const out: { startedAt: number; profitLoss: number }[] = [];
  for (const s of rawHistory) {
    const me = s.players.find((p) => p.player_id === playerId);
    if (!me) continue;
    out.push({
      startedAt: new Date(s.started_at).getTime(),
      profitLoss: me.chips_left - me.total_buy_in,
    });
  }
  return out;
}
