"use client";

import type { LiveRow } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";
import TiltAura from "./TiltAura";

/**
 * The live board: characters seated around a felt oval.
 *
 * Seats are computed from an ellipse so the layout adapts from 3 players to
 * 10 without hand-placing anything. The host is pinned to top-centre and
 * everyone else fills clockwise from there in session order.
 *
 * Characters deliberately overlap the table rail — that overlap is what
 * makes them read as sitting at it rather than floating around it.
 */

interface Seat {
  row: LiveRow;
  /** Percent of container. */
  x: number;
  y: number;
}

/** Ellipse radii as a percentage of the container. */
const RX = 37;
const RY = 31;
const CX = 50;
const CY = 49;

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
  if (n <= 4) return 1.35;
  if (n <= 6) return 1.15;
  if (n <= 8) return 1;
  return 0.82;
}

const CHIP_COLOURS = ["#d73535", "#1f9d55", "#2676c9", "#e9c46a", "#8b5cf6"];

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
      {/* --- Room ambience, all behind the table --- */}

      {/* Pendant light pooling over the table */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "48%",
          transform: "translate(-50%, -50%)",
          width: "115%",
          height: "150%",
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(255,214,140,0.16) 0%, rgba(255,190,110,0.07) 28%, transparent 62%)",
        }}
      />
      {/* Light cone falling from above */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "-16%",
          transform: "translateX(-50%)",
          width: "42%",
          height: "72%",
          background:
            "linear-gradient(to bottom, rgba(255,220,150,0.14), rgba(255,220,150,0.03) 55%, transparent)",
          clipPath: "polygon(41% 0, 59% 0, 100% 100%, 0 100%)",
          filter: "blur(1.4vw)",
        }}
      />
      {/* Room falls off into darkness at the edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(0,0,0,0.55) 88%)",
          margin: "-6vh -6vw",
        }}
      />

      {/* Elapsed, top right */}
      <div className="absolute top-0 right-0 text-right z-20">
        <div className="uppercase tracking-[0.22em] text-white/35 font-semibold text-[clamp(11px,1.1vw,20px)]">
          Elapsed
        </div>
        <div className="text-[#e9c46a] font-black leading-none text-[clamp(26px,2.6vw,48px)]">
          {elapsed}
        </div>
      </div>

      {/* --- The table --- */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: `${CY + 3}%`,
          transform: "translate(-50%, -50%)",
          width: "42%",
          aspectRatio: "1.75 / 1",
        }}
      >
        {/* Wooden rail */}
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background:
              "linear-gradient(160deg, #6b452a 0%, #4a2f18 38%, #35200f 70%, #5c3a22 100%)",
            boxShadow:
              "0 2vh 5vh rgba(0,0,0,0.6), inset 0 0.2vh 0.4vh rgba(255,210,150,0.25)",
          }}
        />
        {/* Felt */}
        <div
          className="absolute rounded-[50%] overflow-hidden"
          style={{
            inset: "1.6%",
            background:
              "radial-gradient(ellipse at 50% 32%, #1e7a4f 0%, #0f4b2f 55%, #08301e 100%)",
            boxShadow:
              "inset 0 0 6vw rgba(0,0,0,0.6), inset 0 0.4vh 1vh rgba(0,0,0,0.5)",
          }}
        >
          {/* Felt weave */}
          <div
            className="absolute inset-0 opacity-[0.09]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.7) 0.5px, transparent 0.5px)",
              backgroundSize: "3px 3px",
            }}
          />
          {/* Betting line */}
          <div
            className="absolute rounded-[50%]"
            style={{
              inset: "13%",
              border: "0.12vw solid rgba(255,255,255,0.09)",
            }}
          />
        </div>

        {/* Pot */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="uppercase tracking-[0.3em] text-white/45 font-bold text-[clamp(10px,1.05vw,19px)]">
            Total pot
          </div>
          <div
            className="text-[#ffd95a] font-black leading-none text-[clamp(38px,5vw,105px)]"
            style={{ textShadow: "0 0.4vh 2vh rgba(0,0,0,0.7)" }}
          >
            {formatINR(pot)}
          </div>
          {/* Chips scattered under the pot */}
          <div className="flex items-end gap-[0.5vw] mt-[1.2vh]">
            {[3, 5, 2, 4].map((count, stack) => (
              <div key={stack} className="flex flex-col-reverse">
                {Array.from({ length: count }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: "2.1vw",
                      height: "0.55vw",
                      marginTop: "-0.1vw",
                      borderRadius: "50%",
                      background: `linear-gradient(90deg, ${CHIP_COLOURS[stack % CHIP_COLOURS.length]}, #fff 22%, ${CHIP_COLOURS[stack % CHIP_COLOURS.length]} 42%, ${CHIP_COLOURS[stack % CHIP_COLOURS.length]} 60%, #fff 80%, ${CHIP_COLOURS[stack % CHIP_COLOURS.length]})`,
                      boxShadow: "0 0.1vw 0.2vw rgba(0,0,0,0.5)",
                      border: "0.05vw solid rgba(255,255,255,0.35)",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- Seats --- */}
      {seats.map(({ row, x, y }) => (
        <div
          key={row.playerId}
          className="absolute text-center z-20"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
            width: `${17 * scale}%`,
          }}
        >
          <div className="flex items-end justify-center relative">
            {row.tilted && <TiltAura scale={scale} />}

            {row.characterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.characterUrl}
                alt={row.displayName}
                className="relative object-contain"
                style={{
                  height: `${16 * scale}vw`,
                  maxHeight: `${34 * scale}vh`,
                  filter: row.tilted
                    ? "drop-shadow(0 0 1vw rgba(255,230,120,0.6))"
                    : "drop-shadow(0 1vh 2vh rgba(0,0,0,0.7))",
                }}
              />
            ) : (
              <div className="relative">
                <DisplayAvatar
                  name={row.displayName}
                  photoUrl={row.photoUrl}
                  size={120 * scale}
                  ring={row.isHost ? "rgba(233,196,106,0.8)" : undefined}
                />
              </div>
            )}

            {row.isHost && (
              <span
                className="absolute -top-1 right-0 bg-[#e9c46a] text-[#0a2c1c] font-black rounded-full leading-none z-10"
                style={{
                  fontSize: `${0.85 * scale}vw`,
                  padding: `${0.3 * scale}vw ${0.7 * scale}vw`,
                  letterSpacing: "0.1em",
                  boxShadow: "0 0.2vw 0.6vw rgba(0,0,0,0.5)",
                }}
              >
                HOST
              </span>
            )}
          </div>

          {/* Name plate */}
          <div
            className="inline-block rounded-lg px-[0.9vw] py-[0.3vh] mt-[0.4vh]"
            style={{
              background: "rgba(2,14,10,0.72)",
              border: "0.08vw solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div
              className="text-white font-bold truncate leading-tight"
              style={{ fontSize: `${1.45 * scale}vw` }}
            >
              {row.displayName}
            </div>
            <div
              className="text-[#ffd95a] font-black tabular-nums leading-tight"
              style={{ fontSize: `${1.75 * scale}vw` }}
            >
              {formatINR(row.totalBuyIn)}
            </div>
          </div>

          {row.tilted && (
            <div
              className="text-[#ffe066] font-black tracking-wider mt-[0.3vh]"
              style={{
                fontSize: `${1.05 * scale}vw`,
                textShadow: "0 0 0.6vw rgba(255,224,102,0.7)",
              }}
            >
              ON TILT
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
