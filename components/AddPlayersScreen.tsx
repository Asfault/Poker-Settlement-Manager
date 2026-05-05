"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";
import { uid } from "@/lib/id";
import Button from "./Button";
import Card from "./Card";

export default function AddPlayersScreen({
  session,
  setSession,
  onStart,
  onCancel,
}: {
  session: Session;
  setSession: (updater: (s: Session) => Session) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const trimmed = name.trim();
  const duplicate = session.players.some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canAdd = trimmed.length > 0 && !duplicate;

  function addPlayer() {
    if (!canAdd) return;
    setSession((s) => ({
      ...s,
      players: [
        ...s.players,
        { id: uid(), name: trimmed, buyIns: [], chipsLeft: null },
      ],
    }));
    setName("");
  }

  function removePlayer(id: string) {
    setSession((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
    }));
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={onCancel}
            className="text-white/60 hover:text-white text-sm"
          >
            ← Cancel
          </button>
          <h1 className="text-xl font-bold">Add Players</h1>
          <span className="w-12" />
        </header>

        <Card className="p-5 mb-5">
          <label className="block text-sm text-white/70 mb-2">
            Player name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPlayer();
              }}
              placeholder="e.g. Ram"
              className="flex-1 bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
              autoFocus
            />
            <Button onClick={addPlayer} disabled={!canAdd}>
              Add
            </Button>
          </div>
          {duplicate && trimmed.length > 0 && (
            <p className="text-loss text-xs mt-2">
              A player with that name already exists.
            </p>
          )}
        </Card>

        <Card className="p-5 mb-6">
          <h2 className="text-sm uppercase tracking-wide text-white/50 mb-3">
            Players ({session.players.length})
          </h2>
          {session.players.length === 0 ? (
            <p className="text-white/40 text-sm py-6 text-center">
              No players yet. Add at least 2 to start.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {session.players.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-white/40 text-sm w-5">
                      {idx + 1}.
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </span>
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="text-loss/80 hover:text-loss text-sm"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button
          size="lg"
          className="w-full"
          onClick={onStart}
          disabled={session.players.length < 2}
        >
          Start Session
        </Button>
      </div>
    </div>
  );
}
