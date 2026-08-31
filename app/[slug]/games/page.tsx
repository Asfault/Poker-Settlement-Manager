"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useSharedStats } from "@/lib/db/useSharedStats";
import GameHistoryList from "@/components/stats/GameHistoryList";
import SharedFrame from "@/components/stats/SharedFrame";

/**
 * Every night of the current season. Scoped like the rest of the shared
 * link — listing all history here would let anyone add the seasons up
 * themselves, which is exactly what the reset is meant to prevent.
 */
export default function SharedGamesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const shared = useSharedStats(slug);

  return (
    <SharedFrame state={shared.state} onUnlock={shared.unlock}>
      <Link
        href={`/${slug}`}
        className="text-white/40 hover:text-white text-sm inline-flex items-center min-h-[44px]"
      >
        ← Stats
      </Link>

      <header className="mb-5 mt-1">
        <h1 className="text-xl font-bold">Game history</h1>
        <p className="text-white/50 text-sm">
          {shared.seasonLabel && `${shared.seasonLabel} · `}
          {shared.sessions.length} night
          {shared.sessions.length === 1 ? "" : "s"}, newest first
        </p>
      </header>

      <GameHistoryList
        sessions={shared.sessions}
        gameHref={(id) => `/${slug}/game/${id}`}
      />
    </SharedFrame>
  );
}
