"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";
import { uid } from "@/lib/id";
import { formatINR } from "@/lib/format";
import { totalBuyIn } from "@/lib/settlement";
import Button from "./Button";
import Card from "./Card";
import ConfirmDialog from "./ConfirmDialog";

const QUICK_AMOUNTS = [1000, 2000, 4000, 5000];

export default function LiveSessionScreen({
  session,
  setSession,
  onSessionOver,
}: {
  session: Session;
  setSession: (updater: (s: Session) => Session) => void;
  onSessionOver: () => void;
}) {
  const [customByPlayer, setCustomByPlayer] = useState<Record<string, string>>(
    {},
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [pendingBuyIn, setPendingBuyIn] = useState<{
    playerId: string;
    amount: number;
  } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const totalPot = session.players.reduce(
    (sum, p) => sum + totalBuyIn(p),
    0,
  );

  /** Queue a buy-in for confirmation via the in-app dialog. */
  function addBuyIn(playerId: string, amount: number) {
    if (amount <= 0) return;
    if (!session.players.some((p) => p.id === playerId)) return;
    setPendingBuyIn({ playerId, amount });
  }

  /** Actually apply the queued buy-in after the user confirms. */
  function confirmPendingBuyIn() {
    if (!pendingBuyIn) return;
    const { playerId, amount } = pendingBuyIn;
    setSession((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              buyIns: [
                ...p.buyIns,
                { id: uid(), amount, at: Date.now() },
              ],
            }
          : p,
      ),
    }));
    // Clear the custom input for that player (in case that's how it was added)
    setCustomByPlayer((m) => ({ ...m, [playerId]: "" }));
    setPendingBuyIn(null);
  }

  function removeBuyIn(playerId: string, buyInId: string) {
    setSession((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId
          ? { ...p, buyIns: p.buyIns.filter((b) => b.id !== buyInId) }
          : p,
      ),
    }));
  }

  function addPlayer() {
    const trimmed = newPlayerName.trim();
    if (trimmed.length === 0) return;
    const duplicate = session.players.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) return;
    setSession((s) => ({
      ...s,
      players: [
        ...s.players,
        { id: uid(), name: trimmed, buyIns: [], chipsLeft: null },
      ],
    }));
    setNewPlayerName("");
    setShowAddPlayer(false);
  }

  function removePlayer(playerId: string) {
    const player = session.players.find((p) => p.id === playerId);
    if (!player) return;
    // Nothing to lose — drop them straight away.
    if (player.buyIns.length === 0) {
      doRemovePlayer(playerId);
      return;
    }
    setPendingRemove(playerId);
  }

  function doRemovePlayer(playerId: string) {
    setSession((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== playerId),
    }));
  }

  function handleCustom(playerId: string) {
    const raw = customByPlayer[playerId] ?? "";
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    addBuyIn(playerId, Math.round(amount));
    // Note: custom input is cleared inside confirmPendingBuyIn so that
    // canceling the confirmation keeps the amount in the input.
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10 pb-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Live Session</h1>
          <p className="text-white/50 text-sm">
            {session.players.length} players · Tap to add buy-ins
          </p>
        </header>

        <Card className="p-4 sm:p-5 mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">
              Total pot
            </div>
            <div className="text-3xl font-bold text-gold-400 tabular-nums">
              {formatINR(totalPot)}
            </div>
          </div>
          <div className="text-5xl opacity-70">🎰</div>
        </Card>

        {/* Add another player — kept at the top so it's always reachable */}
        {showAddPlayer ? (
          <Card className="p-4 sm:p-5 mb-4 border-dashed border-white/20">
            <label className="block text-sm text-white/70 mb-2">
              New player name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addPlayer();
                  if (e.key === "Escape") {
                    setShowAddPlayer(false);
                    setNewPlayerName("");
                  }
                }}
                placeholder="e.g. Sita"
                className="flex-1 bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
                autoFocus
              />
              <Button
                onClick={addPlayer}
                disabled={
                  newPlayerName.trim().length === 0 ||
                  session.players.some(
                    (p) =>
                      p.name.toLowerCase() ===
                      newPlayerName.trim().toLowerCase(),
                  )
                }
              >
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddPlayer(false);
                  setNewPlayerName("");
                }}
              >
                Cancel
              </Button>
            </div>
            {newPlayerName.trim().length > 0 &&
              session.players.some(
                (p) =>
                  p.name.toLowerCase() ===
                  newPlayerName.trim().toLowerCase(),
              ) && (
                <p className="text-loss text-xs mt-2">
                  A player with that name already exists.
                </p>
              )}
          </Card>
        ) : (
          <button
            onClick={() => setShowAddPlayer(true)}
            className="w-full mb-4 py-3 rounded-2xl border-2 border-dashed border-white/15 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5 transition-colors text-sm font-semibold"
          >
            + Add Player
          </button>
        )}

        <div className="flex flex-col gap-4">
          {session.players.map((p) => {
            const total = totalBuyIn(p);
            const custom = customByPlayer[p.id] ?? "";
            return (
              <Card key={p.id} className="p-4 sm:p-5">
                <div className="flex items-baseline justify-between mb-3 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {p.name}
                    </h3>
                    <button
                      onClick={() => removePlayer(p.id)}
                      title={`Remove ${p.name}`}
                      aria-label={`Remove ${p.name}`}
                      className="text-white/30 hover:text-loss text-base leading-none px-1.5 py-0.5 rounded hover:bg-loss/10 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/50">Total buy-in</div>
                    <div className="text-xl font-bold text-gold-400 tabular-nums">
                      {formatINR(total)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {QUICK_AMOUNTS.map((amt) => (
                    <Button
                      key={amt}
                      variant="secondary"
                      size="sm"
                      onClick={() => addBuyIn(p.id, amt)}
                      className="!py-2"
                    >
                      +{formatINR(amt)}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={custom}
                      onChange={(e) =>
                        setCustomByPlayer((m) => ({
                          ...m,
                          [p.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCustom(p.id);
                      }}
                      placeholder="Custom amount"
                      className="w-full bg-felt-900 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
                    />
                  </div>
                  <Button
                    onClick={() => handleCustom(p.id)}
                    disabled={!custom || Number(custom) <= 0}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>

                {p.buyIns.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-white/50 hover:text-white/80 select-none">
                      Buy-in history ({p.buyIns.length})
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {p.buyIns.map((b) => (
                        <li
                          key={b.id}
                          className="group flex items-center gap-1 text-xs bg-felt-900 border border-white/10 rounded-full pl-2.5 pr-1 py-1"
                        >
                          <span className="text-white/80 tabular-nums">
                            {formatINR(b.amount)}
                          </span>
                          <button
                            onClick={() => removeBuyIn(p.id, b.id)}
                            className="text-white/30 hover:text-loss px-1.5 leading-none"
                            title="Remove buy-in"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Card>
            );
          })}

          {/* Session Over sits at the end of the same flex-col so it gets the
              same 16px gap-4 spacing above it that separates the player cards. */}
          <Button
            size="lg"
            variant="danger"
            onClick={onSessionOver}
            className="w-full"
            disabled={totalPot === 0}
          >
            Session Over
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingBuyIn !== null}
        title="Confirm buy-in"
        message={
          pendingBuyIn
            ? `Add ${formatINR(pendingBuyIn.amount)} buy-in for ${
                session.players.find((p) => p.id === pendingBuyIn.playerId)
                  ?.name ?? "this player"
              }?`
            : ""
        }
        confirmLabel="Add buy-in"
        cancelLabel="Cancel"
        onConfirm={confirmPendingBuyIn}
        onCancel={() => setPendingBuyIn(null)}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        danger
        title="Remove player?"
        message={(() => {
          const p = session.players.find((x) => x.id === pendingRemove);
          if (!p) return "";
          const n = p.buyIns.length;
          return `${p.name} has ${n} buy-in${n === 1 ? "" : "s"} totalling ${formatINR(totalBuyIn(p))}. Removing them deletes those too.`;
        })()}
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemove) doRemovePlayer(pendingRemove);
          setPendingRemove(null);
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}
