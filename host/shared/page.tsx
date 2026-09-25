"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SharedSessionRow,
  deleteSharedSession,
  listSharedSessions,
} from "@/lib/db/shared";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Card from "@/components/Card";
import ConfirmDialog from "@/components/ConfirmDialog";

/** Rough device guess from the user agent, just for context. */
function deviceOf(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Other";
}

export default function SharedSessionsPage() {
  const [rows, setRows] = useState<SharedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SharedSessionRow | null>(
    null,
  );

  useEffect(() => {
    listSharedSessions()
      .then(setRows)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load"),
      )
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const money = rows.reduce((s, r) => s + r.total_pot, 0);
    const players = rows.reduce((s, r) => s + r.player_count, 0);
    return {
      sessions: rows.length,
      money,
      avgPlayers: rows.length ? (players / rows.length).toFixed(1) : "0",
      avgPot: rows.length ? Math.round(money / rows.length) : 0,
    };
  }, [rows]);

  async function confirmDelete() {
    const row = pendingDelete;
    if (!row) return;
    setPendingDelete(null);
    try {
      await deleteSharedSession(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="px-4 py-6 pb-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Out in the wild</h1>
          <p className="text-white/50 text-sm">
            Sessions completed by people using the public app
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-white/40 text-sm py-10 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm">
              Nothing yet. Sessions appear here when someone finishes a game
              on the public app.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <Stat label="Sessions" value={String(totals.sessions)} />
              <Stat
                label="Money tracked"
                value={formatINR(totals.money)}
                accent
              />
              <Stat label="Avg players" value={totals.avgPlayers} />
              <Stat label="Avg pot" value={formatINR(totals.avgPot)} />
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((r) => {
                const isOpen = open === r.id;
                const players = [...(r.payload?.players ?? [])].sort(
                  (a, b) => b.profitLoss - a.profitLoss,
                );
                const duration =
                  r.started_at && r.ended_at
                    ? new Date(r.ended_at).getTime() -
                      new Date(r.started_at).getTime()
                    : null;
                return (
                  <Card key={r.id} className="overflow-hidden">
                    <button
                      onClick={() => setOpen(isOpen ? null : r.id)}
                      className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 block">
                          <span className="block font-medium text-sm">
                            {formatDateTime(new Date(r.received_at).getTime())}
                          </span>
                          <span className="block text-white/40 text-xs mt-0.5">
                            {r.player_count} players ·{" "}
                            {deviceOf(r.user_agent)}
                            {duration !== null &&
                              duration > 0 &&
                              ` · ${formatDuration(0, duration)}`}
                          </span>
                        </span>
                        <span className="text-right shrink-0 block">
                          <span className="block text-gold-400 font-bold tabular-nums">
                            {formatINR(r.total_pot)}
                          </span>
                          <span className="block text-white/35 text-xs">
                            pot
                          </span>
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-white/5">
                        <table className="w-full mt-3">
                          <thead>
                            <tr className="text-xs uppercase tracking-wide text-white/40">
                              <th className="text-left py-1.5">Player</th>
                              <th className="text-right py-1.5">Buy-in</th>
                              <th className="text-right py-1.5">Chips</th>
                              <th className="text-right py-1.5">P/L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {players.map((p, i) => (
                              <tr
                                key={i}
                                className="border-t border-white/5 text-sm"
                              >
                                <td className="py-2 truncate max-w-[40%]">
                                  {p.name}
                                </td>
                                <td className="py-2 text-right tabular-nums text-gold-400">
                                  {formatINR(p.totalBuyIn)}
                                </td>
                                <td className="py-2 text-right tabular-nums text-white/70">
                                  {formatINR(p.chipsLeft)}
                                </td>
                                <td
                                  className={`py-2 text-right tabular-nums font-bold ${
                                    p.profitLoss > 0
                                      ? "text-win"
                                      : p.profitLoss < 0
                                        ? "text-loss"
                                        : "text-white/60"
                                  }`}
                                >
                                  {p.profitLoss > 0 ? "+" : ""}
                                  {formatINR(p.profitLoss)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {(r.payload?.settlements ?? []).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <div className="text-xs uppercase tracking-wide text-white/40 mb-1.5">
                              Settlements
                            </div>
                            {r.payload.settlements.map((s, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-sm py-1"
                              >
                                <span className="text-loss truncate">
                                  {s.from}
                                </span>
                                <span className="text-white/30 text-xs">→</span>
                                <span className="text-win truncate">
                                  {s.to}
                                </span>
                                <span className="ml-auto text-gold-400 font-semibold tabular-nums shrink-0">
                                  {formatINR(s.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end mt-3">
                          <button
                            onClick={() => setPendingDelete(r)}
                            className="text-loss/60 hover:text-loss text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        danger
        title="Delete this record?"
        message="It's removed from your database permanently."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
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
