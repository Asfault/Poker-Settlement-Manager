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

function dayMonth(ms) {
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Season-scoped milestones, most important first. Mirrors recap.ts. */
function buildMilestones(seasonBefore, tonight, totalsAfter, totalsBefore, who) {
  if (seasonBefore.length === 0 || tonight.length === 0) return [];
  const out = [];

  const priorNights = new Map();
  let best = null;
  let worst = null;
  for (const s of seasonBefore) {
    const at = new Date(s.started_at).getTime();
    for (const p of s.players) {
      const v = plOf(p);
      const list = priorNights.get(p.player_id) ?? [];
      list.push(v);
      priorNights.set(p.player_id, list);
      if (best === null || v > best.pl) best = { playerId: p.player_id, pl: v, at };
      if (worst === null || v < worst.pl) worst = { playerId: p.player_id, pl: v, at };
    }
  }

  const after = [...totalsAfter.entries()].sort((a, b) => b[1] - a[1]);
  const before = [...totalsBefore.entries()].sort((a, b) => b[1] - a[1]);
  const [newLeader, runnerUp] = after;
  const oldLeader = before[0];
  if (
    newLeader &&
    newLeader[1] > 0 &&
    (!runnerUp || newLeader[1] > runnerUp[1]) &&
    (!oldLeader || oldLeader[0] !== newLeader[0])
  ) {
    out.push({
      ...who(newLeader[0]),
      headline: "Takes the lead",
      detail: oldLeader ? `Takes over from ${who(oldLeader[0]).name}` : "Top of the table",
      tone: "lead",
    });
  }

  const top = tonight[0];
  if (best && top.profitLoss > 0 && top.profitLoss > best.pl) {
    out.push({
      ...who(top.playerId),
      headline: "Biggest win of the season",
      detail: `${inr(top.profitLoss)} beats ${who(best.playerId).name}'s ${inr(best.pl)} on ${dayMonth(best.at)}`,
      tone: "win",
    });
  }
  const bottom = tonight[tonight.length - 1];
  if (worst && bottom.profitLoss < 0 && bottom.profitLoss < worst.pl) {
    out.push({
      ...who(bottom.playerId),
      headline: "Worst night of the season",
      detail: `${inr(bottom.profitLoss)}, worse than ${who(worst.playerId).name}'s ${inr(worst.pl)} on ${dayMonth(worst.at)}`,
      tone: "loss",
    });
  }

  for (const p of tonight) {
    const prior = priorNights.get(p.playerId) ?? [];
    if (p.profitLoss > 0 && prior.length >= 2 && prior.every((x) => x <= 0)) {
      out.push({
        ...who(p.playerId),
        headline: "First win of the season",
        detail: `After ${prior.length} nights without one`,
        tone: "win",
      });
    }
  }

  for (const p of tonight) {
    if ((priorNights.get(p.playerId) ?? []).length === 0) continue;
    const wasAt = totalsBefore.get(p.playerId) ?? 0;
    const nowAt = totalsAfter.get(p.playerId) ?? 0;
    if (wasAt <= 0 && nowAt > 0) {
      out.push({ ...who(p.playerId), headline: "Into profit for the season", detail: `Season now ${inr(nowAt)}`, tone: "win" });
    } else if (wasAt >= 0 && nowAt < 0) {
      out.push({ ...who(p.playerId), headline: "Into the red for the season", detail: `Season now ${inr(nowAt)}`, tone: "loss" });
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

  // Standings and milestones are both scoped to the season tonight belongs to.
  const season = seasonWindow(new Date(latest.started_at).getTime());
  const inSeason = sorted.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= season.startsAt && t < season.endsAt;
  });
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
        playedTonight: latest.players.some((p) => p.player_id === playerId),
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
    seasonNights: inSeason.length,
    milestones: buildMilestones(
      seasonBefore,
      tonight,
      totalsAfter,
      totalsBefore,
      (id) => ({ playerId: id, name: nameById.get(id) ?? "—" }),
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

console.log("\nMilestones (season only)");
const heads = (r) => r.milestones.map((m) => `${m.name}: ${m.headline}`);
{
  // The season's first night: nothing has changed, it has just begun.
  const h = [sess("only", NOW - MIN, [pl("p1", "Ram", 1000, 5000), pl("p2", "Sita", 1000, 0)])];
  check("nothing on the season's first night", buildRecap(h, NOW, 30 * MIN).milestones, []);
}
{
  // Hari led; tonight Ram wins big and takes over.
  const h = [
    sess("a", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 2000), pl("p2", "Hari", 1000, 6000), pl("p3", "Sita", 1000, 0)]),
    sess("b", NOW - MIN, [pl("p1", "Ram", 1000, 9000), pl("p2", "Hari", 1000, 0), pl("p3", "Sita", 1000, 1000)]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  check("a new leader is reported first", r.milestones[0].headline, "Takes the lead");
  check("and it's the right person", r.milestones[0].name, "Ram");
  check("naming who they took it from", r.milestones[0].detail, "Takes over from Hari");
  check("in gold", r.milestones[0].tone, "lead");
  check("the season's best night is reported", heads(r).includes("Ram: Biggest win of the season"), true);
}
{
  // A tie at the top isn't a lead.
  const h = [
    sess("a", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 3000), pl("p2", "Hari", 1000, 0)]),
    sess("b", NOW - MIN, [pl("p1", "Ram", 1000, 0), pl("p2", "Hari", 1000, 3000)]),
  ];
  check(
    "level on top means nobody takes the lead",
    heads(buildRecap(h, NOW, 30 * MIN)).some((x) => x.endsWith("Takes the lead")),
    false,
  );
}
{
  // Someone who sat tonight out can inherit the lead.
  const h = [
    sess("a", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 6000), pl("p2", "Hari", 1000, 4000), pl("p3", "Sita", 1000, 0)]),
    sess("b", NOW - MIN, [pl("p1", "Ram", 5000, 0), pl("p3", "Sita", 1000, 2000)]),
  ];
  check(
    "an absent player can take the lead",
    heads(buildRecap(h, NOW, 30 * MIN)).includes("Hari: Takes the lead"),
    true,
  );
}
{
  // Sita's -4000 is worse than anyone's night this season.
  const h = [
    sess("a", NOW - 10 * DAY, [pl("p1", "Ram", 3000, 0), pl("p2", "Sita", 1000, 4000)]),
    sess("b", NOW - MIN, [pl("p1", "Ram", 1000, 5000), pl("p2", "Sita", 5000, 1000)]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  check("the season's worst night is reported", heads(r).includes("Sita: Worst night of the season"), true);
  check("and so is the biggest win", heads(r).includes("Ram: Biggest win of the season"), true);
}
{
  // A good night that doesn't beat the season's best says nothing.
  const h = [
    sess("a", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 9000), pl("p2", "Sita", 9000, 1000)]),
    sess("b", NOW - MIN, [pl("p1", "Ram", 1000, 0), pl("p2", "Sita", 1000, 2000)]),
  ];
  check(
    "no season record, no record milestone",
    heads(buildRecap(h, NOW, 30 * MIN)).some((x) => x.includes("of the season") && !x.includes("First")),
    false,
  );
}
{
  // Sita lost twice this season, then wins.
  const h = [
    sess("s1", NOW - 20 * DAY, [pl("p2", "Sita", 1000, 0), pl("p1", "Ram", 1000, 2000)]),
    sess("s2", NOW - 10 * DAY, [pl("p2", "Sita", 1000, 500), pl("p1", "Ram", 1000, 1500)]),
    sess("s3", NOW - MIN, [pl("p2", "Sita", 1000, 1200), pl("p1", "Ram", 1000, 800)]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  check("first win of the season is reported", heads(r).includes("Sita: First win of the season"), true);
  check("after two or more nights", r.milestones.find((m) => m.headline === "First win of the season").detail, "After 2 nights without one");
}
{
  // One losing night isn't a drought.
  const h = [
    sess("s1", NOW - 10 * DAY, [pl("p2", "Sita", 1000, 0), pl("p1", "Ram", 1000, 2000)]),
    sess("s2", NOW - MIN, [pl("p2", "Sita", 1000, 1500), pl("p1", "Ram", 1000, 500)]),
  ];
  check(
    "a win after a single loss isn't a first win",
    heads(buildRecap(h, NOW, 30 * MIN)).includes("Sita: First win of the season"),
    false,
  );
}
{
  // Ram crosses into profit on the season; Sita drops into the red.
  const h = [
    sess("s1", NOW - 10 * DAY, [pl("p1", "Ram", 1500, 1000), pl("p2", "Sita", 1000, 1500)]),
    sess("s2", NOW - MIN, [pl("p1", "Ram", 1000, 2000), pl("p2", "Sita", 2000, 1000)]),
  ];
  const r = buildRecap(h, NOW, 30 * MIN);
  check("crossing into profit is reported", heads(r).includes("Ram: Into profit for the season"), true);
  check("with the season total", r.milestones.find((m) => m.headline === "Into profit for the season").detail, "Season now +₹500");
  check("so is dropping into the red", heads(r).includes("Sita: Into the red for the season"), true);
}
{
  // A player's first night of the season crosses nothing.
  const h = [
    sess("s1", NOW - 10 * DAY, [pl("p1", "Ram", 1000, 2000), pl("p2", "Sita", 1000, 0)]),
    sess("s2", NOW - MIN, [pl("p1", "Ram", 1000, 0), pl("p9", "Newbie", 1000, 3000)]),
  ];
  check(
    "a season debut isn't 'into profit'",
    heads(buildRecap(h, NOW, 30 * MIN)).includes("Newbie: Into profit for the season"),
    false,
  );
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
  check("tonight's delta on the season total", ram.tonightDelta, 2000);
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
  check("and they're marked as sitting out", absent.playedTonight, false);
  check(
    "while tonight's players aren't",
    r.standings.find((s) => s.playerId === "p1").playedTonight,
    true,
  );
}

console.log("\nStandings are scoped to the season");
{
  // NOW sits in winter. A game 120 days earlier is the previous season, so
  // it must not count towards the standings or the milestones.
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
  // Last season's game is invisible to the milestones too. Tonight is the
  // first night of this season, so nothing is reported — if last season
  // leaked in, Ram's -1000 would read as a record loss and Sita's +2000 as
  // a new leader.
  check("last season never reaches the milestones", r.milestones, []);
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
