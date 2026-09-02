// End-of-night recap rules, mirroring lib/display/recap.ts.
// Run with: node __tests__/recap.test.mjs

function nameOf(p) {
  return (p.nickname && p.nickname.trim()) || p.name;
}
function plOf(p) {
  return p.chips_left - p.total_buy_in;
}
/** Mirrors seasonOf from lib/stats/season.ts — the window a date falls in. */
function seasonWindow(epochMs) {
  const START = { winter: 12, summer: 3, monsoon: 6, autumn: 9 };
  const d = new Date(epochMs);
  const m = d.getMonth() + 1;
  const name =
    m === 12 || m <= 2
      ? "winter"
      : m <= 5
        ? "summer"
        : m <= 8
          ? "monsoon"
          : "autumn";
  const year = name === "winter" && m <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  return {
    startsAt: new Date(year, START[name] - 1, 1).getTime(),
    endsAt: new Date(year, START[name] + 2, 1).getTime(),
  };
}

function totalsFrom(sessions) {
  const out = new Map();
  for (const s of sessions) {
    for (const p of s.players) {
      out.set(p.player_id, (out.get(p.player_id) ?? 0) + plOf(p));
    }
  }
  return out;
}
function rankOf(totals) {
  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const out = new Map();
  ordered.forEach(([id], i) => out.set(id, i + 1));
  return out;
}
function inr(n) {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-IN");
  return `${n < 0 ? "-" : n > 0 ? "+" : ""}₹${abs}`;
}

function buildMilestones(before, tonight, totalsAfter, totalsBefore) {
  const out = [];
  const priorNights = new Map();
  for (const s of before) {
    for (const p of s.players) {
      const list = priorNights.get(p.player_id) ?? [];
      list.push(plOf(p));
      priorNights.set(p.player_id, list);
    }
  }
  for (const p of tonight) {
    const prior = priorNights.get(p.playerId) ?? [];
    if (prior.length === 0) continue;
    const bestBefore = Math.max(...prior);
    const worstBefore = Math.min(...prior);
    const base = { playerId: p.playerId, name: p.name };

    if (p.profitLoss > 0 && p.profitLoss > bestBefore) {
      out.push({ ...base, headline: "Biggest night ever", tone: "win" });
    } else if (p.profitLoss < 0 && p.profitLoss < worstBefore) {
      out.push({ ...base, headline: "Worst night ever", tone: "loss" });
    }
    if (p.profitLoss > 0 && prior.every((x) => x <= 0)) {
      out.push({ ...base, headline: "First ever win", tone: "win" });
    }
    const after = totalsAfter.get(p.playerId) ?? 0;
    const priorTotal = totalsBefore.get(p.playerId) ?? 0;
    if (priorTotal <= 0 && after > 0) {
      out.push({ ...base, headline: "Into profit at last", tone: "win" });
    } else if (priorTotal >= 0 && after < 0) {
      out.push({
        ...base,
        headline: "Underwater for the first time",
        tone: "loss",
      });
    }
  }
  return out;
}

function buildRecap(history, now, windowMs) {
  if (history.length === 0) return null;
  const sorted = [...history].sort(
    (a, b) =>
      new Date(b.ended_at ?? b.started_at).getTime() -
      new Date(a.ended_at ?? a.started_at).getTime(),
  );
  const latest = sorted[0];
  const endedAt = new Date(latest.ended_at ?? latest.started_at).getTime();
  if (now - endedAt > windowMs || now < endedAt) return null;
  if (latest.players.length === 0) return null;

  const tonight = latest.players
    .map((p) => ({
      playerId: p.player_id,
      name: nameOf(p),
      totalBuyIn: p.total_buy_in,
      chipsLeft: p.chips_left,
      profitLoss: plOf(p),
    }))
    .sort((a, b) => b.profitLoss - a.profitLoss);

  // Standings are scoped to the season tonight belongs to; milestones below
  // still read the whole history.
  const season = seasonWindow(new Date(latest.started_at).getTime());
  const inSeason = sorted.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= season.startsAt && t < season.endsAt;
  });
  const before = sorted.filter((s) => s.id !== latest.id);
  const seasonBefore = inSeason.filter((s) => s.id !== latest.id);
  const totalsAfter = totalsFrom(inSeason);
  const totalsBefore = totalsFrom(seasonBefore);
  const ranksAfter = rankOf(totalsAfter);
  const ranksBefore = rankOf(totalsBefore);
  const nameById = new Map();
  for (const s of sorted) {
    for (const p of s.players) nameById.set(p.player_id, nameOf(p));
  }

  const standings = [...totalsAfter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, total]) => {
      const wasRanked = totalsBefore.has(playerId);
      const rank = ranksAfter.get(playerId) ?? 0;
      return {
        playerId,
        name: nameById.get(playerId) ?? "—",
        total,
        rank,
        movement: wasRanked ? (ranksBefore.get(playerId) ?? 0) - rank : null,
      };
    });

  return {
    sessionId: latest.id,
    endedAt,
    pot: latest.players.reduce((s, p) => s + p.total_buy_in, 0),
    tonight,
    standings,
    // All-time, deliberately: "biggest night ever" means ever, and "into
    // profit at last" is about a whole record. Passing the season totals
    // here would reset both every three months.
    milestones: buildMilestones(
      before,
      tonight,
      totalsFrom(sorted),
      totalsFrom(before),
    ),
  };
}

