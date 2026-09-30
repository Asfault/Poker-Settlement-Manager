"use client";

import type { Derived } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import SeasonBoard from "./SeasonBoard";
import PokerTable from "./PokerTable";

/** The home state — the table during a session, the leaderboard between them. */
export default function LiveBoard({
  derived,
  now,
}: {
  derived: Derived;
  now: number;
}) {
  const live = derived.live;

  if (!live || live.rows.length === 0) {
    return <IdleBoard derived={derived} />;
  }

  return (
    <PokerTable
      rows={live.rows}
      pot={live.pot}
      startedAt={live.startedAt}
      now={now}
    />
  );
}

/**
 * Shown between sessions — who's leading the season, and the season table.
 *
 * Seasonal, not all-time: this is the live competition, and a two-year
 * accumulation nobody can catch up on isn't one. Layout lives in
 * `SeasonBoard`, shared with recap slide 2.
 */
function IdleBoard({ derived }: { derived: Derived }) {
  const { season } = derived;

  if (season.standings.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="text-[clamp(60px,9vw,160px)] mb-6">🃏</div>
        <div className="font-black text-[clamp(32px,5vw,90px)] text-[#e9c46a]">
          POKERESH
        </div>
        <div className="text-white/40 mt-4 text-[clamp(18px,2vw,32px)]">
          {season.label} starts here
        </div>
        <div className="text-white/25 mt-2 text-[clamp(14px,1.4vw,24px)]">
          Nobody has played a hand yet
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-[2vh_2vw]">
      <SeasonBoard
        rows={season.standings.map((p) => ({
          playerId: p.playerId,
          name: p.displayName,
          photoUrl: p.photoUrl,
          characterUrl: p.characterUrl,
          total: p.totalProfitLoss,
          sessions: p.sessions,
          wins: p.wins,
        }))}
        seasonNights={season.sessions}
        heroTag={`Leading ${season.label}`}
        accent="#e9c46a"
        heading={
          <div className="uppercase tracking-[0.3em] text-white/45 font-bold text-[2.3vh] mt-[0.6vh]">
            Season standings
          </div>
        }
        footer={
          <div className="text-white/35 text-[2.2vh]">
            {season.sessions} night{season.sessions === 1 ? "" : "s"} ·{" "}
            {formatINR(season.totalMoney)} across the table ·{" "}
            {season.word} ends {season.endsLabel}
          </div>
        }
      />
    </div>
  );
}
