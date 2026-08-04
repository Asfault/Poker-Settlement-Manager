// Derived stats rules, mirroring lib/stats/extra.ts.
// Run with: node __tests__/stats.test.mjs

// ---------- mirrored helpers ----------

function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function nightsSinceLastWin(results) {
  let count = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] > 0) return count;
    count += 1;
  }
  return null;
}

function stdDev(xs) {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function currentStreak(results) {
  if (results.length === 0) return null;
  const last = results[results.length - 1];
  let len = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) {
    len += 1;
  }
  return { type: last > 0 ? "W" : last < 0 ? "L" : "E", length: len };
}

function longestRun(results, value) {
  let best = 0;
  let run = 0;
  for (const r of results) {
    if (r === value) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function computeRecords(sessions) {
  const out = {
    biggestWin: null,
    biggestLoss: null,
    biggestPot: null,
    longestSession: null,
    mostBuyIns: null,
  };
  for (const s of sessions) {
    if (out.biggestPot === null || s.pot > out.biggestPot.amount) {
      out.biggestPot = { at: s.startedAt, amount: s.pot };
    }
    if (
      !s.isBackfill &&
      s.durationMs !== null &&
      s.durationMs > 0 &&
      (out.longestSession === null || s.durationMs > out.longestSession.ms)
    ) {
      out.longestSession = { at: s.startedAt, ms: s.durationMs };
    }
    for (const p of s.players) {
      if (out.biggestWin === null || p.profitLoss > out.biggestWin.amount) {
        out.biggestWin = { name: p.name, amount: p.profitLoss };
      }
      if (out.biggestLoss === null || p.profitLoss < out.biggestLoss.amount) {
        out.biggestLoss = { name: p.name, amount: p.profitLoss };
      }
      if (
        !s.isBackfill &&
        (out.mostBuyIns === null || p.buyInCount > out.mostBuyIns.amount)
      ) {
        out.mostBuyIns = { name: p.name, amount: p.buyInCount };
      }
    }
  }
  return out;
}

function computeGroupExtras(sessions) {
  let playerNights = 0;
  let buyInCount = 0;
  let rebuyNights = 0;
  let realBuyInNights = 0;
  let fees = 0;
  let pot = 0;
  let durationMs = 0;
  let durationCount = 0;
  let assumed = 0;
  for (const s of sessions) {
    playerNights += s.players.length;
    pot += s.pot;
    if (s.durationMs !== null && s.durationMs > 0) {
      durationMs += s.durationMs;
      durationCount += 1;
      if (s.isBackfill) assumed += 1;
    }
    const paying = s.players.filter((p) => p.playerId !== s.hostPlayerId).length;
    fees += s.houseFeePerPlayer * paying;
    for (const p of s.players) {
      buyInCount += p.buyInCount;
      if (!s.isBackfill) {
        realBuyInNights += 1;
        if (p.buyInCount > 1) rebuyNights += 1;
      }
    }
  }
  const n = sessions.length;
  return {
    avgPlayersPerNight: n > 0 ? playerNights / n : 0,
    totalBuyInCount: buyInCount,
    rebuyRate: realBuyInNights > 0 ? rebuyNights / realBuyInNights : 0,
    avgPotPerPlayer: playerNights > 0 ? pot / playerNights : 0,
    houseFeesCollected: fees,
    totalHoursPlayed: durationMs / 3600000,
    avgHoursPlayed: durationCount > 0 ? durationMs / durationCount / 3600000 : 0,
    assumedDurationSessions: assumed,
  };
}

function computePlayerExtras(sessions) {
  const chronological = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const acc = new Map();

  chronological.forEach((s, sessionIndex) => {
    const ranked = [...s.players].sort((a, b) => b.profitLoss - a.profitLoss);

    let earliestReload = Infinity;
    const firstReloaders = new Set();
    if (!s.isBackfill) {
      for (const p of s.players) {
        const firstRebuy = (p.buyInTimes ?? [])[1];
        if (firstRebuy === undefined) continue;
        if (firstRebuy < earliestReload) {
          earliestReload = firstRebuy;
          firstReloaders.clear();
          firstReloaders.add(p.playerId);
        } else if (firstRebuy === earliestReload) {
          firstReloaders.add(p.playerId);
        }
      }
    }
    const anyoneReloaded = firstReloaders.size > 0;

    for (const p of s.players) {
      let e = acc.get(p.playerId);
      if (!e) {
        e = {
          playerId: p.playerId,
          results: [],
          pls: [],
          totalBuyIn: 0,
          totalPl: 0,
          positions: [],
          timesFirst: 0,
          timedProfit: 0,
          timedMs: 0,
          firstIndex: sessionIndex,
          tableSizes: new Map(),
          rebuyOffsets: [],
          rockNights: 0,
          timedNights: 0,
          firstToReload: 0,
          reloadNights: 0,
          shareIn: [],
          shareOut: [],
        };
        acc.set(p.playerId, e);
      }
      if (!s.isBackfill) {
        e.timedNights += 1;
        if (p.buyInCount === 1) e.rockNights += 1;
        if (anyoneReloaded) {
          e.reloadNights += 1;
          if (firstReloaders.has(p.playerId)) e.firstToReload += 1;
        }
      }
      if (s.pot > 0) {
        e.shareIn.push(p.totalBuyIn / s.pot);
        e.shareOut.push(p.chipsLeft / s.pot);
      }
      const size = s.players.length;
      const bucket = e.tableSizes.get(size) ?? { sessions: 0, total: 0 };
      bucket.sessions += 1;
      bucket.total += p.profitLoss;
      e.tableSizes.set(size, bucket);
      if (!s.isBackfill) {
        for (const t of (p.buyInTimes ?? []).slice(1)) {
          const minutes = (t - s.startedAt) / 60000;
          if (minutes >= 0) e.rebuyOffsets.push(minutes);
        }
      }
      e.results.push(p.profitLoss > 0 ? 1 : p.profitLoss < 0 ? -1 : 0);
      e.pls.push(p.profitLoss);
      e.totalBuyIn += p.totalBuyIn;
      e.totalPl += p.profitLoss;
      const position =
        ranked.findIndex((r) => r.profitLoss === p.profitLoss) + 1;
      e.positions.push(position);
      if (position === 1) e.timesFirst += 1;
      if (s.durationMs !== null && s.durationMs > 0) {
        e.timedProfit += p.profitLoss;
        e.timedMs += s.durationMs;
      }
    }
  });

  const totalSessions = chronological.length;
  return [...acc.values()].map((e) => {
    return {
      playerId: e.playerId,
      roi: e.totalBuyIn > 0 ? e.totalPl / e.totalBuyIn : 0,
      currentStreak: currentStreak(e.results),
      longestWinStreak: longestRun(e.results, 1),
      longestLossStreak: longestRun(e.results, -1),
      avgFinishPosition: mean(e.positions),
      timesFirst: e.timesFirst,
      profitPerHour: e.timedMs > 0 ? e.timedProfit / (e.timedMs / 3600000) : null,
      volatility: stdDev(e.pls),
      attendanceRate:
        totalSessions - e.firstIndex > 0
          ? e.results.length / (totalSessions - e.firstIndex)
          : 0,
      medianNight: median(e.pls),
      nightsSinceLastWin: nightsSinceLastWin(e.results),
      byTableSize: [...e.tableSizes.entries()]
        .map(([size, v]) => ({
          size,
          sessions: v.sessions,
          totalProfitLoss: v.total,
          avgProfitLoss: v.total / v.sessions,
        }))
        .sort((a, b) => a.size - b.size),
      rebuyTiming:
        e.rebuyOffsets.length > 0
          ? { avgMinute: mean(e.rebuyOffsets), samples: e.rebuyOffsets.length }
          : null,
      rockNights: { nights: e.rockNights, outOf: e.timedNights },
      firstToReload: { nights: e.firstToReload, outOf: e.reloadNights },
      potShareIn: mean(e.shareIn),
      potShareOut: mean(e.shareOut),
    };
  });
}

// ---------- harness ----------

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.log(
      `  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`,
    );
    fail += 1;
  }
}
function close(label, actual, expected, eps = 0.0001) {
  if (Math.abs(actual - expected) <= eps) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.log(
      `  FAIL  ${label}\n        expected ${expected}\n        actual   ${actual}`,
    );
    fail += 1;
  }
}