function recordsFrom(sessions) {
  const out = new Map();
  for (const s of sessions) {
    for (const p of s.players) {
      const e = out.get(p.player_id) ?? { sessions: 0, wins: 0, total: 0 };
      e.sessions += 1;
      if (plOf(p) > 0) e.wins += 1;
      e.total += plOf(p);
      out.set(p.player_id, e);
    }
  }
  return out;
}

/** buildRecap plus the per-player record fields on each standing. */
function buildRecapWithRecords(history, now, windowMs) {
  const base = buildRecap(history, now, windowMs);
  if (!base) return base;
  const sorted = [...history].sort(
    (a, b) =>
      new Date(b.ended_at ?? b.started_at).getTime() -
      new Date(a.ended_at ?? a.started_at).getTime(),
  );
  const latest = sorted[0];
  // Season-scoped, matching the standings they sit beside.
  const season = seasonWindow(new Date(latest.started_at).getTime());
  const inSeason = sorted.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= season.startsAt && t < season.endsAt;
  });
  const recAfter = recordsFrom(inSeason);
  const recBefore = recordsFrom(inSeason.filter((s) => s.id !== latest.id));

  base.standings = base.standings.map((s) => {
    const a = recAfter.get(s.playerId) ?? { sessions: 0, wins: 0, total: 0 };
    const b = recBefore.get(s.playerId) ?? { sessions: 0, wins: 0, total: 0 };
    const rateAfter = a.sessions > 0 ? a.wins / a.sessions : 0;
    const rateBefore = b.sessions > 0 ? b.wins / b.sessions : 0;
    return {
      ...s,
      tonightDelta: a.total - b.total,
      sessions: a.sessions,
      wins: a.wins,
      winRate: rateAfter,
      winRateDelta:
        b.sessions > 0 && a.sessions !== b.sessions
          ? (rateAfter - rateBefore) * 100
          : 0,
    };
  });
  return base;
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

const MIN = 60000;
const DAY = 86400000;
const NOW = 1_800_000_000_000;

function pl(id, name, buyIn, chips) {
  return {
    player_id: id,
    name,
    nickname: null,
    photo_url: null,
    character_url: null,
    total_buy_in: buyIn,
    chips_left: chips,
    buy_in_count: 1,
  };
}
function sess(id, endedAt, players) {
  return {
    id,
    started_at: new Date(endedAt - 4 * 3600000).toISOString(),
    ended_at: new Date(endedAt).toISOString(),
    players,
  };
}

console.log("\nWhen the recap shows at all");
{
  const h = [sess("a", NOW - 5 * MIN, [pl("p1", "Ram", 1000, 2000), pl("p2", "Sita", 1000, 0)])];
  check("just after a session, it's up", buildRecap(h, NOW, 30 * MIN) !== null, true);
  check(
    "an hour later, it's gone",
    buildRecap(h, NOW + 60 * MIN, 30 * MIN),
    null,
  );
  check("no history, nothing to show", buildRecap([], NOW, 30 * MIN), null);
  check(
    "a session with no players is skipped",
    buildRecap([sess("empty", NOW - MIN, [])], NOW, 30 * MIN),
    null,
  );
}

