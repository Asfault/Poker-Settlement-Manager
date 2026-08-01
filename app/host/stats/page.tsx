"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GroupStats,
  PlayerStats,
  SessionSummary,
  computeGroupStats,
  computePlayerStats,
  loadCompletedSessions,
} from "@/lib/db/stats";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StatsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedSessions()
      .then(setSessions)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load stats"),
      )
      .finally(() => setLoading(false));
  }, []);

  const players: PlayerStats[] = useMemo(
    () => computePlayerStats(sessions),
    [sessions],
  );
  const group: GroupStats = useMemo(
    () => computeGroupStats(sessions),
    [sessions],
  );

  const busiestDay = useMemo(() => {
    const max = Math.max(...group.byWeekday);
    if (max === 0) return null;
    return WEEKDAYS[group.byWeekday.indexOf(max)];
  }, [group.byWeekday]);

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Stats</h1>
          <p className="text-white/50 text-sm">
            Poker only — house fees excluded
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm">
              No completed sessions yet. Stats appear once you&apos;ve finished
              a game or entered some history.
            </p>
          </Card>
        ) : (
          <>
            {/* Group summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <Stat label="Sessions" value={String(group.sessions)} />
              <Stat
                label="Money played"
                value={formatINR(group.totalMoney)}
                accent
              />
              <Stat label="Biggest pot" value={formatINR(group.biggestPot)} />
              <Stat label="Avg pot" value={formatINR(group.avgPot)} />
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

            {/* Leaderboard */}
            <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
              Leaderboard
            </h2>
            <div className="flex flex-col gap-2">
              {players.map((p, i) => {
                const open = expanded === p.playerId;
                return (
                  <Card key={p.playerId} className="overflow-hidden">
                    <button
                      onClick={() => setExpanded(open ? null : p.playerId)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-white/30 text-sm w-5 shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <PlayerAvatar
                        name={p.name}
                        photoUrl={p.photoUrl}
                        size={40}
                      />
                      <span className="min-w-0 flex-1 block">
                        <span className="font-semibold truncate block">
                          {p.name}
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
                            value={`${p.avgProfitLoss > 0 ? "+" : ""}${formatINR(Math.round(p.avgProfitLoss))}`}
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
                                  title={
                                    r > 0 ? "Won" : r < 0 ? "Lost" : "Even"
                                  }
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
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
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
