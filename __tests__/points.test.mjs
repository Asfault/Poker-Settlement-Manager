// Host-only points statistic, mirroring lib/stats/points.ts.
// Run with: node __tests__/points.test.mjs

const TABLE = [100, 70, 50, 40, 30, 20, 10];
const FLOOR = 5;
function pointsForPosition(position) {
  return TABLE[position - 1] ?? FLOOR;
}
function nightPoints(players) {
  const ranked = [...players].sort((a, b) => b.profitLoss - a.profitLoss);
  const out = new Map();
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1].profitLoss === ranked[i].profitLoss) j += 1;
    let sum = 0;
    for (let pos = i + 1; pos <= j + 1; pos += 1) sum += pointsForPosition(pos);
    const each = sum / (j - i + 1);
    for (let k = i; k <= j; k += 1) out.set(ranked[k].playerId, each);
    i = j + 1;
  }
  return out;
}
function computePoints(sessions) {
  const totals = new Map();
  for (const s of sessions) {
    for (const [id, pts] of nightPoints(s.players)) totals.set(id, (totals.get(id) ?? 0) + pts);
  }
  return totals;
}
function formatPoints(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
    fail += 1;
  }
}
const p = (playerId, profitLoss) => ({ playerId, profitLoss });

console.log("\nThe scale");
check("1st to 7th", [1, 2, 3, 4, 5, 6, 7].map(pointsForPosition), [100, 70, 50, 40, 30, 20, 10]);
check("8th and below get 5", [8, 9, 12].map(pointsForPosition), [5, 5, 5]);

console.log("\nOne night");
{
  const pts = nightPoints([p("a", -500), p("b", 3000), p("c", 0), p("d", -2500)]);
  check("placed by P/L, not by entry order", [pts.get("b"), pts.get("c"), pts.get("a"), pts.get("d")], [100, 70, 50, 40]);
}
{
  const pts = nightPoints([p("a", 1000), p("b", 500), p("c", 500), p("d", -2000)]);
  check("two tied for 2nd split 70 and 50", [pts.get("b"), pts.get("c")], [60, 60]);
  check("and the next player is 4th, not 3rd", pts.get("d"), 40);
}
{
  const pts = nightPoints([p("a", 900), p("b", 900), p("c", 900)]);
  close("a three-way tie at the top splits 100, 70 and 50", pts.get("a"), 220 / 3);
}
{
  const nine = "abcdefghi".split("").map((id, i) => p(id, 1000 - i * 100));
  const pts = nightPoints(nine);
  check("7th gets 10, 8th and 9th get 5", [pts.get("g"), pts.get("h"), pts.get("i")], [10, 5, 5]);
}
{
  const pts = nightPoints([p("x", 0), p("y", 0), p("z", 0), p("w", 0), p("v", 0), p("u", 0), p("t", 0), p("s", 0)]);
  check("an all-level eight-player night: tie splits across 7th and 8th too", pts.get("x"), (100 + 70 + 50 + 40 + 30 + 20 + 10 + 5) / 8);
}

console.log("\nAcross nights");
{
  const totals = computePoints([
    { players: [p("a", 500), p("b", -500)] },
    { players: [p("a", -100), p("b", 100), p("c", 0)] },
  ]);
  check("totals add up per player", [totals.get("a"), totals.get("b"), totals.get("c")], [150, 170, 70]);
  check("a player who never played has no entry", totals.has("z"), false);
}

console.log("\nFormatting");
check("whole numbers stay whole", formatPoints(410), "410");
check("a split half shows one decimal", formatPoints(412.5), "412.5");
check("thirds round to one decimal", formatPoints(220 / 3), "73.3");

function close(label, actual, expected) {
  check(label, Math.abs(actual - expected) < 1e-9, true);
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