console.log("\nTonight's ordering");
{
  const h = [
    sess("a", NOW - MIN, [
      pl("p1", "Ram", 2000, 1000),
      pl("p2", "Sita", 2000, 5000),
      pl("p3", "Kula", 2000, 0),
    ]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  check(
    "sorted best to worst",
    r.tonight.map((p) => p.name),
    ["Sita", "Ram", "Kula"],
  );
  check("pot is the sum of buy-ins", r.pot, 6000);
  check("P/L is chips minus buy-in", r.tonight[0].profitLoss, 3000);
}

console.log("\nRank movement");
{
  // Before tonight: Hari +5000, Ram +1000. Tonight Ram wins big and overtakes.
  const h = [
    sess("old", NOW - 10 * DAY, [
      pl("p1", "Ram", 1000, 2000),
      pl("p2", "Hari", 1000, 6000),
    ]),
    sess("new", NOW - MIN, [
      pl("p1", "Ram", 1000, 9000),
      pl("p2", "Hari", 1000, 0),
    ]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  const byId = new Map(r.standings.map((s) => [s.playerId, s]));
  check("the climber is now first", byId.get("p1").rank, 1);
  check("climbing shows as positive movement", byId.get("p1").movement, 1);
  check("the overtaken player drops", byId.get("p2").movement, -1);
}
{
  // A player appearing for the first time has no previous position.
  const h = [
    sess("old", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 2000)]),
    sess("new", NOW - MIN, [
      pl("p1", "Ram", 1000, 1500),
      pl("p9", "Newbie", 1000, 500),
    ]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  const newbie = r.standings.find((s) => s.playerId === "p9");
  check("a debut has null movement, not zero", newbie.movement, null);
}

console.log("\nMilestones");
{
  // Ram's best was +1000; tonight he makes +4000.
  const h = [
    sess("old", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 2000), pl("p2", "Sita", 1000, 0)]),
    sess("new", NOW - MIN, [pl("p1", "Ram", 1000, 5000), pl("p2", "Sita", 1000, 0)]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  const heads = r.milestones.map((m) => `${m.name}: ${m.headline}`);
  check("a personal best is reported", heads.includes("Ram: Biggest night ever"), true);
  check(
    "a losing night that isn't a record says nothing",
    heads.some((x) => x.startsWith("Sita")),
    false,
  );
}
{
  // Sita has lost twice, then wins.
  const h = [
    sess("s1", NOW - 20 * DAY, [pl("p2", "Sita", 1000, 0)]),
    sess("s2", NOW - 10 * DAY, [pl("p2", "Sita", 1000, 500)]),
    sess("s3", NOW - MIN, [pl("p2", "Sita", 1000, 4000)]),
  ];
  const heads = buildRecap(h, NOW, 30 * MIN).milestones.map((m) => m.headline);
  check("first ever win is reported", heads.includes("First ever win"), true);
  check("so is crossing into profit", heads.includes("Into profit at last"), true);
}
{
  // A player on their very first night gets nothing — the live board already
  // announced the debut.
  const h = [sess("only", NOW - MIN, [pl("p1", "Ram", 1000, 5000)])];
  check(
    "a debut produces no milestone here",
    buildRecap(h, NOW, 30 * MIN).milestones,
    [],
  );
}
{
  // Ram was up overall, tonight drags him under for the first time.
  const h = [
    sess("old", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 2000)]),
    sess("new", NOW - MIN, [pl("p1", "Ram", 5000, 0)]),
  ];
  const heads = buildRecap(h, NOW, 30 * MIN).milestones.map((m) => m.headline);
  check(
    "going underwater is reported once",
    heads.filter((x) => x === "Underwater for the first time").length,
    1,
  );
  check("and so is the record loss", heads.includes("Worst night ever"), true);
}

console.log("\nWin rate and tonight's delta");
{
  // Ram: lost, lost, then won tonight — 0% becomes 33%.
  const h = [
    sess("s1", NOW - 30 * DAY, [pl("p1", "Ram", 1000, 0), pl("p2", "Sita", 1000, 2000)]),
    sess("s2", NOW - 20 * DAY, [pl("p1", "Ram", 1000, 0), pl("p2", "Sita", 1000, 2000)]),
    sess("s3", NOW - MIN, [pl("p1", "Ram", 1000, 3000), pl("p2", "Sita", 1000, 0)]),
  ];
  const r = buildRecapWithRecords(h, NOW, 30 * MIN);
  const ram = r.standings.find((s) => s.playerId === "p1");
  const sita = r.standings.find((s) => s.playerId === "p2");

  check("sessions counted", ram.sessions, 3);
  check("wins counted", ram.wins, 1);
  check("win rate is wins over sessions", Math.round(ram.winRate * 100), 33);
  check(
    "win rate delta is in percentage points",
    Math.round(ram.winRateDelta),
    33,
  );
  check(
    "a player who lost tonight moves the other way",
    Math.round(sita.winRateDelta),
    -33,
  );
  check("tonight's delta on the all-time total", ram.tonightDelta, 2000);
  check("and the other direction", sita.tonightDelta, -1000);
}
{
  // Somebody who didn't play tonight has no movement to report.
  const h = [
    sess("s1", NOW - 30 * DAY, [pl("p1", "Ram", 1000, 2000), pl("p9", "Absent", 1000, 0)]),
    sess("s2", NOW - MIN, [pl("p1", "Ram", 1000, 2000)]),
  ];
  const r = buildRecapWithRecords(h, NOW, 30 * MIN);
  const absent = r.standings.find((s) => s.playerId === "p9");
  check("an absent player's win rate doesn't move", absent.winRateDelta, 0);
  check("nor does their total", absent.tonightDelta, 0);
}

console.log("\nStandings are scoped to the season");
{
  // NOW sits in winter. A game 120 days earlier is the previous season, so
  // it must not count towards the standings — but it should still be
  // visible to the milestone tests, which are all-time by design.
  const lastSeason = sess("old", NOW - 120 * DAY, [
    pl("p1", "Ram", 1000, 9000),
    pl("p2", "Sita", 1000, 0),
  ]);
  const tonight = sess("new", NOW - MIN, [
    pl("p1", "Ram", 1000, 0),
    pl("p2", "Sita", 1000, 3000),
  ]);
  const r = buildRecapWithRecords([lastSeason, tonight], NOW, 30 * MIN);
  const byId = new Map(r.standings.map((s) => [s.playerId, s]));

  check(
    "last season's huge win doesn't carry into this season's table",
    byId.get("p1").total,
    -1000,
  );
  check("tonight's winner leads the season", r.standings[0].playerId, "p2");
  check(
    "and a player's season record counts only this season's games",
    byId.get("p2").sessions,
    1,
  );
  check(
    "a first appearance this season has no previous position",
    byId.get("p1").movement,
    null,
  );
  // Ram's -1000 is his worst night only when measured against last
  // season's +8000 — so this firing proves milestones aren't season-scoped.
  check(
    "milestones still see the whole history",
    r.milestones.some(
      (m) => m.name === "Ram" && m.headline === "Worst night ever",
    ),
    true,
  );
  // And the mirror of it: all-time he's still +7000, so he hasn't gone
  // under. Season totals would have said -1000 and fired this wrongly.
  check(
    "and judge profit across it, not just this season",
    r.milestones.some(
      (m) => m.name === "Ram" && m.headline === "Underwater for the first time",
    ),
    false,
  );
}
{
  // Two games in the same season — movement is measured within it.
  const a = sess("a", NOW - 20 * DAY, [
    pl("p1", "Ram", 1000, 3000),
    pl("p2", "Sita", 1000, 0),
  ]);
  const b = sess("b", NOW - MIN, [
    pl("p1", "Ram", 1000, 0),
    pl("p2", "Sita", 1000, 5000),
  ]);
  const r = buildRecap([a, b], NOW, 30 * MIN);
  const byId = new Map(r.standings.map((s) => [s.playerId, s]));
  check("the climber tops the season", r.standings[0].playerId, "p2");
  check("and is shown as having climbed", byId.get("p2").movement, 1);
  check("the overtaken player drops", byId.get("p1").movement, -1);
}

console.log("\nFormatting");
{
  check("positive amounts are signed", inr(1500), "+₹1,500");
  check("negative amounts are signed", inr(-1500), "-₹1,500");
  check("zero carries no sign", inr(0), "₹0");
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
