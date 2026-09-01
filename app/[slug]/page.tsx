"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useSharedStats } from "@/lib/db/useSharedStats";
import StatsView from "@/components/stats/StatsView";
import SharedFrame from "@/components/stats/SharedFrame";
import SeasonHeader from "@/components/stats/SeasonHeader";
import HallOfFame from "@/components/stats/HallOfFame";

/**
 * Public read-only stats at pokeresh.com/<slug>.
 *
 * Shows the CURRENT SEASON only — everything below comes from
 * `useSharedStats`, which scopes the sessions before they get here. All-time
 * figures are the host's alone.
 *
 * This is a catch-all at the root, so it also receives mistyped URLs; those
 * get a plain not-found rather than a password prompt they could never
 * satisfy. Static routes like /host and /display take precedence.
 */
export default function SharedStatsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const shared = useSharedStats(slug);

  return (
    <SharedFrame state={shared.state} onUnlock={shared.unlock}>
      <header className="mb-5">
        <p className="text-gold-400 font-bold">Pokeresh</p>
      </header>

      {shared.seasonResult && shared.season && (
        <SeasonHeader
          result={shared.seasonResult}
          label={shared.seasonLabel}
          note={shared.seasonNote}
          isCurrent={shared.isCurrentSeason}
          welcome
        />
      )}

      {/* Sits above the stats: in the first week of a season there's little
          else to show, and an empty page reads as broken. */}
      <HallOfFame entries={shared.hallOfFame} />

      {/* One layout, whether or not the season has started. With no games,
          StatsView draws the same page from the roster with every figure at
          zero — rather than a different, smaller page. */}
      <StatsView
        sessions={shared.sessions}
        playerHref={(id) => `/${slug}/player/${id}`}
        roster={shared.roster}
      />

      {shared.sessions.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/5">
          <Link
            href={`/${slug}/games`}
            className="flex items-center justify-between gap-3 min-h-[56px] px-4 rounded-2xl border border-white/10 hover:border-white/25 transition-colors"
          >
            <span>
              <span className="block font-semibold">View game history</span>
              <span className="block text-white/40 text-xs">
                All {shared.sessions.length} nights this season
              </span>
            </span>
            <span className="text-white/25 shrink-0">→</span>
          </Link>
        </div>
      )}
    </SharedFrame>
  );
}
