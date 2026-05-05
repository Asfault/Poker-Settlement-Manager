"use client";

import { useMemo, useState } from "react";
import type { Session } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { totalBuyIn } from "@/lib/settlement";
import Button from "./Button";
import Card from "./Card";

export default function SessionOverScreen({
  session,
  setSession,
  onCalculate,
  onBack,
}: {
  session: Session;
  setSession: (updater: (s: Session) => Session) => void;
  onCalculate: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalBuy = session.players.reduce(
      (sum, p) => sum + totalBuyIn(p),
      0,
    );
    const totalChips = session.players.reduce(
      (sum, p) => sum + (p.chipsLeft ?? 0),
      0,
    );
    return { totalBuy, totalChips, diff: totalChips - totalBuy };
  }, [session.players]);

  const allFilled = session.players.every((p) => p.chipsLeft !== null);

  function setChips(playerId: string, raw: string) {
    setSession((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              chipsLeft: raw === "" ? null : Math.max(0, Math.round(Number(raw))),
            }
          : p,
      ),
    }));
    if (error) setError(null);
  }

  function handleCalculate() {
    if (!allFilled) {
      setError("Enter chips left for every player.");
      return;
    }
    if (totals.totalBuy !== totals.totalChips) {
      setError(
        `Tally error. Recheck chip count. Total buy-ins: ${formatINR(
          totals.totalBuy,
        )}, Total chips left: ${formatINR(
          totals.totalChips,
        )}, Difference: ${formatINR(Math.abs(totals.diff))}`,
      );
      return;
    }
    setError(null);
    onCalculate();
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="text-white/60 hover:text-white text-sm"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">Session Over</h1>
          <span className="w-12" />
        </header>

        <p className="text-white/60 text-sm mb-5">
          Enter the final chip count for each player. The totals must match.
        </p>

        <Card className="overflow-hidden mb-5">
          <table className="w-full">
            <thead>
              <tr className="bg-felt-700/60 text-xs uppercase tracking-wide text-white/60">
                <th className="text-left py-3 px-4">Player</th>
                <th className="text-right py-3 px-3">Total Buy-ins</th>
                <th className="text-right py-3 px-4">Chips Left</th>
              </tr>
            </thead>
            <tbody>
              {session.players.map((p) => {
                const total = totalBuyIn(p);
                return (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-gold-400">
                      {formatINR(total)}
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
                          value={p.chipsLeft ?? ""}
                          onChange={(e) => setChips(p.id, e.target.value)}
                          placeholder="0"
                          className="w-32 ml-auto block bg-felt-900 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-right text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500 tabular-nums"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 bg-felt-700/40">
                <td className="py-3 px-4 font-semibold">Totals</td>
                <td className="py-3 px-3 text-right font-semibold tabular-nums text-gold-400">
                  {formatINR(totals.totalBuy)}
                </td>
                <td
                  className={`py-3 px-4 text-right font-semibold tabular-nums ${
                    !allFilled
                      ? "text-white/60"
                      : totals.totalChips === totals.totalBuy
                        ? "text-win"
                        : "text-loss"
                  }`}
                >
                  {formatINR(totals.totalChips)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>

        {error && (
          <div className="mb-5 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleCalculate}
          disabled={!allFilled}
        >
          Calculate
        </Button>
      </div>
    </div>
  );
}
