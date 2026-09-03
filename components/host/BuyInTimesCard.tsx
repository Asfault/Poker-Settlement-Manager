"use client";

import type { DbSessionPlayer } from "@/lib/db/sessions";
import { sumBuyIns } from "@/lib/db/sessions";
import { formatClock, formatINR } from "@/lib/format";
import Card from "@/components/Card";

/**
 * Read-only buy-in times for the whole table, for the tally and results
 * screens.
 *
 * A card rather than an expander per player: both those screens are tables,
 * and hanging a collapsible row off each one would mean restructuring them.
 * It also reads better for "who bought in when" — you can compare people
 * without opening seven things.
 *
 * No remove buttons here. By these screens the buy-ins are settled; editing
 * belongs on the live session screen.
 */
export default function BuyInTimesCard({
  players,
}: {
  players: DbSessionPlayer[];
}) {
  const withBuyIns = players.filter((p) => p.buy_ins.length > 0);
  if (withBuyIns.length === 0) return null;

  return (
    <>
      <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
        Buy-in times
      </h2>
      <Card className="p-4 mb-5 flex flex-col gap-3">
        {withBuyIns.map((p) => (
          <div key={p.id}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-sm font-medium truncate">
                {p.display_name}
              </span>
              <span className="text-white/40 text-xs tabular-nums shrink-0">
                {p.buy_ins.length} ·{" "}
                <span className="text-gold-400/80">
                  {formatINR(sumBuyIns(p))}
                </span>
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-1.5">
              {p.buy_ins.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-1.5 text-xs bg-felt-900 border border-white/10 rounded-lg px-2.5 py-1 min-w-0"
                >
                  <span className="text-white/80 tabular-nums whitespace-nowrap">
                    {formatINR(b.amount)}
                  </span>
                  <span className="text-white/40 tabular-nums whitespace-nowrap text-[11px] ml-auto">
                    {formatClock(new Date(b.created_at).getTime())}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </>
  );
}
