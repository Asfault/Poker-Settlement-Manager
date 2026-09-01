"use client";

import type { RosterEntry } from "@/lib/db/shared-stats";
import { formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

/**
 * The season before it starts: everyone on the roster, everything at zero.
 *
 * Shown in place of the stats when a season has no completed games yet. An
 * empty page reads as broken; a table of zeroes reads as a season about to
 * happen — and it's honest, because that is genuinely everyone's record.
 *
 * Only active players appear, matching the leaderboard's default.
 */
export default function SeasonOpeningBoard({
  roster,
}: {
  roster: RosterEntry[];
}) {
  if (roster.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-white/50 text-sm">
          No games played yet. The season&apos;s stats appear here after the
          first night.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Tile label="Nights" value="0" />
        <Tile label="Money played" value={formatINR(0)} accent />
        <Tile label="Players" value={String(roster.length)} />
        <Tile label="Biggest pot" value={formatINR(0)} />
      </div>

      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-sm uppercase tracking-wide text-white/50">
          Leaderboard
        </h2>
        <span className="text-white/25 text-xs">Nothing played yet</span>
      </div>

      <div className="flex flex-col gap-2">
        {roster.map((p, i) => (
          <Card key={p.playerId} className="p-4 flex items-center gap-3">
            <span className="text-white/20 text-sm w-5 shrink-0 tabular-nums">
              {i + 1}
            </span>
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="font-semibold truncate block">{p.name}</span>
              <span className="text-white/30 text-xs block">
                0 sessions · 0% win rate
              </span>
            </span>
            <span className="font-bold tabular-nums shrink-0 text-white/40">
              {formatINR(0)}
            </span>
          </Card>
        ))}
      </div>

      <p className="text-white/30 text-xs mt-4 text-center">
        Everyone starts level. First night sorts that out.
      </p>
    </>
  );
}

function Tile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="text-white/45 text-xs">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums mt-0.5 ${
          accent ? "text-gold-400/60" : "text-white/50"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}
