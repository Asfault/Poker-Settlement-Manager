"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RosterPlayer, listPlayers } from "@/lib/db/players";
import { createSession, getLastHouseFee } from "@/lib/db/sessions";
import { formatINR } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

export default function NewSessionPage() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [fee, setFee] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPlayers(), getLastHouseFee()])
      .then(([players, lastFee]) => {
        setRoster(players);
        setFee(lastFee);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load roster"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q),
    );
  }, [roster, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      // Dropping the host from the game clears the host selection.
      if (hostId && !next.includes(hostId)) setHostId(null);
      return next;
    });
  }

  const payingCount = selected.filter((id) => id !== hostId).length;
  const totalFee = fee * payingCount;
  const needsHost = fee > 0 && !hostId;
  const canStart = selected.length >= 2 && !needsHost;

  async function start() {
    if (!canStart) return;
    setBusy(true);
    setError(null);
    try {
      // Snapshot the real name, not the nickname — screens show the name.
      const displayNames: Record<string, string> = {};
      for (const id of selected) {
        const p = roster.find((r) => r.id === id);
        if (p) displayNames[id] = p.name;
      }
      const sessionId = await createSession({
        playerIds: selected,
        displayNames,
        hostPlayerId: hostId,
        houseFeePerPlayer: fee,
      });
      router.replace(`/host/session/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold">New session</h1>
          <p className="text-white/50 text-sm">
            {selected.length} selected
            {selected.length > 0 && hostId && ` · ${payingCount} paying the fee`}
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-white/40 text-sm py-10 text-center">Loading…</p>
        ) : roster.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm mb-4">
              No players on the roster yet.
            </p>
            <Link href="/host/players">
              <Button>Add players first</Button>
            </Link>
          </Card>
        ) : (
          <>
            {/* Who's playing */}
            <Card className="p-4 mb-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="text-sm uppercase tracking-wide text-white/50">
                  Who&apos;s playing
                </h2>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-32 bg-felt-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {filtered.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl border transition-colors text-left ${
                        on
                          ? "border-gold-500/60 bg-gold-500/10"
                          : "border-white/5 hover:border-white/15"
                      }`}
                    >
                      <PlayerAvatar
                        name={p.name}
                        photoUrl={p.photo_url}
                        size={40}
                      />
                      <span className="min-w-0 flex-1 block">
                        <span className="font-medium truncate block">
                          {p.name}
                        </span>
                        {p.nickname?.trim() && (
                          <span className="text-white/40 text-xs truncate block">
                            {p.nickname}
                          </span>
                        )}
                      </span>
                      <span
                        className={`w-5 h-5 rounded-md border-2 shrink-0 inline-flex items-center justify-center ${
                          on
                            ? "bg-gold-500 border-gold-500 text-felt-900"
                            : "border-white/25"
                        }`}
                      >
                        {on && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                          >
                            <path d="M4 12l6 6L20 5" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* House fee */}
            <Card className="p-4 mb-4">
              <h2 className="text-sm uppercase tracking-wide text-white/50 mb-3">
                House fee
              </h2>

              <label className="block text-sm text-white/70 mb-1.5">
                Per player
              </label>
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={fee}
                  onChange={(e) => setFee(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-felt-900 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white focus:outline-none focus:border-gold-500 tabular-nums"
                />
              </div>

              <label className="block text-sm text-white/70 mb-1.5">
                Host {fee > 0 && <span className="text-loss">*</span>}
              </label>
              {selected.length === 0 ? (
                <p className="text-white/35 text-xs">
                  Pick who&apos;s playing first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setHostId(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      hostId === null
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/10 text-white/50 hover:text-white"
                    }`}
                  >
                    No host
                  </button>
                  {selected.map((id) => {
                    const p = roster.find((r) => r.id === id);
                    if (!p) return null;
                    const on = hostId === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setHostId(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          on
                            ? "border-gold-500/60 bg-gold-500/15 text-gold-400 font-semibold"
                            : "border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {needsHost && (
                <p className="text-loss text-xs mt-2">
                  Pick a host — someone has to receive the fee.
                </p>
              )}

              {fee > 0 && hostId && (
                <div className="mt-3 rounded-xl bg-felt-900 border border-white/5 px-3 py-2.5 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>
                      {formatINR(fee)} × {payingCount} paying
                    </span>
                    <span className="text-gold-400 font-semibold tabular-nums">
                      {formatINR(totalFee)}
                    </span>
                  </div>
                  <p className="text-white/35 text-xs mt-1.5">
                    Kept out of buy-ins and P/L. Added only at settlement.
                  </p>
                </div>
              )}
            </Card>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/55 text-xs">
              Enter real chip amounts during the session — don&apos;t add the
              fee to anyone&apos;s buy-in. The app handles it.
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-felt-900 via-felt-900/95 to-transparent">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => router.push("/host")}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={start}
            disabled={!canStart || busy}
          >
            {busy ? "Starting…" : "Start session"}
          </Button>
        </div>
      </div>
    </div>
  );
}
