"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SessionSummary, loadCompletedSessions } from "@/lib/db/stats";
import { deleteSession } from "@/lib/db/sessions";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(
    null,
  );

  async function confirmDelete() {
    const s = pendingDelete;
    if (!s) return;
    setPendingDelete(null);
    setDeleting(s.id);
    try {
      await deleteSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete session");
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    loadCompletedSessions()
      .then(setSessions)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load history"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h1 className="text-xl font-bold">History</h1>
            <p className="text-white/50 text-sm">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link href="/host/backfill">
            <Button size="sm" variant="secondary">
              + Add old game
            </Button>
          </Link>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-white/40 text-sm py-10 text-center">Loading…</p>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm mb-4">
              No completed sessions yet. Finish one, or enter games you played
              before the app existed.
            </p>
            <Link href="/host/backfill">
              <Button>Add an old game</Button>
            </Link>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => {
              const winner = [...s.players].sort(
                (a, b) => b.profitLoss - a.profitLoss,
              )[0];
              return (
                <Card
                  key={s.id}
                  className={`p-4 ${deleting === s.id ? "opacity-40" : ""}`}
                >
                  <Link href={`/host/session/${s.id}`} className="block">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">
                          {formatDateTime(s.startedAt)}
                        </div>
                        <div className="text-white/40 text-xs mt-0.5">
                          {s.players.length} players
                          {s.durationMs !== null &&
                            s.durationMs > 0 &&
                            ` · ${formatDuration(0, s.durationMs)}`}
                          {s.isBackfill && " · entered manually"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-gold-400 font-bold tabular-nums">
                          {formatINR(s.pot)}
                        </div>
                        <div className="text-white/35 text-xs">pot</div>
                      </div>
                    </div>
                    {winner && winner.profitLoss > 0 && (
                      <div className="text-xs text-white/50">
                        🏆 {winner.name}{" "}
                        <span className="text-win font-semibold tabular-nums">
                          +{formatINR(winner.profitLoss)}
                        </span>
                      </div>
                    )}
                  </Link>
                  <div className="mt-3 pt-2 border-t border-white/5 flex justify-end">
                    <button
                      onClick={() => setPendingDelete(s)}
                      disabled={deleting !== null}
                      className="text-loss/60 hover:text-loss text-xs"
                    >
                      {deleting === s.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        danger
        title="Delete this session?"
        message={
          pendingDelete
            ? `${formatDateTime(pendingDelete.startedAt)} · ${pendingDelete.players.length} players · ${formatINR(pendingDelete.pot)} pot. It'll be removed from all stats permanently.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
