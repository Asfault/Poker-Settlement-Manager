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
