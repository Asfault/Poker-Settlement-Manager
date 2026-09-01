"use client";

import type { SeasonResult } from "@/lib/stats/season";
import {
  SEASON_ACCENT,
  seasonEndLabel,
  seasonGreeting,
  seasonPhase,
  seasonRangeLabel,
  seasonWord,
} from "@/lib/stats/season";
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
  welcome = false,
}: {
  result: SeasonResult;
  label: string;
  note: string | null;
  /** False when showing the last completed season during an off-season. */
  isCurrent: boolean;
  /**
   * Shared page only. Adds the greeting and gives the card more weight at
   * the start and end of a season. The host doesn't need welcoming to
   * their own app.
   */
  welcome?: boolean;
}) {
  const accent = SEASON_ACCENT[result.season.name];
  const { winner, tied, gameCount, noEligiblePlayers } = result;

  const phase = seasonPhase(result.season, gameCount, isCurrent, Date.now());
  const greeting = welcome ? seasonGreeting(result.season, phase) : null;

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

      {/* A soft pool of the season's colour behind the title. CSS only —
          no per-season artwork to make or maintain. */}
      {greeting && (
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            left: "-10%",
            top: "-60%",
            width: "70%",
            height: "180%",
            background: `radial-gradient(ellipse at 40% 50%, ${accent}22, transparent 70%)`,
          }}
        />
      )}

      <div className="relative">
        {greeting && (
          <div className="mb-4">
            <h2
              className="font-bold leading-tight text-[clamp(26px,7vw,40px)]"
              style={{ color: accent }}
            >
              {greeting.title}
            </h2>
            <p className="text-white/55 text-sm mt-1.5">{greeting.subtitle}</p>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div
              className="text-xs uppercase tracking-[0.2em] font-semibold"
              style={{ color: accent }}
            >
              {isCurrent ? "This season" : "Last season"}
            </div>
            <h3
              className={`font-bold truncate ${greeting ? "text-lg" : "text-2xl"}`}
            >
              {label}
            </h3>
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

      {/* What's being played for. Shared page only, and dropped once the
          season is over — by then the champion block above says who took
          it, and "gets a trophy" in the past tense reads oddly. */}
      {welcome && phase !== "finished" && (
        <p
          className="text-sm mt-4 pt-4 border-t border-white/5 leading-relaxed"
          style={{ color: `${accent}cc` }}
        >
          Most profit by the end of the season gets a trophy, glory, and a
          picture of everyone bowing down in front of them.{" "}
          <span className="text-white/45">
            {seasonWord(result.season.name)} ends{" "}
            {seasonEndLabel(result.season)}.
          </span>
        </p>
      )}
      </div>
    </Card>
  );
}
