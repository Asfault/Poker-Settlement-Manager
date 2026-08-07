"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number towards its target instead of snapping to it.
 *
 * The pot is the one figure on the board everyone glances at, and a buy-in
 * currently makes it jump by thousands between one poll and the next. Ticking
 * it up draws the eye to the fact something happened.
 *
 * Uses requestAnimationFrame with an ease-out curve, so it's smooth on a TV
 * and costs nothing when the value isn't moving. Falls back to the raw value
 * for anyone who's asked for reduced motion.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const from = fromRef.current;
    if (reduced || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const start = performance.now();

    function step(t: number) {
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutCubic — fast off the mark, settles gently.
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      if (p < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      // Land on the target so an interrupted run never leaves a stale figure.
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}
