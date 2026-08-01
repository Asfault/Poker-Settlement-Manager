"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoadedSession,
  loadSession,
  setSessionStatus,
} from "@/lib/db/sessions";
import Card from "@/components/Card";
import Button from "@/components/Button";
import HostLiveSession from "./HostLiveSession";
import HostTally from "./HostTally";
import HostResults from "./HostResults";

/**
 * Which screen to show when editing an already-finished session.
 *
 * Crucially this is local state, not the session's status. A completed
 * session stays `complete` in the database the whole time you're editing —
 * so it never reappears on the dashboard as "in progress", never drops out
 * of stats, and never shows up on the public display as tonight's game.
 */
type EditMode = "buyins" | "chips" | null;

export default function HostSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LoadedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadSession(sessionId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function goTo(status: "live" | "tally" | "complete") {
    await setSessionStatus(sessionId, status);
    await refresh();
  }

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-white/40 text-sm">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-6 text-center">
            <p className="text-loss text-sm mb-4">
              {error ?? "Session not found"}
            </p>
            <Button onClick={() => router.push("/host")}>Back to host</Button>
          </Card>
        </div>
      </div>
    );
  }

  const isComplete = data.session.status === "complete";

  // ---- Editing a finished session ----
  if (isComplete && editMode !== null) {
    const banner = (
      <div className="px-4 pt-4">
        <div className="max-w-2xl mx-auto rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-gold-400 text-sm">
            Editing a finished session
          </span>
          <button
            onClick={() => setEditMode(null)}
            className="text-white/60 hover:text-white text-sm shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    );

    if (editMode === "chips") {
      return (
        <>
          {banner}
          <HostTally
            data={data}
            onRefresh={refresh}
            onBack={() => setEditMode("buyins")}
            onCalculate={() => setEditMode(null)}
          />
        </>
      );
    }

    return (
      <>
        {banner}
        <HostLiveSession
          data={data}
          onRefresh={refresh}
          onSessionOver={() => setEditMode("chips")}
        />
      </>
    );
  }

  // ---- Normal flow, driven by status ----
  switch (data.session.status) {
    case "tally":
      return (
        <HostTally
          data={data}
          onRefresh={refresh}
          onBack={() => goTo("live")}
          onCalculate={() => goTo("complete")}
        />
      );
    case "complete":
      return (
        <HostResults
          data={data}
          onEditBuyIns={() => setEditMode("buyins")}
          onEditChips={() => setEditMode("chips")}
        />
      );
    default:
      return (
        <HostLiveSession
          data={data}
          onRefresh={refresh}
          onSessionOver={() => goTo("tally")}
        />
      );
  }
}
