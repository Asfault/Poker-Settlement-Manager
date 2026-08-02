"use client";

import Link from "next/link";
import type { SessionSummary } from "@/lib/db/stats";
import { formatDateTime, formatINR } from "@/lib/format";
import Card from "@/components/Card";

/** Every past night, newest first. Poker figures only — no fees anywhere. */
export default function GameHistoryList({
  sessions,
  gameHref,
}: {
  sessions: SessionSummary[];
  gameHref: (sessionId: string) => string;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => {
        const winner = [...s.players].sort(
          (a, b) => b.profitLoss - a.profitLoss,
        )[0];
        return (
          <Link key={s.id} href={gameHref(s.id)}>
            <Card className="p-4 min-h-[56px] flex items-center gap-3 hover:border-white/20 transition-colors">
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">
                  {formatDateTime(s.startedAt).split(",")[0]}
                </span>
                <span className="block text-white/35 text-xs truncate">
                  {s.players.length} players · {formatINR(s.pot)} pot
                  {winner && winner.profitLoss > 0 && (
                    <> · {winner.name} won</>
                  )}
                </span>
              </span>
              <span className="text-white/25 text-sm shrink-0">→</span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
