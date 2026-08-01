"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DisplayHistorySession,
  DisplayLiveSession,
  fetchDisplayPayload,
  fetchLive,
  forgetPassword,
} from "@/lib/db/display";
import { derive } from "@/lib/display/derive";
import {
  Card,
  fillerCards,
  nextGapMs,
  pickFiller,
  triggeredCards,
} from "@/lib/display/content";
import LiveBoard from "./LiveBoard";
import ContentCard from "./ContentCard";

const LIVE_POLL_MS = 1000; // buy-ins land on the TV within a second
const HISTORY_POLL_MS = 5 * 60 * 1000; // safety net; also refetched on change
const FILLER_MS = 15000;
const ALERT_MS = 12000;
const RECENT_MEMORY = 8;

export default function DisplayShell({
  password,
  onSignOut,
}: {
  password: string;
  onSignOut: () => void;
}) {
  const [live, setLive] = useState<DisplayLiveSession | null>(null);
  const [history, setHistory] = useState<DisplayHistorySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const completedCount = useRef<number | null>(null);

  // What's currently on top of the board, if anything.
  const [overlay, setOverlay] = useState<Card | null>(null);
  const recentIds = useRef<string[]>([]);
  const firedIds = useRef<Set<string>>(new Set());
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- History: large, rarely changes ----------

  const loadHistory = useCallback(async () => {
    try {
      const full = await fetchDisplayPayload(password);
      if (!full.ok) {
        forgetPassword();
        onSignOut();
        return;
      }
      setHistory(full.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection lost");
    }
  }, [password, onSignOut]);

  useEffect(() => {
    loadHistory();
    const id = setInterval(loadHistory, HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [loadHistory]);

  // ---------- Live: small, polled every second ----------

  const loadLive = useCallback(async () => {
    try {
      const next = await fetchLive(password);
      if (!next.ok) {
        forgetPassword();
        onSignOut();
        return;
      }
      setLive(next.live);
      setError(null);

      // A session just finished — pull fresh history so stats update.
      if (
        completedCount.current !== null &&
        next.completed_count !== completedCount.current
      ) {
        loadHistory();
      }
      completedCount.current = next.completed_count;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection lost");
    }
  }, [password, onSignOut, loadHistory]);

  useEffect(() => {
    loadLive();
    const id = setInterval(loadLive, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [loadLive]);

  // Ticking clock for elapsed time and the tilt window.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const derived = useMemo(() => {
    if (history === null) return null;
    return derive(
      { ok: true, live, history, server_time: "" },
      now,
    );
  }, [live, history, now]);

  // ---------- Show a card ----------

  const show = useCallback((card: Card, ms: number) => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    setOverlay(card);
    recentIds.current = [card.id, ...recentIds.current].slice(0, RECENT_MEMORY);
    overlayTimer.current = setTimeout(() => setOverlay(null), ms);
  }, []);

  // ---------- Triggered alerts jump the queue ----------

  useEffect(() => {
    if (!derived) return;
    const candidates = triggeredCards(derived)
      .filter((c) => !firedIds.current.has(c.id))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const next = candidates[0];
    if (!next) return;
    firedIds.current.add(next.id);
    show(next, ALERT_MS);
  }, [derived, show]);

  // ---------- Filler rotation ----------

  useEffect(() => {
    if (!derived) return;

    function scheduleNext() {
      if (gapTimer.current) clearTimeout(gapTimer.current);
      gapTimer.current = setTimeout(() => {
        setOverlay((cur) => {
          // Don't stomp on an alert that's mid-flight.
          if (cur) {
            scheduleNext();
            return cur;
          }
          const pool = fillerCards(derived!);
          const pick = pickFiller(pool, recentIds.current);
          if (pick) {
            recentIds.current = [pick.id, ...recentIds.current].slice(
              0,
              RECENT_MEMORY,
            );
            if (overlayTimer.current) clearTimeout(overlayTimer.current);
            overlayTimer.current = setTimeout(
              () => setOverlay(null),
              FILLER_MS,
            );
          }
          scheduleNext();
          return pick;
        });
      }, nextGapMs());
    }

    scheduleNext();
    return () => {
      if (gapTimer.current) clearTimeout(gapTimer.current);
    };
    // Rebuild the schedule only when the session identity changes, not on
    // every poll — otherwise the timer resets every 3 seconds and nothing
    // ever fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived?.live?.sessionId, derived === null]);

  useEffect(() => {
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      if (gapTimer.current) clearTimeout(gapTimer.current);
    };
  }, []);

  if (!derived) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/30 text-2xl">
        {error ?? "Connecting…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen overflow-hidden relative p-[3vh_3vw]">
      {/* Board is always mounted; overlays sit on top of it. */}
      <div
        className="h-full transition-opacity duration-500"
        style={{ opacity: overlay ? 0.08 : 1 }}
      >
        <LiveBoard derived={derived} now={now} />
      </div>

      {overlay && (
        <div className="absolute inset-0 p-[5vh_6vw] flex flex-col justify-center">
          <ContentCard card={overlay} />
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 right-5 text-[#ef4444]/70 text-sm">
          {error} — retrying
        </div>
      )}

      <button
        onClick={() => {
          forgetPassword();
          onSignOut();
        }}
        className="absolute bottom-3 left-4 text-white/10 hover:text-white/40 text-xs transition-colors"
      >
        sign out
      </button>
    </div>
  );
}
