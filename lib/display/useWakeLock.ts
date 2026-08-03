"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while the display board is up.
 *
 * The board is meant to sit on a TV all night without being touched, which is
 * exactly the condition every device treats as "idle, go to sleep".
 *
 * Two things to know about the Wake Lock API:
 *
 *  - The lock is released automatically whenever the page is hidden — tab
 *    switched, screen locked, app backgrounded. It is NOT restored on return,
 *    so it has to be re-requested on every `visibilitychange`. Requesting once
 *    at mount looks like it works and then quietly stops after the first time
 *    anyone switches away.
 *  - It only controls the device running the browser. A TV with its own
 *    inactivity timer will still sleep on schedule, and no web API can stop
 *    it — that one is a settings change on the TV.
 *
 * Unsupported browsers are a no-op rather than an error. Nothing here is
 * load-bearing; the board works fine, the screen just dims.
 */

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

export function useWakeLock(enabled: boolean = true) {
  const sentinel = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<WakeLockSentinelLike>;
      };
    };
    if (!nav.wakeLock) return;

    let cancelled = false;

    async function acquire() {
      // Only meaningful while visible; the request throws otherwise.
      if (document.visibilityState !== "visible") return;
      if (sentinel.current && !sentinel.current.released) return;
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel.current = lock;
        // Fires when the browser drops it for us — re-acquire on the next
        // visibility change rather than assuming we still hold it.
        lock.addEventListener("release", () => {
          if (sentinel.current === lock) sentinel.current = null;
        });
      } catch {
        // Denied, or the tab lost visibility mid-request. Harmless.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const lock = sentinel.current;
      sentinel.current = null;
      if (lock && !lock.released) lock.release().catch(() => {});
    };
  }, [enabled]);
}
