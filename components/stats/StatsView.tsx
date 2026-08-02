"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  GroupStats,
  PlayerStats,
  SessionSummary,
  computeGroupStats,
  computePlayerStats,
} from "@/lib/db/stats";
import {
  GroupExtras,
  PlayerExtras,
  Records,
  computeGroupExtras,
  computePlayerExtras,
  computeRecords,
} from "@/lib/stats/extra";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";
import MonthlyChart from "@/components/host/stats/MonthlyChart";
import CumulativeChart from "@/components/host/stats/CumulativeChart";

/**
 * The whole stats page body, from group tiles down to the leaderboard.
 *
 * Shared verbatim between the host page and the public shared link, so the two
 * can never drift. The only difference is where a player's "Full stats" button
 * points — hence `playerHref`.
 *
 * Poker numbers only. House fees never appear here.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${formatINR(n)}`;
}

export default function StatsView({
  sessions,
  playerHref,
}: {
  sessions: SessionSummary[];
  playerHref: (playerId: string) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Archived players stay in every historical total — they're just hidden from
  // the leaderboard by default so it reflects who currently plays.
  const [showArchived, setShowArchived] = useState(false);

  const allPlayers: PlayerStats[] = useMemo(
    () => computePlayerStats(sessions),
    [sessions],
  );
  const group: GroupStats = useMemo(
    () => computeGroupStats(sessions),
    [sessions],
  );
  const extras: GroupExtras = useMemo(
    () => computeGroupExtras(sessions),
    [sessions],
  );
  const records: Records = useMemo(() => computeRecords(sessions), [sessions]);
  const playerExtras = useMemo(() => {
    const map = new Map<string, PlayerExtras>();
    for (const e of computePlayerExtras(sessions)) map.set(e.playerId, e);
    return map;
  }, [sessions]);

  const archivedCount = allPlayers.filter((p) => !p.isActive).length;
  const players = showArchived
    ? allPlayers
    : allPlayers.filter((p) => p.isActive);

  const chartSeries = useMemo(
    () =>
      players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        sessions: p.sessions,
        points: playerExtras.get(p.playerId)?.cumulative ?? [],
      })),
    [players, playerExtras],
  );

  const busiestDay = useMemo(() => {
    const max = Math.max(...group.byWeekday);
    if (max === 0) return null;
    return WEEKDAYS[group.byWeekday.indexOf(max)];
  }, [group.byWeekday]);

  if (sessions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-white/50 text-sm">
          No completed sessions yet. Stats appear once a game has finished.
        </p>
      </Card>
    );
  }

  return (
    <>
      {/* Group summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <Stat label="Sessions" value={String(group.sessions)} />
        <Stat label="Money played" value={formatINR(group.totalMoney)} accent />
        <Stat label="Biggest pot" value={formatINR(group.biggestPot)} />
        <Stat label="Avg pot" value={formatINR(group.avgPot)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Stat label="Avg players" value={extras.avgPlayersPerNight.toFixed(1)} />
        <Stat label="Buy-ins all time" value={String(extras.totalBuyInCount)} />
        <Stat
          label="Rebuy rate"
          value={`${Math.round(extras.rebuyRate * 100)}%`}
        />
        <Stat label="Avg per player" value={formatINR(extras.avgPotPerPlayer)} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <Stat
          label="Hours played"
          value={`${Math.round(extras.totalHoursPlayed)}h`}
        />
        <Stat label="Avg night" value={`${extras.avgHoursPlayed.toFixed(1)}h`} />
        {extras.assumedDurationSessions > 0 && (
          <p className="col-span-2 text-white/30 text-xs -mt-0.5">
            Includes {extras.assumedDurationSessions} historical night
            {extras.assumedDurationSessions === 1 ? "" : "s"} counted at an
            assumed 4 hours, since those games predate the app.
          </p>
        )}
      </div>

      <Card className="p-4 mb-5 text-sm text-white/60 flex flex-wrap gap-x-6 gap-y-1">
        {busiestDay && (
          <span>
            Most common night:{" "}
            <span className="text-white font-medium">{busiestDay}</span>
          </span>
        )}
        {group.avgDurationMs !== null && (
          <span>
            Average length:{" "}
            <span className="text-white font-medium">
              {formatDuration(0, group.avgDurationMs)}
            </span>
          </span>
        )}
        {group.firstSession && (
          <span>
            Since{" "}
            <span className="text-white font-medium">
              {formatDateTime(group.firstSession).split(",")[0]}
            </span>
          </span>
        )}
      </Card>

      {/* Hall of fame */}
      <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
        Records
      </h2>
      <Card className="p-4 mb-5 flex flex-col gap-3">
        {records.biggestWin && records.biggestWin.amount > 0 && (
          <RecordRow
            label="Biggest night"
            who={records.biggestWin.name}
            value={signed(records.biggestWin.amount)}
            at={records.biggestWin.at}
            tone="win"
          />
        )}
        {records.biggestLoss && records.biggestLoss.amount < 0 && (
          <RecordRow
            label="Worst night"
            who={records.biggestLoss.name}
            value={formatINR(records.biggestLoss.amount)}
            at={records.biggestLoss.at}
            tone="loss"
          />
        )}
        {records.biggestSwing && (
          <RecordRow
            label="Widest table"
            who={`${records.biggestSwing.winner} over ${records.biggestSwing.loser}`}
            value={formatINR(records.biggestSwing.amount)}
            at={records.biggestSwing.at}
          />
        )}
        {records.mostBuyIns && records.mostBuyIns.amount > 1 && (
          <RecordRow
            label="Most buy-ins"
            who={records.mostBuyIns.name}
            value={`${records.mostBuyIns.amount} in a night`}
            at={records.mostBuyIns.at}
            tone="loss"
          />
        )}
        {records.longestSession && (
          <RecordRow
            label="Longest session"
            who="The whole table"
            value={formatDuration(0, records.longestSession.ms)}
            at={records.longestSession.at}
          />
        )}
      </Card>

      {/* Charts */}
      {chartSeries.some((s) => s.points.length > 1) && (
        <>
          <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
            Profit over time
          </h2>
          <Card className="p-4 mb-5">
            <CumulativeChart series={chartSeries} />
            <p className="text-white/30 text-xs mt-3">
              Running total per player, by session. Tap a name to hide it.
            </p>
          </Card>
        </>
      )}

      {extras.byMonth.length > 1 && (
        <>
          <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
            When we play
          </h2>
          <Card className="p-4 mb-5">
            <MonthlyChart data={extras.byMonth} />
          </Card>
        </>
      )}

      {/* Leaderboard */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-sm uppercase tracking-wide text-white/50">
          Leaderboard
        </h2>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            aria-pressed={showArchived}
            className="text-xs text-white/50 hover:text-white border border-white/10 rounded-lg px-3 min-h-[36px] transition-colors"
          >
            {showArchived ? "Active only" : `Show all (+${archivedCount})`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {players.map((p, i) => {
          const open = expanded === p.playerId;
          const x = playerExtras.get(p.playerId);
          return (
            <Card key={p.playerId} className="overflow-hidden">
              <button
                onClick={() => setExpanded(open ? null : p.playerId)}
                aria-expanded={open}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-white/30 text-sm w-5 shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={40} />
                <span className="min-w-0 flex-1 block">
                  <span className="font-semibold truncate block">
                    {p.name}
                    {!p.isActive && (
                      <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-wide text-white/40 border border-white/15 rounded px-1.5 py-0.5">
                        Archived
                      </span>
                    )}
                  </span>
                  <span className="text-white/40 text-xs block">
                    {p.sessions} session{p.sessions === 1 ? "" : "s"} ·{" "}
                    {Math.round(p.winRate * 100)}% win rate
                  </span>
                </span>
                <span
                  className={`font-bold tabular-nums shrink-0 ${
                    p.totalProfitLoss > 0
                      ? "text-win"
                      : p.totalProfitLoss < 0
                        ? "text-loss"
                        : "text-white/60"
                  }`}
                >
                  {p.totalProfitLoss > 0 ? "+" : ""}
                  {formatINR(p.totalProfitLoss)}
                </span>
              </button>

              {open && (
                <div className="px-4 pb-4 pt-1 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3">
                    <Row
                      label="Record"
                      value={`${p.wins}W · ${p.losses}L${p.evens ? ` · ${p.evens}E` : ""}`}
                    />
                    <Row
                      label="Avg per night"
                      value={signed(Math.round(p.avgProfitLoss))}
                      tone={
                        p.avgProfitLoss > 0
                          ? "win"
                          : p.avgProfitLoss < 0
                            ? "loss"
                            : undefined
                      }
                    />
                    <Row
                      label="Best night"
                      value={`+${formatINR(p.biggestWin)}`}
                      tone="win"
                    />
                    <Row
                      label="Worst night"
                      value={formatINR(p.biggestLoss)}
                      tone="loss"
                    />
                    <Row
                      label="Total bought in"
                      value={formatINR(p.totalBuyIn)}
                    />
                    <Row
                      label="Buy-ins taken"
                      value={String(p.totalBuyInCount)}
                    />
                    {x && (
                      <>
                        <Row
                          label="ROI"
                          value={`${x.roi > 0 ? "+" : ""}${(x.roi * 100).toFixed(1)}%`}
                          tone={
                            x.roi > 0 ? "win" : x.roi < 0 ? "loss" : undefined
                          }
                        />
                        <Row
                          label="Current streak"
                          value={
                            x.currentStreak
                              ? `${x.currentStreak.length}${x.currentStreak.type}`
                              : "—"
                          }
                          tone={
                            x.currentStreak?.type === "W"
                              ? "win"
                              : x.currentStreak?.type === "L"
                                ? "loss"
                                : undefined
                          }
                        />
                        <Row
                          label="Best run"
                          value={`${x.longestWinStreak}W · ${x.longestLossStreak}L`}
                        />
                        <Row
                          label="Avg finish"
                          value={
                            x.avgFinishPosition > 0
                              ? x.avgFinishPosition.toFixed(1)
                              : "—"
                          }
                        />
                        <Row
                          label="Nights on top"
                          value={`${x.timesFirst} of ${p.sessions}`}
                        />
                        <Row
                          label="Attendance"
                          value={`${Math.round(x.attendanceRate * 100)}%`}
                        />
                        {x.profitPerHour !== null && (
                          <Row
                            label="Per hour"
                            value={signed(Math.round(x.profitPerHour))}
                            tone={
                              x.profitPerHour > 0
                                ? "win"
                                : x.profitPerHour < 0
                                  ? "loss"
                                  : undefined
                            }
                          />
                        )}
                        <Row
                          label="Swing"
                          value={`±${formatINR(Math.round(x.volatility))}`}
                        />
                      </>
                    )}
                  </div>

                  {p.recentForm.length > 0 && (
                    <div className="mt-4">
                      <div className="text-white/40 text-xs mb-1.5">
                        Recent form (newest first)
                      </div>
                      <div className="flex gap-1">
                        {p.recentForm.map((r, idx) => (
                          <span
                            key={idx}
                            title={r > 0 ? "Won" : r < 0 ? "Lost" : "Even"}
                            className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                              r > 0
                                ? "bg-win/20 text-win"
                                : r < 0
                                  ? "bg-loss/20 text-loss"
                                  : "bg-white/10 text-white/50"
                            }`}
                          >
                            {r > 0 ? "W" : r < 0 ? "L" : "E"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.lastPlayed && (
                    <div className="text-white/30 text-xs mt-3">
                      Last played {formatDateTime(p.lastPlayed)}
                    </div>
                  )}

                  <Link
                    href={playerHref(p.playerId)}
                    className="mt-4 flex items-center justify-center min-h-[44px] rounded-xl border border-white/10 text-sm text-white/70 hover:text-white hover:border-white/25 transition-colors"
                  >
                    Full stats →
                  </Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Stat({
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
          accent ? "text-gold-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

function Row({
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

function RecordRow({
  label,
  who,
  value,
  at,
  tone,
}: {
  label: string;
  who: string;
  value: string;
  at: number;
  tone?: "win" | "loss";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-white/45 text-xs">{label}</div>
        <div className="text-sm truncate">{who}</div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`font-bold tabular-nums ${
            tone === "win"
              ? "text-win"
              : tone === "loss"
                ? "text-loss"
                : "text-white/85"
          }`}
        >
          {value}
        </div>
        <div className="text-white/30 text-xs">
          {formatDateTime(at).split(",")[0]}
        </div>
      </div>
    </div>
  );
}
