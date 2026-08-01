"use client";

import type { LiveRow } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";

/**
 * The live board: characters seated around a felt oval.
 *
 * Seats are computed from an ellipse so the layout adapts from 3 players to
 * 10 without hand-placing anything. The host is pinned to top-centre and
 * everyone else fills clockwise from there in session order.
 */

interface Seat {
  row: LiveRow;
  /** Percent of container. */
  x: number;
  y: number;
}

/** Ellipse radii as a percentage of the container, leaving room for labels. */
const RX = 40;
const RY = 33;
const CX = 50;
const CY = 50;

function layout(rows: LiveRow[]): Seat[] {
  const n = rows.length;
  if (n === 0) return [];

  // Host first so they land at top-centre, everyone else keeps their order.
  const hostIndex = rows.findIndex((r) => r.isHost);
  const ordered =
    hostIndex > 0
      ? [...rows.slice(hostIndex), ...rows.slice(0, hostIndex)]
      : rows;

  // Start at the top (-90°) and go clockwise.
  return ordered.map((row, i) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    return {
      row,
      x: CX + RX * Math.cos(angle),
      y: CY + RY * Math.sin(angle),
    };
  });
}

/** Characters shrink as the table fills up. */
function seatScale(n: number): number {
  if (n <= 4) return 1.25;
  if (n <= 6) return 1.1;
  if (n <= 8) return 1;
  return 0.85;
}

export default function PokerTable({
  rows,
  pot,
  startedAt,
  now,
}: {
  rows: LiveRow[];
  pot: number;
  startedAt: number;
  now: number;
}) {
  const seats = layout(rows);
  const scale = seatScale(rows.length);

  const mins = Math.max(0, Math.floor((now - startedAt) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const elapsed = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <div className="relative w-full h-full">
      {/* Elapsed, top right */}
      <div className="absolute top-0 right-0 text-right z-20">
        <div className="uppercase tracking-[0.22em] text-white/35 font-semibold text-[clamp(11px,1.1vw,20px)]">
          Elapsed
        </div>
        <div className="text-[#e9c46a] font-black leading-none text-[clamp(26px,2.6vw,48px)]">
          {elapsed}
        </div>
      </div>

      {/* Felt */}
      <div
        className="absolute rounded-[50%] flex flex-col items-center justify-center"
        style={{
          left: "50%",
          top: "52%",
          transform: "translate(-50%, -50%)",
          width: "44%",
          aspectRatio: "1.75 / 1",
          background:
            "radial-gradient(ellipse at 50% 35%, #1a6b45, #0d3d27 70%, #082a1b)",
          border: "0.9vw solid #4a2f18",
          boxShadow:
            "0 0 0 0.35vw rgba(233,196,106,0.28), inset 0 0 6vw rgba(0,0,0,0.55)",
        }}
      >
        <div className="uppercase tracking-[0.3em] text-white/40 font-bold text-[clamp(10px,1.1vw,20px)]">
          Total pot
        </div>
        <div
          className="text-[#e9c46a] font-black leading-none text-[clamp(38px,5.2vw,110px)]"
          style={{ textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}
        >
          {formatINR(pot)}
        </div>
      </div>

      {/* Seats */}
      {seats.map(({ row, x, y }) => (
        <div
          key={row.playerId}
          className="absolute text-center z-10"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
            width: `${15 * scale}%`,
          }}
        >
          <div className="flex items-end justify-center relative">
            {row.recentBuyIns >= 2 && (
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  width: "120%",
                  aspectRatio: "1",
                  background:
                    "radial-gradient(circle, rgba(239,68,68,0.5), transparent 70%)",
                }}
              />
            )}

            {row.characterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.characterUrl}
                alt={row.displayName}
                className="relative object-contain"
                style={{
                  height: `${10 * scale}vw`,
                  maxHeight: "22vh",
                  filter:
                    row.recentBuyIns >= 2
                      ? "drop-shadow(0 0 1.5vw rgba(239,68,68,0.8))"
                      : "drop-shadow(0 0.6vw 1.2vw rgba(0,0,0,0.55))",
                }}
              />
            ) : (
              <div className="relative">
                <DisplayAvatar
                  name={row.displayName}
                  photoUrl={row.photoUrl}
                  size={90 * scale}
                  ring={
                    row.isHost
                      ? "rgba(233,196,106,0.8)"
                      : row.recentBuyIns >= 2
                        ? "#ef4444"
                        : undefined
                  }
                />
              </div>
            )}

            {row.isHost && (
              <span
                className="absolute -top-1 right-0 bg-[#e9c46a] text-[#0a2c1c] font-black rounded-full leading-none"
                style={{
                  fontSize: `${0.85 * scale}vw`,
                  padding: `${0.3 * scale}vw ${0.7 * scale}vw`,
                  letterSpacing: "0.1em",
                }}
              >
                HOST
              </span>
            )}
          </div>

          <div
            className="text-white font-bold truncate mt-1"
            style={{ fontSize: `${1.5 * scale}vw` }}
          >
            {row.displayName}
          </div>
          <div
            className="text-[#e9c46a] font-black tabular-nums leading-tight"
            style={{ fontSize: `${1.7 * scale}vw` }}
          >
            {formatINR(row.totalBuyIn)}
          </div>
          {row.recentBuyIns >= 2 && (
            <div
              className="text-[#ef4444] font-black tracking-wider"
              style={{ fontSize: `${1.05 * scale}vw` }}
            >
              ON TILT
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
