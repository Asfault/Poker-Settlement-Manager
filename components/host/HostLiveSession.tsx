"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DbSessionPlayer,
  LoadedSession,
  addBuyIn,
  addPlayerToSession,
  deleteSession,
  removeBuyIn,
  removeSessionPlayer,
  sumBuyIns,
} from "@/lib/db/sessions";
import { RosterPlayer, createPlayer, listPlayers } from "@/lib/db/players";
import { formatINR } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ConfirmDialog from "@/components/ConfirmDialog";
import PlayerAvatar from "./PlayerAvatar";

const QUICK_AMOUNTS = [1000, 2000, 4000, 5000];

export default function HostLiveSession({
  data,
  onRefresh,
  onSessionOver,
}: {
  data: LoadedSession;
  onRefresh: () => Promise<void>;
  onSessionOver: () => void;
}) {
  const router = useRouter();
  const { session, players } = data;
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    sessionPlayerId: string;
    name: string;
    amount: number;
  } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<DbSessionPlayer | null>(
    null,
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Roster for adding someone mid-session.
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listPlayers().then(setRoster).catch(() => setRoster([]));
  }, []);

  const totalPot = useMemo(
    () => players.reduce((s, p) => s + sumBuyIns(p), 0),
    [players],
  );

  const alreadyIn = new Set(players.map((p) => p.player_id));
  const available = roster.filter((r) => !alreadyIn.has(r.id));

  const houseFeeTotal =
    session.house_fee_per_player *
    players.filter((p) => p.pays_house_fee && p.player_id !== session.host_player_id)
      .length;

  function queueBuyIn(p: DbSessionPlayer, amount: number) {
    if (amount <= 0) return;
    setPending({
      sessionPlayerId: p.id,
      name: p.display_name,
      amount,
    });
  }

  async function confirmBuyIn() {
    if (!pending) return;
    setBusy(true);
    try {
      await addBuyIn(pending.sessionPlayerId, pending.amount);
      setCustom((m) => ({ ...m, [pending.sessionPlayerId]: "" }));
      setPending(null);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add buy-in");
    } finally {
      setBusy(false);
    }
  }

  const nameTaken =
    newName.trim().length > 0 &&
    roster.some(
      (r) => r.name.toLowerCase() === newName.trim().toLowerCase(),
    );

  /** Create a roster entry for someone new, then join them to this session. */
  function addBrandNewPlayer() {
    const trimmed = newName.trim();
    if (!trimmed || nameTaken) return;
    act(async () => {
      const created = await createPlayer({ name: trimmed });
      await addPlayerToSession({
        sessionId: session.id,
        playerId: created.id,
        displayName: created.name,
        paysHouseFee: true,
      });
      setRoster(await listPlayers());
      setNewName("");
      setShowAdd(false);
    });
  }

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 pb-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-4">
          <h1 className="text-xl font-bold">Live session</h1>
          <p className="text-white/50 text-sm">
            {players.length} players
            {session.house_fee_per_player > 0 &&
              ` · ${formatINR(session.house_fee_per_player)} house fee`}
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {/* Pot */}
        <Card className="p-4 sm:p-5 mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">
              Total pot
            </div>
            <div className="text-3xl font-bold text-gold-400 tabular-nums">
              {formatINR(totalPot)}
            </div>
            {houseFeeTotal > 0 && (
              <div className="text-white/35 text-xs mt-1">
                + {formatINR(houseFeeTotal)} house fee at settlement
              </div>
            )}
          </div>
          <div className="text-5xl opacity-70">🎰</div>
        </Card>

        {/* Add player mid-session */}
        {showAdd ? (
          <Card className="p-4 mb-4 border-dashed border-white/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm text-white/70">Add a player</h2>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewName("");
                }}
                className="text-white/50 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            {available.length > 0 && (
              <>
                <p className="text-white/40 text-xs mb-2">From the roster</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {available.map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        act(async () => {
                          await addPlayerToSession({
                            sessionId: session.id,
                            playerId: r.id,
                            displayName: r.name,
                            paysHouseFee: r.id !== session.host_player_id,
                          });
                          setShowAdd(false);
                        })
                      }
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-sm border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-colors"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Someone new — creates a roster entry, then joins them in. */}
            <p className="text-white/40 text-xs mb-2">Someone new</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addBrandNewPlayer();
                }}
                placeholder="Name"
                className="flex-1 min-w-0 bg-felt-900 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
              />
              <Button
                size="sm"
                onClick={addBrandNewPlayer}
                disabled={busy || !newName.trim() || nameTaken}
              >
                Add
              </Button>
            </div>
            {nameTaken && (
              <p className="text-loss text-xs mt-2">
                Someone with that name is already on the roster.
              </p>
            )}
            <p className="text-white/30 text-xs mt-2">
              They&apos;ll be saved to your roster for next time.
            </p>
          </Card>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full mb-4 py-3 rounded-2xl border-2 border-dashed border-white/15 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5 transition-colors text-sm font-semibold"
          >
            + Add player
          </button>
        )}

        {/* Players */}
        <div className="flex flex-col gap-4">
          {players.map((p) => {
            const total = sumBuyIns(p);
            const isHost = p.player_id === session.host_player_id;
            const value = custom[p.id] ?? "";
            return (
              <Card key={p.id} className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      name={p.display_name}
                      photoUrl={p.photo_url}
                      size={40}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold truncate">
                          {p.display_name}
                        </h3>
                        {isHost && (
                          <span className="text-[10px] uppercase tracking-wider text-gold-400 border border-gold-500/40 rounded px-1.5 py-0.5 shrink-0">
                            Host
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (p.buy_ins.length === 0) {
                          act(() => removeSessionPlayer(p.id));
                        } else {
                          setPendingRemove(p);
                        }
                      }}
                      disabled={busy}
                      title={`Remove ${p.display_name}`}
                      className="text-white/25 hover:text-loss text-base leading-none px-1.5 py-0.5 rounded hover:bg-loss/10 transition-colors shrink-0"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-right shrink-0">
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
                      onClick={() => queueBuyIn(p, amt)}
                      disabled={busy}
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
                      value={value}
                      onChange={(e) =>
                        setCustom((m) => ({ ...m, [p.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && Number(value) > 0) {
                          queueBuyIn(p, Math.round(Number(value)));
                        }
                      }}
                      placeholder="Custom amount"
                      className="w-full bg-felt-900 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => queueBuyIn(p, Math.round(Number(value)))}
                    disabled={busy || !value || Number(value) <= 0}
                  >
                    Add
                  </Button>
                </div>

                {p.buy_ins.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-white/50 hover:text-white/80 select-none">
                      Buy-in history ({p.buy_ins.length})
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {p.buy_ins.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center gap-1 text-xs bg-felt-900 border border-white/10 rounded-full pl-2.5 pr-1 py-1"
                        >
                          <span className="text-white/80 tabular-nums">
                            {formatINR(b.amount)}
                          </span>
                          <button
                            onClick={() => act(() => removeBuyIn(b.id))}
                            disabled={busy}
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

          <Button
            size="lg"
            variant="danger"
            onClick={onSessionOver}
            className="w-full"
            disabled={totalPot === 0 || busy}
          >
            Session Over
          </Button>

          <button
            onClick={() => setConfirmDiscard(true)}
            disabled={busy}
            className="w-full text-center text-white/30 hover:text-loss text-xs py-2"
          >
            Discard session
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Confirm buy-in"
        message={
          pending
            ? `Add ${formatINR(pending.amount)} buy-in for ${pending.name}?`
            : ""
        }
        confirmLabel="Add buy-in"
        onConfirm={confirmBuyIn}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        danger
        title="Remove player?"
        message={
          pendingRemove
            ? `${pendingRemove.display_name} has ${pendingRemove.buy_ins.length} buy-in${pendingRemove.buy_ins.length === 1 ? "" : "s"} totalling ${formatINR(sumBuyIns(pendingRemove))}. Removing them deletes those too.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={() => {
          const p = pendingRemove;
          setPendingRemove(null);
          if (p) act(() => removeSessionPlayer(p.id));
        }}
        onCancel={() => setPendingRemove(null)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        danger
        title="Discard this session?"
        message="Every buy-in in it is deleted permanently."
        confirmLabel="Discard"
        onConfirm={async () => {
          setConfirmDiscard(false);
          setBusy(true);
          try {
            await deleteSession(session.id);
            router.replace("/host");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not discard session",
            );
            setBusy(false);
          }
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
