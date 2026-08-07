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
  /**
   * Character artwork, when the player has any. Alerts render this full-bleed
   * behind the text rather than as a thumbnail — same asset, far more impact
   * from across a room. Kept separate from photoUrl so the card can choose a
   * layout rather than guessing what it was handed.
   */
  artUrl?: string | null;
  /** Higher wins when several triggers fire at once. */
  priority?: number;
  /**
   * When the event behind this alert happened. Anything that can't get on
   * screen soon after is dropped rather than queued — "Ram is on tilt" ten
   * minutes late is just confusing.
   */
  at?: number;
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

export function triggeredCards(d: Derived, now = Date.now()): Card[] {
  const out: Card[] = [];
  const live = d.live;
  if (!live) return out;

  /** Most recent buy-in across the table — the "now" for table-wide alerts. */
  const lastAny = Math.max(
    0,
    ...live.rows.map((r) => r.lastBuyInAt ?? 0),
  );

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
        photoUrl: r.photoUrl,
        artUrl: r.characterUrl,
        priority: 100,
        at: r.tiltStartedAt,
      });
    }
  }

  // Deepest pockets tonight. Keyed on the player alone — fires once for
  // them, and again only if someone else takes the title later.
  const deepest = [...live.rows].sort((a, b) => b.totalBuyIn - a.totalBuyIn)[0];
  if (deepest && deepest.buyInCount >= 3) {
    out.push({
      id: `atm-${deepest.playerId}`,
      kind: "alert",
      title: `${deepest.displayName.toUpperCase()} IS THE ATM`,
      body: `${formatINR(deepest.totalBuyIn)} across ${deepest.buyInCount} buy-ins tonight.`,
      tone: "gold",
      photoUrl: deepest.photoUrl,
      artUrl: deepest.characterUrl,
      priority: 70,
      at: deepest.lastBuyInAt ?? undefined,
    });
  }

  // Cards are in the air.
  const totalBuyIns = live.rows.reduce((s, r) => s + r.buyInCount, 0);
  if (totalBuyIns >= 1) {
    out.push({
      id: `underway-${live.sessionId}`,
      kind: "alert",
      title: "WE'RE UNDERWAY",
      body: `${live.playerCount} at the table. Good luck.`,
      tone: "gold",
      priority: 40,
      at: live.startedAt,
    });
  }

  // First person to go back in.
  const reloaded = live.rows.filter((r) => r.buyInCount > 1);
  if (reloaded.length === 1) {
    const first = reloaded[0];
    out.push({
      id: `first-rebuy-${live.sessionId}`,
      kind: "alert",
      title: "FIRST REBUY OF THE NIGHT",
      body: `${first.displayName} is back in for more.`,
      tone: "loss",
      photoUrl: first.photoUrl,
      artUrl: first.characterUrl,
      priority: 65,
      at: first.lastBuyInAt ?? undefined,
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
      at: lastAny || undefined,
    });
  }

  // Still hasn't rebought.
  const rocks = live.rows.filter((r) => r.buyInCount === 1);
  const others = live.rows.filter((r) => r.buyInCount > 1);
  if (rocks.length === 1 && others.length >= 3) {
    const rock = rocks[0];
    out.push({
      id: `rock-${rock.playerId}`,
      kind: "alert",
      title: `${rock.displayName.toUpperCase()} HASN'T REBOUGHT`,
      body: "Everyone else has. Make of that what you will.",
      tone: "win",
      photoUrl: rock.photoUrl,
      artUrl: rock.characterUrl,
      priority: 50,
      at: lastAny || undefined,
    });
  }

  // The inverse: nobody survived. Fires once, on the buy-in that completed it.
  if (
    live.rows.length >= 3 &&
    rocks.length === 0 &&
    live.rows.every((r) => r.buyInCount > 1)
  ) {
    out.push({
      id: `all-in-again-${live.sessionId}`,
      kind: "alert",
      title: "EVERYONE HAS RELOADED",
      body: "Not a single survivor from the first buy-in.",
      tone: "loss",
      priority: 55,
      at: lastAny || undefined,
    });
  }

  // ---------- Time-based ----------
  //
  // These key their id on the threshold they crossed, not on the clock, so
  // each fires exactly once per episode rather than every second.

  const elapsed = now - live.startedAt;

  // Quiet table. Only interesting once the night is properly underway, and
  // only if somebody has actually bought in.
  const QUIET_MS = 30 * 60 * 1000;
  if (lastAny > 0 && elapsed > QUIET_MS && now - lastAny > QUIET_MS) {
    const quietBlocks = Math.floor((now - lastAny) / QUIET_MS);
    out.push({
      id: `quiet-${live.sessionId}-${quietBlocks}`,
      kind: "alert",
      title: "THE TABLE HAS GONE QUIET",
      body: `No buy-ins for ${hours(now - lastAny)}. Someone's card-dead, or everyone's playing well.`,
      tone: "neutral",
      priority: 30,
      // Dated to the moment it became true, so a stale one is discarded.
      at: lastAny + quietBlocks * QUIET_MS,
    });
  }

  // Hour markers. Only past the third hour — before that it's just a clock.
  const hoursIn = Math.floor(elapsed / 3600000);
  if (hoursIn >= 3) {
    const avg = d.group.avgDurationMs;
    const pastAverage = avg !== null && elapsed > avg;
    out.push({
      id: `hour-${live.sessionId}-${hoursIn}`,
      kind: "alert",
      title: `${hoursIn} HOURS IN`,
      body: pastAverage
        ? `Longer than the usual ${hours(avg!)} already.`
        : "And still going.",
      tone: "gold",
      priority: 35,
      at: live.startedAt + hoursIn * 3600000,
    });
  }

  // Late night. Keyed on the hour so it fires once at 1am, once at 2am.
  const hourOfDay = new Date(now).getHours();
  if (hourOfDay >= 1 && hourOfDay <= 4) {
    const stamp = new Date(now);
    stamp.setMinutes(0, 0, 0);
    out.push({
      id: `latenight-${live.sessionId}-${hourOfDay}`,
      kind: "alert",
      title: `IT'S ${hourOfDay}AM`,
      body: "Nobody has gone home. Respect, or concern.",
      tone: "neutral",
      priority: 25,
      at: stamp.getTime(),
    });
  }

  // A debut, fired on their first buy-in rather than at session start — an
  // alert has to be about a moment, or the 60s age limit discards it.
  const played = new Set(
    d.lifetime.filter((p) => p.sessions > 0).map((p) => p.playerId),
  );
  for (const r of live.rows) {
    if (played.has(r.playerId)) continue;
    if (r.buyInCount !== 1 || r.lastBuyInAt === null) continue;
    out.push({
      id: `debut-${r.playerId}`,
      kind: "alert",
      title: `${r.displayName.toUpperCase()}'S FIRST NIGHT`,
      body: "Everyone's first game is their best game. Allegedly.",
      tone: "gold",
      photoUrl: r.photoUrl,
      artUrl: r.characterUrl,
      priority: 75,
      at: r.lastBuyInAt,
    });
  }

  return out;
}

