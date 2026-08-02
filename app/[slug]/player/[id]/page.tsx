"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SessionSummary } from "@/lib/db/stats";
import {
  fetchSharedStats,
  forgetSharePassword,
  rememberSharePassword,
  savedSharePassword,
  sharedSlugExists,
} from "@/lib/db/shared-stats";
import PlayerDetailView from "@/components/stats/PlayerDetailView";
import SharedGate from "@/components/stats/SharedGate";

/**
 * One player's full stats on the public shared link.
 *
 * Gated independently of the index page — landing here directly from a
 * forwarded URL still has to pass the password, and a rotated password
 * invalidates the stored one here just as it does there.
 *
 * No sessionHref: viewers have no session screens to drill into.
 */
export default function SharedPlayerStatsPage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = params?.slug ?? "";
  const playerId = params?.id ?? "";

  const [exists, setExists] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [checking, setChecking] = useState(true);

  async function load(pw: string): Promise<boolean> {
    const result = await fetchSharedStats(slug, pw);
    if (!result.ok) return false;
    setSessions(result.sessions);
    return true;
  }

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
      const pw = savedSharePassword(slug);
      if (pw) {
        try {
          const result = await fetchSharedStats(slug, pw);
          if (!active) return;
          if (result.ok) setSessions(result.sessions);
          else forgetSharePassword(slug);
        } catch {
          forgetSharePassword(slug);
        }
      }
      if (active) setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

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
        <PlayerDetailView
          sessions={sessions}
          playerId={playerId}
          backHref={`/${slug}`}
          backLabel="Stats"
        />
        <p className="text-white/25 text-xs mt-8 text-center">pokeresh.com</p>
      </div>
    </div>
  );
}
