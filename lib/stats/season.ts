import type { SessionSummary } from "@/lib/db/stats";

/**
 * Seasons.
 *
 * Four fixed windows, derived from a session's date. Nothing starts a
 * season and nothing ends one — which is the point. A manual system needs
 * an action twice every three months, and forgetting is silent: a night
 * gets played and belongs to nowhere.
 *
 * When a season turns out too thin to deserve a champion, that's recorded
 * with a note and the no-winner flag rather than by moving dates. Moving
 * dates erases what happened; a note states it.
 *
 * Pure module — no Supabase import, mirrored in __tests__/season.test.mjs.
 */

export type SeasonName = "winter" | "summer" | "monsoon" | "autumn";

export interface Season {
  /** Stable key, e.g. "2026-autumn". Winter is keyed on the year it starts. */
  id: string;
  name: SeasonName;
  /** The year the season began. Winter 2025 runs Dec 2025 – Feb 2026. */
  year: number;
  /** Inclusive start, exclusive end. */
  startsAt: number;
  endsAt: number;
}

const LABELS: Record<SeasonName, string> = {
  winter: "Winter",
  summer: "Summer",
  monsoon: "Monsoon",
  autumn: "Autumn",
};

/**
 * Accent colour per season, used on the shared page only. Deliberately just
 * an accent over the existing felt-green — recolouring the whole palette
 * four times a year would make three of them look worse than the default.
 */
export const SEASON_ACCENT: Record<SeasonName, string> = {
  winter: "#7cc7ff",
  summer: "#ffcf5c",
  monsoon: "#4fd1c5",
  autumn: "#f0913f",
};

/** First month (1–12) of each season. */
const START_MONTH: Record<SeasonName, number> = {
  winter: 12,
  summer: 3,
  monsoon: 6,
  autumn: 9,
};

function nameForMonth(month: number): SeasonName {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "summer";
  if (month <= 8) return "monsoon";
  return "autumn";
}

function build(name: SeasonName, year: number): Season {
  const startMonth = START_MONTH[name];
  const startsAt = new Date(year, startMonth - 1, 1).getTime();
  // Three months on, exclusive. Date handles the year rollover for winter.
  const endsAt = new Date(year, startMonth + 2, 1).getTime();
  return { id: `${year}-${name}`, name, year, startsAt, endsAt };
}

/** Which season a moment falls in. */
export function seasonOf(epochMs: number): Season {
  const d = new Date(epochMs);
  const month = d.getMonth() + 1;
  const name = nameForMonth(month);
  // Winter starting in December belongs to that year; January and February
  // belong to the winter that began the previous December.
  const year = name === "winter" && month <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  return build(name, year);
}

/** The season immediately after this one. */
export function nextSeason(season: Season): Season {
  return seasonOf(season.endsAt);
}

export function seasonLabel(season: Season, customName?: string | null): string {
  if (customName && customName.trim()) return customName.trim();
  if (season.name === "winter") {
    // Spans a year boundary, so both years are worth showing.
    return `Winter ${season.year}–${String(season.year + 1).slice(2)}`;
  }
  return `${LABELS[season.name]} ${season.year}`;
}

/** Just the season word — "Autumn". The greeting uses this rather than a
 *  custom name, so "Welcome to Autumn" still reads even when the season has
 *  been renamed to something else. */
export function seasonWord(name: SeasonName): string {
  return LABELS[name];
}

/**
 * Where a season is in its life. The shared page's banner changes with it:
 * big and welcoming before the first game, compact once there are stats
 * worth reading, and loud again at the end when the standings start to
 * matter. A hero that never changes is wallpaper by week eight.
 */
export type SeasonPhase = "opening" | "running" | "closing" | "finished";

/** How long before the end a season counts as closing. */
const CLOSING_MS = 21 * 86400000;

export function seasonPhase(
  season: Season,
  gameCount: number,
  isCurrent: boolean,
  now: number,
): SeasonPhase {
  if (!isCurrent || now >= season.endsAt) return "finished";
  if (gameCount === 0) return "opening";
  return season.endsAt - now <= CLOSING_MS ? "closing" : "running";
}

/**
 * Banner copy. Null while a season is simply running — at that point the
 * stats are the point and the header should get out of the way.
 */
