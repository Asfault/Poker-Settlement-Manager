"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SessionSummary } from "@/lib/db/stats";
import {
  fetchSharedStats,
  forgetSharePassword,
  rememberSharePassword,
  savedSharePassword,
  sharedSlugExists,
} from "@/lib/db/shared-stats";
import StatsView from "@/components/stats/StatsView";
import SharedGate from "@/components/stats/SharedGate";

/**
 * Public read-only stats at pokeresh.com/<slug>.
 *
 * This is a catch-all at the root, so it also receives genuinely wrong URLs.
 * Those get a plain not-found rather than a password prompt they could never
 * satisfy — hence the separate `sharedSlugExists` check. Real routes like
 * /host and /display are static and take precedence over this.
 */
export default function SharedStatsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const [exists, setExists] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [checking, setChecking] = useState(true);

  const load = useCallback(
    async (pw: string): Promise<boolean> => {
      const result = await fetchSharedStats(slug, pw);
      if (!result.ok) return false;
      setSessions(result.sessions);
      return true;
    },
    [slug],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await sharedSlugExists(slug);
      if (!active) return;
      setExists(found);
      if (!found) {
        setChecking(false);
        return;
      }
      // Returning viewer — try the password we already have. It fails
      // silently if the host has rotated it since.
      const pw = savedSharePassword(slug);
      if (pw) {
        try {
          const ok = await load(pw);
          if (!ok) forgetSharePassword(slug);
        } catch {
          forgetSharePassword(slug);
        }
      }
      if (active) setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [slug, load]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  if (exists === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-gold-400 font-bold text-lg mb-1">Pokeresh</p>
        <p className="text-white/50 text-sm">
          Nothing here. Check the link you were sent.
        </p>
      </div>
    );
  }

  if (!sessions) {
    return (
      <SharedGate
        onSubmit={async (pw) => {
          const ok = await load(pw);
          if (ok) rememberSharePassword(slug, pw);
          return ok;
        }}
      />
    );
  }

  return (
    <div className="px-4 py-6 pb-10 pt-safe">
      <div className="max-w-3xl mx-auto">
        <header className="mb-5">
          <p className="text-gold-400 font-bold">Pokeresh</p>
          <h1 className="text-xl font-bold">Stats</h1>
          <p className="text-white/50 text-sm">
            Poker only — house fees excluded
          </p>
        </header>

        <StatsView
          sessions={sessions}
          playerHref={(id) => `/${slug}/player/${id}`}
        />

        <p className="text-white/25 text-xs mt-8 text-center">
          pokeresh.com
        </p>
      </div>
    </div>
  );
}
