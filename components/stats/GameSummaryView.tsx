"use client";

import Link from "next/link";
import type { SessionSummary } from "@/lib/db/stats";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Card from "@/components/Card";

/**
 * One night, read-only, on the public shared link.
 *
 * Poker figures only — buy-in, chips out, P/L. No settlements: who paid whom
 * is between the people who were there, and showing it would drag the house
 * fee onto a page that otherwise never mentions it.
 *
 * Players appear in session order, matching the host's own session screen.
 */
export default function GameSummaryView({
  session,
  backHref,
  backLabel = "Game history",
}: {
  session: SessionSummary;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <>
      <Link
        href={backHref}
        className="text-white/40 hover:text-white text-sm inline-flex items-center min-h-[44px]"
      >
        ← {backLabel}
      </Link>

      <header className="mb-5 mt-1">
        <h1 className="text-xl font-bold">
          {formatDateTime(session.startedAt).split(",")[0]}
        </h1>
        <p className="text-white/50 text-sm">
          {session.players.length} players · {formatINR(session.pot)} on the
          table
          {session.durationMs !== null && session.durationMs > 0 && (
            <> · {formatDuration(0, session.durationMs)}</>
          )}
          {session.isBackfill && (
            <span className="text-white/30"> · entered as history</span>
          )}
        </p>
      </header>

      <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
        Results
      </h2>
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          {session.players.map((p) => (
            <div key={p.playerId} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{p.name}</span>
                <span className="block text-white/35 text-xs tabular-nums">
                  in {formatINR(p.totalBuyIn)} · out {formatINR(p.chipsLeft)}
                </span>
              </span>
              <span
                className={`font-bold tabular-nums shrink-0 ${
                  p.profitLoss > 0
                    ? "text-win"
                    : p.profitLoss < 0
                      ? "text-loss"
                      : "text-white/60"
                }`}
              >
                {p.profitLoss > 0 ? "+" : ""}
                {formatINR(p.profitLoss)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
