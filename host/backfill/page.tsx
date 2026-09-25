"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RosterPlayer, listPlayers } from "@/lib/db/players";
import { createBackfillSession } from "@/lib/db/stats";
import { formatINR } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

interface Entry {
  buyIn: string;
  chips: string;
}

export default function BackfillPage() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    // datetime-local wants local time without a timezone suffix.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPlayers()
      .then(setRoster)
      .catch(() => setRoster([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setEntries((e) =>
      e[id] ? e : { ...e, [id]: { buyIn: "", chips: "" } },
    );
  }

  const totals = useMemo(() => {
    let buy = 0;
    let chips = 0;
    for (const id of selected) {
      const e = entries[id];
      if (!e) continue;
      buy += Number(e.buyIn) || 0;
      chips += Number(e.chips) || 0;
    }
    return { buy, chips, diff: chips - buy };
  }, [selected, entries]);

  const allFilled =
    selected.length >= 2 &&
    selected.every((id) => {
      const e = entries[id];
      return e && e.buyIn !== "" && e.chips !== "";
    });

  const balanced = totals.buy === totals.chips && totals.buy > 0;

  async function save() {
    if (!allFilled) {
      setError("Fill in buy-ins and chips for every player.");
      return;
    }
    if (!balanced) {
      setError(
        `Chips don't match buy-ins. Buy-ins: ${formatINR(totals.buy)}, Chips: ${formatINR(totals.chips)}, Difference: ${formatINR(Math.abs(totals.diff))}`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBackfillSession({
        playedAt: new Date(date),
        houseFeePerPlayer: 0,
        hostPlayerId: null,
        players: selected.map((id) => {
          const p = roster.find((r) => r.id === id);
          return {
            playerId: id,
            name: p?.name ?? "",
            totalBuyIn: Number(entries[id].buyIn),
            chipsLeft: Number(entries[id].chips),
          };
        }),
      });
      router.replace("/host/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save session");
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/host/history"
            className="text-white/60 hover:text-white text-sm"
          >
            ← History
          </Link>
          <h1 className="text-xl font-bold">Add old game</h1>
          <span className="w-14" />
        </header>

        <p className="text-white/50 text-sm mb-5">
          Enter a session from before the app. Buy-ins and chips only — leave
          house fees out so the stats stay clean.
        </p>

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
              Add players to the roster first.
            </p>
            <Link href="/host/players">
              <Button>Go to players</Button>
            </Link>
          </Card>
        ) : (
          <>
            <Card className="p-4 mb-4">
              <label className="block text-sm text-white/70 mb-1.5">
                When was it?
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-500"
              />
            </Card>

            <Card className="p-4 mb-4">
              <h2 className="text-sm uppercase tracking-wide text-white/50 mb-3">
                Who played
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {roster.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm border transition-colors ${
                        on
                          ? "border-gold-500/60 bg-gold-500/10 text-white"
                          : "border-white/10 text-white/55 hover:text-white"
                      }`}
                    >
                      <PlayerAvatar
                        name={p.name}
                        photoUrl={p.photo_url}
                        size={22}
                      />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </Card>

            {selected.length > 0 && (
              <Card className="overflow-hidden mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="bg-felt-700/60 text-xs uppercase tracking-wide text-white/60">
                      <th className="text-left py-2.5 px-4">Player</th>
                      <th className="text-right py-2.5 px-2">Buy-in</th>
                      <th className="text-right py-2.5 px-4">Chips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((id) => {
                      const p = roster.find((r) => r.id === id);
                      const e = entries[id] ?? { buyIn: "", chips: "" };
                      return (
                        <tr key={id} className="border-t border-white/5">
                          <td className="py-2 px-4 text-sm font-medium truncate">
                            {p?.name}
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={e.buyIn}
                              onChange={(ev) =>
                                setEntries((m) => ({
                                  ...m,
                                  [id]: { ...e, buyIn: ev.target.value },
                                }))
                              }
                              placeholder="0"
                              className="w-24 ml-auto block bg-felt-900 border border-white/10 rounded-lg px-2 py-1.5 text-right text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500 tabular-nums"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={e.chips}
                              onChange={(ev) =>
                                setEntries((m) => ({
                                  ...m,
                                  [id]: { ...e, chips: ev.target.value },
                                }))
                              }
                              placeholder="0"
                              className="w-24 ml-auto block bg-felt-900 border border-white/10 rounded-lg px-2 py-1.5 text-right text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500 tabular-nums"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-felt-700/40 text-sm">
                      <td className="py-2.5 px-4 font-semibold">Totals</td>
                      <td className="py-2.5 px-2 text-right font-semibold tabular-nums text-gold-400">
                        {formatINR(totals.buy)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-semibold tabular-nums ${
                          totals.diff === 0 && totals.buy > 0
                            ? "text-win"
                            : "text-loss"
                        }`}
                      >
                        {formatINR(totals.chips)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </Card>
            )}

            {selected.length > 0 && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
                  totals.diff === 0 && totals.buy > 0
                    ? "border-win/40 bg-win/10 text-win"
                    : totals.diff < 0
                      ? "border-white/10 bg-white/5 text-white/70"
                      : "border-loss/40 bg-loss/10 text-loss"
                }`}
              >
                <span>
                  {totals.diff === 0 && totals.buy > 0
                    ? "Chips match buy-ins exactly"
                    : totals.diff < 0
                      ? "Still to account for"
                      : "Over by"}
                </span>
                <span className="font-bold tabular-nums text-base">
                  {totals.diff === 0 && totals.buy > 0
                    ? "✓"
                    : formatINR(Math.abs(totals.diff))}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-4 bg-gradient-to-t from-felt-900 via-felt-900/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          <Button
            size="lg"
            className="w-full"
            onClick={save}
            disabled={!allFilled || !balanced || busy}
          >
            {busy ? "Saving…" : "Save session"}
          </Button>
        </div>
      </div>
    </div>
  );
}
