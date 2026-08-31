"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SessionSummary, loadCompletedSessions } from "@/lib/db/stats";
import { SeasonSettings, loadSeasonSettings } from "@/lib/db/seasons";
import {
  computeSeasonResult,
  preSeasonSessions,
  seasonLabel,
  seasonsWithGames,
  sessionsInSeason,
} from "@/lib/stats/season";
import StatsView from "@/components/stats/StatsView";
import SeasonHeader from "@/components/stats/SeasonHeader";
import SeasonAdmin from "@/components/host/stats/SeasonAdmin";
import ShareStatsPanel from "@/components/host/stats/ShareStatsPanel";

/**
 * The host's stats page — the only place all-time figures appear.
 *
 * The shared link is scoped to the current season; here you can pick any
 * season, the whole history, or the games from before seasons began.
 */

/** Not a season id, so it can't collide with one. */
const ALL_TIME = "__all__";
const PRE_SEASON = "__pre__";

export default function StatsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [settings, setSettings] = useState<SeasonSettings>({
    startFrom: null,
    meta: [],
    exclusions: [],
  });
  const [scope, setScope] = useState<string>(ALL_TIME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const reloadSettings = useCallback(async () => {
    setSettings(await loadSeasonSettings());
  }, []);

  useEffect(() => {
    Promise.all([loadCompletedSessions(), loadSeasonSettings()])
      .then(([s, cfg]) => {
        setSessions(s);
        setSettings(cfg);
        // Land on the newest season if there is one — that's what you'd
        // want to look at, and it's what everyone else can see.
        const seasons = seasonsWithGames(s, cfg.startFrom);
        if (seasons.length > 0) setScope(seasons[0].id);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load stats"),
      )
      .finally(() => setLoading(false));
  }, []);

  const seasons = useMemo(
    () => seasonsWithGames(sessions, settings.startFrom),
    [sessions, settings.startFrom],
  );

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === scope) ?? null,
    [seasons, scope],
  );

  const scopedSessions = useMemo(() => {
    if (scope === ALL_TIME) return sessions;
    if (scope === PRE_SEASON)
      return preSeasonSessions(sessions, settings.startFrom);
    if (!selectedSeason) return sessions;
    return sessionsInSeason(sessions, selectedSeason, settings.startFrom);
  }, [scope, sessions, settings.startFrom, selectedSeason]);

  const seasonMeta = useMemo(
    () => settings.meta.find((m) => m.seasonId === selectedSeason?.id),
    [settings.meta, selectedSeason],
  );

  const seasonResult = useMemo(() => {
    if (!selectedSeason) return null;
    return computeSeasonResult(selectedSeason, scopedSessions, {
      excludedPlayerIds: settings.exclusions
        .filter((e) => e.seasonId === selectedSeason.id)
        .map((e) => e.playerId),
      noWinner: seasonMeta?.noWinner,
    });
  }, [selectedSeason, scopedSessions, settings.exclusions, seasonMeta]);

  const preSeasonCount = preSeasonSessions(sessions, settings.startFrom).length;

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Stats</h1>
            <p className="text-white/50 text-sm">
              Poker only — house fees excluded
            </p>
          </div>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="Share settings"
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="2.6" />
              <circle cx="6" cy="12" r="2.6" />
              <circle cx="18" cy="19" r="2.6" />
              <path d="M8.3 10.8 15.7 6.4" />
              <path d="M8.3 13.2l7.4 4.4" />
            </svg>
          </button>
        </header>

        {/* Scope. Everyone else only ever sees the current season; this is
            where the rest of it lives. */}
        {(seasons.length > 0 || preSeasonCount > 0) && (
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full mb-5 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-gold-500"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {seasonLabel(
                  s,
                  settings.meta.find((m) => m.seasonId === s.id)?.customName,
                )}
              </option>
            ))}
            <option value={ALL_TIME}>All time</option>
            {preSeasonCount > 0 && (
              <option value={PRE_SEASON}>
                Before seasons ({preSeasonCount})
              </option>
            )}
          </select>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {selectedSeason && seasonResult && (
          <>
            <SeasonHeader
              result={seasonResult}
              label={seasonLabel(selectedSeason, seasonMeta?.customName)}
              note={seasonMeta?.note ?? null}
              isCurrent={selectedSeason.id === seasons[0]?.id}
            />
            <SeasonAdmin
              season={selectedSeason}
              result={seasonResult}
              customName={seasonMeta?.customName ?? null}
              note={seasonMeta?.note ?? null}
              noWinner={seasonMeta?.noWinner ?? false}
              excludedPlayerIds={settings.exclusions
                .filter((e) => e.seasonId === selectedSeason.id)
                .map((e) => e.playerId)}
              onChanged={reloadSettings}
            />
          </>
        )}

        <StatsView
          sessions={scopedSessions}
          playerHref={(id) => `/host/players/${id}`}
        />
      </div>

      <ShareStatsPanel open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
