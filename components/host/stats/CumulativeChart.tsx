"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/format";

/**
 * Cumulative poker P/L per player over time — the "who's actually up" chart.
 *
 * X axis is session index rather than real time: nights are what matter, and
 * spacing by date would squash a busy month against a quiet year. Each player
 * is plotted only across the nights they played, so lines start where a player
 * debuts.
 *
 * Legend entries toggle lines on and off. Capped to the six most frequent
 * players by default, since seven overlapping lines on a phone is unreadable.
 */

export interface CumulativeSeries {
  playerId: string;
  name: string;
  sessions: number;
  /** Oldest first. */
  points: { at: number; total: number }[];
}

const COLORS = [
  "#e9c46a",
  "#22c55e",
  "#60a5fa",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#2dd4bf",
  "#facc15",
];

const W = 320;
const H = 150;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 10;

export default function CumulativeChart({
  series,
}: {
  series: CumulativeSeries[];
}) {
  const ranked = useMemo(
    () => [...series].sort((a, b) => b.sessions - a.sessions),
    [series],
  );

  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(ranked.slice(6).map((s) => s.playerId)),
  );

  const visible = ranked.filter((s) => !hidden.has(s.playerId));

  const { maxLen, min, max } = useMemo(() => {
    let maxLen = 0;
    let min = 0;
    let max = 0;
    for (const s of visible) {
      if (s.points.length > maxLen) maxLen = s.points.length;
      for (const p of s.points) {
        if (p.total < min) min = p.total;
        if (p.total > max) max = p.total;
      }
    }
    // Never collapse to a zero-height range.
    if (min === max) {
      min -= 100;
      max += 100;
    }
    return { maxLen, min, max };
  }, [visible]);

  if (series.length === 0) return null;

  const x = (i: number) =>
    PAD_L + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * (W - PAD_L - PAD_R));
  const y = (v: number) =>
    PAD_T + ((max - v) / (max - min)) * (H - PAD_T - PAD_B);

  function toggle(playerId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Cumulative profit and loss per player across sessions"
        preserveAspectRatio="none"
      >
        {/* Break-even line — above it you're up, below it you're down. */}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={y(0)}
          y2={y(0)}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {visible.map((s) => {
          const colorIndex = ranked.findIndex(
            (r) => r.playerId === s.playerId,
          );
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.total)}`)
            .join(" ");
          return (
            <path
              key={s.playerId}
              d={d}
              fill="none"
              stroke={COLORS[colorIndex % COLORS.length]}
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {ranked.map((s, i) => {
          const off = hidden.has(s.playerId);
          const last = s.points[s.points.length - 1]?.total ?? 0;
          return (
            <button
              key={s.playerId}
              onClick={() => toggle(s.playerId)}
              aria-pressed={!off}
              className={`flex items-center gap-1.5 text-xs min-h-[32px] transition-opacity ${
                off ? "opacity-35" : ""
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-white/75">{s.name}</span>
              <span
                className={`tabular-nums ${
                  last > 0
                    ? "text-win"
                    : last < 0
                      ? "text-loss"
                      : "text-white/40"
                }`}
              >
                {last > 0 ? "+" : ""}
                {formatINR(last)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