const DAY = 86400000;
function player(id, name, buyIn, chips, buyInCount = 1, buyInTimes = []) {
  return {
    playerId: id,
    name,
    totalBuyIn: buyIn,
    chipsLeft: chips,
    profitLoss: chips - buyIn,
    buyInCount,
    buyInTimes,
  };
}
function session(opts) {
  const players = opts.players;
  return {
    id: opts.id,
    startedAt: opts.startedAt,
    isBackfill: opts.isBackfill ?? false,
    durationMs: opts.durationMs ?? 4 * 3600000,
    houseFeePerPlayer: opts.houseFeePerPlayer ?? 200,
    hostPlayerId: opts.hostPlayerId ?? "host",
    players,
    pot: players.reduce((s, p) => s + p.totalBuyIn, 0),
  };
}

// ---------- streaks ----------

console.log("\nStreaks");
check("current streak counts the trailing run", currentStreak([1, -1, -1, -1]), {
  type: "L",
  length: 3,
});
check("a single result is a streak of one", currentStreak([1]), {
  type: "W",
  length: 1,
});
check("empty history has no streak", currentStreak([]), null);
check("evens form their own streak", currentStreak([1, 0, 0]), {
  type: "E",
  length: 2,
});
check("longest run finds the best, not the last", longestRun([1, 1, 1, -1, 1], 1), 3);
check("longest run is zero when absent", longestRun([-1, -1], 1), 0);
check("a loss run breaks on an even", longestRun([-1, 0, -1, -1], -1), 2);

