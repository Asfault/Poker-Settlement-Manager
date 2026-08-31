"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useSharedStats } from "@/lib/db/useSharedStats";
import GameSummaryView from "@/components/stats/GameSummaryView";
import SharedFrame from "@/components/stats/SharedFrame";
import Card from "@/components/Card";

/**
 * One night's summary on the public shared link.
 *
 * Only nights in the current season are reachable — a link to an older
 * game falls through to the not-found card rather than showing it.
 */
export default function SharedGamePage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = params?.slug ?? "";
  const sessionId = params?.id ?? "";
  const shared = useSharedStats(slug);

  const session = shared.sessions.find((s) => s.id === sessionId);

  return (
    <SharedFrame state={shared.state} onUnlock={shared.unlock}>
      {session ? (
        <GameSummaryView session={session} backHref={`/${slug}/games`} />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-white/50 text-sm mb-4">
            That game isn&apos;t in this season.
          </p>
          <Link href={`/${slug}/games`} className="text-gold-400 text-sm">
            Back to game history
          </Link>
        </Card>
      )}
    </SharedFrame>
  );
}
