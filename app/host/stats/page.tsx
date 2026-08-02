"use client";

import { useEffect, useState } from "react";
import { SessionSummary, loadCompletedSessions } from "@/lib/db/stats";
import StatsView from "@/components/stats/StatsView";
import ShareStatsPanel from "@/components/host/stats/ShareStatsPanel";

export default function StatsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
        <header className="mb-5 flex items-start justify-between gap-3">
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

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        <StatsView
          sessions={sessions}
          playerHref={(id) => `/host/players/${id}`}
        />
      </div>

      <ShareStatsPanel open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
