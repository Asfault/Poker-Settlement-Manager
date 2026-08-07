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

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${formatINR(n)}`;
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
 * Scale jokes.
 *
 * These work precisely because the comparison is ridiculous — the point is
 * the number of zeroes between a home game in Bangalore and a televised
 * final table, not any real equivalence.
 *
 * Figures are public career tournament earnings and are deliberately rounded
 * and hedged ("over"), because they move every time these players cash. If
 * they ever look badly stale, update them here — nothing else reads them.
 */
const PROS: { name: string; usd: number; note: string }[] = [
  { name: "Daniel Negreanu", usd: 50_000_000, note: "in live tournaments" },
  { name: "Bryn Kenney", usd: 60_000_000, note: "in live tournaments" },
  { name: "Phil Ivey", usd: 40_000_000, note: "in live tournaments" },
  { name: "Phil Hellmuth", usd: 30_000_000, note: "in live tournaments" },
];

/** Rough INR per USD. Only ever used for jokes, so precision is irrelevant. */
const USD_INR = 85;
/** What a decent biryani costs. The unit of account round here. */
const BIRYANI_INR = 300;

function comparisonCards(d: Derived): Card[] {
  const out: Card[] = [];
  const { group } = d;
  const active = d.lifetime.filter((p) => p.isActive);

  const leader = active[0];
  if (leader && leader.totalProfitLoss > 0 && leader.sessions >= 3) {
    for (const pro of PROS) {
      const proInr = pro.usd * USD_INR;
      const share = (leader.totalProfitLoss / proInr) * 100;
      out.push({
        id: `pro-${pro.name.replace(/\s+/g, "-").toLowerCase()}`,
        kind: "fact",
        title: "Nearly there",
        body: `${pro.name} has won over $${Math.round(pro.usd / 1_000_000)}m ${pro.note}. ${leader.displayName} is up ${formatINR(leader.totalProfitLoss)}. That's ${share.toFixed(5)}% of the way.`,
        tone: "gold",
        photoUrl: leader.photoUrl,
      });
    }

    // How long at their current rate.
    if (leader.avgProfitLoss > 0) {
      const nights = Math.round(
        (PROS[0].usd * USD_INR) / leader.avgProfitLoss,
      );
      const years = Math.round(nights / 52);
      out.push({
        id: "pro-eta",
        kind: "fact",
        title: "Projected timeline",
        body: `At ${formatINR(Math.round(leader.avgProfitLoss))} a night, ${leader.displayName} catches ${PROS[0].name} in ${years.toLocaleString("en-IN")} years. Assuming everyone keeps turning up.`,
        tone: "gold",
        photoUrl: leader.photoUrl,
      });
    }
  }

  // Losses, denominated in biryani.
  for (const p of active) {
    if (p.sessions < 3 || p.totalProfitLoss >= -BIRYANI_INR * 5) continue;
    const biryanis = Math.round(Math.abs(p.totalProfitLoss) / BIRYANI_INR);
    out.push({
      id: `biryani-${p.playerId}`,
      kind: "fact",
      title: "In real terms",
      body: `${p.displayName} is down ${formatINR(Math.abs(p.totalProfitLoss))} all time. That is ${biryanis} biryanis, handed to this table, for nothing.`,
      tone: "loss",
      photoUrl: p.photoUrl,
    });
  }

  // Hourly rate against doing literally anything else.
  for (const p of active) {
    if (p.profitPerHour === null || p.sessions < 4) continue;
    if (p.profitPerHour >= 0) continue;
    out.push({
      id: `wage-${p.playerId}`,
      kind: "fact",
      title: "Career advice",
      body: `${p.displayName} loses ${formatINR(Math.abs(Math.round(p.profitPerHour)))} an hour here. You could pay someone minimum wage to lose it for you and still come out ahead.`,
      tone: "loss",
      photoUrl: p.photoUrl,
    });
  }

  // Hours, in working weeks.
  if (group.totalHoursPlayed >= 40) {
    const days = (group.totalHoursPlayed / 8).toFixed(0);
    out.push({
      id: "hours-as-work",
      kind: "fact",
      title: "Time well spent",
      body: `${Math.round(group.totalHoursPlayed)} hours have been played at this table. That is ${days} full working days. Nobody has been promoted.`,
      tone: "neutral",
    });
  }

  // The table's total churn, in biryani.
  if (group.totalMoney > 0) {
    out.push({
      id: "table-biryani",
      kind: "fact",
      title: "Money across this table",
      body: `${formatINR(group.totalMoney)} has moved around this table. ${Math.round(group.totalMoney / BIRYANI_INR).toLocaleString("en-IN")} biryanis. And you still order the same one.`,
      tone: "gold",
    });
  }

  // Bracelets.
  if (group.sessions >= 10) {
    out.push({
      id: "bracelets",
      kind: "fact",
      title: "Hardware",
      body: `Phil Hellmuth has won 17 WSOP bracelets. This table has played ${group.sessions} nights and won zero.`,
      tone: "neutral",
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

    // Buy-in history is NOT a card. It lives permanently under each player's
    // nameplate on the board, so it's always visible rather than waiting on
    // a random rotation.

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

    // ---------- The newer, nosier ones ----------

    // Median against mean. Only worth saying when they disagree.
    if (p.sessions >= 5) {
      const med = Math.round(p.medianNight);
      const avg = Math.round(p.avgProfitLoss);
      if (Math.abs(med - avg) >= 500) {
        out.push({
          id: `median-${p.playerId}`,
          kind: "fact",
          title: "One good night is doing a lot of work",
          body:
            avg > med
              ? `${p.displayName} averages ${signed(avg)} a night, but a typical night is ${signed(med)}. One result is carrying the whole record.`
              : `${p.displayName} averages ${signed(avg)}, yet the typical night is ${signed(med)}. One disaster is dragging everything down.`,
          tone: avg > med ? "win" : "loss",
          photoUrl: p.photoUrl,
        });
      }
    }

    // Share of the pot: in versus out.
    if (p.sessions >= 4 && p.potShareOut > 0) {
      const inPct = Math.round(p.potShareIn * 100);
      const outPct = Math.round(p.potShareOut * 100);
      if (inPct !== outPct) {
        out.push({
          id: `share-${p.playerId}`,
          kind: "fact",
          title: "Share of the money",
          body:
            outPct > inPct
              ? `${p.displayName} brings ${inPct}% of the money to the table and leaves with ${outPct}%. Everyone else is funding that.`
              : `${p.displayName} brings ${inPct}% of the money and leaves with ${outPct}%. Thank you for your service.`,
          tone: outPct > inPct ? "win" : "loss",
          photoUrl: p.photoUrl,
        });
      }
    }

    // Rock nights.
    if (p.rockNights.outOf >= 4) {
      const { nights, outOf } = p.rockNights;
      const pct = Math.round((nights / outOf) * 100);
      out.push({
        id: `rock-nights-${p.playerId}`,
        kind: "fact",
        title: pct >= 60 ? "Immovable" : "Rarely satisfied",
        body:
          pct >= 60
            ? `${p.displayName} has survived on one buy-in ${nights} of ${outOf} nights. Either disciplined or asleep.`
            : `${p.displayName} has made it through a night on one buy-in just ${nights} times out of ${outOf}. The chips call.`,
        tone: pct >= 60 ? "win" : "loss",
        photoUrl: p.photoUrl,
      });
    }

    // First to reload.
    if (p.firstToReload.outOf >= 3 && p.firstToReload.nights > 0) {
      const { nights, outOf } = p.firstToReload;
      out.push({
        id: `first-reload-${p.playerId}`,
        kind: "fact",
        title: "First one back in",
        body: `${p.displayName} has been the first to reload on ${nights} of ${outOf} nights. Someone has to break the seal.`,
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    // A drought.
    if (p.nightsSinceLastWin !== null && p.nightsSinceLastWin >= 4) {
      out.push({
        id: `drought-${p.playerId}`,
        kind: "stat",
        title: `Nights since ${p.displayName} won`,
        value: String(p.nightsSinceLastWin),
        subtitle: "But this is the one. Definitely.",
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    // Never won at all, once it stops being bad luck.
    if (p.nightsSinceLastWin === null && p.sessions >= 4) {
      out.push({
        id: `never-won-${p.playerId}`,
        kind: "fact",
        title: "Still waiting",
        body: `${p.displayName} has played ${p.sessions} nights and won none of them. The table thanks you.`,
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    // Best run ever, when it's worth mentioning.
    if (p.longestWinStreak >= 3) {
      out.push({
        id: `best-run-${p.playerId}`,
        kind: "stat",
        title: `${p.displayName}'s best run`,
        value: `${p.longestWinStreak} wins`,
        subtitle: "in a row, and never since",
        tone: "win",
        photoUrl: p.photoUrl,
      });
    }
    if (p.longestLossStreak >= 4) {
      out.push({
        id: `worst-run-${p.playerId}`,
        kind: "stat",
        title: `${p.displayName}'s worst run`,
        value: `${p.longestLossStreak} losses`,
        subtitle: "consecutively, on purpose apparently",
        tone: "loss",
        photoUrl: p.photoUrl,
      });
    }

    // Attendance.
    if (p.sessions >= 5 && p.attendanceRate < 0.6) {
      out.push({
        id: `attendance-${p.playerId}`,
        kind: "fact",
        title: "Hard to book",
        body: `${p.displayName} has turned up to ${Math.round(p.attendanceRate * 100)}% of the nights since they started playing. We do notice.`,
        tone: "neutral",
        photoUrl: p.photoUrl,
      });
    }
    if (p.sessions >= 6 && p.attendanceRate >= 0.95) {
      out.push({
        id: `ever-present-${p.playerId}`,
        kind: "fact",
        title: "Ever present",
        body: `${p.displayName} has been at ${Math.round(p.attendanceRate * 100)}% of nights since their first. No hobbies.`,
        tone: "win",
        photoUrl: p.photoUrl,
      });
    }

    // Table size preference.
    if (
      p.bestTableSize &&
      p.worstTableSize &&
      p.bestTableSize.size !== p.worstTableSize.size &&
      p.sessions >= 6
    ) {
      out.push({
        id: `table-size-${p.playerId}`,
        kind: "fact",
        title: "Picky about company",
        body: `${p.displayName} averages ${signed(Math.round(p.bestTableSize.avg))} at ${p.bestTableSize.size}-handed tables and ${signed(Math.round(p.worstTableSize.avg))} at ${p.worstTableSize.size}. Choose your invitations accordingly.`,
        tone: "neutral",
        photoUrl: p.photoUrl,
      });
    }

    // Times on top.
    if (p.sessions >= 5 && p.timesFirst > 0) {
      out.push({
        id: `on-top-${p.playerId}`,
        kind: "stat",
        title: `${p.displayName} has topped the table`,
        value: `${p.timesFirst}×`,
        subtitle: `out of ${p.sessions} nights · average finish ${p.avgFinishPosition.toFixed(1)}`,
        tone: "win",
        photoUrl: p.photoUrl,
      });
    }

    // Hourly rate.
    if (p.profitPerHour !== null && p.sessions >= 4) {
      const perHour = Math.round(p.profitPerHour);
      out.push({
        id: `per-hour-${p.playerId}`,
        kind: "stat",
        title: `${p.displayName} earns`,
        value: `${signed(perHour)}/hr`,
        subtitle:
          perHour >= 0
            ? "Don't hand in your notice"
            : "You could pay someone less to lose this for you",
        tone: perHour >= 0 ? "win" : "loss",
        photoUrl: p.photoUrl,
      });
    }

    // Volatility, framed as a personality rather than a number.
    if (p.sessions >= 6 && p.volatility > 0) {
      out.push({
        id: `swing-${p.playerId}`,
        kind: "fact",
        title: "Emotional range",
        body: `A typical ${p.displayName} night lands within ${formatINR(Math.round(p.volatility))} either side of their average. Pack accordingly.`,
        tone: "neutral",
        photoUrl: p.photoUrl,
      });
    }
  }

  // ---------- Absurd comparisons ----------
  out.push(...comparisonCards(d));

  // ---------- Comparisons ----------

  if (lifetime.length >= 3) {
    const steady = [...lifetime]
      .filter((p) => p.sessions >= 5)
      .sort((a, b) => a.volatility - b.volatility)[0];
    if (steady) {
      out.push({
        id: "most-consistent",
        kind: "fact",
        title: "The most predictable person here",
        body: `${steady.displayName} swings least from night to night. Whether that's control or cowardice is for them to say.`,
        tone: "neutral",
        photoUrl: steady.photoUrl,
      });
    }

    // Two players almost level all time.
    const ranked = [...lifetime].sort(
      (a, b) => b.totalProfitLoss - a.totalProfitLoss,
    );
    let closest: { a: LifetimeRow; b: LifetimeRow; gap: number } | null = null;
    for (let i = 0; i < ranked.length - 1; i += 1) {
      const gap = Math.abs(
        ranked[i].totalProfitLoss - ranked[i + 1].totalProfitLoss,
      );
      if (closest === null || gap < closest.gap) {
        closest = { a: ranked[i], b: ranked[i + 1], gap };
      }
    }
    if (closest && closest.gap > 0 && closest.gap <= 2000) {
      out.push({
        id: "closest-race",
        kind: "headToHead",
        title: "Too close to call",
        subtitle: `${formatINR(closest.gap)} between them, all time`,
        data: [
          {
            label: closest.a.displayName,
            value: closest.a.totalProfitLoss,
            display: `${closest.a.totalProfitLoss > 0 ? "+" : ""}${formatINR(closest.a.totalProfitLoss)}`,
            photoUrl: closest.a.photoUrl,
            tone: "win",
          },
          {
            label: closest.b.displayName,
            value: closest.b.totalProfitLoss,
            display: `${closest.b.totalProfitLoss > 0 ? "+" : ""}${formatINR(closest.b.totalProfitLoss)}`,
            photoUrl: closest.b.photoUrl,
            tone: "neutral",
          },
        ],
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

  if (group.sessions >= 4) {
    out.push({
      id: "avg-players",
      kind: "stat",
      title: "Average turnout",
      value: group.avgPlayersPerNight.toFixed(1),
      subtitle: "players a night",
      tone: "neutral",
    });

    out.push({
      id: "avg-per-player",
      kind: "stat",
      title: "Brought to the table",
      value: formatINR(Math.round(group.avgPotPerPlayer)),
      subtitle: "per person, per night, on average",
      tone: "gold",
    });
  }

  if (group.rebuyRate > 0) {
    out.push({
      id: "rebuy-rate",
      kind: "fact",
      title: "Discipline, measured",
      body: `${Math.round(group.rebuyRate * 100)}% of player-nights end in at least one reload. The other ${Math.round((1 - group.rebuyRate) * 100)}% went home early.`,
      tone: "neutral",
    });
  }

  if (group.totalHoursPlayed >= 10) {
    out.push({
      id: "hours-played",
      kind: "stat",
      title: "Hours at this table",
      value: `${Math.round(group.totalHoursPlayed)}h`,
      subtitle: `across ${group.sessions} nights, and counting`,
      tone: "gold",
    });
  }

  if (group.biggestTable && group.biggestTable.size >= 5) {
    out.push({
      id: "biggest-table",
      kind: "stat",
      title: "Most people ever squeezed in",
      value: String(group.biggestTable.size),
      subtitle: "elbows were involved",
      tone: "neutral",
    });
  }

  if (group.moneyPerHour !== null && group.sessions >= 3) {
    out.push({
      id: "money-per-hour",
      kind: "fact",
      title: "The rate of exchange",
      body: `${formatINR(Math.round(group.moneyPerHour))} changes hands every hour at this table. Nobody is getting richer.`,
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
 * Gap before the next filler card: 1m, 2m or 4m, averaging about two.
 *
 * This was 2/3/7 when the pool was only ~44 cards and repetition was the
 * problem. The pool is now ~65, so the constraint has gone and the slower
 * gaps just made the board feel dead. The 4-minute option stays so it still
 * gets an occasional rest.
 */
export function nextGapMs(): number {
  const options = [60_000, 120_000, 240_000];
  const weights = [4, 4, 2];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[0];
}
