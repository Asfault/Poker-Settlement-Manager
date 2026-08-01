import type { Derived, LifetimeRow } from "./derive";
import { formatINR } from "@/lib/format";

/**
 * The content catalogue.
 *
 * Two pools:
 *  - TRIGGERED fire on live events and interrupt whatever's showing
 *  - FILLER rotates in the gaps between buy-ins
 *
 * Each item declares what it needs, so anything without enough data to be
 * interesting simply doesn't appear. Adding a new fact is one entry here.
 */

export type CardKind =
  | "alert"
  | "stat"
  | "leaderboard"
  | "pie"
  | "bar"
  | "fact"
  | "headToHead"
  | "spotlight";

export interface CardDatum {
  label: string;
  value: number;
  /** Formatted for display; falls back to the raw value. */
  display?: string;
  photoUrl?: string | null;
  tone?: "win" | "loss" | "neutral" | "gold";
}

export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  /** Big single value, for stat and alert cards. */
  value?: string;
  body?: string;
  tone?: "win" | "loss" | "neutral" | "gold";
  data?: CardDatum[];
  photoUrl?: string | null;
  /** Higher wins when several triggers fire at once. */
  priority?: number;
}

const WEEKDAY = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

function hours(ms: number): string {
  const h = ms / 3600000;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(ms / 60000)}m`;
}

// ============================================================
//  Triggered — fire on live events
// ============================================================

export function triggeredCards(d: Derived): Card[] {
  const out: Card[] = [];
  const live = d.live;
  if (!live) return out;

  // On tilt. The id is keyed on when the episode began, not the buy-in
  // count, so reloading a third and fourth time doesn't re-fire the alert.
  for (const r of live.rows) {
    if (r.tilted && r.tiltStartedAt !== null) {
      out.push({
        id: `tilt-${r.playerId}-${r.tiltStartedAt}`,
        kind: "alert",
        title: `${r.displayName.toUpperCase()} IS ON TILT`,
        body: `${r.recentBuyIns} buy-ins in 15 minutes. Someone take the cards away.`,
        tone: "loss",
        photoUrl: r.characterUrl ?? r.photoUrl,
        priority: 100,
      });
    }
  }

  // Deepest pockets tonight.
  const deepest = [...live.rows].sort((a, b) => b.totalBuyIn - a.totalBuyIn)[0];
  if (deepest && deepest.buyInCount >= 3) {
    out.push({
      id: `atm-${deepest.playerId}-${deepest.buyInCount}`,
      kind: "alert",
      title: `${deepest.displayName.toUpperCase()} IS THE ATM`,
      body: `${formatINR(deepest.totalBuyIn)} across ${deepest.buyInCount} buy-ins tonight.`,
      tone: "gold",
      photoUrl: deepest.photoUrl,
      priority: 70,
    });
  }

  // Pot milestones, every 25k.
  const milestone = Math.floor(live.pot / 25000) * 25000;
  if (milestone >= 25000) {
    out.push({
      id: `pot-${milestone}`,
      kind: "alert",
      title: `${formatINR(milestone)} ON THIS TABLE`,
      body: "And climbing.",
      tone: "gold",
      priority: 60,
    });
  }

  // Still hasn't rebought.
  const rocks = live.rows.filter((r) => r.buyInCount === 1);
  const others = live.rows.filter((r) => r.buyInCount > 1);
  if (rocks.length === 1 && others.length >= 3) {
    const rock = rocks[0];
    out.push({
      id: `rock-${rock.playerId}-${others.length}`,
      kind: "alert",
      title: `${rock.displayName.toUpperCase()} HASN'T REBOUGHT`,
      body: "Everyone else has. Make of that what you will.",
      tone: "win",
      photoUrl: rock.photoUrl,
      priority: 50,
    });
  }

  return out;
}

// ============================================================
//  Filler — rotates when nothing's happening
// ============================================================

