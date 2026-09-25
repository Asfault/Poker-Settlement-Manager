"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SessionSummary, loadCompletedSessions } from "@/lib/db/stats";
import PlayerDetailView from "@/components/stats/PlayerDetailView";
import Card from "@/components/Card";

/** Full stats for one player, reached from the leaderboard expander. */
export default function HostPlayerStatsPage() {
  const params = useParams<{ id: string }>();
  const playerId = params?.id ?? "";

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedSessions()
      .then(setSessions)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load stats"),
      )
      .finally(() => setLoading(false));
  }, []);

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
        {error ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm mb-4">{error}</p>
            <Link href="/host/stats" className="text-gold-400 text-sm">
              Back to stats
            </Link>
          </Card>
        ) : (
          <PlayerDetailView
            sessions={sessions}
            playerId={playerId}
            backHref="/host/stats"
            sessionHref={(id) => `/host/session/${id}`}
          />
        )}
      </div>
    </div>
  );
}
