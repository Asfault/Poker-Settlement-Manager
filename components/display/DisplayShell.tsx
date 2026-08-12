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
import { buildRecap } from "@/lib/display/recap";
import LiveBoard from "./LiveBoard";
import BuyInTicker from "./BuyInTicker";
import ShotClock from "./ShotClock";
import RecapPanels from "./RecapPanels";
import ContentCard from "./ContentCard";
import PlayerDrawer from "./PlayerDrawer";
import { PlayerCard, buildPlayerCard, historyFor } from "@/lib/display/playerCard";
import { useWakeLock } from "@/lib/display/useWakeLock";

const LIVE_POLL_MS = 1000; // buy-ins land on the TV within a second
const HISTORY_POLL_MS = 5 * 60 * 1000; // safety net; also refetched on change
const FILLER_MS = 15000;
const ALERT_MS = 12000;
const RECENT_MEMORY = 15;
/**
 * Minimum gap between alerts. Without this, entering several buy-ins in a
 * row fires a queue of them back to back and the board disappears.
 */
const ALERT_COOLDOWN_MS = 15 * 1000;
/**
 * Alerts are about a moment. If one can't get on screen within this long of
 * the event that caused it, it's discarded rather than queued — otherwise
 * entering a batch of buy-ins produces a trickle of stale announcements for
 * the next ten minutes.
 */
const ALERT_MAX_AGE_MS = 30 * 1000;
const DRAWER_EVERY_MS = 30 * 60 * 1000; // one player spotlight every half hour
const DRAWER_HOLD_MS = 3 * 60 * 1000; // stays open three minutes
const DRAWER_FIRST_MS = DRAWER_EVERY_MS; // first one lands on the same cadence
/**
 * How long the end-of-night reveal owns the screen after a session finishes.
 * Derived from the session's ended_at rather than tracked in state, so a TV
 * that reloads mid-recap picks up where it left off.
 */
const RECAP_WINDOW_MS = 30 * 60 * 1000;

