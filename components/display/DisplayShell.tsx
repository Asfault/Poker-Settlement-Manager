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
import PlayerDrawer from "./PlayerDrawer";
import { PlayerCard, buildPlayerCard, historyFor } from "@/lib/display/playerCard";

const LIVE_POLL_MS = 1000; // buy-ins land on the TV within a second
const HISTORY_POLL_MS = 5 * 60 * 1000; // safety net; also refetched on change
const FILLER_MS = 15000;
const ALERT_MS = 12000;
const RECENT_MEMORY = 8;
/**
 * Minimum gap between alerts. Without this, entering several buy-ins in a
 * row fires a queue of them back to back and the board disappears.
 */
const ALERT_COOLDOWN_MS = 90 * 1000;
/**
 * Alerts are about a moment. If one can't get on screen within this long of
 * the event that caused it, it's discarded rather than queued — otherwise
 * entering a batch of buy-ins produces a trickle of stale announcements for
 * the next ten minutes.
 */
const ALERT_MAX_AGE_MS = 2 * 60 * 1000;
const DRAWER_EVERY_MS = 30 * 60 * 1000; // one player spotlight every half hour
const DRAWER_HOLD_MS = 2 * 60 * 1000; // stays open two minutes
const DRAWER_FIRST_MS = DRAWER_EVERY_MS; // first one lands on the same cadence

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
  const lastAlertAt = useRef(0);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Player spotlight drawer — own schedule, suppresses filler while open.
  const [drawer, setDrawer] = useState<PlayerCard | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerOpen = useRef(false);
  const drawerQueue = useRef<string[]>([]);
  const drawerTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // Timers fire long after their closure was created — read through refs so
  // they always see current data.
  const derivedRef = useRef(derived);
  const historyRef = useRef(history);
  useEffect(() => {
    derivedRef.current = derived;
    historyRef.current = history;
  }, [derived, history]);

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
    const t = Date.now();

    const candidates = triggeredCards(derived).filter(
      (c) => !firedIds.current.has(c.id),
    );

    // Burn anything whose moment has passed. Marking it fired means it
    // never shows, rather than surfacing minutes after the fact.
    for (const c of candidates) {
      if (c.at !== undefined && t - c.at > ALERT_MAX_AGE_MS) {
        firedIds.current.add(c.id);
      }
    }

    const fresh = candidates
      .filter((c) => !firedIds.current.has(c.id))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const next = fresh[0];
    if (!next) return;

    // One alert at a time. Anything still waiting when the gap ends only
    // runs if it's still fresh — the check above sees to that.
    if (t - lastAlertAt.current < ALERT_COOLDOWN_MS) return;

    firedIds.current.add(next.id);
    lastAlertAt.current = t;
    show(next, ALERT_MS);
  }, [derived, show]);

  // ---------- Player spotlight drawer ----------

  useEffect(() => {
    const rows = derived?.live?.rows;
    const sessionId = derived?.live?.sessionId;
    if (!rows || rows.length === 0 || !sessionId) return;

    function clearTimers() {
      drawerTimers.current.forEach(clearTimeout);
      drawerTimers.current = [];
    }

    function openNext() {
      const current = derivedRef.current;
      const liveRows = current?.live?.rows ?? [];
      if (liveRows.length === 0) return;

      // Round-robin so everyone gets a turn before anyone repeats.
      if (drawerQueue.current.length === 0) {
        drawerQueue.current = liveRows.map((r) => r.playerId);
      }
      let id = drawerQueue.current.shift();
      while (id && !liveRows.some((r) => r.playerId === id)) {
        id = drawerQueue.current.shift();
      }
      const row = liveRows.find((r) => r.playerId === id) ?? liveRows[0];
      if (!row || !current) return;

      const card = buildPlayerCard(
        current,
        row,
        historyFor(current, row.playerId, historyRef.current ?? []),
      );

      drawerOpen.current = true;
      setDrawer(card);
      // Mount first, then animate in on the next frame.
      requestAnimationFrame(() => setDrawerVisible(true));

      drawerTimers.current.push(
        setTimeout(() => {
          setDrawerVisible(false);
          drawerTimers.current.push(
            setTimeout(() => {
              setDrawer(null);
              drawerOpen.current = false;
            }, 800),
          );
        }, DRAWER_HOLD_MS),
      );

      drawerTimers.current.push(setTimeout(openNext, DRAWER_EVERY_MS));
    }

    clearTimers();
    drawerQueue.current = [];
    drawerTimers.current.push(setTimeout(openNext, DRAWER_FIRST_MS));

    return () => {
      clearTimers();
      setDrawerVisible(false);
      setDrawer(null);
      drawerOpen.current = false;
    };
    // Restart only when the session changes, not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived?.live?.sessionId]);

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
          // The drawer owns the screen while it's open — triggered alerts
          // still interrupt, but filler waits its turn.
          if (drawerOpen.current) {
            scheduleNext();
            return null;
          }
          // Read through the ref — this timer outlives its closure, so
          // `derived` captured above would be minutes out of date.
          const current = derivedRef.current;
          if (!current) {
            scheduleNext();
            return null;
          }
          const pool = fillerCards(current);
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

      {drawer && <PlayerDrawer card={drawer} visible={drawerVisible} />}

      {overlay && (
        <div className="absolute inset-0 z-40 p-[5vh_6vw] flex flex-col justify-center bg-[#051911]/95">
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
