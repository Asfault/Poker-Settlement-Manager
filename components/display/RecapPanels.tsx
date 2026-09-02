"use client";

import { useEffect, useState } from "react";
import type { Recap } from "@/lib/display/recap";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";

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
      <div className="flex-1 min-h-0 p-[5vh_6vw] flex flex-col">
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

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="uppercase tracking-[0.3em] text-white/45 font-bold text-[clamp(14px,1.5vw,24px)] mb-[3vh] shrink-0">
      {children}
    </div>
  );
}

function TonightPanel({ recap }: { recap: Recap }) {
  const rows = recap.tonight;
  return (
    <div className="h-full flex flex-col animate-[fadeIn_450ms_ease-out]">
      <PanelTitle>
        Tonight · {formatINR(recap.pot)} on the table
      </PanelTitle>
      <div
        className="flex-1 min-h-0 grid gap-[1.2vh]"
        style={{ gridTemplateRows: `repeat(${rows.length}, 1fr)` }}
      >
        {rows.map((p, i) => (
          <div
            key={p.playerId}
            className="flex items-center gap-[1.6vw] min-h-0"
          >
            <span className="text-white/25 font-black tabular-nums text-[clamp(20px,2.2vw,40px)] w-[3vw] shrink-0">
              {i + 1}
            </span>
            <DisplayAvatar
              name={p.name}
              photoUrl={p.photoUrl}
              size={72}
              ring={i === 0 ? "#e9c46a" : undefined}
            />
            <span className="flex-1 min-w-0 truncate font-bold text-[clamp(24px,3vw,54px)]">
              {p.name}
            </span>
            <span className="text-white/35 tabular-nums text-[clamp(14px,1.4vw,24px)] shrink-0 whitespace-nowrap">
              in {formatINR(p.totalBuyIn)} · out {formatINR(p.chipsLeft)}
            </span>
            {/* No fixed width: a long figure was overflowing its column and
                running into the name. Natural width plus nowrap instead. */}
            <span
              className="font-black tabular-nums text-[clamp(24px,2.9vw,52px)] shrink-0 whitespace-nowrap text-right"
              style={{
                color:
                  p.profitLoss > 0
                    ? "#22c55e"
                    : p.profitLoss < 0
                      ? "#ef4444"
                      : "rgba(255,255,255,0.6)",
              }}
            >
              {p.profitLoss > 0 ? "+" : ""}
              {formatINR(p.profitLoss)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StandingsPanel({ recap }: { recap: Recap }) {
  // Only as many as fit legibly on a TV.
  const rows = recap.standings.slice(0, 8);
  return (
    <div className="h-full flex flex-col animate-[fadeIn_450ms_ease-out]">
      <PanelTitle>{recap.seasonLabel} · after tonight</PanelTitle>
      <div
        className="flex-1 min-h-0 grid gap-[1.2vh]"
        style={{ gridTemplateRows: `repeat(${rows.length}, 1fr)` }}
      >
        {rows.map((s) => (
          <div key={s.playerId} className="flex items-center gap-[1.6vw] min-h-0">
            <span className="text-white/25 font-black tabular-nums text-[clamp(20px,2.2vw,40px)] w-[3vw] shrink-0">
              {s.rank}
            </span>
            <DisplayAvatar name={s.name} photoUrl={s.photoUrl} size={72} />
            <span className="flex-1 min-w-0 truncate font-bold text-[clamp(24px,3vw,54px)]">
              {s.name}
            </span>
            <Movement movement={s.movement} />

            {/* Win rate, with tonight's shift. */}
            <span className="shrink-0 text-right whitespace-nowrap leading-tight">
              <span className="block text-white/70 tabular-nums text-[clamp(16px,1.9vw,32px)]">
                {Math.round(s.winRate * 100)}%
              </span>
              <span
                className="block tabular-nums text-[clamp(11px,1.1vw,18px)]"
                style={{
                  color:
                    s.winRateDelta > 0
                      ? "#22c55e"
                      : s.winRateDelta < 0
                        ? "#ef4444"
                        : "rgba(255,255,255,0.22)",
                }}
              >
                {s.winRateDelta === 0
                  ? "—"
                  : `${s.winRateDelta > 0 ? "+" : ""}${s.winRateDelta.toFixed(1)}`}
              </span>
            </span>

            <span className="shrink-0 text-right whitespace-nowrap leading-tight">
              <span
                className="block font-black tabular-nums text-[clamp(24px,2.9vw,52px)]"
                style={{
                  color:
                    s.total > 0
                      ? "#22c55e"
                      : s.total < 0
                        ? "#ef4444"
                        : "rgba(255,255,255,0.6)",
                }}
              >
                {s.total > 0 ? "+" : ""}
                {formatINR(s.total)}
              </span>
              <span
                className="block tabular-nums text-[clamp(11px,1.1vw,18px)]"
                style={{
                  color:
                    s.tonightDelta > 0
                      ? "#22c55e"
                      : s.tonightDelta < 0
                        ? "#ef4444"
                        : "rgba(255,255,255,0.22)",
                }}
              >
                {s.tonightDelta === 0
                  ? "—"
                  : `${s.tonightDelta > 0 ? "+" : ""}${formatINR(s.tonightDelta)} tonight`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rank movement from tonight. Climbing is the interesting direction. */
function Movement({ movement }: { movement: number | null }) {
  if (movement === null) {
    return (
      <span className="text-[#e9c46a] font-bold text-[clamp(13px,1.3vw,22px)] shrink-0 w-[5vw]">
        NEW
      </span>
    );
  }
  if (movement === 0) {
    return <span className="shrink-0 w-[5vw] text-white/15 text-center">–</span>;
  }
  const up = movement > 0;
  return (
    <span
      className="font-bold tabular-nums text-[clamp(15px,1.6vw,26px)] shrink-0 w-[5vw]"
      style={{ color: up ? "#22c55e" : "#ef4444" }}
    >
      {up ? "▲" : "▼"} {Math.abs(movement)}
    </span>
  );
}

/**
 * Milestones on the left, everyone's updated record on the right.
 *
 * On its own the milestone list is often one line, which wastes a whole
 * screen. Pairing it with the records means the panel always carries
 * something to read, and the two answer each other — "biggest night ever"
 * next to the W/L that produced it.
 */
function MilestonePanel({ recap }: { recap: Recap }) {
  const rows = recap.milestones.slice(0, 4);
  const played = new Set(recap.tonight.map((p) => p.playerId));
  const records = recap.standings
    .filter((s) => played.has(s.playerId))
    .sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="h-full flex flex-col animate-[fadeIn_450ms_ease-out]">
      <PanelTitle>What changed</PanelTitle>
      <div className="flex-1 min-h-0 grid grid-cols-[1.35fr_1fr] gap-[3vw]">
        <div className="flex flex-col justify-center gap-[2.4vh] min-h-0">
          {rows.map((m, i) => (
            <div
              key={`${m.playerId}-${i}`}
              className="flex items-center gap-[1.6vw] min-w-0"
            >
              <DisplayAvatar
                name={m.name}
                photoUrl={m.photoUrl}
                size={92}
                ring={m.tone === "win" ? "#22c55e" : "#ef4444"}
              />
              <div className="min-w-0">
                <div
                  className="font-black leading-tight text-[clamp(22px,2.7vw,48px)]"
                  style={{ color: m.tone === "win" ? "#22c55e" : "#ef4444" }}
                >
                  {m.name} — {m.headline}
                </div>
                <div className="text-white/55 text-[clamp(14px,1.5vw,26px)] mt-[0.5vh]">
                  {m.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-center min-h-0 border-l border-white/10 pl-[2.5vw]">
          <div className="uppercase tracking-[0.24em] text-white/30 font-bold text-[clamp(11px,1.1vw,18px)] mb-[1.6vh]">
            Records after tonight
          </div>
          <div className="flex flex-col gap-[1.4vh]">
            {records.map((s) => (
              <div
                key={s.playerId}
                className="flex items-baseline gap-[1vw] whitespace-nowrap"
              >
                <span className="flex-1 min-w-0 truncate text-white/80 font-bold text-[clamp(16px,1.9vw,32px)]">
                  {s.name}
                </span>
                <span className="text-white/40 tabular-nums text-[clamp(13px,1.3vw,22px)]">
                  {s.wins}W · {s.sessions - s.wins}L
                </span>
                <span className="text-white tabular-nums font-bold text-[clamp(16px,1.8vw,30px)] w-[4.5vw] text-right">
                  {Math.round(s.winRate * 100)}%
                </span>
                <span
                  className="tabular-nums text-[clamp(12px,1.2vw,20px)] w-[4vw] text-right"
                  style={{
                    color:
                      s.winRateDelta > 0
                        ? "#22c55e"
                        : s.winRateDelta < 0
                          ? "#ef4444"
                          : "rgba(255,255,255,0.22)",
                  }}
                >
                  {s.winRateDelta === 0
                    ? "—"
                    : `${s.winRateDelta > 0 ? "+" : ""}${s.winRateDelta.toFixed(0)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