export default function DisplayShell({
  password,
  onSignOut,
}: {
  password: string;
  onSignOut: () => void;
}) {
  // The board sits untouched on a TV all night — exactly what every device
  // reads as "idle". Re-requested on visibility change; see useWakeLock.
  useWakeLock();

  const [live, setLive] = useState<DisplayLiveSession | null>(null);
  const [history, setHistory] = useState<DisplayHistorySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const completedCount = useRef<number | null>(null);
  /**
   * serverNow − deviceNow, measured on each live poll. The shot clock counts
   * against this rather than the TV's own clock, which is frequently wrong.
   */
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // What's currently on top of the board, if anything.
  const [overlay, setOverlay] = useState<Card | null>(null);
  // Mirrors `overlay` for the schedulers, which run inside timers and must
  // not read stale closure state or do their thinking inside a setState
  // updater.
  const overlayRef = useRef<Card | null>(null);
  /**
   * The moment a session ends, `live` goes null but `history` hasn't caught
   * up yet, so there's a beat where the recap can't be built and the board
   * falls back to the idle leaderboard. This holds the screen across that gap.
   */
  const [awaitingRecap, setAwaitingRecap] = useState(false);
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
    } finally {
      // Whatever happened, stop holding the screen — a failed refetch
      // shouldn't leave the board stuck on the interstitial.
      setAwaitingRecap(false);
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
      if (next.server_time) {
        const skew = new Date(next.server_time).getTime() - Date.now();
        // Ignore sub-second noise so this doesn't churn every poll.
        setServerOffsetMs((prev) =>
          Math.abs(skew - prev) > 1000 ? skew : prev,
        );
      }

      // A session just finished — pull fresh history so stats update.
      if (
        completedCount.current !== null &&
        next.completed_count !== completedCount.current
      ) {
        // Hold the board until the finished session is actually in history,
        // otherwise the idle leaderboard flashes up for a second first.
        setAwaitingRecap(true);
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

  /**
   * The end-of-night reveal, active for half an hour after a session ends and
   * only when nothing else is being played. Recomputed off the 10s clock.
   */
  const recap = useMemo(() => {
    if (live) return null;
    if (!history) return null;
    return buildRecap(history, now, RECAP_WINDOW_MS);
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

  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const show = useCallback((card: Card, ms: number) => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    setOverlay(card);
    // Keep the ref in step immediately — the effect above only runs after
    // the commit, and a timer firing in between would see the old value.
    overlayRef.current = card;
    recentIds.current = [card.id, ...recentIds.current].slice(0, RECENT_MEMORY);
    overlayTimer.current = setTimeout(() => {
      setOverlay(null);
      overlayRef.current = null;
    }, ms);
  }, []);

  // ---------- Triggered alerts jump the queue ----------

  useEffect(() => {
    if (!derived) return;
    const t = Date.now();

    const candidates = triggeredCards(derived, t).filter(
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

    /**
     * All the decision-making happens here, NOT inside a setState updater.
     * React may invoke an updater more than once, and this one had side
     * effects — every extra call scheduled another timer, so the gaps
     * accumulated into several competing schedules and stopped being honoured.
     * Current overlay state is read from a ref instead.
     */
    function scheduleNext() {
      if (gapTimer.current) clearTimeout(gapTimer.current);
      gapTimer.current = setTimeout(() => {
        // Don't stomp on an alert that's mid-flight, and let the drawer own
        // the screen while it's open — alerts still interrupt it, filler
        // waits its turn.
        // Read data through refs: this timer outlives its closure, so
        // anything captured above would be minutes out of date.
        const current = derivedRef.current;
        if (overlayRef.current || drawerOpen.current || !current) {
          scheduleNext();
          return;
        }

        const pool = fillerCards(current, Date.now());
        const pick = pickFiller(pool, recentIds.current);
        if (pick) {
          recentIds.current = [pick.id, ...recentIds.current].slice(
            0,
            RECENT_MEMORY,
          );
          setOverlay(pick);
          overlayRef.current = pick;
          if (overlayTimer.current) clearTimeout(overlayTimer.current);
          overlayTimer.current = setTimeout(() => {
            setOverlay(null);
            overlayRef.current = null;
          }, FILLER_MS);
        }
        scheduleNext();
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
      {/* Board is always mounted; overlays sit on top of it. The bottom
          inset keeps the table clear of the ticker, so seats at the front
          of the ellipse aren't sitting behind it. */}
      {/* Board is always mounted; overlays sit on top of it. Full height —
          the buy-in strip is a brief overlay rather than a permanent
          fixture, so nothing needs reserving at the bottom. */}
      <div
        className="h-full transition-opacity duration-500"
        style={{ opacity: overlay ? 0.08 : 1 }}
      >
        <LiveBoard derived={derived} now={now} />
      </div>

      {/* Covers the beat between the session ending and history catching up,
          so the idle leaderboard doesn't flash before the reveal starts. */}
      {awaitingRecap && !recap && !live && (
        <div className="absolute inset-0 z-30 bg-[#051911] flex flex-col items-center justify-center animate-[fadeIn_300ms_ease-out]">
          <div className="text-[#e9c46a] font-black tracking-[0.2em] uppercase text-[clamp(20px,2.4vw,42px)]">
            Counting the chips
          </div>
          <div className="text-white/35 mt-[1.5vh] text-[clamp(14px,1.5vw,26px)]">
            That&apos;s a wrap on tonight
          </div>
        </div>
      )}

      {/* The reveal owns the screen while it's up — no filler, no drawer.
          It's the only thing anyone's looking at. */}
      {recap && <RecapPanels recap={recap} />}

      {drawer && !recap && (
        <PlayerDrawer card={drawer} visible={drawerVisible} />
      )}

      {overlay && !recap && (
        <div
          className={`absolute inset-0 z-40 flex flex-col justify-center bg-[#051911]/95 ${
            // Art alerts bleed to the edges; everything else keeps its padding.
            overlay.artUrl ? "" : "p-[5vh_6vw]"
          }`}
        >
          <ContentCard card={overlay} />
        </div>
      )}

      {/* Above the overlay on purpose. A buy-in is the live moment; filler
          is wallpaper. The strip is additive rather than screen-owning, so
          it can sit on top without hiding anything that matters. */}
      <BuyInTicker live={live} />

      {/* Outranks everything — someone is being told to act. */}
      <ShotClock
        startedAt={
          live?.clock_started_at
            ? new Date(live.clock_started_at).getTime()
            : null
        }
        serverOffsetMs={serverOffsetMs}
      />

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
