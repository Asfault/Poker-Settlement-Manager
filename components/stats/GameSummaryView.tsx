"use client";

import Link from "next/link";
import type { SessionSummary } from "@/lib/db/stats";
import { computeNetRows, settleNet } from "@/lib/houseFee";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Card from "@/components/Card";

/**
 * One night, read-only.
 *
 * Settlements are the real ones — computed on net, fee included — because
 * that's the cash that actually moved. The per-night fee is shown so the
 * numbers add up. What is never shown anywhere here is the lifetime total of
 * fees collected; that stays on the host's own display settings page.
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
  const rows = computeNetRows(
    session.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      totalBuyIn: p.totalBuyIn,
      chipsLeft: p.chipsLeft,
      paysHouseFee: p.paysHouseFee,
    })),
    session.houseFeePerPlayer,
    session.hostPlayerId,
  );

  const settlements = settleNet(rows);
  const ranked = [...rows].sort((a, b) => b.profitLoss - a.profitLoss);
  const feeApplies = session.houseFeePerPlayer > 0;

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

      {/* Results */}
      <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
        Results
      </h2>
      <Card className="p-4 mb-5">
        <div className="flex flex-col gap-3">
          {ranked.map((r, i) => (
            <div key={r.playerId} className="flex items-center gap-3">
              <span className="text-white/30 text-sm w-5 shrink-0 tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{r.name}</span>
                <span className="block text-white/35 text-xs tabular-nums">
                  in {formatINR(r.totalBuyIn)} · out{" "}
                  {formatINR(r.chipsLeft)}
                </span>
              </span>
              <span
                className={`font-bold tabular-nums shrink-0 ${
                  r.profitLoss > 0
                    ? "text-win"
                    : r.profitLoss < 0
                      ? "text-loss"
                      : "text-white/60"
                }`}
              >
                {r.profitLoss > 0 ? "+" : ""}
                {formatINR(r.profitLoss)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Settlements */}
      {settlements.length > 0 && (
        <>
          <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
            Who paid whom
          </h2>
          <Card className="p-4 mb-5">
            <div className="flex flex-col gap-2.5">
              {settlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm flex-wrap"
                >
                  <span className="text-white/85 font-medium">{s.from}</span>
                  <span className="text-white/30">→</span>
                  <span className="text-white/85 font-medium">{s.to}</span>
                  <span className="ml-auto tabular-nums font-semibold text-gold-400">
                    {formatINR(s.amount)}
                  </span>
                </div>
              ))}
            </div>
            {feeApplies && (
              <p className="text-white/30 text-xs mt-4">
                Includes the {formatINR(session.houseFeePerPlayer)} table fee
                per player, which is why these differ from the poker figures
                above.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
