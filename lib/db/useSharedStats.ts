"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionSummary } from "@/lib/db/stats";
import {
  fetchSharedStats,
  forgetSharePassword,
  rememberSharePassword,
  savedSharePassword,
  sharedSlugExists,
} from "@/lib/db/shared-stats";
import {
  HallOfFameEntry,
  Season,
  SeasonMeta,
  SeasonResult,
  buildHallOfFame,
  computeSeasonResult,
  seasonLabel,
  seasonToShow,
  sessionsInSeason,
} from "@/lib/stats/season";

/**
 * Everything the public shared pages need: the password gate, and the
 * season scoping.
 *
 * Both live here on purpose. The scoping is a privacy guarantee — the
 * shared link shows the current season and nothing else — and a guarantee
 * that depends on four separate pages each remembering to filter is not a
 * guarantee. Pages get `sessions` already scoped and never see the rest.
 */

export type SharedState = "checking" | "missing" | "locked" | "ready";

export interface SharedStats {
  state: SharedState;
  /** Season-scoped. The only session list a shared page should render. */
  sessions: SessionSummary[];
  season: Season | null;
  seasonLabel: string;
  seasonNote: string | null;
  seasonResult: SeasonResult | null;
  /** False when showing the last completed season during an off-season. */
  isCurrentSeason: boolean;
  hallOfFame: HallOfFameEntry[];
  /** True once seasons are switched on but no games have been played yet. */
  awaitingFirstGame: boolean;
  unlock: (password: string) => Promise<boolean>;
}

export function useSharedStats(slug: string): SharedStats {
  const [state, setState] = useState<SharedState>("checking");
  const [all, setAll] = useState<SessionSummary[]>([]);
  const [startFrom, setStartFrom] = useState<number | null>(null);
  const [meta, setMeta] = useState<SeasonMeta[]>([]);
  const [exclusions, setExclusions] = useState<
    { seasonId: string; playerId: string }[]
  >([]);

  const apply = useCallback(
    async (password: string): Promise<boolean> => {
      const result = await fetchSharedStats(slug, password);
      if (!result.ok) return false;
      setAll(result.sessions);
      setStartFrom(result.seasonsStartFrom);
      setMeta(result.seasonMeta);
      setExclusions(result.seasonExclusions);
      setState("ready");
      return true;
    },
    [slug],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await sharedSlugExists(slug);
      if (!active) return;
      if (!found) {
        setState("missing");
        return;
      }
      // Returning viewer — try the stored password. It fails silently if
      // the host has rotated it since.
      const pw = savedSharePassword(slug);
      if (pw) {
        try {
          if (await apply(pw)) return;
          forgetSharePassword(slug);
        } catch {
          forgetSharePassword(slug);
        }
      }
      if (active) setState("locked");
    })();
    return () => {
      active = false;
    };
  }, [slug, apply]);

  const scoped = useMemo(() => {
    const showing = seasonToShow(all, startFrom, Date.now());
    if (!showing) {
      return {
        sessions: [] as SessionSummary[],
        season: null,
        result: null,
        isCurrent: true,
        label: "",
        note: null as string | null,
      };
    }
    const m = meta.find((x) => x.seasonId === showing.season.id);
    const seasonSessions = sessionsInSeason(all, showing.season, startFrom);
    return {
      sessions: seasonSessions,
      season: showing.season,
      result: computeSeasonResult(showing.season, seasonSessions, {
        excludedPlayerIds: exclusions
          .filter((e) => e.seasonId === showing.season.id)
          .map((e) => e.playerId),
        noWinner: m?.noWinner,
      }),
      isCurrent: showing.isCurrent,
      label: seasonLabel(showing.season, m?.customName),
      note: m?.note ?? null,
    };
  }, [all, startFrom, meta, exclusions]);

  const hallOfFame = useMemo(
    () =>
      buildHallOfFame(all, startFrom, meta, exclusions, scoped.season?.id),
    [all, startFrom, meta, exclusions, scoped.season],
  );

  return {
    state,
    sessions: scoped.sessions,
    season: scoped.season,
    seasonLabel: scoped.label,
    seasonNote: scoped.note,
    seasonResult: scoped.result,
    isCurrentSeason: scoped.isCurrent,
    hallOfFame,
    awaitingFirstGame: state === "ready" && scoped.season === null,
    unlock: async (password: string) => {
      const ok = await apply(password);
      if (ok) rememberSharePassword(slug, password);
      return ok;
    },
  };
}