export function seasonGreeting(
  season: Season,
  phase: SeasonPhase,
): { title: string; subtitle: string } | null {
  const word = seasonWord(season.name);

  if (phase === "opening") {
    const subtitles: Record<SeasonName, string> = {
      winter: "Long nights, short tempers, and nobody down a rupee yet.",
      summer: "Too hot to fold. Nobody has lost anything so far.",
      monsoon: "Nobody's going home early. Everyone still level.",
      autumn: "New season, clean slate, same mistakes ahead.",
    };
    return {
      title: `Welcome to ${word}`,
      subtitle: subtitles[season.name],
    };
  }

  if (phase === "closing") {
    const end = new Date(season.endsAt - 86400000).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
    });
    return {
      title: `${word} ends ${end}`,
      subtitle: "Whatever's on the table now is close to final.",
    };
  }

  if (phase === "finished") {
    return {
      title: `That's ${word} done`,
      subtitle: "Final standings below. The next one starts from nothing.",
    };
  }

  return null;
}

/** "1 Sep – 30 Nov 2026", for the season header. */
export function seasonRangeLabel(season: Season): string {
  const start = new Date(season.startsAt);
  // endsAt is exclusive, so step back a day for display.
  const end = new Date(season.endsAt - 86400000);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(start, start.getFullYear() !== end.getFullYear())} – ${fmt(end, true)}`;
}

// ---------- Scoping sessions ----------

/**
 * Sessions inside a season. `startFrom` is the date seasons begin at all —
 * anything before it belongs to no season and never reaches the shared page.
 */
export function sessionsInSeason(
  sessions: SessionSummary[],
  season: Season,
  startFrom: number | null,
): SessionSummary[] {
  return sessions.filter(
    (s) =>
      s.startedAt >= season.startsAt &&
      s.startedAt < season.endsAt &&
      (startFrom === null || s.startedAt >= startFrom),
  );
}

/** Sessions from before seasons began. Host-only. */
export function preSeasonSessions(
  sessions: SessionSummary[],
  startFrom: number | null,
): SessionSummary[] {
  if (startFrom === null) return [];
  return sessions.filter((s) => s.startedAt < startFrom);
}

/**
 * Every season that actually has games, newest first. Derived from the
 * sessions themselves, so a quarter nobody played simply doesn't appear.
 */
export function seasonsWithGames(
  sessions: SessionSummary[],
  startFrom: number | null,
): Season[] {
  const seen = new Map<string, Season>();
  for (const s of sessions) {
    if (startFrom !== null && s.startedAt < startFrom) continue;
    const season = seasonOf(s.startedAt);
    if (!seen.has(season.id)) seen.set(season.id, season);
  }
  return [...seen.values()].sort((a, b) => b.startsAt - a.startsAt);
}

/**
 * The season to show on the shared page: whichever one is running now.
 *
 * Always the current season, even before it has any games — that's the
 * "Welcome to Autumn" state, and it's the whole point of having an opening
 * phase. An earlier version fell back to the last season with games, which
 * was left over from a design where seasons were started by hand and gaps
 * between them were real. With fixed windows every moment belongs to a
 * season, so there's nothing to fall back to.
 *
 * Null only when seasons haven't been switched on, or we're still before
 * the date they begin.
 */
export function seasonToShow(
  sessions: SessionSummary[],
  startFrom: number | null,
  now: number,
): { season: Season; isCurrent: boolean } | null {
  if (startFrom === null || now < startFrom) return null;
  return { season: seasonOf(now), isCurrent: true };
}

// ---------- The award ----------

/** Below this share of the season's games, nobody is eligible. */
export const MIN_ATTENDANCE = 0.65;

export interface SeasonStanding {
  playerId: string;
  name: string;
  photoUrl: string | null;
  profit: number;
  sessions: number;
  wins: number;
  winRate: number;
  /** Their share of the season's games, 0–1. */
  attendance: number;
  eligible: boolean;
}

export interface SeasonResult {
  season: Season;
  /** Games played in the season. */
  gameCount: number;
  standings: SeasonStanding[];
  /** Null when nobody qualifies, or the season is flagged as having none. */
  winner: SeasonStanding | null;
  /** Shared with the winner on identical profit AND win rate. */
  tied: SeasonStanding[];
  /** Set when there are games but no eligible player. */
  noEligiblePlayers: boolean;
}

/**
 * Standings and the champion.
 *
 * Highest profit wins, with a minimum attendance of the season's games and
 * ties broken on win rate. Disqualified players stay in the standings —
 * their results are part of everyone else's season — they're just barred
 * from the award.
 *
 * The UI shows ineligibility without saying whether it came from attendance
 * or from the host's decision. That keeps disqualification from being an
 * announcement.
 */
export function computeSeasonResult(
  season: Season,
  seasonSessions: SessionSummary[],
  options: { excludedPlayerIds?: string[]; noWinner?: boolean } = {},
): SeasonResult {
  const excluded = new Set(options.excludedPlayerIds ?? []);
  const gameCount = seasonSessions.length;

  interface Acc {
    playerId: string;
    name: string;
    photoUrl: string | null;
    profit: number;
    sessions: number;
    wins: number;
  }
  const map = new Map<string, Acc>();

  for (const s of seasonSessions) {
    for (const p of s.players) {
      let e = map.get(p.playerId);
      if (!e) {
        e = {
          playerId: p.playerId,
          name: p.name,
          photoUrl: p.photoUrl,
          profit: 0,
          sessions: 0,
          wins: 0,
        };
        map.set(p.playerId, e);
      }
      e.name = p.name;
      e.photoUrl = p.photoUrl;
      e.profit += p.profitLoss;
      e.sessions += 1;
      if (p.profitLoss > 0) e.wins += 1;
    }
  }

  const standings: SeasonStanding[] = [...map.values()]
    .map((e) => {
      const attendance = gameCount > 0 ? e.sessions / gameCount : 0;
      return {
        playerId: e.playerId,
        name: e.name,
        photoUrl: e.photoUrl,
        profit: e.profit,
        sessions: e.sessions,
        wins: e.wins,
        winRate: e.sessions > 0 ? e.wins / e.sessions : 0,
        attendance,
        eligible: attendance >= MIN_ATTENDANCE && !excluded.has(e.playerId),
      };
    })
    .sort((a, b) => b.profit - a.profit);

  if (options.noWinner || gameCount === 0) {
    return {
      season,
      gameCount,
      standings,
      winner: null,
      tied: [],
      noEligiblePlayers: false,
    };
  }

  // Only a player in profit can be champion — crowning someone who lost
  // money over a whole season would be a strange trophy.
  const contenders = standings.filter((s) => s.eligible && s.profit > 0);
  if (contenders.length === 0) {
    return {
      season,
      gameCount,
      standings,
      winner: null,
      tied: [],
      // Distinguish "nobody turned up enough" from "nobody finished ahead".
      noEligiblePlayers: standings.every((s) => !s.eligible),
    };
  }

  const best = [...contenders].sort(
    (a, b) => b.profit - a.profit || b.winRate - a.winRate,
  );
  const top = best[0];
  // Only a dead heat on both measures counts as shared.
  const tied = best.filter(
    (s) =>
      s.playerId !== top.playerId &&
      s.profit === top.profit &&
      s.winRate === top.winRate,
  );

  return {
    season,
    gameCount,
    standings,
    winner: top,
    tied,
    noEligiblePlayers: false,
  };
}

// ---------- Hall of fame ----------

export interface HallOfFameEntry {
  season: Season;
  label: string;
  gameCount: number;
  winner: SeasonStanding | null;
  tied: SeasonStanding[];
  note: string | null;
  noEligiblePlayers: boolean;
}

export interface SeasonMeta {
  seasonId: string;
  customName: string | null;
  note: string | null;
  noWinner: boolean;
}

/**
 * Past seasons and their champions, newest first.
 *
 * Recomputed every time rather than stored, so correcting a disqualification
 * or flagging a season as having no winner updates history immediately.
 * `exclude` drops the season currently being shown, since it isn't history
 * yet.
 */
export function buildHallOfFame(
  sessions: SessionSummary[],
  startFrom: number | null,
  meta: SeasonMeta[],
  exclusions: { seasonId: string; playerId: string }[],
  excludeSeasonId?: string,
): HallOfFameEntry[] {
  const metaById = new Map(meta.map((m) => [m.seasonId, m]));

  return seasonsWithGames(sessions, startFrom)
    .filter((s) => s.id !== excludeSeasonId)
    .map((season) => {
      const m = metaById.get(season.id);
      const result = computeSeasonResult(
        season,
        sessionsInSeason(sessions, season, startFrom),
        {
          excludedPlayerIds: exclusions
            .filter((e) => e.seasonId === season.id)
            .map((e) => e.playerId),
          noWinner: m?.noWinner,
        },
      );
      return {
        season,
        label: seasonLabel(season, m?.customName),
        gameCount: result.gameCount,
        winner: result.winner,
        tied: result.tied,
        note: m?.note ?? null,
        noEligiblePlayers: result.noEligiblePlayers,
      };
    });
}
