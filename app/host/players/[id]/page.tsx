"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PlayerStats,
  SessionSummary,
  computePlayerStats,
  loadCompletedSessions,
} from "@/lib/db/stats";
import {
  PlayerExtras,
  computePlayerExtras,
} from "@/lib/stats/extra";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

/**
 * Full stats for one player. Reached from the "Full stats" button inside the
 * leaderboard expander — the inline panel stays for a quick look, this is for
 * when you want the whole picture.
 */
export default function PlayerStatsPage() {
  const params = useParams<{ id: string }>();
  const playerId = params?.id;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedSessions()
      .then(setSessions)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load stats"),
      )
      .finally(() => setLoading(false));
  }, []);

  const player: PlayerStats | undefined = useMemo(
    () => computePlayerStats(sessions).find((p) => p.playerId === playerId),
    [sessions, playerId],
  );
  const extras: PlayerExtras | undefined = useMemo(
    () => computePlayerExtras(sessions).find((e) => e.playerId === playerId),
    [sessions, playerId],
  );

  /** Every night this player was at the table, newest first. */
  const nights = useMemo(
    () =>
      sessions
        .map((s) => {
          const me = s.players.find((p) => p.playerId === playerId);
          if (!me) return null;
          const ranked = [...s.players].sort(
            (a, b) => b.profitLoss - a.profitLoss,
          );
          return {
            sessionId: s.id,
            at: s.startedAt,
            profitLoss: me.profitLoss,
            buyInCount: me.buyInCount,
            tableSize: s.players.length,
            position:
              ranked.findIndex((r) => r.profitLoss === me.profitLoss) + 1,
            isBackfill: s.isBackfill,
            durationMs: s.durationMs,
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null)
        .sort((a, b) => b.at - a.at),
    [sessions, playerId],
  );

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  if (error || !player || !extras) {
    return (
      <div className="px-4 py-6 pb-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm mb-4">
              {error ?? "No completed sessions for this player yet."}
            </p>
            <Link href="/host/stats" className="text-gold-400 text-sm">
              Back to stats
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/host/stats"
          className="text-white/40 hover:text-white text-sm inline-flex items-center min-h-[44px]"
        >
          ← Stats
        </Link>

        <header className="flex items-center gap-4 mb-5 mt-1">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            size={64}
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{player.name}</h1>
            <p className="text-white/50 text-sm">
              {player.sessions} session{player.sessions === 1 ? "" : "s"}
              {!player.isActive && " · archived"}
            </p>
          </div>
          <div
            className={`ml-auto text-right shrink-0 ${
              player.totalProfitLoss > 0
                ? "text-win"
                : player.totalProfitLoss < 0
                  ? "text-loss"
                  : "text-white/60"
            }`}
          >
            <div className="text-2xl font-bold tabular-nums">
              {player.totalProfitLoss > 0 ? "+" : ""}
              {formatINR(player.totalProfitLoss)}
            </div>
            <div className="text-white/40 text-xs">all time</div>
          </div>
        </header>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <Tile
            label="Typical night"
            value={`${extras.medianNight > 0 ? "+" : ""}${formatINR(extras.medianNight)}`}
            hint="median"
            tone={
              extras.medianNight > 0
                ? "win"
                : extras.medianNight < 0
                  ? "loss"
                  : undefined
            }
          />
          <Tile
            label="Average night"
            value={`${player.avgProfitLoss > 0 ? "+" : ""}${formatINR(Math.round(player.avgProfitLoss))}`}
            hint="mean"
            tone={
              player.avgProfitLoss > 0
                ? "win"
                : player.avgProfitLoss < 0
                  ? "loss"
                  : undefined
            }
          />
          <Tile
            label="Win rate"
            value={`${Math.round(player.winRate * 100)}%`}
            hint={`${player.wins}W · ${player.losses}L`}
          />
          <Tile
            label="Since a win"
            value={
              extras.nightsSinceLastWin === null
                ? "—"
                : extras.nightsSinceLastWin === 0
                  ? "Won last"
                  : `${extras.nightsSinceLastWin}`
            }
            hint={
              extras.nightsSinceLastWin === null
                ? "never won"
                : extras.nightsSinceLastWin === 0
                  ? "most recent night"
                  : "nights"
            }
            tone={
              extras.nightsSinceLastWin !== null &&
              extras.nightsSinceLastWin >= 3
                ? "loss"
                : undefined
            }
          />
        </div>

        {/* Table size */}
        {extras.byTableSize.length > 1 && (
          <>
            <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
              By table size
            </h2>
            <Card className="p-4 mb-5">
              <div className="flex flex-col gap-2.5">
                {extras.byTableSize.map((t) => (
                  <div
                    key={t.size}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-white/60 shrink-0 w-24">
                      {t.size} players
                    </span>
                    <span className="text-white/30 text-xs flex-1">
                      {t.sessions} night{t.sessions === 1 ? "" : "s"}
                    </span>
                    <span
                      className={`tabular-nums font-medium shrink-0 ${
                        t.avgProfitLoss > 0
                          ? "text-win"
                          : t.avgProfitLoss < 0
                            ? "text-loss"
                            : "text-white/60"
                      }`}
                    >
                      {t.avgProfitLoss > 0 ? "+" : ""}
                      {formatINR(Math.round(t.avgProfitLoss))}
                      <span className="text-white/30 font-normal"> avg</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-3">
                Small samples swing hard — treat anything under about five
                nights at a given size as a curiosity, not a pattern.
              </p>
            </Card>
          </>
        )}

        {/* Habits */}
        <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
          Habits
        </h2>
        <Card className="p-4 mb-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <DetailRow
              label="Buy-ins taken"
              value={String(player.totalBuyInCount)}
            />
            <DetailRow
              label="Per night"
              value={(player.totalBuyInCount / player.sessions).toFixed(1)}
            />
            <DetailRow
              label="Typical rebuy"
              value={
                extras.rebuyTiming
                  ? `${Math.round(extras.rebuyTiming.avgMinute)} min in`
                  : "never rebought"
              }
            />
            <DetailRow
              label="Attendance"
              value={`${Math.round(extras.attendanceRate * 100)}%`}
            />
            <DetailRow
              label="Avg finish"
              value={
                extras.avgFinishPosition > 0
                  ? extras.avgFinishPosition.toFixed(1)
                  : "—"
              }
            />
            <DetailRow
              label="Nights on top"
              value={`${extras.timesFirst} of ${player.sessions}`}
            />
            <DetailRow
              label="ROI"
              value={`${extras.roi > 0 ? "+" : ""}${(extras.roi * 100).toFixed(1)}%`}
              tone={
                extras.roi > 0 ? "win" : extras.roi < 0 ? "loss" : undefined
              }
            />
            <DetailRow
              label="Swing"
              value={`±${formatINR(Math.round(extras.volatility))}`}
            />
          </div>
          {extras.rebuyTiming && (
            <p className="text-white/30 text-xs mt-3">
              Rebuy timing from {extras.rebuyTiming.samples} rebuy
              {extras.rebuyTiming.samples === 1 ? "" : "s"} in sessions the app
              timed. Games entered as history aren&apos;t counted.
            </p>
          )}
        </Card>

        {/* Every night */}
        <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
          Every night
        </h2>
        <div className="flex flex-col gap-2">
          {nights.map((n) => (
            <Link key={n.sessionId} href={`/host/session/${n.sessionId}`}>
              <Card className="p-4 min-h-[56px] flex items-center gap-3 hover:border-white/20 transition-colors">
                <span className="text-sm text-white/70 min-w-0 flex-1 truncate">
                  {formatDateTime(n.at).split(",")[0]}
                  <span className="text-white/30">
                    {" "}
                    · {n.tableSize}-handed · {n.position}
                    {ordinal(n.position)}
                  </span>
                </span>
                <span
                  className={`tabular-nums font-semibold shrink-0 ${
                    n.profitLoss > 0
                      ? "text-win"
                      : n.profitLoss < 0
                        ? "text-loss"
                        : "text-white/60"
                  }`}
                >
                  {n.profitLoss > 0 ? "+" : ""}
                  {formatINR(n.profitLoss)}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "win" | "loss";
}) {
  return (
    <Card className="p-3">
      <div className="text-white/45 text-xs">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums mt-0.5 ${
          tone === "win"
            ? "text-win"
            : tone === "loss"
              ? "text-loss"
              : "text-white"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-white/30 text-xs mt-0.5">{hint}</div>}
    </Card>
  );
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/45">{label}</span>
      <span
        className={`font-medium tabular-nums ${
          tone === "win"
            ? "text-win"
            : tone === "loss"
              ? "text-loss"
              : "text-white/85"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
