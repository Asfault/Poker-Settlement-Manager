"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPlayers } from "@/lib/db/players";
import {
  DbSession,
  deleteSession,
  findOpenSession,
  listSessions,
} from "@/lib/db/sessions";
import { formatDateTime } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function HostDashboard() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [open, setOpen] = useState<DbSession | null>(null);
  const [recent, setRecent] = useState<DbSession[]>([]);
  const [discarding, setDiscarding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  async function discardOpen() {
    if (!open) return;
    setConfirmDiscard(false);
    setDiscarding(true);
    try {
      await deleteSession(open.id);
      setOpen(null);
    } finally {
      setDiscarding(false);
    }
  }

  useEffect(() => {
    listPlayers()
      .then((p) => setPlayerCount(p.length))
      .catch(() => setPlayerCount(null));
    findOpenSession().then(setOpen).catch(() => setOpen(null));
    listSessions()
      .then((s) => setRecent(s.filter((x) => x.status === "complete").slice(0, 3)))
      .catch(() => setRecent([]));
  }, []);

  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Host</h1>
          <p className="text-white/50 text-sm">
            {playerCount === null
              ? " "
              : `${playerCount} player${playerCount === 1 ? "" : "s"} on the roster`}
          </p>
        </header>

        {open && (
          <Card className="p-5 mb-4 border-gold-500/50">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/host/session/${open.id}`}
                className="min-w-0 flex-1"
              >
                <div className="text-xs uppercase tracking-wide text-gold-400 mb-0.5">
                  Session in progress
                </div>
                <div className="font-semibold">
                  {open.status === "tally"
                    ? "Waiting on chip counts"
                    : "Live now"}
                </div>
                <div className="text-white/45 text-xs mt-0.5">
                  Started {formatDateTime(new Date(open.started_at).getTime())}
                </div>
              </Link>
              <Link
                href={`/host/session/${open.id}`}
                className="text-2xl shrink-0"
              >
                →
              </Link>
            </div>
            <button
              onClick={() => setConfirmDiscard(true)}
              disabled={discarding}
              className="mt-3 pt-3 border-t border-white/5 w-full text-left text-loss/70 hover:text-loss text-xs min-h-[44px]"
            >
              {discarding ? "Discarding…" : "Discard this session"}
            </button>
          </Card>
        )}

        {/* The one thing you open this app to do. Full width, gold border,
            biggest target on the screen. */}
        <Link href="/host/session/new" className="block mb-3">
          <Card className="p-5 min-h-[76px] flex items-center gap-4 border-gold-500/45 hover:border-gold-500/70 transition-colors">
            <span className="text-3xl leading-none" aria-hidden="true">
              🃏
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-lg">New session</span>
              <span className="block text-white/45 text-xs mt-0.5">
                Pick players, set the fee
              </span>
            </span>
          </Card>
        </Link>

        {/* Players is a tab now, so the secondary row is the two screens that
            didn't earn a tab. */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/host/display">
            <Card className="p-4 h-full min-h-[72px] hover:border-white/20 transition-colors">
              <div className="text-xl mb-1.5" aria-hidden="true">
                📺
              </div>
              <div className="font-semibold text-sm">Display</div>
              <div className="text-white/45 text-xs mt-0.5">
                TV board and password
              </div>
            </Card>
          </Link>
          <Link href="/host/shared">
            <Card className="p-4 h-full min-h-[72px] hover:border-white/20 transition-colors">
              <div className="text-xl mb-1.5" aria-hidden="true">
                🌍
              </div>
              <div className="font-semibold text-sm">Wild</div>
              <div className="text-white/45 text-xs mt-0.5">
                Games run by others
              </div>
            </Card>
          </Link>
        </div>

        {recent.length > 0 && (
          <>
            <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
              Recent sessions
            </h2>
            <div className="flex flex-col gap-2">
              {recent.map((s) => (
                <Link key={s.id} href={`/host/session/${s.id}`}>
                  <Card className="p-4 min-h-[56px] hover:border-white/20 transition-colors flex items-center justify-between gap-3">
                    <span className="text-sm">
                      {formatDateTime(new Date(s.started_at).getTime())}
                    </span>
                    <span className="text-white/30 text-sm shrink-0">View</span>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        {playerCount === 0 && (
          <Card className="p-6 text-center mt-4">
            <p className="text-white/50 text-sm mb-4">
              Add your regulars to the roster first — then starting a session is
              just tapping names.
            </p>
            <Link href="/host/players">
              <Button>Add players</Button>
            </Link>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        danger
        title="Discard this session?"
        message="Every buy-in in it is deleted permanently."
        confirmLabel="Discard"
        onConfirm={discardOpen}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
