"use client";

import { useEffect, useState } from "react";
import {
  getShareSettings,
  setShareSettings,
  validateSlug,
  normaliseSlug,
} from "@/lib/db/shared-stats";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";

/**
 * Share settings for the public stats link.
 *
 * The link is deliberately gated by its own password, separate from the
 * display board's — revoking the shared link should never kill the TV
 * mid-game. Changing either the slug or the password kills every existing
 * viewer session immediately, which is the whole point of being able to
 * rotate them.
 */
export default function ShareStatsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrigin(window.location.origin);
    setLoading(true);
    setError(null);
    getShareSettings()
      .then((s) => {
        setSavedSlug(s.slug);
        setSavedPassword(s.password);
        setSlug(s.slug ?? "");
        setPassword(s.password ?? "");
      })
      .catch(() => setError("Could not load share settings"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const live = Boolean(savedSlug && savedPassword);
  const shareUrl = savedSlug ? `${origin}/${savedSlug}` : "";
  const slugError = slug.trim() ? validateSlug(slug) : null;
  const dirty =
    normaliseSlug(slug) !== (savedSlug ?? "") ||
    password.trim() !== (savedPassword ?? "");
  const canSave =
    !busy && dirty && !slugError && slug.trim() !== "" && password.trim() !== "";

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setShareSettings(slug, password);
      setSavedSlug(normaliseSlug(slug));
      setSavedPassword(password.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      // The unique index on share_slug is the likely culprit.
      setError(
        e instanceof Error ? e.message : "Could not save — try another name",
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setConfirmOff(false);
    setBusy(true);
    try {
      await setShareSettings(null, null);
      setSavedSlug(null);
      setSavedPassword(null);
      setSlug("");
      setPassword("");
    } catch {
      setError("Could not turn the link off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-stats-title"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-felt-800 border-t sm:border border-gold-500/40 sm:rounded-2xl rounded-t-2xl p-5 pb-safe-4 sm:pb-5 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 id="share-stats-title" className="text-lg font-bold">
              Share stats
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-white/40 hover:text-white -mt-1 -mr-1 w-9 h-9 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <p className="text-white/50 text-sm mb-4">
            A read-only page anyone with the link and password can open. Never
            shows the live game, and never shows house fees.
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-white/40 text-sm py-6 text-center">Loading…</p>
          ) : (
            <>
              {live && (
                <div className="mb-4">
                  <div className="text-white/45 text-xs mb-1.5">Link</div>
                  <div className="bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-sm text-gold-400 break-all mb-2">
                    {shareUrl}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(`${shareUrl}\nPassword: ${savedPassword}`)
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        })
                        .catch(() => {});
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy link and password"}
                  </Button>
                </div>
              )}

              <label className="block mb-4">
                <span className="text-white/45 text-xs">Link name</span>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-white/30 text-sm shrink-0">
                    pokeresh.com/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="iknowdhermesh"
                    className="flex-1 min-w-0 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500"
                  />
                </div>
                {slugError && (
                  <span className="block text-loss text-xs mt-1.5">
                    {slugError}
                  </span>
                )}
              </label>

              <label className="block mb-2">
                <span className="text-white/45 text-xs">Password</span>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Set a password"
                  className="w-full mt-1.5 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500"
                />
              </label>
              <p className="text-white/35 text-xs mb-4">
                Separate from the TV display password on purpose — changing
                this one won&apos;t interrupt a game in progress.
              </p>

              <div className="flex gap-2">
                <Button onClick={save} disabled={!canSave} className="flex-1">
                  {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
                </Button>
                {live && (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmOff(true)}
                    disabled={busy}
                  >
                    Turn off
                  </Button>
                )}
              </div>

              <p className="text-white/30 text-xs mt-4">
                Changing the name or password signs out everyone currently
                viewing. The link name is memorable, not secret — the password
                is what actually protects the page.
              </p>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOff}
        danger
        title="Turn off the shared link?"
        message="The page stops working immediately and everyone viewing it is signed out."
        confirmLabel="Turn off"
        onConfirm={turnOff}
        onCancel={() => setConfirmOff(false)}
      />
    </>
  );
}
