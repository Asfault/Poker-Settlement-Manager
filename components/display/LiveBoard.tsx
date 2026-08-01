"use client";

import type { Derived } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";

function elapsed(startedAt: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - startedAt) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** The home state — who's in, what they've put in, how big the pot is. */
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

  const rows = [...live.rows].sort((a, b) => b.totalBuyIn - a.totalBuyIn);
  const max = Math.max(1, ...rows.map((r) => r.totalBuyIn));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-end justify-between mb-[2vh] shrink-0">
        <div>
          <div className="uppercase tracking-[0.3em] text-white/40 font-semibold text-[clamp(14px,1.4vw,22px)]">
            Total pot
          </div>
          <div
            className="font-black tabular-nums leading-none text-[#e9c46a]"
            style={{
              fontSize: "clamp(48px, 7vw, 130px)",
              textShadow: "0 4px 24px rgba(0,0,0,0.5)",
            }}
          >
            {formatINR(live.pot)}
          </div>
        </div>
        <div className="text-right text-white/40 text-[clamp(14px,1.5vw,24px)]">
          <div>
            {live.playerCount} player{live.playerCount === 1 ? "" : "s"}
          </div>
          <div>{elapsed(live.startedAt, now)}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center gap-[1.2vh]">
        {rows.map((r) => (
          <div key={r.playerId} className="flex items-center gap-[1.6vw]">
            <DisplayAvatar
              name={r.displayName}
              photoUrl={r.photoUrl}
              size={72}
              ring={r.recentBuyIns >= 2 ? "#ef4444" : undefined}
            />
            <div className="w-[20%] shrink-0 min-w-0">
              <div className="font-bold truncate text-[clamp(20px,2.4vw,42px)]">
                {r.displayName}
              </div>
              <div className="text-white/35 text-[clamp(13px,1.3vw,20px)]">
                {r.buyInCount} buy-in{r.buyInCount === 1 ? "" : "s"}
                {r.recentBuyIns >= 2 && (
                  <span className="text-[#ef4444] font-bold"> · ON TILT</span>
                )}
              </div>
            </div>
            <div className="flex-1 h-[clamp(24px,3vw,48px)] bg-white/5 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-[width] duration-700"
                style={{
                  width: `${(r.totalBuyIn / max) * 100}%`,
                  background:
                    "linear-gradient(90deg, #e9c46a, rgba(233,196,106,0.45))",
                }}
              />
            </div>
            <div
              className="w-[16%] shrink-0 text-right font-black tabular-nums text-[#e9c46a] text-[clamp(20px,2.4vw,42px)]"
            >
              {formatINR(r.totalBuyIn)}
            </div>
          </div>
        ))}
      </div>
    </div>
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
