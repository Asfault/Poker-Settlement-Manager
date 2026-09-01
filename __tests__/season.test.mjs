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
  if (startFrom === null || now < startFrom) return null;
  return { season: seasonOf(now), isCurrent: true };
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
    "the season running now",
    seasonToShow(sessions, from, at(2026, 10, 1))?.season.id,
    "2026-autumn",
  );
  // The bug this replaced: with no games yet there was no season to show,
  // so the welcome banner never rendered on a fresh season.
  check(
    "the current season shows even with no games in it",
    seasonToShow([], from, at(2026, 9, 5))?.season.id,
    "2026-autumn",
  );
  check(
    "and it counts as current",
    seasonToShow([], from, at(2026, 9, 5))?.isCurrent,
    true,
  );
  check(
    "once the calendar rolls over, the new season takes over",
    seasonToShow(sessions, from, at(2026, 12, 15))?.season.id,
    "2026-winter",
  );
  check(
    "nothing before the date seasons begin",
    seasonToShow(sessions, from, at(2026, 8, 20)),
    null,
  );
  check(
    "nothing when seasons are switched off",
    seasonToShow(sessions, null, at(2026, 10, 1)),
    null,
  );
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

// ---------- reigning champion ----------

function reigningChampion(sessions, startFrom, meta, exclusions, now) {
  const current = seasonOf(now);
  const past = seasonsWithGames(sessions, startFrom).filter(
    (s) => s.id !== current.id && s.startsAt < current.startsAt,
  );
  if (past.length === 0) return null;
  const last = past[0];
  const m = meta.find((x) => x.seasonId === last.id);
  const result = computeSeasonResult(
    last,
    sessionsInSeason(sessions, last, startFrom),
    {
      excludedPlayerIds: exclusions
        .filter((e) => e.seasonId === last.id)
        .map((e) => e.playerId),
      noWinner: m?.noWinner,
    },
  );
  if (result.tied.length > 0 || !result.winner) return null;
  return { season: last, standing: result.winner };
}

function seasonBadgeLabel(season) {
  const labels = {
    winter: "Winter",
    summer: "Summer",
    monsoon: "Monsoon",
    autumn: "Autumn",
  };
  return `${labels[season.name].toUpperCase()} ${String(season.year).slice(2)}`;
}

console.log("\nReigning champion");
{
  const from = at(2026, 9, 1);
  // Autumn: Ram wins. Then Winter begins.
  const autumn = [
    session("a1", at(2026, 9, 10), [
      player("p1", "Ram", 2000),
      player("p2", "Sita", -2000),
    ]),
    session("a2", at(2026, 10, 10), [
      player("p1", "Ram", 1000),
      player("p2", "Sita", -1000),
    ]),
  ];

  check(
    "during the first season there's nobody to crown",
    reigningChampion(autumn, from, [], [], at(2026, 10, 20)),
    null,
  );
  check(
    "once the next season starts, last season's winner reigns",
    reigningChampion(autumn, from, [], [], at(2026, 12, 10))?.standing.playerId,
    "p1",
  );
  check(
    "a season flagged as having no champion crowns nobody",
    reigningChampion(
      autumn,
      from,
      [{ seasonId: "2026-autumn", customName: null, note: null, noWinner: true }],
      [],
      at(2026, 12, 10),
    ),
    null,
  );
  check(
    "nor does a disqualified winner",
    reigningChampion(
      autumn,
      from,
      [],
      [{ seasonId: "2026-autumn", playerId: "p1" }],
      at(2026, 12, 10),
    ),
    null,
  );
}
{
  const from = at(2026, 9, 1);
  // A dead heat has no single face to put on the image.
  const drawn = [
    session("a1", at(2026, 9, 10), [
      player("p1", "Ram", 500),
      player("p2", "Sita", 500),
    ]),
  ];
  check(
    "a shared title crowns nobody",
    reigningChampion(drawn, from, [], [], at(2026, 12, 10)),
    null,
  );
}
{
  const from = at(2026, 9, 1);
  // Two finished seasons — only the most recent one counts.
  const sessions = [
    session("a1", at(2026, 9, 10), [
      player("p1", "Ram", 2000),
      player("p2", "Sita", -2000),
    ]),
    session("w1", at(2026, 12, 10), [
      player("p1", "Ram", -3000),
      player("p2", "Sita", 3000),
    ]),
  ];
  check(
    "the title passes to the newest completed season's winner",
    reigningChampion(sessions, from, [], [], at(2027, 4, 10))?.standing.playerId,
    "p2",
  );
  check(
    "and the badge names the season they won, not the current one",
    seasonBadgeLabel(
      reigningChampion(sessions, from, [], [], at(2027, 4, 10)).season,
    ),
    "WINTER 26",
  );
}

console.log("\nBadge labels");
check(
  "autumn",
  seasonBadgeLabel(seasonOf(at(2026, 9, 15))),
  "AUTUMN 26",
);
// Winter spans two years but the badge uses only the one it started in —
// "WINTER 26–27 CHAMP" would run past the player column on the card.
check("winter uses its starting year", seasonBadgeLabel(seasonOf(at(2027, 1, 15))), "WINTER 26");
check("december is the same winter", seasonBadgeLabel(seasonOf(at(2026, 12, 20))), "WINTER 26");
check("monsoon", seasonBadgeLabel(seasonOf(at(2026, 7, 1))), "MONSOON 26");
check("summer", seasonBadgeLabel(seasonOf(at(2027, 4, 1))), "SUMMER 27");
check(
  "every label is short enough for the column",
  ["autumn", "winter", "monsoon", "summer"].every(
    (n) => `${seasonBadgeLabel(build(n, 2026))} CHAMP`.length <= 16,
  ),
  true,
);

// ---------- banner phases ----------

const CLOSING_MS = 21 * 86400000;

function seasonPhase(season, gameCount, isCurrent, now) {
  if (!isCurrent || now >= season.endsAt) return "finished";
  if (gameCount === 0) return "opening";
  return season.endsAt - now <= CLOSING_MS ? "closing" : "running";
}

console.log("\nBanner phases");
{
  const autumn = seasonOf(at(2026, 9, 15));

  check(
    "no games yet is the opening",
    seasonPhase(autumn, 0, true, at(2026, 9, 2)),
    "opening",
  );
  check(
    "games played mid-season is just running",
    seasonPhase(autumn, 4, true, at(2026, 10, 1)),
    "running",
  );
  check(
    "the last three weeks are the closing",
    seasonPhase(autumn, 8, true, at(2026, 11, 20)),
    "closing",
  );
  check(
    "past the end is finished",
    seasonPhase(autumn, 10, true, at(2026, 12, 5)),
    "finished",
  );
  check(
    "an older season shown during an off-season is finished",
    seasonPhase(autumn, 10, false, at(2026, 10, 1)),
    "finished",
  );
  check(
    "an empty season in its closing weeks still reads as opening",
    seasonPhase(autumn, 0, true, at(2026, 11, 25)),
    "opening",
  );
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
