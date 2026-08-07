"use client";

import { useEffect, useRef, useState } from "react";
import type { DisplayLiveSession } from "@/lib/db/display";
import { formatINR } from "@/lib/format";
import { SHELL_PAD_VH, TICKER_HEIGHT_VH } from "./Ticker";

/**
 * The buy-in lower third.
 *
 * Buy-ins are the only real-time events the board has — during a session the
 * app knows what people put in, never what they're holding. Before this, an
 * individual buy-in produced nothing on screen unless it happened to trip
 * tilt or a pot milestone, which is most of why the board felt quiet.
 *
 * It's a strip over the board rather than a card, so the table, the pot and
 * the seat pulse all stay visible while it's up.
 *
 * Deliberately outside the alert system: `ALERT_COOLDOWN_MS` would swallow
 * consecutive buy-ins, and these want to queue rather than compete. Entering
 * three at once shows three strips, five seconds apart.
 *
 * **Rebuys only.** Everyone's opening buy-in lands within a few minutes of
 * each other at the start of the night, which produced a queue of near
 * identical strips before anything interesting had happened. A reload is the
 * moment worth announcing; sitting down is not.
 */

const HOLD_MS = 5000;
const GAP_MS = 400;

interface BuyInEvent {
  key: string;
  name: string;
  amount: number;
  /** Which buy-in of theirs this was, 1-indexed. */
  ordinal: number;
  /** Their running total including this one. */
  runningTotal: number;
}

export default function BuyInTicker({
  live,
}: {
  live: DisplayLiveSession | null;
}) {
  const [current, setCurrent] = useState<BuyInEvent | null>(null);
  const queue = useRef<BuyInEvent[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const seededFor = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!live) return;

    // First sight of a session: mark everything already there as seen, so
    // opening the TV mid-game doesn't replay the whole night.
    const seeding = seededFor.current !== live.id;
    if (seeding) {
      seen.current = new Set();
      queue.current = [];
      seededFor.current = live.id;
    }

    const fresh: BuyInEvent[] = [];

    for (const p of live.players) {
      const ordered = [...(p.buy_ins ?? [])].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      let running = 0;
      ordered.forEach((b, i) => {
        running += b.amount;
        const key = `${p.player_id}:${b.at}:${b.amount}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        if (seeding) return;
        // Opening buy-ins are skipped — see the note at the top of the file.
        // They're still marked seen so they never surface later.
        if (i === 0) return;
        fresh.push({
          key,
          name: p.nickname?.trim() || p.name,
          amount: b.amount,
          ordinal: i + 1,
          runningTotal: running,
        });
      });
    }

    if (fresh.length === 0) return;
    queue.current.push(...fresh);
    setCurrent((c) => (c === null ? (queue.current.shift() ?? null) : c));
  }, [live]);

  // Hold the current strip, then take the next one off the queue.
  useEffect(() => {
    if (current === null) return;
    const t = setTimeout(() => {
      setCurrent(null);
      const next = queue.current.shift();
      if (next) {
        const g = setTimeout(() => setCurrent(next), GAP_MS);
        timers.current.push(g);
      }
    }, HOLD_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [current]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  if (!current) return null;

  return (
    <div
      key={current.key}
      className="pointer-events-none absolute z-50 buyin-strip"
      // Inline rather than Tailwind arbitrary values: these negative offsets
      // cancel the shell's 3vh/3vw padding so the strip runs edge to edge,
      // and they're too load-bearing to risk on class generation.
      // Sits exactly where the ticker does, covering it for its five seconds
      // rather than covering the players. Negative offsets cancel the
      // shell's padding so it runs edge to edge.
      style={{
        left: `-${SHELL_PAD_VH}vw`,
        right: `-${SHELL_PAD_VH}vw`,
        bottom: `-${SHELL_PAD_VH}vh`,
      }}
      aria-live="polite"
    >
      {/* Exactly the ticker's height, so it replaces the crawl rather than
          eating into the board above it. Everything sits on one line. */}
      <div
        className="flex items-center border-t-[0.3vh] border-gold-400"
        style={{
          height: `${TICKER_HEIGHT_VH}vh`,
          gap: "1.2vw",
          padding: "0 2vw",
          background:
            "linear-gradient(90deg, rgba(10,15,12,.97) 0%, rgba(15,24,20,.93) 70%, rgba(15,24,20,.6) 100%)",
        }}
      >
        <div
          className="shrink-0 rounded-full bg-gold-400 text-felt-900 font-bold flex items-center justify-center buyin-chip"
          style={{ width: "5.2vh", height: "5.2vh", fontSize: "2.6vh" }}
        >
          ₹
        </div>

        {/* min-w-0 lets this truncate instead of shoving the detail block
            off the right edge when someone has a long name. */}
        <div
          className="text-white font-bold truncate min-w-0"
          style={{ fontSize: "3.6vh" }}
        >
          {current.name}{" "}
          <span className="text-white/50" style={{ fontSize: "2.5vh" }}>
            buys in
          </span>{" "}
          <span className="text-gold-400">{formatINR(current.amount)}</span>
        </div>

        <div
          className="ml-auto shrink-0 whitespace-nowrap text-white/55"
          style={{ fontSize: "2.3vh" }}
        >
          {ordinalLabel(current.ordinal)} ·{" "}
          <span className="text-white/80">
            {formatINR(current.runningTotal)} tonight
          </span>
        </div>
      </div>
    </div>
  );
}

function ordinalLabel(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
