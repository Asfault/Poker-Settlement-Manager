// Season rules, mirroring lib/stats/season.ts.
// Run with: node __tests__/season.test.mjs

const START_MONTH = { winter: 12, summer: 3, monsoon: 6, autumn: 9 };
const MIN_ATTENDANCE = 0.65;

function nameForMonth(month) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "summer";
  if (month <= 8) return "monsoon";
  return "autumn";
}

function build(name, year) {
  const startMonth = START_MONTH[name];
  return {
    id: `${year}-${name}`,
    name,
    year,
    startsAt: new Date(year, startMonth - 1, 1).getTime(),
    endsAt: new Date(year, startMonth + 2, 1).getTime(),
  };
}

function seasonOf(epochMs) {
  const d = new Date(epochMs);
  const month = d.getMonth() + 1;
  const name = nameForMonth(month);
  const year =
    name === "winter" && month <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  return build(name, year);
}

function seasonLabel(season, customName) {
  if (customName && customName.trim()) return customName.trim();
  if (season.name === "winter") {
    return `Winter ${season.year}–${String(season.year + 1).slice(2)}`;
  }
  const labels = {
    winter: "Winter",
    summer: "Summer",
    monsoon: "Monsoon",
    autumn: "Autumn",
  };
  return `${labels[season.name]} ${season.year}`;
}

function sessionsInSeason(sessions, season, startFrom) {
  return sessions.filter(
    (s) =>
      s.startedAt >= season.startsAt &&
      s.startedAt < season.endsAt &&
      (startFrom === null || s.startedAt >= startFrom),
  );
}

function seasonsWithGames(sessions, startFrom) {
  const seen = new Map();
  for (const s of sessions) {
    if (startFrom !== null && s.startedAt < startFrom) continue;
    const season = seasonOf(s.startedAt);
    if (!seen.has(season.id)) seen.set(season.id, season);
  }
  return [...seen.values()].sort((a, b) => b.startsAt - a.startsAt);
}

function seasonToShow(sessions, startFrom, now) {
  const current = seasonOf(now);
  const played = seasonsWithGames(sessions, startFrom);
  if (played.some((s) => s.id === current.id)) {
    return { season: current, isCurrent: true };
  }
  if (played.length === 0) return null;
  return { season: played[0], isCurrent: false };
}