// ---------- spread ----------

console.log("\nVolatility");
check("no results means no spread", stdDev([]), 0);
check("identical nights have zero spread", stdDev([500, 500, 500]), 0);
close("population standard deviation", stdDev([100, -100]), 100);

// ---------- records ----------

console.log("\nRecords");
{
  const sessions = [
    session({
      id: "a",
      startedAt: 1000 * DAY,
      players: [player("p1", "Ram", 2000, 5000, 2), player("p2", "Sita", 3000, 0, 3)],
    }),
    session({
      id: "b",
      startedAt: 1001 * DAY,
      isBackfill: true,
      durationMs: 0,
      players: [player("p1", "Ram", 9000, 0, 1), player("p2", "Sita", 1000, 10000, 1)],
    }),
  ];
  const r = computeRecords(sessions);
  check("biggest win picks the best single night", r.biggestWin, {
    name: "Sita",
    amount: 9000,
  });
  check("biggest loss picks the worst single night", r.biggestLoss, {
    name: "Ram",
    amount: -9000,
  });
  check("biggest pot is the largest session total", r.biggestPot.amount, 10000);
  check(
    "backfilled nights never win longest session",
    r.longestSession.ms,
    4 * 3600000,
  );
  check(
    "most buy-ins ignores backfill aggregate rows",
    r.mostBuyIns,
    { name: "Sita", amount: 3 },
  );
}

// ---------- group extras ----------

console.log("\nGroup extras");
{
  const sessions = [
    session({
      id: "a",
      startedAt: 1000 * DAY,
      houseFeePerPlayer: 200,
      hostPlayerId: "host",
      players: [
        player("host", "Dhermesh", 2000, 3000, 1),
        player("p1", "Ram", 2000, 1000, 2),
        player("p2", "Sita", 2000, 2000, 1),
      ],
    }),
  ];
  const g = computeGroupExtras(sessions);
  check("host is exempt from their own fee", g.houseFeesCollected, 400);
  close("average players per night", g.avgPlayersPerNight, 3);
  check("total buy-in count sums every player", g.totalBuyInCount, 4);
  close("rebuy rate is share of player-nights with a reload", g.rebuyRate, 1 / 3);
  close("average pot per player", g.avgPotPerPlayer, 2000);
}
{
  const backfilled = [
    session({
      id: "b",
      startedAt: 1000 * DAY,
      isBackfill: true,
      players: [player("p1", "Ram", 5000, 0, 1), player("p2", "Sita", 5000, 10000, 1)],
    }),
  ];
  check(
    "backfill-only history reports no rebuy rate rather than zero percent",
    computeGroupExtras(backfilled).rebuyRate,
    0,
  );
}
{
  // Migration 007 gives backfilled nights an assumed 4h. They count toward
  // hours played, but must stay out of the longest-session record.
  const sessions = [
    session({
      id: "real",
      startedAt: 1000 * DAY,
      durationMs: 6 * 3600000,
      players: [player("p1", "Ram", 1000, 2000), player("p2", "Sita", 1000, 0)],
    }),
    session({
      id: "assumed",
      startedAt: 1001 * DAY,
      isBackfill: true,
      durationMs: 4 * 3600000,
      players: [player("p1", "Ram", 1000, 0), player("p2", "Sita", 1000, 2000)],
    }),
  ];
  const g = computeGroupExtras(sessions);
  close("total hours sums real and assumed alike", g.totalHoursPlayed, 10);
  close("average hours across both", g.avgHoursPlayed, 5);
  check(
    "assumed nights are counted and disclosed",
    g.assumedDurationSessions,
    1,
  );
  check(
    "an assumed duration can never win longest session",
    computeRecords(sessions).longestSession.ms,
    6 * 3600000,
  );
}

// ---------- player extras ----------

