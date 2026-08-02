"use client";

import { useState } from "react";
import Button from "@/components/Button";

/**
 * Password prompt for the shared stats link.
 *
 * The check happens server-side in `shared_stats_payload` — a wrong password
 * returns no data at all, rather than data the UI hides. There's nothing here
 * worth inspecting in devtools.
 */
export default function SharedGate({
  onSubmit,
}: {
  onSubmit: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setWrong(false);
    try {
      const ok = await onSubmit(password.trim());
      if (!ok) setWrong(true);
    } catch {
      setWrong(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-safe">
      <form onSubmit={submit} className="w-full max-w-xs text-center">
        <p className="text-gold-400 font-bold text-lg mb-1">Pokeresh</p>
        <p className="text-white/50 text-sm mb-6">
          Enter the password to see the stats.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setWrong(false);
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Password"
          aria-invalid={wrong}
          className={`w-full bg-felt-800 border rounded-xl px-4 py-3 text-white text-center placeholder:text-white/25 focus:outline-none mb-3 ${
            wrong ? "border-loss" : "border-white/10 focus:border-gold-500"
          }`}
        />

        {wrong && (
          <p className="text-loss text-sm mb-3">
            That&apos;s not it. Ask Dhermesh for the password.
          </p>
        )}

        <Button type="submit" disabled={busy || !password.trim()} className="w-full">
          {busy ? "Checking…" : "Open"}
        </Button>
      </form>
    </div>
  );
}
