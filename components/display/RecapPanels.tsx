"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Recap, RecapMilestone, RecapStanding } from "@/lib/display/recap";
import { SEASON_ACCENT } from "@/lib/stats/season";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";
import Portrait from "./Portrait";
import SeasonBoard from "./SeasonBoard";
import { plColor, signedINR } from "./money";

/**
 * The end-of-night reveal.
 *
 * Panels take turns rather than playing once, because people are still in the
 * room settling up and arguing. Someone who looks up ten minutes after the
 * game ends should still see how the night went.
 *
 * Each panel is one screen — no scrolling, since nobody can scroll a TV — and
 * each looks different at a glance: tonight is a gold bar chart, the season
 * is the idle board's leader-and-table layout in the season's colour, and
 * "what changed" is cards that fill the screen however many there are. The
 * first version drew slides 1 and 2 as near-identical tables and the host
 * took them for the same slide.
 *
 * Everything is sized in vh so it's the same on a 720p TV and a 4K one.
 */

const PANEL_MS = 15000;
const GOLD = "#e9c46a";

export default function RecapPanels({ recap }: { recap: Recap }) {
  // Panel 3 is dropped entirely when nothing notable happened. A reveal that
  // fires every week stops being a reveal.
  const panelCount = recap.milestones.length > 0 ? 3 : 2;
  const [index, setIndex] = useState(0);
  const accent = SEASON_ACCENT[recap.seasonName];

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

  const bar = index === 0 ? GOLD : index === 1 ? accent : null;

  return (
    <div className="absolute inset-0 z-30 bg-[#051911] flex flex-col">
      {bar && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[0.8vh]"
          style={{ background: bar }}
        />
      )}

      <div className="flex-1 min-h-0 p-[5vh_5vw_2vh] flex flex-col">
        {index === 0 && <TonightPanel recap={recap} />}
        {index === 1 && <StandingsPanel recap={recap} accent={accent} />}
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
              background: i === index ? GOLD : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PanelTitle({
  title,
  note,
  color,
}: {
  title: string;
  note?: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-[1.4vw] mb-[3vh] shrink-0 min-w-0">
      <span
        className="font-black tracking-[0.02em] text-[4.4vh] shrink-0"
        style={color ? { color } : undefined}
      >
        {title}
      </span>
      {note && (
        <span className="text-white/40 text-[2.4vh] truncate">{note}</span>
      )}
    </div>
  );
}

// ---------- Slide 1: tonight, as a bar chart ----------

/**
 * Winners' green bars grow right from a centre line, losers' red bars grow
 * left, scaled to the night's biggest swing. Bars stop at 38% of the track
 * so the amount label always has room beside them.
 */
function TonightPanel({ recap }: { recap: Recap }) {
  const rows = recap.tonight;
  const max = Math.max(1, ...rows.map((p) => Math.abs(p.profitLoss)));
  return (
    <div className="h-full flex flex-col min-h-0 animate-[fadeIn_450ms_ease-out]">
      <PanelTitle
        title="Tonight"
        note={`${formatINR(recap.pot)} on the table`}
        color={GOLD}
      />
      <div
        className="flex-1 min-h-0 grid gap-[1.1vh]"
        style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0,1fr))` }}
      >
        {rows.map((p, i) => {
          const w = (Math.abs(p.profitLoss) / max) * 38;
          const up = p.profitLoss >= 0;
          return (
            <div
              key={p.playerId}
              className="grid items-center gap-x-[1.6vw] min-h-0"
              style={{ gridTemplateColumns: "7.5vh 20vw minmax(0,1fr)" }}
            >
              <DisplayAvatar
                name={p.name}
                photoUrl={p.photoUrl}
                size="7vh"
                ring={i === 0 ? GOLD : undefined}
              />
              <div className="min-w-0">
                <div className="font-extrabold truncate text-[3.4vh] leading-tight">
                  {p.name}
                </div>
                <div className="text-white/40 tabular-nums whitespace-nowrap text-[1.9vh] mt-[0.3vh]">
                  in {formatINR(p.totalBuyIn)} · out {formatINR(p.chipsLeft)}
                </div>
              </div>
              <div className="relative h-[5.2vh]">
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 -top-[1.2vh] -bottom-[1.2vh] w-[2px] bg-white/[0.18]"
                />
                {w > 0 && (
                  <div
                    className="absolute inset-y-0 rounded-[0.8vh]"
                    style={
                      up
                        ? {
                            left: "50%",
                            width: `${w}%`,
                            background:
                              "linear-gradient(90deg, rgba(34,197,94,0.35), #22c55e)",
                          }
                        : {
                            right: "50%",
                            width: `${w}%`,
                            background:
                              "linear-gradient(270deg, rgba(239,68,68,0.35), #ef4444)",
                          }
                    }
                  />
                )}
                <span
                  className="absolute top-1/2 -translate-y-1/2 font-black tabular-nums whitespace-nowrap text-[3.2vh]"
                  style={{
                    color: plColor(p.profitLoss),
                    ...(up
                      ? { left: `calc(50% + ${w}% + 1.2vw)` }
                      : { right: `calc(50% + ${w}% + 1.2vw)` }),
                  }}
                >
                  {signedINR(p.profitLoss)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Slide 2: the season, in the idle board's layout ----------

function StandingsPanel({ recap, accent }: { recap: Recap; accent: string }) {
  return (
    <div className="h-full min-h-0 animate-[fadeIn_450ms_ease-out]">
      <SeasonBoard
        rows={recap.standings.map((s) => ({
          playerId: s.playerId,
          name: s.name,
          photoUrl: s.photoUrl,
          characterUrl: s.characterUrl,
          total: s.total,
          sessions: s.sessions,
          wins: s.wins,
          movement: s.movement,
          tonight: s.playedTonight ? s.tonightDelta : null,
        }))}
        seasonNights={recap.seasonNights}
        heroTag="Leading after tonight"
        accent={accent}
        heading={
          <div className="flex items-baseline gap-[1.4vw] min-w-0">
            <span
              className="font-black text-[3.6vh] shrink-0"
              style={{ color: accent }}
            >
              {recap.seasonLabel}
            </span>
            <span className="text-white/40 text-[2.4vh] truncate">
              after tonight · {recap.seasonNights} night
              {recap.seasonNights === 1 ? "" : "s"}
            </span>
          </div>
        }
      />
    </div>
  );
}

// ---------- Slide 3: what changed in the season ----------

const TONE_COLOR: Record<RecapMilestone["tone"], string> = {
  lead: GOLD,
  win: "#22c55e",
  loss: "#ef4444",
};

type CardVariant = "hero" | "column" | "tile";

/**
 * The layout adapts to how many things happened, so the screen is always
 * full: one fills it as a single hero, two or three stand side by side as
 * tall columns, four make a 2×2 grid. The first version put a lone
 * milestone in a small card in the top-left and left the rest empty.
 *
 * Every card carries the player's season strip — P/L, W–L, win rate,
 * attendance — so even a one-event night has something to read.
 */
function MilestonePanel({ recap }: { recap: Recap }) {
  const items = recap.milestones.slice(0, 4);
  const n = items.length;
  const variant: CardVariant = n === 1 ? "hero" : n === 4 ? "tile" : "column";
  const standing = new Map(recap.standings.map((s) => [s.playerId, s]));
  const tonight = new Map(recap.tonight.map((p) => [p.playerId, p.profitLoss]));

  return (
    <div className="h-full flex flex-col min-h-0 animate-[fadeIn_450ms_ease-out]">
      <PanelTitle title="What changed" note={`in ${recap.seasonLabel}`} />
      <div
        className="flex-1 min-h-0 grid gap-[2.4vh_2.4vw]"
        style={{
          gridTemplateColumns:
            n === 4 ? "1fr 1fr" : `repeat(${n}, minmax(0,1fr))`,
          gridTemplateRows: n === 4 ? "1fr 1fr" : "minmax(0,1fr)",
        }}
      >
        {items.map((m, i) => (
          <MilestoneCard
            key={`${m.playerId}-${i}`}
            m={m}
            variant={variant}
            standing={standing.get(m.playerId)}
            tonight={tonight.get(m.playerId)}
            seasonNights={recap.seasonNights}
          />
        ))}
      </div>
    </div>
  );
}

function MilestoneCard({
  m,
  variant,
  standing,
  tonight,
  seasonNights,
}: {
  m: RecapMilestone;
  variant: CardVariant;
  standing: RecapStanding | undefined;
  /** Undefined when they sat tonight out. */
  tonight: number | undefined;
  seasonNights: number;
}) {
  const color = TONE_COLOR[m.tone];
  // Tonight's figure goes after the detail, unless the detail already quotes
  // it. Amounts render through `amounts()` so a line can't break between
  // the sign and the number.
  const tail =
    tonight === undefined
      ? "sat out tonight"
      : m.headline.startsWith("Biggest win") ||
          m.headline.startsWith("Worst night")
        ? null
        : `${signedINR(tonight)} tonight`;

  const text = {
    hero: { kicker: "2.3vh", head: "7.5vh", detail: "3vh" },
    column: { kicker: "2.1vh", head: "4.6vh", detail: "2.5vh" },
    tile: { kicker: "2vh", head: "3.4vh", detail: "2.2vh" },
  }[variant];

  const words = (
    <div className={`min-w-0 ${variant === "column" ? "text-center" : ""}`}>
      <div
        className="uppercase tracking-[0.28em] font-extrabold text-white/55 truncate"
        style={{ fontSize: text.kicker }}
      >
        {m.name}
      </div>
      <div
        className="font-black leading-[1.05] mt-[1vh]"
        style={{ color, fontSize: text.head }}
      >
        {m.headline}
      </div>
      <div
        className="text-white/60 mt-[1.2vh] tabular-nums"
        style={{ fontSize: text.detail }}
      >
        {amounts(m.detail)}
        {tail && (
          <>
            {" · "}
            <span className="whitespace-nowrap">{amounts(tail)}</span>
          </>
        )}
      </div>
      {standing && (
        <SeasonStrip
          standing={standing}
          seasonNights={seasonNights}
          variant={variant}
        />
      )}
    </div>
  );

  const glow = `radial-gradient(ellipse at ${
    variant === "column" ? "50% 25%" : "20% 50%"
  }, ${color}24, transparent 60%)`;
  const shell =
    "min-h-0 min-w-0 rounded-[2.4vh] border border-white/[0.07] overflow-hidden";

  if (variant === "hero") {
    return (
      <div
        className={`${shell} grid items-center gap-[4vw] px-[5vw]`}
        style={{
          gridTemplateColumns: "40% minmax(0,1fr)",
          background: `${glow}, rgba(255,255,255,0.03)`,
        }}
      >
        <div className="flex justify-center items-center min-h-0">
          <Portrait
            name={m.name}
            photoUrl={m.photoUrl}
            characterUrl={m.characterUrl}
            size="40vh"
            color={color}
          />
        </div>
        {words}
      </div>
    );
  }

  if (variant === "column") {
    return (
      <div
        className={`${shell} flex flex-col items-center justify-center gap-[3vh] px-[2vw]`}
        style={{ background: `${glow}, rgba(255,255,255,0.03)` }}
      >
        <Portrait
          name={m.name}
          photoUrl={m.photoUrl}
          characterUrl={m.characterUrl}
          size="20vh"
          color={color}
        />
        {words}
      </div>
    );
  }

  return (
    <div
      className={`${shell} flex items-center gap-[2vw] px-[2.4vw]`}
      style={{ background: `${glow}, rgba(255,255,255,0.035)` }}
    >
      <Portrait
        name={m.name}
        photoUrl={m.photoUrl}
        characterUrl={null}
        size="13vh"
        color={color}
      />
      {words}
    </div>
  );
}

/**
 * Wrap every signed amount in a no-wrap span, with a real minus sign. The
 * TV was breaking lines between "-" and "₹4,000" — even U+2212 alone
 * didn't stop Chrome doing it.
 */
function amounts(text: string): ReactNode[] {
  return text.split(/([+-]₹[\d,]+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap">
        {part.replace("-", "\u2212")}
      </span>
    ) : (
      part
    ),
  );
}

/** Season P/L, W–L, win rate and attendance for the player on a card. */
function SeasonStrip({
  standing: s,
  seasonNights,
  variant,
}: {
  standing: RecapStanding;
  seasonNights: number;
  variant: CardVariant;
}) {
  const items: { k: string; v: string; color?: string }[] = [
    { k: "Season", v: signedINR(s.total), color: plColor(s.total) },
    { k: "W–L", v: `${s.wins}–${s.sessions - s.wins}` },
    {
      k: "Win rate",
      v: `${Math.round((s.sessions > 0 ? s.wins / s.sessions : 0) * 100)}%`,
    },
    {
      k: "Attendance",
      v: `${Math.round((seasonNights > 0 ? s.sessions / seasonNights : 0) * 100)}%`,
    },
  ];
  const size = {
    hero: { k: "1.8vh", v: "4.2vh", gap: "3.2vw", top: "5vh" },
    column: { k: "1.6vh", v: "3.2vh", gap: "2vw", top: "3vh" },
    tile: { k: "1.4vh", v: "2.4vh", gap: "1.6vw", top: "1.6vh" },
  }[variant];

  return (
    <div
      className={`grid border-t border-white/[0.08] ${
        variant === "column" ? "justify-center" : "justify-start"
      }`}
      style={{
        gridTemplateColumns:
          variant === "column" ? "repeat(2, auto)" : "repeat(4, auto)",
        columnGap: size.gap,
        rowGap: "1.6vh",
        marginTop: size.top,
        paddingTop: size.top,
      }}
    >
      {items.map((it) => (
        <div key={it.k} className="min-w-0">
          <div
            className="uppercase tracking-[0.2em] text-white/35 font-bold whitespace-nowrap"
            style={{ fontSize: size.k }}
          >
            {it.k}
          </div>
          <div
            className="font-black tabular-nums whitespace-nowrap mt-[0.6vh]"
            style={{ fontSize: size.v, color: it.color }}
          >
            {it.v}
          </div>
        </div>
      ))}
    </div>
  );
}
