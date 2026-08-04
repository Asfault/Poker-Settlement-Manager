"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  PlayerStats,
  SessionSummary,
  computePlayerStats,
} from "@/lib/db/stats";
import { PlayerExtras, computePlayerExtras } from "@/lib/stats/extra";
import { formatDateTime, formatINR } from "@/lib/format";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

/**
 * Full stats for one player. Shared between the host route and the public
 * shared link — `backHref` and `sessionHref` are the only differences, since
 * viewers of the shared page have no session screens to drill into.
 */
export default function PlayerDetailView({
  sessions,
  playerId,
  backHref,
  backLabel = "Stats",
  sessionHref,
}: {
  sessions: SessionSummary[];
  playerId: string;
  backHref: string;
  backLabel?: string;
  sessionHref?: (sessionId: string) => string;
}) {
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
            tableSize: s.players.length,
            position:
              ranked.findIndex((r) => r.profitLoss === me.profitLoss) + 1,
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null)
        .sort((a, b) => b.at - a.at),
    [sessions, playerId],
  );

  if (!player || !extras) {
    return (
      <Card className="p-8 text-center">
        <p className="text-white/50 text-sm mb-4">
          No completed sessions for this player yet.
        </p>
        <Link href={backHref} className="text-gold-400 text-sm">
          Back to {backLabel.toLowerCase()}
        </Link>
      </Card>
    );
  }

  return (
    <>
      <Link
        href={backHref}
        className="text-white/40 hover:text-white text-sm inline-flex items-center min-h-[44px]"
      >
        ← {backLabel}
      </Link>

      <header className="flex items-center gap-4 mb-5 mt-1">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={64} />
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
            extras.nightsSinceLastWin !== null && extras.nightsSinceLastWin >= 3
              ? "loss"
              : undefined
          }
        />
      </div>

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
              Small samples swing hard — treat anything under about five nights
              at a given size as a curiosity, not a pattern.
            </p>
          </Card>
        </>
      )}

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
            label="Buy-ins per night"
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
          {extras.rockNights.outOf > 0 && (
            <DetailRow
              label="Rock nights"
              value={`${extras.rockNights.nights} of ${extras.rockNights.outOf}`}
            />
          )}
          {extras.firstToReload.outOf > 0 && (
            <DetailRow
              label="First to reload"
              value={`${extras.firstToReload.nights} of ${extras.firstToReload.outOf}`}
              tone={
                extras.firstToReload.nights > extras.firstToReload.outOf / 2
                  ? "loss"
                  : undefined
              }
            />
          )}
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
            tone={extras.roi > 0 ? "win" : extras.roi < 0 ? "loss" : undefined}
          />
          <DetailRow
            label="Swing"
            value={`±${formatINR(Math.round(extras.volatility))}`}
          />
        </div>
        {extras.rebuyTiming && (
          <p className="text-white/30 text-xs mt-3">
            Rebuy timing, rock nights and reload order come from sessions the
            app timed. Games entered as history aren&apos;t counted — they
            store one lump buy-in and would make everyone look like a rock.
          </p>
        )}
      </Card>

      {/* Put in vs took out. The pot is zero-sum, so these two shares are
          directly comparable — leaving with more than you brought is the
          whole game, expressed without reference to table size. */}
      {extras.potShareOut > 0 && (
        <>
          <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
            Share of the pot
          </h2>
          <Card className="p-4 mb-5">
            <div className="flex items-end gap-6">
              <div>
                <div className="text-white/45 text-xs">Puts in</div>
                <div className="text-xl font-bold tabular-nums mt-0.5">
                  {(extras.potShareIn * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-white/25 pb-1.5">→</div>
              <div>
                <div className="text-white/45 text-xs">Leaves with</div>
                <div
                  className={`text-xl font-bold tabular-nums mt-0.5 ${
                    extras.potShareOut > extras.potShareIn
                      ? "text-win"
                      : extras.potShareOut < extras.potShareIn
                        ? "text-loss"
                        : "text-white"
                  }`}
                >
                  {(extras.potShareOut * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <p className="text-white/30 text-xs mt-3">
              Average share of each night&apos;s money. Leaving with a bigger
              share than you brought means you&apos;re up, whatever the table
              size.
            </p>
          </Card>
        </>
      )}

      <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
        Every night
      </h2>
      <div className="flex flex-col gap-2">
        {nights.map((n) => {
          const body = (
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
          );
          return sessionHref ? (
            <Link key={n.sessionId} href={sessionHref(n.sessionId)}>
              {body}
            </Link>
          ) : (
            <div key={n.sessionId}>{body}</div>
          );
        })}
      </div>
    </>
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
