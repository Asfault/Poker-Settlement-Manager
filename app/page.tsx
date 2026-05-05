"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";
import { uid } from "@/lib/id";
import { usePersistentState } from "@/lib/storage";
import StartScreen from "@/components/StartScreen";
import AddPlayersScreen from "@/components/AddPlayersScreen";
import LiveSessionScreen from "@/components/LiveSessionScreen";
import SessionOverScreen from "@/components/SessionOverScreen";
import ResultsScreen from "@/components/ResultsScreen";

type View = "start" | "session";

export default function Home() {
  const [session, setSession, { hydrated }] = usePersistentState<Session | null>(
    "psm:session:v1",
    null,
  );
  // The view determines whether to show the StartScreen or the active session.
  // It defaults to the start screen, even if a session exists, so the user
  // gets a chance to choose between "Resume" and "New Session".
  const [view, setView] = useState<View>("start");

  // Avoid SSR/hydration flicker — render an empty shell until storage is read.
  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  function newSession() {
    setSession({
      id: uid(),
      startedAt: Date.now(),
      status: "setup",
      players: [],
    });
    setView("session");
  }

  function resumeSession() {
    setView("session");
  }

  function patchSession(updater: (s: Session) => Session) {
    setSession((prev) => (prev ? updater(prev) : prev));
  }

  function discardAndReturnToStart() {
    setSession(null);
    setView("start");
  }

  // Start screen
  if (view === "start" || !session) {
    return (
      <StartScreen
        onNewSession={newSession}
        hasInProgress={!!session}
        onResume={resumeSession}
      />
    );
  }

  // Active session screens, picked by status.
  switch (session.status) {
    case "setup":
      return (
        <AddPlayersScreen
          session={session}
          setSession={patchSession}
          onStart={() =>
            patchSession((s) => ({ ...s, status: "live" }))
          }
          onCancel={discardAndReturnToStart}
        />
      );

    case "live":
      return (
        <LiveSessionScreen
          session={session}
          setSession={patchSession}
          onSessionOver={() =>
            patchSession((s) => ({ ...s, status: "tally" }))
          }
        />
      );

    case "tally":
      return (
        <SessionOverScreen
          session={session}
          setSession={patchSession}
          onCalculate={() =>
            patchSession((s) => ({ ...s, status: "results" }))
          }
          onBack={() =>
            patchSession((s) => ({ ...s, status: "live" }))
          }
        />
      );

    case "results":
      return (
        <ResultsScreen
          session={session}
          onNewSession={discardAndReturnToStart}
        />
      );

    default:
      return (
        <StartScreen
          onNewSession={newSession}
          hasInProgress={false}
          onResume={resumeSession}
        />
      );
  }
}