console.log("\nPlayer extras");
{
  // Ram and Sita play all four nights; Gita misses the last one.
  // Every night is zero-sum, as a real table would be.
  const sessions = [
    session({
      id: "a",
      startedAt: 1000 * DAY,
      players: [
        player("p1", "Ram", 1000, 2000),
        player("p2", "Sita", 1000, 1000),
        player("p3", "Gita", 1000, 0),
      ],
    }),
    session({
      id: "b",
      startedAt: 1001 * DAY,
      players: [
        player("p1", "Ram", 1000, 0),
        player("p2", "Sita", 1000, 2000),
        player("p3", "Gita", 1000, 1000),
      ],
    }),
    session({
      id: "c",
      startedAt: 1002 * DAY,
      players: [
        player("p1", "Ram", 1000, 0),
        player("p2", "Sita", 1000, 2000),
        player("p3", "Gita", 1000, 1000),
      ],
    }),
    session({
      id: "d",
      startedAt: 1003 * DAY,
      players: [
        player("p1", "Ram", 1000, 500),
        player("p2", "Sita", 1000, 1500),
      ],
    }),
  ];
  const byId = new Map(computePlayerExtras(sessions).map((e) => [e.playerId, e]));
  const ram = byId.get("p1");
  const sita = byId.get("p2");
  const gita = byId.get("p3");

  close("ROI is profit over money staked", ram.roi, -1500 / 4000);
  check("current streak reads the most recent nights", ram.currentStreak, {
    type: "L",
    length: 3,
  });
  check("longest win run", ram.longestWinStreak, 1);
  check("attendance is full for an ever-present player", ram.attendanceRate, 1);
  close(
    "attendance counts only nights since a player's debut",
    gita.attendanceRate,
    0.75,
  );
  check("nights on top are counted", sita.timesFirst, 3);
  close("average finish position", sita.avgFinishPosition, 1.25);
  close(
    "profit per hour uses only timed sessions",
    sita.profitPerHour,
    2500 / 16,
  );
}
{
  // Everyone breaks even — ties share the better position.
  const sessions = [
    session({
      id: "a",
      startedAt: 1000 * DAY,
      players: [player("p1", "Ram", 1000, 1000), player("p2", "Sita", 1000, 1000)],
    }),
  ];
  const byId = new Map(computePlayerExtras(sessions).map((e) => [e.playerId, e]));
  check("tied players both count as first", byId.get("p1").avgFinishPosition, 1);
  check("a tied night is an even, not a win", byId.get("p1").currentStreak, {
    type: "E",
    length: 1,
  });
  check("break-even ROI is zero", byId.get("p2").roi, 0);
}

// ---------- median, drought, table size, rebuy timing ----------

console.log("\nTypical night and drought");
check("median of an odd count is the middle", median([-500, 100, 900]), 100);
check("median of an even count averages the middle two", median([0, 100, 300, 500]), 200);
check("median resists one outlier the mean would chase", median([-100, -100, -100, 9000]), -100);
check("no nights, no median", median([]), 0);
check("won the most recent night", nightsSinceLastWin([-1, 1]), 0);
check("counts nights back to the last win", nightsSinceLastWin([1, -1, -1, 0]), 3);
check("never won returns null", nightsSinceLastWin([-1, 0, -1]), null);
check("no history returns null", nightsSinceLastWin([]), null);

console.log("\nTable size and rebuy timing");
{
  const H = 3600000;
  const start = 1000 * DAY;
  const sessions = [
    // Five-handed, Ram rebuys 90 minutes in.
    session({
      id: "five",
      startedAt: start,
      players: [
        player("p1", "Ram", 2000, 0, 2, [start, start + 1.5 * H]),
        player("p2", "Sita", 1000, 1000),
        player("p3", "Gita", 1000, 1000),
        player("p4", "Mohan", 1000, 1000),
        player("p5", "Leela", 1000, 2000),
      ],
    }),
    // Three-handed, Ram wins and never reloads.
    session({
      id: "three",
      startedAt: start + DAY,
      players: [
        player("p1", "Ram", 1000, 3000, 1, [start + DAY]),
        player("p2", "Sita", 1000, 0),
        player("p3", "Gita", 1000, 0),
      ],
    }),
    // Historical night: one aggregate buy-in row stamped at the start.
    session({
      id: "old",
      startedAt: start + 2 * DAY,
      isBackfill: true,
      players: [
        player("p1", "Ram", 5000, 0, 1, [start + 2 * DAY]),
        player("p2", "Sita", 1000, 6000),
      ],
    }),
  ];
  const ram = computePlayerExtras(sessions).find((e) => e.playerId === "p1");

  check(
    "results are grouped by how many were at the table",
    ram.byTableSize.map((t) => [t.size, t.sessions, t.totalProfitLoss]),
    [
      [2, 1, -5000],
      [3, 1, 2000],
      [5, 1, -2000],
    ],
  );
  close("average per table size", ram.byTableSize[1].avgProfitLoss, 2000);
  close("rebuy timing averages minutes into the night", ram.rebuyTiming.avgMinute, 90);
  check("only actual rebuys are sampled", ram.rebuyTiming.samples, 1);
  check("typical night is the median, not the mean", ram.medianNight, -2000);
}
{
  const start = 1000 * DAY;
  const sessions = [
    session({
      id: "old",
      startedAt: start,
      isBackfill: true,
      players: [
        player("p1", "Ram", 9000, 0, 1, [start]),
        player("p2", "Sita", 1000, 10000, 1, [start]),
      ],
    }),
  ];
  const ram = computePlayerExtras(sessions).find((e) => e.playerId === "p1");
  check(
    "backfilled nights never claim a rebuy at minute zero",
    ram.rebuyTiming,
    null,
  );
}

