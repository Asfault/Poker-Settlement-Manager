"use client";

import type { ReactNode } from "react";
import type { SharedState } from "@/lib/db/useSharedStats";
import SharedGate from "./SharedGate";

/**
 * The wrapper every public shared page sits in: loading, not-found, the
 * password prompt, and the page chrome. Keeps the four routes down to just
 * their content.
 */
export default function SharedFrame({
  state,
  onUnlock,
  children,
}: {
  state: SharedState;
  onUnlock: (password: string) => Promise<boolean>;
  children: ReactNode;
}) {
  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-gold-400 font-bold text-lg mb-1">Pokeresh</p>
        <p className="text-white/50 text-sm">
          Nothing here. Check the link you were sent.
        </p>
      </div>
    );
  }

  if (state === "locked") return <SharedGate onSubmit={onUnlock} />;

  return (
    <div className="px-4 py-6 pb-10 pt-safe">
      <div className="max-w-3xl mx-auto">
        {children}
        <p className="text-white/25 text-xs mt-8 text-center">pokeresh.com</p>
      </div>
    </div>
  );
}
