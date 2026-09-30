"use client";

import type { ReactNode } from "react";
import DisplayAvatar from "./DisplayAvatar";
import Portrait from "./Portrait";
import { plColor, signedINR } from "./money";

/**
 * The season leader beside the season table. Shared by the idle board and
 * recap slide 2 — the host wanted the two to look alike, so one component
 * draws both and they can't drift. The recap passes `movement` and
 * `tonight` on each row; the idle board doesn't.
 *
 * Everything is sized in vh, never px: on a TV whose browser reports 720p,
 * fixed-pixel rows didn't fit and overlapped each other and the heading.
 * Every figure has its own fixed column, so a long name truncates instead of
 * running into the numbers.
 */

export interface SeasonBoardRow {
  playerId: string;
  name: string;
  photoUrl: string | null;
  characterUrl: string | null;
  /** Season P/L. */
  total: number;
  /** Season nights played. */
  sessions: number;
  wins: number;
  /** Rank change tonight — recap only. Null for a first appearance. */
  movement?: number | null;
  /** Tonight's result, null if they sat out — recap only. */
  tonight?: number | null;
}

const COLS = "4.5vw 7.5vh minmax(0,1fr) 7vw 9vw 11vw";

/**
 * "Leading" is the top of the season table, not the championship rule: the
 * leader sits right beside the table, and naming someone who isn't row 1
 * would look like a bug. Nobody leads a table topped by zero or a tie.
 */
export function leaderOf(rows: SeasonBoardRow[]): SeasonBoardRow | null {
  const [first, second] = rows;
  if (!first || first.total <= 0) return null;
  if (second && second.total >= first.total) return null;
  return first;
}

export default function SeasonBoard({
  rows,
  seasonNights,
  heroTag,
  accent,
  heading,
  footer,
}: {
  /** Sorted by season P/L, best first. Only the top 8 are drawn. */
  rows: SeasonBoardRow[];
  /** Nights held this season — the attendance denominator. */
  seasonNights: number;
  /** "Leading Autumn 2026" / "Leading after tonight". */
  heroTag: string;
  /** Colour of the hero tag. */
  accent: string;
  heading: ReactNode;
  footer?: ReactNode;
}) {
  const top = rows.slice(0, 8);
  const leader = leaderOf(top);

  return (
    <div
      className="h-full grid gap-[4vw] min-h-0"
      style={{
        gridTemplateColumns: leader ? "30% minmax(0,1fr)" : "minmax(0,1fr)",
      }}
    >
      {leader && <LeaderHero leader={leader} tag={heroTag} accent={accent} />}

      <div className="flex flex-col min-h-0">
        <div className="shrink-0 mb-[2.4vh]">{heading}</div>
        <div
          className="grid gap-x-[1.6vw] px-[1.2vw] mb-[0.8vh] shrink-0 uppercase tracking-[0.2em] text-white/30 font-bold text-[1.7vh]"
          style={{ gridTemplateColumns: COLS }}
        >
          <span />
          <span />
          <span>Player</span>
          <span className="text-right">Win rate</span>
          <span className="text-right">Attendance</span>
          <span className="text-right">P/L</span>
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
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="flex items-baseline gap-[0.5vw] min-w-0">
                  <span
                    className={`font-black tabular-nums text-[3vh] ${
                      isLeader ? "text-[#e9c46a]" : "text-white/25"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {p.movement !== undefined && (
                    <Movement movement={p.movement} />
                  )}
                </span>
                <DisplayAvatar name={p.name} photoUrl={p.photoUrl} size="7vh" />
                <span className="font-bold truncate text-[3.9vh]">{p.name}</span>
                <span className="text-right tabular-nums text-white/45 text-[2.3vh]">
                  {pct(p.sessions > 0 ? p.wins / p.sessions : 0)}
                </span>
                <span className="text-right tabular-nums text-white/45 text-[2.3vh]">
                  {pct(seasonNights > 0 ? p.sessions / seasonNights : 0)}
                </span>
                <span className="text-right whitespace-nowrap leading-[1.05]">
                  <span
                    className="block font-black tabular-nums text-[3.9vh]"
                    style={{ color: plColor(p.total) }}
                  >
                    {signedINR(p.total)}
                  </span>
                  {p.tonight !== undefined && (
                    <span
                      className="block tabular-nums text-[1.8vh]"
                      style={{
                        color:
                          p.tonight === null
                            ? "rgba(255,255,255,0.25)"
                            : plColor(p.tonight),
                      }}
                    >
                      {p.tonight === null
                        ? "sat out"
                        : `${signedINR(p.tonight)} tonight`}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {footer && <div className="shrink-0 mt-[2.4vh]">{footer}</div>}
      </div>
    </div>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Rank change tonight, beside the rank number. Nothing when unchanged. */
function Movement({ movement }: { movement: number | null }) {
  if (movement === null) {
    return (
      <span className="text-[#e9c46a] font-extrabold text-[1.6vh]">NEW</span>
    );
  }
  if (movement === 0) return null;
  const up = movement > 0;
  return (
    <span
      className="font-extrabold tabular-nums whitespace-nowrap text-[1.9vh]"
      style={{ color: up ? "#22c55e" : "#ef4444" }}
    >
      {up ? "▲" : "▼"}
      {Math.abs(movement)}
    </span>
  );
}

function LeaderHero({
  leader,
  tag,
  accent,
}: {
  leader: SeasonBoardRow;
  tag: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-0 min-w-0 border-r border-white/[0.08] pr-[4vw]">
      <div
        className="uppercase tracking-[0.2em] font-extrabold text-[2.1vh] mb-[3vh] whitespace-nowrap"
        style={{ color: accent }}
      >
        {tag}
      </div>
      <Portrait
        name={leader.name}
        photoUrl={leader.photoUrl}
        characterUrl={leader.characterUrl}
        size="24vh"
        color="#e9c46a"
        crown
      />
      <div className="font-black leading-[1.05] text-[6.2vh] mt-[3vh] max-w-full truncate">
        {leader.name}
      </div>
      <div
        className="font-black tabular-nums text-[7vh] mt-[1vh]"
        style={{ color: plColor(leader.total) }}
      >
        {signedINR(leader.total)}
      </div>
      <div className="text-white/50 text-[2.5vh] mt-[1.2vh]">
        {leader.wins} of {leader.sessions} night
        {leader.sessions === 1 ? "" : "s"} won
      </div>
      {leader.tonight !== undefined && (
        <div
          className="tabular-nums text-[2.3vh] mt-[0.4vh]"
          style={{
            color:
              leader.tonight === null
                ? "rgba(255,255,255,0.35)"
                : plColor(leader.tonight),
          }}
        >
          {leader.tonight === null
            ? "Sat out tonight"
            : `${signedINR(leader.tonight)} tonight`}
        </div>
      )}
    </div>
  );
}
