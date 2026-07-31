"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RosterPlayer,
  createPlayer,
  deletePlayer,
  listPlayers,
  updatePlayer,
  uploadPlayerPhoto,
} from "@/lib/db/players";
import Button from "@/components/Button";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";
import PhotoCropper from "@/components/host/PhotoCropper";

export default function PlayersPage() {
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<RosterPlayer | null>(null);
  const [adding, setAdding] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setPlayers(await listPlayers(true));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load players");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Search matches either the real name or the nickname.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q),
    );
  }, [players, query]);

  const active = matches.filter((p) => p.is_active);
  const archived = matches.filter((p) => !p.is_active);
  const archivedCount = archived.length;

  return (
    <div className="px-4 py-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-5 gap-2">
          {searchOpen ? (
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search players…"
                autoFocus
                className="flex-1 min-w-0 bg-felt-900 border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
              />
              <button
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                className="text-white/50 hover:text-white text-sm px-2 shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <h1 className="text-xl font-bold">Players</h1>
                <p className="text-white/50 text-sm">
                  {players.filter((p) => p.is_active).length} active
                  {players.filter((p) => !p.is_active).length > 0 &&
                    ` · ${players.filter((p) => !p.is_active).length} archived`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search players"
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </button>
                <Button onClick={() => setAdding(true)}>+ Add</Button>
              </div>
            </>
          )}
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-white/40 text-sm py-10 text-center">Loading…</p>
        ) : players.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm mb-4">
              No players yet. Add your regulars once and you&apos;ll never type
              a name again.
            </p>
            <Button onClick={() => setAdding(true)}>Add your first player</Button>
          </Card>
        ) : matches.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-white/50 text-sm">
              No players match &ldquo;{query}&rdquo;.
            </p>
          </Card>
        ) : (
          <>
            {/* Active players */}
            <div className="flex flex-col gap-2">
              {active.map((p) => (
                <PlayerRow key={p.id} player={p} onEdit={setEditing} />
              ))}
            </div>

            {/* Archived, collapsed by default, always below the toggle */}
            {archivedCount > 0 && (
              <>
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="w-full text-center text-white/40 hover:text-white/70 text-sm mt-5 mb-2"
                >
                  {showArchived
                    ? "Hide archived"
                    : `Show ${archivedCount} archived`}
                </button>
                {showArchived && (
                  <div className="flex flex-col gap-2">
                    {archived.map((p) => (
                      <PlayerRow key={p.id} player={p} onEdit={setEditing} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {(adding || editing) && (
        <PlayerEditor
          player={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function PlayerRow({
  player,
  onEdit,
}: {
  player: RosterPlayer;
  onEdit: (p: RosterPlayer) => void;
}) {
  return (
    <Card
      className={`p-3 flex items-center gap-3 ${
        player.is_active ? "" : "opacity-50"
      }`}
    >
      <PlayerAvatar
        name={player.name}
        photoUrl={player.photo_url}
        size={48}
      />
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{player.name}</div>
        {player.nickname?.trim() && (
          <div className="text-white/40 text-xs truncate">
            {player.nickname}
          </div>
        )}
      </div>
      {!player.is_active && (
        <span className="text-white/40 text-xs shrink-0">Archived</span>
      )}
      <button
        onClick={() => onEdit(player)}
        className="text-white/50 hover:text-white text-sm shrink-0 px-2"
      >
        Edit
      </button>
    </Card>
  );
}

function PlayerEditor({
  player,
  onClose,
  onSaved,
}: {
  player: RosterPlayer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = player === null;
  const [name, setName] = useState(player?.name ?? "");
  const [nickname, setNickname] = useState(player?.nickname ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    player?.photo_url ?? null,
  );
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCropFile(file);
    // Reset so picking the same file twice still fires onChange.
    e.target.value = "";
  }

  function applyCrop(blob: Blob) {
    setPendingPhoto(blob);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(blob));
    setCropFile(null);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      // Create first so we have an id to name the photo file with.
      const saved = isNew
        ? await createPlayer({ name: trimmed, nickname })
        : await updatePlayer(player.id, { name: trimmed, nickname });

      if (pendingPhoto) {
        const url = await uploadPlayerPhoto(saved.id, pendingPhoto);
        await updatePlayer(saved.id, { photo_url: url });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  }

  async function toggleArchive() {
    if (!player) return;
    setBusy(true);
    try {
      await updatePlayer(player.id, { is_active: !player.is_active });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
      setBusy(false);
    }
  }

  async function remove() {
    if (!player) return;
    const ok = window.confirm(
      `Permanently delete ${player.name}? This only works if they've never played a session — otherwise archive them instead.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deletePlayer(player.id);
      onSaved();
    } catch {
      setError(
        "Can't delete — they've played in a session. Archive them instead to keep the history.",
      );
      setBusy(false);
    }
  }

  const shownPhoto = preview ?? photoUrl;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gold-500/50 bg-felt-800 shadow-2xl p-5"
      >
        <h2 className="text-lg font-bold mb-4">
          {isNew ? "Add player" : "Edit player"}
        </h2>

        <div className="flex items-center gap-4 mb-4">
          <PlayerAvatar
            name={name || "?"}
            photoUrl={shownPhoto}
            size={64}
          />
          <div className="flex flex-col gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              {shownPhoto ? "Change photo" : "Add photo"}
            </Button>
            {shownPhoto && (
              <button
                onClick={() => {
                  setPendingPhoto(null);
                  setPhotoUrl(null);
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                }}
                className="text-white/40 hover:text-loss text-xs text-left px-1"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/*"
            onChange={pickPhoto}
            className="hidden"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-white/70 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ram"
              autoFocus
              className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
            />
            <p className="text-white/35 text-xs mt-1">
              Used for stats. Keep it consistent.
            </p>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              Nickname <span className="text-white/35">(optional)</span>
            </label>
            <input
              type="text"
              value={nickname ?? ""}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="The Rock"
              className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500"
            />
            <p className="text-white/35 text-xs mt-1">
              Shown on screens. Change it whenever — stats stay intact.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-loss text-xs">
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={busy || !name.trim()}
            className="flex-1"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>

        {!isNew && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <button
              onClick={toggleArchive}
              disabled={busy}
              className="text-white/50 hover:text-white text-xs"
            >
              {player.is_active ? "Archive" : "Unarchive"}
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="text-loss/70 hover:text-loss text-xs"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {cropFile && (
        <PhotoCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={applyCrop}
        />
      )}
    </div>
  );
}
