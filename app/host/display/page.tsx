"use client";

import { useEffect, useState } from "react";
import { getDisplayPassword, setDisplayPassword } from "@/lib/db/display";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function DisplaySettingsPage() {
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    getDisplayPassword()
      .then((pw) => {
        setCurrent(pw);
        setDraft(pw ?? "");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load settings"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setDisplayPassword(draft);
      setCurrent(draft.trim() || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setConfirmClear(false);
    setBusy(true);
    try {
      await setDisplayPassword(null);
      setCurrent(null);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear");
    } finally {
      setBusy(false);
    }
  }

  const displayUrl = `${origin}/display`;

  return (
    <div className="px-4 py-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Public display</h1>
          <p className="text-white/50 text-sm">
            A read-only board for the TV
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-white/40 text-sm py-10 text-center">Loading…</p>
        ) : (
          <>
            <Card className="p-5 mb-4">
              <h2 className="text-sm uppercase tracking-wide text-white/50 mb-3">
                Password
              </h2>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Set a password"
                className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500 mb-3"
              />
              <div className="flex gap-2">
                <Button
                  onClick={save}
                  disabled={busy || draft.trim() === (current ?? "")}
                  className="flex-1"
                >
                  {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
                </Button>
                {current && (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmClear(true)}
                    disabled={busy}
                  >
                    Turn off
                  </Button>
                )}
              </div>
              <p className="text-white/35 text-xs mt-3">
                Devices stay signed in once they&apos;ve entered it. Changing
                the password signs all of them out — that&apos;s your
                &ldquo;lock it down&rdquo; button.
              </p>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm uppercase tracking-wide text-white/50 mb-2">
                Display URL
              </h2>
              {current ? (
                <>
                  <div className="bg-felt-900 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-gold-400 break-all mb-3">
                    {displayUrl}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigator.clipboard?.writeText(displayUrl).catch(() => {})
                      }
                    >
                      Copy link
                    </Button>
                    <a href="/display" target="_blank" rel="noreferrer">
                      <Button size="sm" variant="secondary">
                        Open
                      </Button>
                    </a>
                  </div>
                  <p className="text-white/35 text-xs mt-3">
                    Open this on the TV, enter the password once, and bookmark
                    it. It shows the live board during a session and the
                    leaderboard when nothing&apos;s running.
                  </p>
                </>
              ) : (
                <p className="text-white/50 text-sm">
                  Set a password above to turn the display on. Without one it
                  stays disabled.
                </p>
              )}
            </Card>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        danger
        title="Turn off the display?"
        message="The display stops working entirely and every device is signed out."
        confirmLabel="Turn off"
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
