"use client";

import type { Derived } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";
import { plColor, signedINR } from "./money";
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
 * accumulation nobody can catch up on isn't one.
 *
 * Everything is sized in vh, never px. The old board used fixed 72px avatars,
 * and on a TV whose browser reports 720p eight rows didn't fit, so rows
 * spilled into each other and into the header. Figures sit in fixed columns
 * so a long name truncates rather than running into the numbers.
 *
 * "Leading" is the top of the season table (most profit), not the
 * championship rule from `lib/stats/season.ts`: the leader sits right beside
 * the table, and naming someone who isn't #1 there would look like a bug.
 */
const IDLE_COLS = "3vw 7.5vh minmax(0,1fr) 6vw 6vw 12vw";

function IdleBoard({ derived }: { derived: Derived }) {
  const { season } = derived;
  const top = season.standings.slice(0, 8);

  if (top.length === 0) {
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

  // Nobody leads a table where the best total is zero or less.
  const leader =
    top[0].totalProfitLoss > 0 &&
    (top.length === 1 || top[0].totalProfitLoss > top[1].totalProfitLoss)
      ? top[0]
      : null;

  return (
    <div
      className="h-full grid gap-[4vw] p-[2vh_2vw]"
      style={{ gridTemplateColumns: leader ? "32% minmax(0,1fr)" : "minmax(0,1fr)" }}
    >
      {leader && <LeaderHero leader={leader} seasonLabel={season.label} />}

      <div className="flex flex-col min-h-0">
        <div className="uppercase tracking-[0.3em] text-white/45 font-bold text-[2.3vh] mb-[3vh] shrink-0">
          Season standings
        </div>
        <div
          className="grid gap-x-[1.6vw] px-[1.2vw] mb-[0.8vh] shrink-0 uppercase tracking-[0.2em] text-white/30 font-bold text-[1.7vh]"
          style={{ gridTemplateColumns: IDLE_COLS }}
        >
          <span />
          <span />
          <span>Player</span>
          <span className="text-right">Nights</span>
          <span className="text-right">Won</span>
          <span className="text-right">Season</span>
        </div>
        <div
          className="flex-1 min-h-0 grid gap-[1.1vh]"
          style={{ gridTemplateRows: `repeat(${top.length}, minmax(0,1fr))` }}
        >
          {top.map((p, i) => {
            const isLeader = leader?.playerId === p.playerId;
            return (
              <div
                key={p.playerId}
                className={`grid items-center gap-x-[1.6vw] px-[1.2vw] min-h-0 rounded-[1.2vh] ${
                  isLeader
                    ? "bg-[#e9c46a]/[0.09] shadow-[inset_0_0_0_1px_rgba(233,196,106,0.28)]"
                    : ""
                }`}
                style={{ gridTemplateColumns: IDLE_COLS }}
              >
                <span
                  className={`font-black tabular-nums text-[3vh] ${
                    isLeader ? "text-[#e9c46a]" : "text-white/25"
                  }`}
                >
                  {i + 1}
                </span>
                <DisplayAvatar
                  name={p.displayName}
                  photoUrl={p.photoUrl}
                  size="7vh"
                />
                <span className="font-bold truncate text-[3.9vh]">
                  {p.displayName}
                </span>
                <span className="text-right tabular-nums text-white/45 text-[2.3vh]">
                  {p.sessions}
                </span>
                <span className="text-right tabular-nums text-white/45 text-[2.3vh]">
                  {Math.round(p.winRate * 100)}%
                </span>
                <span
                  className="text-right font-black tabular-nums whitespace-nowrap text-[3.9vh]"
                  style={{ color: plColor(p.totalProfitLoss) }}
                >
                  {signedINR(p.totalProfitLoss)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-white/35 text-[2.2vh] mt-[2.4vh] shrink-0">
          {season.sessions} night{season.sessions === 1 ? "" : "s"} ·{" "}
          {formatINR(season.totalMoney)} across the table ·{" "}
          {season.word} ends {season.endsLabel}
        </div>
      </div>
    </div>
  );
}

/**
 * The leader, big. Their character artwork when they have one — it's the
 * largest image on the screen and a cut-out reads better than a disc —
 * otherwise their photo in a gold ring under a crown.
 */
function LeaderHero({
  leader,
  seasonLabel,
}: {
  leader: Derived["season"]["standings"][number];
  seasonLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-0 border-r border-white/[0.08] pr-[4vw]">
      <div className="uppercase tracking-[0.32em] text-[#e9c46a] font-extrabold text-[2.2vh] mb-[3vh]">
        Leading {seasonLabel}
      </div>

      {leader.characterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={leader.characterUrl}
          alt=""
          aria-hidden="true"
          className="object-contain max-w-full"
          style={{
            height: "42vh",
            filter: "drop-shadow(0 0 3vh rgba(233,196,106,0.45))",
          }}
        />
      ) : (
        <div className="relative mt-[6vh]">
          {/* Level, not tilted — the summary image's crown sits at an
              angle, but here it's a heading over a portrait. */}
          <svg
            viewBox="0 0 64 40"
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: "-6.5vh", width: "10vh" }}
          >
            <path
              d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z"
              fill="#e9c46a"
              stroke="#b8902f"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="block rounded-full"
            style={{
              boxShadow:
                "0 0 0 0.7vh #e9c46a, 0 0 6vh rgba(233,196,106,0.25)",
            }}
          >
            <DisplayAvatar
              name={leader.displayName}
              photoUrl={leader.photoUrl}
              size="24vh"
            />
          </span>
        </div>
      )}

      <div className="font-black leading-[1.05] text-[6.2vh] mt-[3vh] max-w-full truncate">
        {leader.displayName}
      </div>
      <div
        className="font-black tabular-nums text-[7vh] mt-[1vh]"
        style={{ color: plColor(leader.totalProfitLoss) }}
      >
        {signedINR(leader.totalProfitLoss)}
      </div>
      <div className="text-white/50 text-[2.5vh] mt-[1.2vh]">
        {leader.wins} of {leader.sessions} night
        {leader.sessions === 1 ? "" : "s"} won
      </div>
    </div>
  );
}
