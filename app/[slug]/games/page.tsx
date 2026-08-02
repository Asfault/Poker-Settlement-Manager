"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SessionSummary } from "@/lib/db/stats";
import {
  fetchSharedStats,
  forgetSharePassword,
  rememberSharePassword,
  savedSharePassword,
  sharedSlugExists,
} from "@/lib/db/shared-stats";
import GameHistoryList from "@/components/stats/GameHistoryList";
import SharedGate from "@/components/stats/SharedGate";

/**
 * Every past night, on its own page rather than as an endless list under the
 * stats. Gated independently, like every other route on the shared link.
 */
export default function SharedGamesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

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
        <Link
          href={`/${slug}`}
          className="text-white/40 hover:text-white text-sm inline-flex items-center min-h-[44px]"
        >
          ← Stats
        </Link>

        <header className="mb-5 mt-1">
          <h1 className="text-xl font-bold">Game history</h1>
          <p className="text-white/50 text-sm">
            {sessions.length} night{sessions.length === 1 ? "" : "s"}, newest
            first
          </p>
        </header>

        <GameHistoryList
          sessions={sessions}
          gameHref={(id) => `/${slug}/game/${id}`}
        />

        <p className="text-white/25 text-xs mt-8 text-center">pokeresh.com</p>
      </div>
    </div>
  );
}
