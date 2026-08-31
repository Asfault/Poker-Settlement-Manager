"use client";

import { useParams } from "next/navigation";
import { useSharedStats } from "@/lib/db/useSharedStats";
import PlayerDetailView from "@/components/stats/PlayerDetailView";
import SharedFrame from "@/components/stats/SharedFrame";

/**
 * One player's season on the public shared link.
 *
 * Season-scoped like everything else here, so these are their numbers for
 * this season rather than their record. No sessionHref — viewers have no
 * session screens to drill into.
 */
export default function SharedPlayerStatsPage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = params?.slug ?? "";
  const playerId = params?.id ?? "";
  const shared = useSharedStats(slug);

  return (
    <SharedFrame state={shared.state} onUnlock={shared.unlock}>
      <PlayerDetailView
        sessions={shared.sessions}
        playerId={playerId}
        backHref={`/${slug}`}
        backLabel="Stats"
      />
    </SharedFrame>
  );
}
