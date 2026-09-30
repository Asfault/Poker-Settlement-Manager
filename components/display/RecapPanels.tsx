"use client";

import { useEffect, useState } from "react";
import type { Recap, RecapMilestone } from "@/lib/display/recap";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";
import { plColor, signedINR } from "./money";

/**
 * The end-of-night reveal.
 *
 * Panels take turns rather than playing once, because people are still in the
 * room settling up and arguing. Someone who looks up ten minutes after the
 * game ends should still see how the night went.
 *
 * Each panel is one screen — no scrolling, since nobody can scroll a TV.
 */

const PANEL_MS = 15000;

export default function RecapPanels({ recap }: { recap: Recap }) {
  // Panel 3 is dropped entirely when nothing notable happened. A reveal that
  // fires every week stops being a reveal.
  const panelCount = recap.milestones.length > 0 ? 3 : 2;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [recap.sessionId]);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % panelCount),
      PANEL_MS,
    );
    return () => clearInterval(id);
  }, [panelCount]);

  return (
    <div className="absolute inset-0 z-30 bg-[#051911] flex flex-col">
      <div className="flex-1 min-h-0 p-[5vh_5vw_2vh] flex flex-col">
        {index === 0 && <TonightPanel recap={recap} />}
        {index === 1 && <StandingsPanel recap={recap} />}
        {index === 2 && <MilestonePanel recap={recap} />}
      </div>

      <div className="flex justify-center gap-[1vw] pb-[3vh]">
        {Array.from({ length: panelCount }).map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-colors"
            style={{
              width: "1.6vh",
              height: "1.6vh",
              background: i === index ? "#e9c46a" : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Panel heading: a big title with a quieter note beside it. Sits on its own
 * row above the column headers, so nothing shares a line with the rankings.
 */
function PanelTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-[1.4vw] mb-[3vh] shrink-0 min-w-0">
      <span className="font-black tracking-[0.02em] text-[4.4vh] shrink-0">
        {title}
      </span>
      {note && (
        <span className="text-white/40 text-[2.4vh] truncate">{note}</span>
      )}
    </div>
  );
}

/*
 * Rows are grids with fixed columns for every figure, so a long name
 * truncates instead of running into the numbers, and everything is sized in
 * vh so the layout is the same on a 720p TV and a 4K one. The old panels used
 * fixed 72px avatars and width-based fonts; on a 720p TV the rows didn't fit
 * and overlapped.
 */
function ColumnHeads({ cols, labels }: { cols: string; labels: string[] }) {
  return (
    <div
      className="grid gap-x-[1.6vw] px-[1.2vw] mb-[0.8vh] shrink-0 uppercase tracking-[0.2em] text-white/30 font-bold text-[1.7vh]"
      style={{ gridTemplateColumns: cols }}
    >
      {labels.map((l, i) => (
        <span key={i} className={l === "Player" || !l ? "" : "text-right"}>
          {l}
        </span>
      ))}
    </div>
  );
}

function Rows({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 min-h-0 grid gap-[1.1vh]"
      style={{ gridTemplateRows: `repeat(${count}, minmax(0,1fr))` }}
    >
      {children}
    </div>
  );
}

function rowClass(highlight: boolean): string {
  return `grid items-center gap-x-[1.6vw] px-[1.2vw] min-h-0 rounded-[1.2vh] ${
    highlight
      ? "bg-[#e9c46a]/[0.09] shadow-[inset_0_0_0_1px_rgba(233,196,106,0.28)]"
      : ""
  }`;
}

function Rank({ n, gold }: { n: number; gold: boolean }) {
  return (
    <span
      className={`font-black tabular-nums text-[3vh] ${
        gold ? "text-[#e9c46a]" : "text-white/25"
      }`}
    >
      {n}
    </span>
  );
}

const TONIGHT_COLS = "3vw 7.5vh minmax(0,1fr) 12vw 12vw 15vw";

function TonightPanel({ recap }: { recap: Recap }) {
  const rows = recap.tonight;
  return (
    <div className="h-full flex flex-col min-h-0 animate-[fadeIn_450ms_ease-out]">
      <PanelTitle title="Tonight" note={`${formatINR(recap.pot)} on the table`} />
      <ColumnHeads
        cols={TONIGHT_COLS}
        labels={["", "", "Player", "In", "Out", "Result"]}
      />
      <Rows count={rows.length}>
        {rows.map((p, i) => (
          <div
            key={p.playerId}
            className={rowClass(i === 0)}
            style={{ gridTemplateColumns: TONIGHT_COLS }}
          >
            <Rank n={i + 1} gold={i === 0} />
            <DisplayAvatar
              name={p.name}
              photoUrl={p.photoUrl}
              size="7vh"
              ring={i === 0 ? "#e9c46a" : undefined}
            />
            <span className="font-bold truncate text-[3.9vh]">{p.name}</span>
            <span className="text-right tabular-nums text-white/45 text-[2.3vh] whitespace-nowrap">
              {formatINR(p.totalBuyIn)}
            </span>
            <span className="text-right tabular-nums text-white/45 text-[2.3vh] whitespace-nowrap">
              {formatINR(p.chipsLeft)}
            </span>
            <span
              className="text-right font-black tabular-nums whitespace-nowrap text-[3.9vh]"
              style={{ color: plColor(p.profitLoss) }}
            >
              {signedINR(p.profitLoss)}
            </span>
          </div>
        ))}
      </Rows>
    </div>
  );
}

const STANDINGS_COLS = "3vw 5vw 7.5vh minmax(0,1fr) 9vw 13vw 15vw";

function StandingsPanel({ recap }: { recap: Recap }) {
  // Only as many as fit legibly on a TV.
  const rows = recap.standings.slice(0, 8);
  return (
    <div className="h-full flex flex-col min-h-0 animate-[fadeIn_450ms_ease-out]">
      <PanelTitle
        title={recap.seasonLabel}
        note={`standings after tonight · ${recap.seasonNights} night${
          recap.seasonNights === 1 ? "" : "s"
        }`}
      />
      <ColumnHeads
        cols={STANDINGS_COLS}
        labels={["", "", "", "Player", "W–L", "Tonight", "Season"]}
      />
      <Rows count={rows.length}>
        {rows.map((s) => (
          <div
            key={s.playerId}
            className={rowClass(s.rank === 1)}
            style={{ gridTemplateColumns: STANDINGS_COLS }}
          >
            <Rank n={s.rank} gold={s.rank === 1} />
            <Movement movement={s.movement} />
            <DisplayAvatar name={s.name} photoUrl={s.photoUrl} size="7vh" />
            <span className="font-bold truncate text-[3.9vh]">{s.name}</span>
            <span className="text-right tabular-nums text-white/45 text-[2.3vh] whitespace-nowrap">
              {s.wins}–{s.sessions - s.wins}
            </span>
            <span
              className="text-right tabular-nums text-[2.3vh] whitespace-nowrap"
              style={{
                color:
                  s.tonightDelta === 0
                    ? "rgba(255,255,255,0.2)"
                    : plColor(s.tonightDelta),
              }}
            >
              {s.tonightDelta === 0 ? "—" : signedINR(s.tonightDelta)}
            </span>
            <span
              className="text-right font-black tabular-nums whitespace-nowrap text-[3.9vh]"
              style={{ color: plColor(s.total) }}
            >
              {signedINR(s.total)}
            </span>
          </div>
        ))}
      </Rows>
    </div>
  );
}

/** Rank movement from tonight. Climbing is the interesting direction. */
function Movement({ movement }: { movement: number | null }) {
  if (movement === null) {
    return (
      <span className="text-[#e9c46a] font-extrabold text-[2vh]">NEW</span>
    );
  }
  if (movement === 0) {
    return <span className="text-white/20 text-[2.4vh]">–</span>;
  }
  const up = movement > 0;
  return (
    <span
      className="font-extrabold tabular-nums whitespace-nowrap text-[2.4vh]"
      style={{ color: up ? "#22c55e" : "#ef4444" }}
    >
      {up ? "▲" : "▼"}
      {Math.abs(movement)}
    </span>
  );
}

const TONE_COLOR: Record<RecapMilestone["tone"], string> = {
  lead: "#e9c46a",
  win: "#22c55e",
  loss: "#ef4444",
};

/**
 * What tonight changed in the season, as cards in a 2×2 grid. Season only —
 * the old panel mixed in all-time milestones and a column of W/L records
 * that repeated panel 2; both went.
 */
function MilestonePanel({ recap }: { recap: Recap }) {
  const rows = recap.milestones.slice(0, 4);
  return (
    <div className="h-full flex flex-col min-h-0 animate-[fadeIn_450ms_ease-out]">
      <PanelTitle title="What changed" note={`in ${recap.seasonLabel}`} />
      <div
        className="flex-1 min-h-0 grid gap-[2.4vh_2.4vw]"
        style={{
          gridTemplateColumns: rows.length === 1 ? "minmax(0,1fr)" : "1fr 1fr",
          gridTemplateRows: `repeat(${Math.ceil(rows.length / 2)}, minmax(0,1fr))`,
        }}
      >
        {rows.map((m, i) => {
          const color = TONE_COLOR[m.tone];
          return (
            <div
              key={`${m.playerId}-${i}`}
              className="flex items-center gap-[2vw] min-w-0 min-h-0 rounded-[2vh] px-[2.4vw] bg-white/[0.035] border border-white/[0.07]"
            >
              <DisplayAvatar
                name={m.name}
                photoUrl={m.photoUrl}
                size="13vh"
                ring={color}
              />
              <div className="min-w-0">
                <div className="font-bold uppercase tracking-[0.04em] text-white/85 text-[2.5vh] mb-[0.6vh] truncate">
                  {m.name}
                </div>
                <div
                  className="font-black leading-[1.1] text-[3.4vh]"
                  style={{ color }}
                >
                  {m.headline}
                </div>
                <div className="text-white/50 text-[2.3vh] mt-[0.8vh]">
                  {m.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
