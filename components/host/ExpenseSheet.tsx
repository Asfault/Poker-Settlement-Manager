"use client";

import { useEffect, useMemo, useState } from "react";
import type { DbSessionPlayer } from "@/lib/db/sessions";
import type { ExpenseShare, SessionExpense } from "@/lib/expenses";
import { splitEqually, splitRemainder } from "@/lib/expenses";
import { formatINR } from "@/lib/format";
import Button from "@/components/Button";
import PlayerAvatar from "./PlayerAvatar";

/**
 * Add or edit one expense during a live session.
 *
 * Two modes over the same underlying data — a list of per-person debts:
 *
 *  - Split equally: type one number, pick who's in. The payer absorbs any odd
 *    rupees, so everyone else's share stays clean.
 *  - Per person: type an amount next to each name. No total to enter, because
 *    the total IS the sum of what people owe.
 *
 * The payer needn't be splitting it — Hari can order for Ram and Kula and be
 * owed the lot.
 */
export default function ExpenseSheet({
  players,
  existing,
  defaultPayerId,
  onSave,
  onClose,
}: {
  players: DbSessionPlayer[];
  existing?: SessionExpense | null;
  defaultPayerId: string | null;
  onSave: (input: {
    label: string;
    payerPlayerId: string;
    shares: ExpenseShare[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [payerId, setPayerId] = useState(
    existing?.payerPlayerId ?? defaultPayerId ?? players[0]?.player_id ?? "",
  );
  const [mode, setMode] = useState<"equal" | "custom">(
    existing ? "custom" : "equal",
  );
  const [total, setTotal] = useState("");
  // Nobody is selected for a new expense — picking the two or three people
  // who actually ordered is quicker than deselecting the four who didn't.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(existing ? existing.shares.map((s) => s.playerId) : []),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const s of existing?.shares ?? []) out[s.playerId] = String(s.amount);
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the custom fields from an equal split, so switching modes to
  // tweak one person's amount doesn't mean retyping everyone's.
  useEffect(() => {
    if (mode !== "custom" || existing) return;
    const parsed = Number(total);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const ids = [...selected];
    const shares = splitEqually(parsed, ids);
    if (shares.length === 0) return;
    setAmounts((prev) => {
      const next = { ...prev };
      for (const s of shares) {
        if (!next[s.playerId]) next[s.playerId] = String(s.amount);
      }
      return next;
    });
    // Only when the mode flips, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const shares: ExpenseShare[] = useMemo(() => {
    if (mode === "equal") {
      const parsed = Number(total);
      if (!Number.isFinite(parsed) || parsed <= 0) return [];
      return splitEqually(parsed, [...selected]);
    }
    return players
      .map((p) => ({
        playerId: p.player_id,
        amount: Math.round(Number(amounts[p.player_id] ?? "")),
      }))
      .filter((s) => Number.isFinite(s.amount) && s.amount > 0);
  }, [mode, total, selected, amounts, players]);

  const sum = shares.reduce((s, x) => s + x.amount, 0);
  const absorbed =
    mode === "equal" ? splitRemainder(Number(total) || 0, selected.size) : 0;
  const payerName =
    players.find((p) => p.player_id === payerId)?.display_name ?? "";
  const canSave = !busy && shares.length > 0 && payerId !== "";

  function toggle(playerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({ label, payerPlayerId: payerId, shares });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-felt-800 border-t sm:border border-gold-500/40 sm:rounded-2xl rounded-t-2xl p-5 pb-safe-4 sm:pb-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="expense-sheet-title" className="text-lg font-bold">
            {existing ? "Edit expense" : "Add expense"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/40 hover:text-white -mt-1 -mr-1 w-9 h-9 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        <label className="block mb-4">
          <span className="text-white/45 text-xs">What was it</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Biryani"
            className="w-full mt-1.5 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500"
          />
        </label>

        <div className="mb-4">
          <span className="text-white/45 text-xs">Who paid</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {players.map((p) => (
              <button
                key={p.player_id}
                onClick={() => setPayerId(p.player_id)}
                aria-pressed={payerId === p.player_id}
                className={`px-3 min-h-[38px] rounded-xl text-sm border transition-colors ${
                  payerId === p.player_id
                    ? "border-gold-500 bg-gold-500/15 text-white"
                    : "border-white/10 text-white/55 hover:text-white"
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="flex gap-1 mb-4 p-1 bg-felt-900 rounded-xl">
          {(["equal", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex-1 min-h-[38px] rounded-lg text-sm transition-colors ${
                mode === m
                  ? "bg-white/10 text-white font-semibold"
                  : "text-white/50"
              }`}
            >
              {m === "equal" ? "Split equally" : "Per person"}
            </button>
          ))}
        </div>

        {mode === "equal" ? (
          <>
            <label className="block mb-4">
              <span className="text-white/45 text-xs">Total</span>
              <input
                type="number"
                inputMode="numeric"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="600"
                className="w-full mt-1.5 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500"
              />
            </label>

            <div className="mb-2">
              <span className="text-white/45 text-xs">Split between</span>
              <div className="flex flex-col gap-1.5 mt-1.5">
                {players.map((p) => {
                  const on = selected.has(p.player_id);
                  const share = shares.find((s) => s.playerId === p.player_id);
                  return (
                    <button
                      key={p.player_id}
                      onClick={() => toggle(p.player_id)}
                      aria-pressed={on}
                      className={`flex items-center gap-3 px-3 min-h-[48px] rounded-xl border text-left transition-colors ${
                        on
                          ? "border-white/20 bg-white/[0.04]"
                          : "border-white/5 opacity-45"
                      }`}
                    >
                      <PlayerAvatar
                        name={p.display_name}
                        photoUrl={null}
                        size={28}
                      />
                      <span className="flex-1 min-w-0 truncate text-sm">
                        {p.display_name}
                      </span>
                      <span className="tabular-nums text-sm text-white/70">
                        {share ? formatINR(share.amount) : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="mb-2">
            <span className="text-white/45 text-xs">
              What each person owes {payerName || "the payer"}
            </span>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {players.map((p) => (
                <div
                  key={p.player_id}
                  className="flex items-center gap-3 px-3 min-h-[48px] rounded-xl border border-white/10"
                >
                  <PlayerAvatar
                    name={p.display_name}
                    photoUrl={null}
                    size={28}
                  />
                  <span className="flex-1 min-w-0 truncate text-sm">
                    {p.display_name}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={amounts[p.player_id] ?? ""}
                    onChange={(e) =>
                      setAmounts((prev) => ({
                        ...prev,
                        [p.player_id]: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="w-20 bg-felt-900 border border-white/10 rounded-lg px-2 py-1.5 text-white text-right tabular-nums placeholder:text-white/20 focus:outline-none focus:border-gold-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-white/40 text-xs mt-3 mb-4">
          {sum > 0 ? (
            <>
              {payerName || "The payer"} is owed{" "}
              <span className="text-white/70 font-medium">
                {formatINR(sum)}
              </span>
              {absorbed > 0 && (
                <>
                  {" · "}
                  {formatINR(absorbed)}
                  {" doesn't divide evenly and comes out of their pocket"}
                </>
              )}
            </>
          ) : (
            "Nothing owed yet."
          )}
        </p>

        <Button onClick={save} disabled={!canSave} className="w-full">
          {busy ? "Saving…" : existing ? "Save changes" : "Add expense"}
        </Button>

        <p className="text-white/30 text-xs mt-3">
          Expenses never touch buy-ins, chips or anyone&apos;s poker record.
          They only change who hands whom cash at the end.
        </p>
      </div>
    </div>
  );
}
