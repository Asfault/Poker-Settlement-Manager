import { formatINR } from "@/lib/format";

/** Green up, red down, muted at zero — the board's one colour rule for money. */
export function plColor(n: number): string {
  return n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "rgba(255,255,255,0.6)";
}

/** "+₹6,500" / "-₹2,300" / "₹0". */
export function signedINR(n: number): string {
  return `${n > 0 ? "+" : ""}${formatINR(n)}`;
}