// ---------- rock nights, reload order, pot share ----------

console.log("\nRock nights and reload order");
{
  const H = 3600000;
  const start = 1000 * DAY;
  const sessions = [
    // Ram reloads at +30m, Sita at +90m. Kula never reloads.
    session({
      id: "one",
      startedAt: start,
      players: [
        player("p1", "Ram", 2000, 0, 2, [start, start + 0.5 * H]),
        player("p2", "Sita", 2000, 4000, 2, [start, start + 1.5 * H]),
        player("p3", "Kula", 1000, 1000, 1, [start]),
      ],
    }),
    // Nobody reloads at all — this night must not count against anyone's
    // reload record, but it is a rock night for all three.
    session({
      id: "two",
      startedAt: start + DAY,
      players: [
        player("p1", "Ram", 1000, 500, 1, [start + DAY]),
        player("p2", "Sita", 1000, 1500, 1, [start + DAY]),
        player("p3", "Kula", 1000, 1000, 1, [start + DAY]),
      ],
    }),
  ];
  const byId = new Map(computePlayerExtras(sessions).map((e) => [e.playerId, e]));

  check("earliest reloader is credited", byId.get("p1").firstToReload, {
    nights: 1,
    outOf: 1,
  });
  check("a later reloader is not", byId.get("p2").firstToReload, {
    nights: 0,
    outOf: 1,
  });
  check(
    "a night nobody reloaded isn't held against anyone",
    byId.get("p3").firstToReload,
    { nights: 0, outOf: 1 },
  );
  check("rock nights count single buy-in nights", byId.get("p3").rockNights, {
    nights: 2,
    outOf: 2,
  });
  check("a reloader gets credit only for the quiet night", byId.get("p1").rockNights, {
    nights: 1,
    outOf: 2,
  });
}
{
  // Backfill collapses buy-ins into one row. Counting it would make the whole
  // table look like rocks and claim nobody ever reloaded.
  const start = 1000 * DAY;
  const sessions = [
    session({
      id: "old",
      startedAt: start,
      isBackfill: true,
      players: [
        player("p1", "Ram", 9000, 0, 1, [start]),
        player("p2", "Sita", 1000, 10000, 1, [start]),
      ],
    }),
  ];
  const ram = computePlayerExtras(sessions).find((e) => e.playerId === "p1");
  check("backfill contributes no rock nights", ram.rockNights, {
    nights: 0,
    outOf: 0,
  });
  check("backfill contributes no reload nights", ram.firstToReload, {
    nights: 0,
    outOf: 0,
  });
}

console.log("\nShare of the pot");
{
  const start = 1000 * DAY;
  // Pot is 4000. Ram puts in 1000 (25%) and leaves with 2000 (50%).
  const sessions = [
    session({
      id: "a",
      startedAt: start,
      players: [
        player("p1", "Ram", 1000, 2000),
        player("p2", "Sita", 1000, 1000),
        player("p3", "Kula", 2000, 1000),
      ],
    }),
  ];
  const byId = new Map(computePlayerExtras(sessions).map((e) => [e.playerId, e]));
  close("share put in", byId.get("p1").potShareIn, 0.25);
  close("share taken out", byId.get("p1").potShareOut, 0.5);
  close("a bigger contributor's share in", byId.get("p3").potShareIn, 0.5);
  close("who left with less", byId.get("p3").potShareOut, 0.25);
  const totalIn = [...byId.values()].reduce((s, e) => s + e.potShareIn, 0);
  const totalOut = [...byId.values()].reduce((s, e) => s + e.potShareOut, 0);
  close("shares in sum to the whole pot", totalIn, 1);
  close("shares out sum to the whole pot", totalOut, 1);
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
