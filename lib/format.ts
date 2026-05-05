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
