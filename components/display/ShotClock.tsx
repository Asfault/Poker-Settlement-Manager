"use client";

import { useEffect, useState } from "react";
import { SHOT_CLOCK_SECONDS } from "@/lib/db/display";

/**
 * The 30-second shot clock.
 *
 * Counted against the SERVER's clock, not the TV's. `display_live` returns
 * `server_time` alongside the payload, and the offset between that and this
 * device is applied to every tick — a TV with a clock an hour out still
 * counts down correctly.
 *
 * It outranks everything: alerts, filler, the drawer. Someone is being told
 * to act.
 */

/** How long "cards are dead" stays up after zero. */
const DEAD_HOLD_MS = 8000;

export default function ShotClock({
  startedAt,
  serverOffsetMs,
}: {
  /** Epoch ms of when the host started it, or null when nothing's running. */
  startedAt: number | null;
  /** serverNow − deviceNow, applied so the TV's own clock doesn't matter. */
  serverOffsetMs: number;
}) {
  const [, force] = useState(0);

  // 10fps is plenty for whole seconds and costs nothing.
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return null;

  const elapsed = Date.now() + serverOffsetMs - startedAt;
  const remainingMs = SHOT_CLOCK_SECONDS * 1000 - elapsed;

  // Stop rendering a while after it expires, so a clock nobody cleared
  // doesn't sit on screen all night.
  if (remainingMs < -DEAD_HOLD_MS) return null;

  const expired = remainingMs <= 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = !expired && seconds <= 10;

  if (expired) {
    return (
      <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center shotclock-dead">
        <div
          className="font-black leading-none text-white text-[clamp(60px,11vw,220px)]"
          style={{ textShadow: "0 0.6vh 3vh rgba(0,0,0,0.6)" }}
        >
          TIME&apos;S UP
        </div>
        <div className="mt-[3vh] font-bold uppercase tracking-[0.2em] text-white/90 text-[clamp(20px,2.8vw,52px)]">
          Your cards are dead
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#051911]/80">
      <div
        className="uppercase tracking-[0.3em] font-bold text-[clamp(14px,1.6vw,26px)]"
        style={{ color: urgent ? "#ef4444" : "rgba(255,255,255,0.45)" }}
      >
        Shot clock
      </div>
      <div
        className={`font-black leading-none tabular-nums text-[clamp(120px,22vw,420px)] ${
          urgent ? "shotclock-urgent" : ""
        }`}
        style={{
          color: urgent ? "#ef4444" : "#e9c46a",
          textShadow: "0 1vh 5vh rgba(0,0,0,0.7)",
        }}
      >
        {seconds}
      </div>
    </div>
  );
}
