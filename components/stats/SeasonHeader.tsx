"use client";

import type { SeasonResult } from "@/lib/stats/season";
import { SEASON_ACCENT, seasonRangeLabel } from "@/lib/stats/season";
import { formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

/**
 * The season banner: which season, its dates, and its champion.
 *
 * The accent colour is the only thing that changes per season — a full
 * palette swap four times a year would make three of them look worse than
 * the felt green everything else uses.
 */
export default function SeasonHeader({
  result,
  label,
  note,
  isCurrent,
}: {
  result: SeasonResult;
  label: string;
  note: string | null;
  /** False when showing the last completed season during an off-season. */
  isCurrent: boolean;
}) {
  const accent = SEASON_ACCENT[result.season.name];
  const { winner, tied, gameCount, noEligiblePlayers } = result;

  return (
    <Card
      className="p-5 mb-5 overflow-hidden relative"
      style={{ borderColor: `${accent}55` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
      />

      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <div
            className="text-xs uppercase tracking-[0.2em] font-semibold"
            style={{ color: accent }}
          >
            {isCurrent ? "This season" : "Last season"}
          </div>
          <h2 className="text-2xl font-bold truncate">{label}</h2>
          <p className="text-white/40 text-xs mt-0.5">
            {seasonRangeLabel(result.season)} · {gameCount} night
            {gameCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {note && (
        <p className="text-white/60 text-sm mt-3 border-l-2 pl-3" style={{ borderColor: accent }}>
          {note}
        </p>
      )}

      {winner ? (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
          <PlayerAvatar
            name={winner.name}
            photoUrl={winner.photoUrl}
            size={48}
          />
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: accent }}
            >
              {isCurrent ? "Leading" : "Champion"}
              {tied.length > 0 && " · shared"}
            </div>
            <div className="font-bold truncate">
              {winner.name}
              {tied.map((t) => `, ${t.name}`).join("")}
            </div>
            <div className="text-white/40 text-xs">
              {winner.wins} of {winner.sessions} nights won
            </div>
          </div>
          <div className="text-win font-bold tabular-nums shrink-0">
            +{formatINR(winner.profit)}
          </div>
        </div>
      ) : (
        gameCount > 0 && (
          <p className="text-white/40 text-sm mt-4 pt-4 border-t border-white/5">
            {noEligiblePlayers
              ? "No champion — nobody has played enough of this season's games yet."
              : "No champion for this season."}
          </p>
        )
      )}
    </Card>
  );
}
