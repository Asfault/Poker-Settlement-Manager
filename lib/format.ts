/**
 * Format an integer rupee amount in Indian style with the ₹ symbol.
 * Negative values are formatted as `-₹X` (sign before the symbol).
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${rounded < 0 ? "-" : ""}₹${formatted}`;
}

/**
 * Compact rupees for tight spaces: 5000 → "5k", 2500 → "2.5k", 500 → "500".
 *
 * Used where a chain of amounts has to fit in a cell sized for one number —
 * the buy-in history on the summary image. Deliberately drops the ₹, because
 * the column it sits under already says what the numbers are.
 */
export function shortINR(amount: number): string {
  const n = Math.round(amount);
  if (Math.abs(n) < 1000) return String(n);
  const k = n / 1000;
  // One decimal only when it isn't a whole thousand.
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** Time of day for the board, e.g. "9:12 pm". */
export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Human-readable gap between two timestamps, e.g. "4h 20m".
 * Used for session length stats.
 */
export function formatDuration(startMs: number, endMs: number): string {
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a date as a friendly local string suitable for the summary card. */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