export function fillerCards(d: Derived): Card[] {
  const out: Card[] = [];
  const { lifetime, group, live } = d;

  // ---------- Tonight ----------

  if (live && live.rows.length > 0 && live.pot > 0) {
    out.push({
      id: "tonight-split",
      kind: "pie",
      title: "Tonight's buy-ins",
      subtitle: `${formatINR(live.pot)} on the table`,
      data: live.rows
        .filter((r) => r.totalBuyIn > 0)
        .map((r) => ({
          label: r.displayName,
          value: r.totalBuyIn,
          display: formatINR(r.totalBuyIn),
          photoUrl: r.photoUrl,
        })),
    });

    const totalBuyIns = live.rows.reduce((s, r) => s + r.buyInCount, 0);
    out.push({
      id: "tonight-count",
      kind: "stat",
      title: "Buy-ins tonight",
      value: String(totalBuyIns),
      subtitle: `across ${live.playerCount} players`,
      tone: "gold",
    });

    const elapsed = Date.now() - live.startedAt;
    if (elapsed > 20 * 60 * 1000) {
      out.push({
        id: "tonight-elapsed",
        kind: "stat",
        title: "Playing for",
        value: hours(elapsed),
        subtitle:
          group.avgDurationMs !== null
            ? `average night is ${hours(group.avgDurationMs)}`
            : undefined,
        tone: "neutral",
      });
    }
  }

  // ---------- Lifetime leaderboards ----------

  if (lifetime.length >= 2) {
    out.push({
      id: "all-time-pl",
      kind: "leaderboard",
      title: "All-time profit",
      subtitle: `${group.sessions} sessions`,
      data: lifetime.map((p) => ({
        label: p.displayName,
        value: p.totalProfitLoss,
        display: `${p.totalProfitLoss > 0 ? "+" : ""}${formatINR(p.totalProfitLoss)}`,
        photoUrl: p.photoUrl,
        tone:
          p.totalProfitLoss > 0
            ? "win"
            : p.totalProfitLoss < 0
              ? "loss"
              : "neutral",
      })),
    });

    const byRate = [...lifetime]
      .filter((p) => p.sessions >= 2)
      .sort((a, b) => b.winRate - a.winRate);
    if (byRate.length >= 2) {
      out.push({
        id: "win-rate",
        kind: "bar",
        title: "Win rate",
        data: byRate.map((p) => ({
          label: p.displayName,
          value: Math.round(p.winRate * 100),
          display: `${Math.round(p.winRate * 100)}%`,
          photoUrl: p.photoUrl,
          tone: "gold",
        })),
      });
    }

    const byVolume = [...lifetime].sort((a, b) => b.totalBuyIn - a.totalBuyIn);
    out.push({
      id: "money-through",
      kind: "bar",
      title: "Money put on the table",
      subtitle: "All time",
      data: byVolume.map((p) => ({
        label: p.displayName,
        value: p.totalBuyIn,
        display: formatINR(p.totalBuyIn),
        photoUrl: p.photoUrl,
        tone: "gold",
      })),
    });
  }

  // ---------- Per-player facts ----------

  for (const p of lifetime) {
    if (p.sessions >= 1 && p.biggestWin > 0) {
      out.push({
        id: `best-night-${p.playerId}`,
        kind: "spotlight",
        title: `${p.displayName}'s best night`,
        value: `+${formatINR(p.biggestWin)}`,
        subtitle: "Personal record",
        tone: "win",
        photoUrl: p.photoUrl,
      });
    }
    if (p.biggestLoss < 0) {
      out.push({
        id: `worst-night-${p.playerId}`,
        kind: "spotlight",
        title: `${p.displayName}'s worst night`,
        value: formatINR(p.biggestLoss),
        subtitle: "We don't talk about it",
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    // Perfect record on a tiny sample — the joke writes itself.
    if (p.sessions >= 1 && p.sessions <= 3 && p.wins === p.sessions) {
      out.push({
        id: `undefeated-${p.playerId}`,
        kind: "fact",
        title: "Did you know?",
        body: `${p.displayName} has a 100% win rate. Across ${p.sessions} game${p.sessions === 1 ? "" : "s"}.`,
        tone: "win",
        photoUrl: p.photoUrl,
      });
    }
    if (p.sessions >= 1 && p.sessions <= 3 && p.losses === p.sessions) {
      out.push({
        id: `winless-${p.playerId}`,
        kind: "fact",
        title: "Did you know?",
        body: `${p.displayName} has never won. ${p.sessions} game${p.sessions === 1 ? "" : "s"}, ${p.sessions} loss${p.sessions === 1 ? "" : "es"}.`,
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    if (p.currentStreak.kind === "win" && p.currentStreak.length >= 3) {
      out.push({
        id: `hot-${p.playerId}`,
        kind: "fact",
        title: "On a heater",
        body: `${p.displayName} has won ${p.currentStreak.length} in a row.`,
        tone: "win",
        photoUrl: p.photoUrl,
      });
    }
    if (p.currentStreak.kind === "loss" && p.currentStreak.length >= 3) {
      out.push({
        id: `cold-${p.playerId}`,
        kind: "fact",
        title: "Ice cold",
        body: `${p.displayName} has lost ${p.currentStreak.length} straight. Thoughts and prayers.`,
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    if (p.sessions >= 3 && p.totalProfitLoss < 0) {
      out.push({
        id: `donated-${p.playerId}`,
        kind: "fact",
        title: "Generous contributor",
        body: `${p.displayName} has donated ${formatINR(Math.abs(p.totalProfitLoss))} to this table across ${p.sessions} nights.`,
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    if (p.sessions >= 4) {
      const perNight = Math.round(p.avgProfitLoss);
      out.push({
        id: `pace-${p.playerId}`,
        kind: "fact",
        title: "At this rate",
        body:
          perNight >= 0
            ? `${p.displayName} averages +${formatINR(perNight)} a night. Twice a week, that's ${formatINR(perNight * 104)} a year.`
            : `${p.displayName} averages ${formatINR(perNight)} a night. Twice a week, that's ${formatINR(perNight * 104)} a year. Sleep well.`,
        tone: perNight >= 0 ? "win" : "loss",
        photoUrl: p.photoUrl,
      });
    }

    if (p.totalBuyInCount >= 10) {
      out.push({
        id: `rebuys-${p.playerId}`,
        kind: "stat",
        title: `${p.displayName}'s buy-ins`,
        value: String(p.totalBuyInCount),
        subtitle: `across ${p.sessions} sessions`,
        tone: "gold",
        photoUrl: p.photoUrl,
      });
    }
  }

  // ---------- Head to head ----------

  if (lifetime.length >= 2) {
    const top = lifetime[0];
    const bottom = lifetime[lifetime.length - 1];
    if (top.playerId !== bottom.playerId && top.totalProfitLoss > 0) {
      out.push({
        id: "h2h-top-bottom",
        kind: "headToHead",
        title: "The gap",
        data: [
          {
            label: top.displayName,
            value: top.totalProfitLoss,
            display: `+${formatINR(top.totalProfitLoss)}`,
            photoUrl: top.photoUrl,
            tone: "win",
          },
          {
            label: bottom.displayName,
            value: bottom.totalProfitLoss,
            display: formatINR(bottom.totalProfitLoss),
            photoUrl: bottom.photoUrl,
            tone: "loss",
          },
        ],
        subtitle: `${formatINR(top.totalProfitLoss - bottom.totalProfitLoss)} between them`,
      });
    }
  }

  // ---------- Group facts ----------

  if (group.sessions >= 1) {
    out.push({
      id: "total-money",
      kind: "stat",
      title: "Money across this table",
      value: formatINR(group.totalMoney),
      subtitle: `over ${group.sessions} session${group.sessions === 1 ? "" : "s"}`,
      tone: "gold",
    });

    out.push({
      id: "biggest-pot",
      kind: "stat",
      title: "Biggest pot ever",
      value: formatINR(group.biggestPot),
      subtitle: `average is ${formatINR(group.avgPot)}`,
      tone: "gold",
    });
  }

  if (group.sessions >= 3 && group.busiestWeekday !== null) {
    const count = group.byWeekday[group.busiestWeekday];
    out.push({
      id: "busiest-day",
      kind: "fact",
      title: "Did you know?",
      body: `We mostly play on ${WEEKDAY[group.busiestWeekday]} — ${count} of ${group.sessions} sessions. Why is that?`,
      tone: "neutral",
    });
  }

  if (group.sessions >= 3) {
    out.push({
      id: "weekday-spread",
      kind: "bar",
      title: "When we play",
      data: group.byWeekday
        .map((n, i) => ({
          label: WEEKDAY[i].slice(0, 3),
          value: n,
          display: String(n),
          tone: "gold" as const,
        }))
        .filter((x) => x.value > 0),
    });
  }

  if (group.avgDurationMs !== null && group.sessions >= 2) {
    out.push({
      id: "avg-length",
      kind: "stat",
      title: "Average session",
      value: hours(group.avgDurationMs),
      subtitle: "from first buy-in to final count",
      tone: "neutral",
    });
  }

  if (group.totalBuyInCount >= 20) {
    out.push({
      id: "total-buyins",
      kind: "stat",
      title: "Buy-ins all time",
      value: String(group.totalBuyInCount),
      subtitle: `${(group.totalBuyInCount / Math.max(1, group.sessions)).toFixed(1)} per session`,
      tone: "gold",
    });
  }

  if (group.firstSession !== null && group.sessions >= 5) {
    const days = Math.round((Date.now() - group.firstSession) / 86400000);
    if (days > 0) {
      out.push({
        id: "since",
        kind: "fact",
        title: "Since day one",
        body: `${group.sessions} sessions in ${days} days. That's a game every ${(days / group.sessions).toFixed(1)} days.`,
        tone: "neutral",
      });
    }
  }

  return out;
}

/** Pick a filler card, avoiding anything shown recently. */
export function pickFiller(
  cards: Card[],
  recentIds: string[],
): Card | null {
  if (cards.length === 0) return null;
  const fresh = cards.filter((c) => !recentIds.includes(c.id));
  const pool = fresh.length > 0 ? fresh : cards;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Gap before the next filler card: 30s, 1m, 2m or 10m. */
export function nextGapMs(): number {
  const options = [30_000, 60_000, 120_000, 600_000];
  const weights = [4, 4, 3, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[0];
}
