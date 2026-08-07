"use client";

import { useMemo } from "react";
import type { Derived } from "@/lib/display/derive";
import { formatINR } from "@/lib/format";

/**
 * A slow crawl along the bottom of the board.
 *
 * Cards are punctuation; this is the pulse. Without it the screen is
 * completely static between filler cards, which on a seven-minute gap reads
 * as broken rather than calm.
 *
 * The content is duplicated end to end and the strip translated by exactly
 * -50%, which is what makes the loop seamless — the second copy is under the
 * cursor the moment the first scrolls off.
 */

export const TICKER_HEIGHT_VH = 8;
/**
 * The shell has 3vh of padding all round. The ticker cancels the bottom of
 * it so the strip runs flush to the screen edge — otherwise there's a black
 * band underneath it, and the board is smaller than it needs to be.
 */
export const SHELL_PAD_VH = 3;

export default function Ticker({ derived }: { derived: Derived | null }) {
  const items = useMemo(() => buildItems(derived), [derived]);
  if (items.length === 0) return null;

  return (
    <div
      className="absolute z-20 overflow-hidden flex items-center border-t border-gold-400/30 bg-[#060d09]/95"
      style={{
        height: `${TICKER_HEIGHT_VH}vh`,
        left: `-${SHELL_PAD_VH}vw`,
        right: `-${SHELL_PAD_VH}vw`,
        bottom: `-${SHELL_PAD_VH}vh`,
      }}
      aria-hidden="true"
    >
      <div
        className="shrink-0 bg-gold-400 text-felt-900 font-bold uppercase tracking-[0.14em] h-full flex items-center"
        style={{ fontSize: "1.7vh", padding: "0 1.6vw" }}
      >
        {derived?.live ? "Tonight" : "Pokeresh"}
      </div>

      <div className="flex-1 overflow-hidden">
        <div
          className="ticker-crawl flex whitespace-nowrap"
          style={{ fontSize: "2.1vh" }}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0">
              {items.map((text, i) => (
                <span key={`${copy}-${i}`} className="flex items-center">
                  <span
                    className="text-white/75"
                    style={{ padding: "0 2.2vw" }}
                  >
                    {text}
                  </span>
                  <span className="text-gold-400/70">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildItems(derived: Derived | null): string[] {
  if (!derived) return [];
  const out: string[] = [];
  const { lifetime, group } = derived;

  // Deliberately no buy-in totals here — every seat already shows its own,
  // and the pot is the biggest number on the screen. The ticker is for
  // context you can't get by looking at the table.
  const active = lifetime.filter((p) => p.isActive);

  const leader = active[0];
  if (leader && leader.totalProfitLoss > 0) {
    out.push(
      `${leader.displayName} leads all time at +${formatINR(leader.totalProfitLoss)}`,
    );
  }
  const bottom = active[active.length - 1];
  if (bottom && bottom.totalProfitLoss < 0 && bottom !== leader) {
    out.push(
      `${bottom.displayName} props up the table at ${formatINR(bottom.totalProfitLoss)}`,
    );
  }

  for (const p of active) {
    if (p.sessions < 3) continue;
    if (p.currentStreak.kind === "win" && p.currentStreak.length >= 2) {
      out.push(`${p.displayName} has won ${p.currentStreak.length} in a row`);
    }
    if (p.currentStreak.kind === "loss" && p.currentStreak.length >= 2) {
      out.push(`${p.displayName} has lost ${p.currentStreak.length} straight`);
    }
    if (p.nightsSinceLastWin !== null && p.nightsSinceLastWin >= 3) {
      out.push(
        `${p.displayName} has not won in ${p.nightsSinceLastWin} nights`,
      );
    }
    if (p.sessions >= 5) {
      out.push(
        `${p.displayName} tops the table ${Math.round((p.timesFirst / p.sessions) * 100)}% of the time`,
      );
    }
  }

  if (group.sessions > 0) {
    out.push(`${group.sessions} nights played here`);
    out.push(`${formatINR(group.totalMoney)} across the table all time`);
  }

  return out;
}