function computeSeasonResult(season, seasonSessions, options = {}) {
  const excluded = new Set(options.excludedPlayerIds ?? []);
  const gameCount = seasonSessions.length;
  const map = new Map();

  for (const s of seasonSessions) {
    for (const p of s.players) {
      let e = map.get(p.playerId);
      if (!e) {
        e = {
          playerId: p.playerId,
          name: p.name,
          profit: 0,
          sessions: 0,
          wins: 0,
        };
        map.set(p.playerId, e);
      }
      e.profit += p.profitLoss;
      e.sessions += 1;
      if (p.profitLoss > 0) e.wins += 1;
    }
  }

  const standings = [...map.values()]
    .map((e) => {
      const attendance = gameCount > 0 ? e.sessions / gameCount : 0;
      return {
        ...e,
        winRate: e.sessions > 0 ? e.wins / e.sessions : 0,
        attendance,
        eligible: attendance >= MIN_ATTENDANCE && !excluded.has(e.playerId),
      };
    })
    .sort((a, b) => b.profit - a.profit);

  if (options.noWinner || gameCount === 0) {
    return { gameCount, standings, winner: null, tied: [], noEligiblePlayers: false };
  }

  const contenders = standings.filter((s) => s.eligible && s.profit > 0);
  if (contenders.length === 0) {
    return {
      gameCount,
      standings,
      winner: null,
      tied: [],
      noEligiblePlayers: standings.every((s) => !s.eligible),
    };
  }

  const best = [...contenders].sort(
    (a, b) => b.profit - a.profit || b.winRate - a.winRate,
  );
  const top = best[0];
  const tied = best.filter(
    (s) =>
      s.playerId !== top.playerId &&
      s.profit === top.profit &&
      s.winRate === top.winRate,
  );
  return { gameCount, standings, winner: top, tied, noEligiblePlayers: false };
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

const at = (y, m, d) => new Date(y, m - 1, d).getTime();

function player(id, name, profit) {
  return {
    playerId: id,
    name,
    photoUrl: null,
    totalBuyIn: 1000,
    chipsLeft: 1000 + profit,
    profitLoss: profit,
  };
}
function session(id, when, players) {
  return { id, startedAt: when, players };
}

console.log("\nWhich season a date falls in");
check("September is autumn", seasonOf(at(2026, 9, 15)).id, "2026-autumn");
check("November is still autumn", seasonOf(at(2026, 11, 30)).id, "2026-autumn");
check("December starts winter", seasonOf(at(2026, 12, 1)).id, "2026-winter");
check(
  "January belongs to the winter that began in December",
  seasonOf(at(2027, 1, 15)).id,
  "2026-winter",
);
check("February too", seasonOf(at(2027, 2, 28)).id, "2026-winter");
check("March is summer", seasonOf(at(2027, 3, 1)).id, "2027-summer");
check("June is monsoon", seasonOf(at(2026, 6, 1)).id, "2026-monsoon");
check("August is the end of monsoon", seasonOf(at(2026, 8, 31)).id, "2026-monsoon");

console.log("\nLabels");
check("a normal season", seasonLabel(seasonOf(at(2026, 9, 1))), "Autumn 2026");
check(
  "winter shows both years",
  seasonLabel(seasonOf(at(2027, 1, 5))),
  "Winter 2026–27",
);
check(
  "a custom name wins",
  seasonLabel(seasonOf(at(2026, 9, 1)), "The Great Collapse"),
  "The Great Collapse",
);
check(
  "blank custom names are ignored",
  seasonLabel(seasonOf(at(2026, 9, 1)), "   "),
  "Autumn 2026",
);

console.log("\nSeasons begin from a date");
{
  const sessions = [
    session("old", at(2026, 7, 10), [player("p1", "Ram", 500)]),
    session("new", at(2026, 9, 10), [player("p1", "Ram", 500)]),
  ];
  const from = at(2026, 9, 1);
  check(
    "history before the start date belongs to no season",
    seasonsWithGames(sessions, from).map((s) => s.id),
    ["2026-autumn"],
  );
  check(
    "with no start date, everything counts",
    seasonsWithGames(sessions, null).map((s) => s.id),
    ["2026-autumn", "2026-monsoon"],
  );
  check(
    "and the pre-season game is excluded from the season",
    sessionsInSeason(sessions, seasonOf(at(2026, 9, 10)), from).length,
    1,
  );
}

console.log("\nWhich season the shared page shows");
{
  const sessions = [session("a", at(2026, 9, 10), [player("p1", "Ram", 500)])];
  const from = at(2026, 9, 1);
  check(
    "the running season, when it has games",
    seasonToShow(sessions, from, at(2026, 10, 1)),
    { season: seasonOf(at(2026, 9, 10)), isCurrent: true },
  );
  check(
    "the last completed one during an off-season",
    seasonToShow(sessions, from, at(2026, 12, 15))?.isCurrent,
    false,
  );
  check(
    "and its id",
    seasonToShow(sessions, from, at(2026, 12, 15))?.season.id,
    "2026-autumn",
  );
  check("nothing at all before any games", seasonToShow([], from, at(2026, 9, 5)), null);
}

console.log("\nThe award");
{
  const season = seasonOf(at(2026, 9, 10));
  // Ten games. Ram plays all of them for +5,000. Kula plays only 3 but
  // makes +6,000 in them — so he tops the table and still can't be
  // champion, which is the whole point of the attendance bar.
  const sessions = [];
  for (let i = 0; i < 10; i += 1) {
    const players = [player("p1", "Ram", 500), player("p2", "Sita", -300)];
    if (i < 3) players.push(player("p3", "Kula", 2000));
    sessions.push(session(`s${i}`, at(2026, 9, 5 + i), players));
  }
  const r = computeSeasonResult(season, sessions);

  check("the season counts its games", r.gameCount, 10);
  check("the champion is the top eligible profit", r.winner.playerId, "p1");
  check(
    "a high scorer below the attendance bar is ineligible",
    r.standings.find((s) => s.playerId === "p3").eligible,
    false,
  );
  check(
    "even though their profit is higher",
    r.standings[0].playerId,
    "p3",
  );
  check("nobody is tied", r.tied, []);
}
{
  // Exactly at the bar: 65% of 20 games is 13.
  const season = seasonOf(at(2026, 9, 10));
  const sessions = [];
  for (let i = 0; i < 20; i += 1) {
    const players = [player("p1", "Ram", 100)];
    if (i < 13) players.push(player("p2", "Sita", 500));
    sessions.push(session(`s${i}`, at(2026, 9, 1 + i), players));
  }
  const r = computeSeasonResult(season, sessions);
  check(
    "65% exactly is eligible",
    r.standings.find((s) => s.playerId === "p2").eligible,
    true,
  );
  check("and can win", r.winner.playerId, "p2");
}
{
  // Ties broken on win rate: same profit, different consistency.
  const season = seasonOf(at(2026, 9, 10));
  const sessions = [
    session("a", at(2026, 9, 1), [player("p1", "Ram", 1000), player("p2", "Sita", 500)]),
    session("b", at(2026, 9, 2), [player("p1", "Ram", 0), player("p2", "Sita", 500)]),
  ];
  const r = computeSeasonResult(season, sessions);
  check("both on the same profit", r.standings[0].profit, r.standings[1].profit);
  check("the steadier record takes it", r.winner.playerId, "p2");
  check("and it isn't recorded as shared", r.tied, []);
}
{
  // A dead heat on both measures really is shared.
  const season = seasonOf(at(2026, 9, 10));
  const sessions = [
    session("a", at(2026, 9, 1), [player("p1", "Ram", 500), player("p2", "Sita", 500)]),
  ];
  const r = computeSeasonResult(season, sessions);
  check("one of them is named", r.winner !== null, true);
  check("the other is recorded as tied", r.tied.length, 1);
}
{
  const season = seasonOf(at(2026, 9, 10));
  const sessions = [
    session("a", at(2026, 9, 1), [player("p1", "Ram", 900), player("p2", "Sita", -900)]),
  ];
  check(
    "a disqualified leader doesn't win",
    computeSeasonResult(season, sessions, { excludedPlayerIds: ["p1"] }).winner,
    null,
  );
  check(
    "but stays in the standings",
    computeSeasonResult(season, sessions, { excludedPlayerIds: ["p1"] })
      .standings[0].playerId,
    "p1",
  );
  check(
    "marked ineligible",
    computeSeasonResult(season, sessions, { excludedPlayerIds: ["p1"] })
      .standings[0].eligible,
    false,
  );
  check(
    "the no-winner flag suppresses the award outright",
    computeSeasonResult(season, sessions, { noWinner: true }).winner,
    null,
  );
}
{
  // Everyone lost money — nobody gets a trophy for that.
  const season = seasonOf(at(2026, 9, 10));
  const sessions = [
    session("a", at(2026, 9, 1), [player("p1", "Ram", 0), player("p2", "Sita", 0)]),
  ];
  const r = computeSeasonResult(season, sessions);
  check("breaking even wins nothing", r.winner, null);
  check("but that isn't an attendance problem", r.noEligiblePlayers, false);
}
{
  const season = seasonOf(at(2026, 9, 10));
  check(
    "an empty season has no winner",
    computeSeasonResult(season, []).winner,
    null,
  );
  check("and no games", computeSeasonResult(season, []).gameCount, 0);
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
