"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Persist a piece of state in localStorage.
 *
 * - Reads the initial value on mount (avoids SSR mismatch).
 * - Writes on every change.
 * - Returns the same shape as useState.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>, { hydrated: boolean }] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const isFirst = useRef(true);

  // Load once after mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore corrupted state — fall back to initial
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist on changes (skip the very first render so we don't clobber
  // stored data with the initial value before hydration finishes).
  useEffect(() => {
    if (!hydrated) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage may be full / disabled — fail silently
    }
  }, [key, value, hydrated]);

  return [value, setValue, { hydrated }];
}
