"use client";

import type { HallOfFameEntry } from "@/lib/stats/season";
import { SEASON_ACCENT } from "@/lib/stats/season";
import { formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

/**
 * Past seasons and their champions.
 *
 * Sits high on the shared page rather than at the bottom: in the first week
 * of a season there's almost nothing else to show, and an empty page reads
 * as broken. This is what fills it.
 *
 * A season with no champion still appears — a thin season recorded honestly
 * is more interesting than a gap.
 */
export default function HallOfFame({
  entries,
}: {
  entries: HallOfFameEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <>
      <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
        Hall of fame
      </h2>
      <div className="flex flex-col gap-2 mb-5">
        {entries.map((e) => {
          const accent = SEASON_ACCENT[e.season.name];
          return (
            <Card key={e.season.id} className="p-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: accent }}
                />

                {e.winner ? (
                  <>
                    <PlayerAvatar
                      name={e.winner.name}
                      photoUrl={e.winner.photoUrl}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {e.winner.name}
                        {e.tied.map((t) => `, ${t.name}`).join("")}
                      </div>
                      <div className="text-white/40 text-xs truncate">
                        {e.label} · {e.gameCount} night
                        {e.gameCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className="text-win font-bold tabular-nums shrink-0">
                      +{formatINR(e.winner.profit)}
                    </span>
                  </>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-white/70">
                      {e.label}
                    </div>
                    <div className="text-white/40 text-xs">
                      {e.noEligiblePlayers
                        ? "No champion — not enough attendance"
                        : "No champion"}
                      {" · "}
                      {e.gameCount} night{e.gameCount === 1 ? "" : "s"}
                    </div>
                  </div>
                )}
              </div>

              {e.note && (
                <p className="text-white/45 text-xs mt-2.5 pl-4">{e.note}</p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
