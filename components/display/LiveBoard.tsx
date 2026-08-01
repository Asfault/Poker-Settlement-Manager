"use client";

import type { Derived } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";
import PokerTable from "./PokerTable";

/** The home state — the table during a session, the leaderboard between them. */
export default function LiveBoard({
  derived,
  now,
}: {
  derived: Derived;
  now: number;
}) {
  const live = derived.live;

  if (!live || live.rows.length === 0) {
    return <IdleBoard derived={derived} />;
  }

  return (
    <PokerTable
      rows={live.rows}
      pot={live.pot}
      startedAt={live.startedAt}
      now={now}
    />
  );
}

/** Shown between sessions — leaderboard rather than an empty screen. */
function IdleBoard({ derived }: { derived: Derived }) {
  const top = derived.lifetime.slice(0, 8);

  if (top.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="text-[clamp(60px,9vw,160px)] mb-6">🃏</div>
        <div className="font-black text-[clamp(32px,5vw,90px)] text-[#e9c46a]">
          POKERESH
        </div>
        <div className="text-white/40 mt-4 text-[clamp(18px,2vw,32px)]">
          Waiting for the next game
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-[3vh] shrink-0">
        <div className="uppercase tracking-[0.3em] text-white/40 font-semibold text-[clamp(14px,1.4vw,22px)]">
          All-time standings
        </div>
        <div className="text-white/30 text-[clamp(16px,1.6vw,26px)] mt-1">
          {derived.group.sessions} sessions ·{" "}
          {formatINR(derived.group.totalMoney)} across this table
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-[1.4vh]">
        {top.map((p, i) => (
          <div key={p.playerId} className="flex items-center gap-[1.6vw]">
            <span className="text-white/25 tabular-nums w-[3%] shrink-0 text-[clamp(18px,2vw,34px)]">
              {i + 1}
            </span>
            <DisplayAvatar
              name={p.displayName}
              photoUrl={p.photoUrl}
              size={72}
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate text-[clamp(20px,2.4vw,42px)]">
                {p.displayName}
              </div>
              <div className="text-white/35 text-[clamp(13px,1.3vw,20px)]">
                {p.sessions} sessions · {Math.round(p.winRate * 100)}% win rate
              </div>
            </div>
            <span
              className="font-black tabular-nums shrink-0 text-[clamp(22px,2.6vw,46px)]"
              style={{
                color:
                  p.totalProfitLoss > 0
                    ? "#22c55e"
                    : p.totalProfitLoss < 0
                      ? "#ef4444"
                      : "rgba(255,255,255,0.6)",
              }}
            >
              {p.totalProfitLoss > 0 ? "+" : ""}
              {formatINR(p.totalProfitLoss)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
