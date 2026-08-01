"use client";

import type { LiveRow } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";
import TiltAura from "./TiltAura";
import TiltStamp from "./TiltStamp";
import NamePlate from "./NamePlate";

/**
 * The live board.
 *
 * The room and the table are a single background image, so nothing here
 * draws furniture — players are positioned around the oval that's already
 * in the picture, and the pot sits on its felt.
 *
 * Seats come from an ellipse tuned to match that table, so the layout
 * adapts from 3 players to 10 without hand-placing anything. The host is
 * pinned to top-centre; everyone else fills clockwise in session order.
 */

interface Seat {
  row: LiveRow;
  x: number;
  y: number;
  /** 0 at the back of the table, 1 at the front — drives depth. */
  depth: number;
}

// Tuned against the backdrop art: centre and radii of its table oval.
const CX = 50;
const CY = 52;
const RX = 40;
const RY = 29;

// Where the pot sits on the felt.
const POT_X = 50;
const POT_Y = 54;

function layout(rows: LiveRow[]): Seat[] {
  const n = rows.length;
  if (n === 0) return [];

  const hostIndex = rows.findIndex((r) => r.isHost);
  const ordered =
    hostIndex > 0
      ? [...rows.slice(hostIndex), ...rows.slice(0, hostIndex)]
      : rows;

  return ordered.map((row, i) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    const sin = Math.sin(angle);
    return {
      row,
      x: CX + RX * Math.cos(angle),
      y: CY + RY * sin,
      // -1 at the back, +1 at the front.
      depth: (sin + 1) / 2,
    };
  });
}

function seatScale(n: number): number {
  if (n <= 4) return 1.35;
  if (n <= 6) return 1.15;
  if (n <= 8) return 1;
  return 0.82;
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
    <div className="absolute inset-0 overflow-hidden">
      {/* The room — table and all */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/table-room.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Elapsed */}
      <div className="absolute top-[3vh] right-[3vw] text-right z-30">
        <div className="uppercase tracking-[0.22em] text-white/40 font-semibold text-[clamp(11px,1.1vw,20px)]">
          Elapsed
        </div>
        <div className="text-[#e9c46a] font-black leading-none text-[clamp(26px,2.6vw,48px)]">
          {elapsed}
        </div>
      </div>

      {/* Pot, sitting on the felt */}
      <div
        className="absolute z-20 text-center"
        style={{
          left: `${POT_X}%`,
          top: `${POT_Y}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="uppercase tracking-[0.34em] text-white/45 font-bold text-[clamp(10px,1.05vw,19px)]">
          Total pot
        </div>
        <div
          className="text-[#ffd95a] font-black leading-none text-[clamp(40px,5.4vw,115px)]"
          style={{
            textShadow:
              "0 0.4vh 2.5vh rgba(0,0,0,0.85), 0 0 4vh rgba(255,200,90,0.3)",
          }}
        >
          {formatINR(pot)}
        </div>
      </div>

      {/* Seats */}
      {seats.map(({ row, x, y, depth }) => {
        // Players at the front of the table read slightly larger.
        const depthScale = scale * (0.9 + depth * 0.2);
        return (
          <div
            key={row.playerId}
            className="absolute text-center"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              width: `${17 * depthScale}%`,
              // Front players overlap those behind them.
              zIndex: 10 + Math.round(depth * 10),
            }}
          >
            {/* Spotlight pooling on this seat */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: "50%",
                top: "42%",
                transform: "translate(-50%, -50%)",
                width: "165%",
                height: "150%",
                background: row.tilted
                  ? "radial-gradient(ellipse at 50% 38%, rgba(255,90,70,0.34) 0%, rgba(220,40,35,0.16) 40%, transparent 70%)"
                  : row.isHost
                    ? "radial-gradient(ellipse at 50% 38%, rgba(255,214,140,0.36) 0%, rgba(255,196,110,0.16) 38%, transparent 68%)"
                    : "radial-gradient(ellipse at 50% 38%, rgba(255,240,215,0.2) 0%, rgba(255,230,190,0.08) 40%, transparent 68%)",
              }}
            />

            <div className="flex items-end justify-center relative">
              {row.tilted && <TiltAura scale={depthScale} />}

              {row.characterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.characterUrl}
                  alt={row.displayName}
                  className="relative object-contain"
                  style={{
                    height: `${16 * depthScale}vw`,
                    maxHeight: `${34 * depthScale}vh`,
                    filter: row.tilted
                      ? "drop-shadow(0 0 1vw rgba(255,70,60,0.8)) drop-shadow(0 0 2.2vw rgba(220,30,30,0.5))"
                      : "drop-shadow(0 1.2vh 2.2vh rgba(0,0,0,0.8))",
                  }}
                />
              ) : (
                <div className="relative">
                  <DisplayAvatar
                    name={row.displayName}
                    photoUrl={row.photoUrl}
                    size={120 * depthScale}
                    ring={
                      row.tilted
                        ? "rgba(255,92,92,0.9)"
                        : row.isHost
                          ? "rgba(255,214,140,0.85)"
                          : undefined
                    }
                  />
                </div>
              )}

              {row.tilted && <TiltStamp scale={depthScale} />}
            </div>

            <div className="relative">
              <NamePlate
                name={row.displayName}
                amount={formatINR(row.totalBuyIn)}
                scale={depthScale}
                highlight={row.isHost}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
