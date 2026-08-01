"use client";

import { useMemo, useState } from "react";
import { LoadedSession, setChipsLeft, sumBuyIns } from "@/lib/db/sessions";
import { formatINR } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import PlayerAvatar from "./PlayerAvatar";

export default function HostTally({
  data,
  onRefresh,
  onBack,
  onCalculate,
}: {
  data: LoadedSession;
  onRefresh: () => Promise<void>;
  onBack: () => void;
  onCalculate: () => void;
}) {
  const { session, players } = data;

  // Local edits so typing stays responsive; written to the DB on blur.
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of players) {
      init[p.id] = p.chips_left === null ? "" : String(p.chips_left);
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const buy = players.reduce((s, p) => s + sumBuyIns(p), 0);
    const chips = players.reduce((s, p) => {
      const v = Number(draft[p.id]);
      return s + (Number.isFinite(v) && draft[p.id] !== "" ? v : 0);
    }, 0);
    return { buy, chips, diff: chips - buy };
  }, [players, draft]);

  const allFilled = players.every((p) => (draft[p.id] ?? "") !== "");

  async function persist(sessionPlayerId: string) {
    const raw = draft[sessionPlayerId] ?? "";
    try {
      await setChipsLeft(sessionPlayerId, raw === "" ? null : Number(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function calculate() {
    if (!allFilled) {
      setError("Enter chips left for every player.");
      return;
    }
    if (totals.buy !== totals.chips) {
      setError(
        `Tally error. Recheck chip count. Total buy-ins: ${formatINR(
          totals.buy,
        )}, Total chips left: ${formatINR(
          totals.chips,
        )}, Difference: ${formatINR(Math.abs(totals.diff))}`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    // Flush every value before moving on.
    try {
      await Promise.all(players.map((p) => persist(p.id)));
      await onRefresh();
      onCalculate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="text-white/60 hover:text-white text-sm"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">Session over</h1>
          <span className="w-12" />
        </header>

        <p className="text-white/60 text-sm mb-4">
          Enter each player&apos;s final chip count. Chips only — no house fee.
        </p>

        <Card className="overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="bg-felt-700/60 text-xs uppercase tracking-wide text-white/60">
                <th className="text-left py-3 px-4">Player</th>
                <th className="text-right py-3 px-3">Buy-ins</th>
                <th className="text-right py-3 px-4">Chips left</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        name={p.display_name}
                        photoUrl={p.photo_url}
                        size={32}
                      />
                      <span className="font-medium truncate">
                        {p.display_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-gold-400">
                    {formatINR(sumBuyIns(p))}
                  </td>
                  <td className="py-3 px-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                        ₹
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={draft[p.id] ?? ""}
                        onChange={(e) => {
                          setDraft((d) => ({ ...d, [p.id]: e.target.value }));
                          if (error) setError(null);
                        }}
                        onBlur={() => persist(p.id)}
                        placeholder="0"
                        className="w-32 ml-auto block bg-felt-900 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-right text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500 tabular-nums"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 bg-felt-700/40">
                <td className="py-3 px-4 font-semibold">Totals</td>
                <td className="py-3 px-3 text-right font-semibold tabular-nums text-gold-400">
                  {formatINR(totals.buy)}
                </td>
                <td
                  className={`py-3 px-4 text-right font-semibold tabular-nums ${
                    !allFilled
                      ? "text-white/60"
                      : totals.chips === totals.buy
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

        {/* Running difference — saves doing the subtraction in your head
            to work out what the last player's stack has to be. */}
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
            totals.diff === 0
              ? "border-win/40 bg-win/10 text-win"
              : totals.diff < 0
                ? "border-white/10 bg-white/5 text-white/70"
                : "border-loss/40 bg-loss/10 text-loss"
          }`}
        >
          <span>
            {totals.diff === 0
              ? "Chips match buy-ins exactly"
              : totals.diff < 0
                ? "Still to account for"
                : "Over by"}
          </span>
          <span className="font-bold tabular-nums text-base">
            {totals.diff === 0 ? "✓" : formatINR(Math.abs(totals.diff))}
          </span>
        </div>

        {session.house_fee_per_player > 0 && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/55 text-xs">
            The {formatINR(session.house_fee_per_player)} house fee is added
            automatically at settlement. Don&apos;t include it here.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-felt-900 via-felt-900/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          <Button
            size="lg"
            className="w-full"
            onClick={calculate}
            disabled={!allFilled || busy}
          >
            {busy ? "Calculating…" : "Calculate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
