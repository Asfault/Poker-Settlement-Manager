"use client";

import { useEffect, useState } from "react";
import {
  checkPassword,
  rememberPassword,
  savedPassword,
} from "@/lib/db/display";
import DisplayShell from "@/components/display/DisplayShell";

export default function DisplayPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A device that's already been let in stays in.
  useEffect(() => {
    const saved = savedPassword();
    if (!saved) {
      setChecking(false);
      return;
    }
    checkPassword(saved)
      .then((ok) => setPassword(ok ? saved : null))
      .catch(() => setPassword(null))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ok = await checkPassword(input.trim());
      if (!ok) {
        setError("Wrong password");
        setBusy(false);
        return;
      }
      rememberPassword(input.trim());
      setPassword(input.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
      setBusy(false);
    }
  }

  if (checking) return <div className="min-h-screen" />;

  if (password) {
    return (
      <DisplayShell
        password={password}
        onSignOut={() => {
          setPassword(null);
          setInput("");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-5">🃏</div>
        <h1 className="text-2xl font-bold mb-1">Pokeresh Display</h1>
        <p className="text-white/45 text-sm mb-8">
          Enter the password to show this screen
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-felt-900 border border-white/10 rounded-xl px-4 py-3 text-center text-white text-lg placeholder:text-white/25 focus:outline-none focus:border-gold-500"
          />
          {error && <p className="text-loss text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="w-full bg-gold-500 text-felt-900 font-semibold rounded-xl px-4 py-3 disabled:opacity-40 hover:bg-gold-400 transition-colors"
          >
            {busy ? "Checking…" : "Show display"}
          </button>
        </form>
        <p className="text-white/25 text-xs mt-6">
          This device will stay signed in.
        </p>
      </div>
    </div>
  );
}
