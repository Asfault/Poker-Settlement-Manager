"use client";

import Button from "./Button";

export default function StartScreen({
  onNewSession,
  hasInProgress,
  onResume,
}: {
  onNewSession: () => void;
  hasInProgress: boolean;
  onResume: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🃏</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
          Poker Settlement Manager
        </h1>
        <p className="text-white/60 mb-10">
          Track buy-ins, settle balances, and export a clean WhatsApp-friendly
          summary at the end of the night.
        </p>

        <div className="flex flex-col gap-3">
          {hasInProgress && (
            <Button size="lg" variant="secondary" onClick={onResume}>
              Resume Session
            </Button>
          )}
          <Button size="lg" onClick={onNewSession}>
            New Session
          </Button>
        </div>
      </div>
    </div>
  );
}