/**
 * Milestones are facts about the whole night, not moments — "game number 50"
 * is as true at 2am as it was at 9pm. They live in filler rather than as
 * alerts, because an alert dated to session start would be discarded by
 * ALERT_MAX_AGE_MS unless the TV happened to be switched on in the first
 * minute.
 */
function milestoneCards(d: Derived, now: number): Card[] {
  const out: Card[] = [];
  if (!d.live) return out;

  // group.sessions counts completed games, so tonight is the one after that.
  const sessionNumber = d.group.sessions + 1;
  if (sessionNumber >= 10 && sessionNumber % 10 === 0) {
    out.push({
      id: `milestone-session-${sessionNumber}`,
      kind: "stat",
      title: "Tonight is game number",
      value: String(sessionNumber),
      subtitle: "This table has seen things",
      tone: "gold",
    });
  }

  if (d.group.firstSession !== null) {
    const years = Math.floor((now - d.group.firstSession) / (365 * 86400000));
    const anniversary = d.group.firstSession + years * 365 * 86400000;
    if (years >= 1 && now - anniversary < 86400000) {
      out.push({
        id: `anniversary-${years}`,
        kind: "fact",
        title: years === 1 ? "One year of this" : `${years} years of this`,
        body: `${d.group.sessions} nights since the first game, and nobody has learned anything.`,
        tone: "gold",
      });
    }
  }

  return out;
}

// ============================================================
//  Filler — rotates when nothing's happening
// ============================================================

export function fillerCards(d: Derived, now = Date.now()): Card[] {
  const out: Card[] = [...milestoneCards(d, now)];
  const { group, live } = d;

  // Archived players keep their place in the leaderboard and in history,
  // but stop generating facts — nobody wants nightly trivia about someone
  // who stopped coming.
  const activeIds = new Set(live?.rows.map((r) => r.playerId) ?? []);
  const lifetime = d.lifetime.filter(
    (p) => p.isActive || activeIds.has(p.playerId),
  );

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

/**
 * Gap before the next filler card: 2m, 3m or 7m, averaging about 3 minutes.
 *
 * Deliberately slower than it looks like it should be. The pool is roughly 50
 * cards; at the old ~110s average every card showed twice a night and the
 * board felt repetitive by hour three. Buy-in notifications and triggered
 * alerts are what make it feel alive — filler is the quiet in between, and
 * the 7-minute option exists so the board genuinely rests.
 */
export function nextGapMs(): number {
  const options = [120_000, 180_000, 420_000];
  const weights = [4, 3, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[0];
}
