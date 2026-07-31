"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPlayers } from "@/lib/db/players";
import Card from "@/components/Card";

export default function HostDashboard() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  useEffect(() => {
    listPlayers()
      .then((p) => setPlayerCount(p.length))
      .catch(() => setPlayerCount(null));
  }, []);

  return (
    <div className="px-4 py-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Host</h1>
          <p className="text-white/50 text-sm">
            {playerCount === null
              ? " "
              : `${playerCount} player${playerCount === 1 ? "" : "s"} on the roster`}
          </p>
        </header>

        <Card className="p-5 mb-4 border-gold-500/30">
          <h2 className="font-semibold mb-1">Phase 1 is live</h2>
          <p className="text-white/60 text-sm">
            Roster and photos are ready. Sessions, house fees, stats and the
            live display come next.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/host/players">
            <Card className="p-5 h-full hover:border-white/20 transition-colors">
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold">Players</div>
              <div className="text-white/45 text-xs mt-0.5">
                Roster, nicknames, photos
              </div>
            </Card>
          </Link>
          <Link href="/">
            <Card className="p-5 h-full hover:border-white/20 transition-colors">
              <div className="text-2xl mb-2">🃏</div>
              <div className="font-semibold">Run a session</div>
              <div className="text-white/45 text-xs mt-0.5">
                Uses the public tracker for now
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
