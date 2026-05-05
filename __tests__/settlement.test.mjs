// Stand-alone runtime test for the settlement algorithm.
// Mirrors the logic in lib/settlement.ts (TS types stripped at runtime).

function calculateSettlements(results) {
  const payers = results
    .filter((r) => r.profitLoss < 0)
    .map((r) => ({ name: r.name, amount: -r.profitLoss }))
    .sort((a, b) => b.amount - a.amount);

  const receivers = results
    .filter((r) => r.profitLoss > 0)
    .map((r) => ({ name: r.name, amount: r.profitLoss }))
    .sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0,
    j = 0;
  const EPS = 0.0001;

  while (i < payers.length && j < receivers.length) {
    const pay = Math.min(payers[i].amount, receivers[j].amount);
    if (pay > EPS) {
      settlements.push({
        from: payers[i].name,
        to: receivers[j].name,
        amount: Math.round(pay),
      });
    }
    payers[i].amount -= pay;
    receivers[j].amount -= pay;
    if (payers[i].amount <= EPS) i += 1;
    if (receivers[j].amount <= EPS) j += 1;
  }
  return settlements;
}

function r(name, profitLoss) {
  return { id: name, name, totalBuyIn: 0, chipsLeft: 0, profitLoss };
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${e}`);
    console.log(`        actual:   ${a}`);
    failed++;
  }
}

// 1. The exact example from the spec.
console.log("Spec example: Ram -3000, Dhermesh +2000, Hari +1000");
check(
  "settlements",
  calculateSettlements([
    r("Ram", -3000),
    r("Dhermesh", 2000),
    r("Hari", 1000),
  ]),
  [
    { from: "Ram", to: "Dhermesh", amount: 2000 },
    { from: "Ram", to: "Hari", amount: 1000 },
  ],
);

// 2. Two losers, two winners, simple split.
console.log("Two losers, two winners");
check(
  "settlements",
  calculateSettlements([
    r("A", 5000),
    r("B", -3000),
    r("C", 2000),
    r("D", -4000),
  ]),
  [
    // top payer D(4000) -> top receiver A(5000): 4000
    // top payer B(3000) -> A(1000) -> 1000
    // B(2000) -> C(2000) -> 2000
    { from: "D", to: "A", amount: 4000 },
    { from: "B", to: "A", amount: 1000 },
    { from: "B", to: "C", amount: 2000 },
  ],
);

// 3. One loser pays one winner exactly.
console.log("One loser, one winner exact");
check(
  "settlements",
  calculateSettlements([r("A", 5000), r("B", -5000)]),
  [{ from: "B", to: "A", amount: 5000 }],
);

// 4. Everyone breaks even.
console.log("Everyone breaks even");
check(
  "settlements",
  calculateSettlements([r("A", 0), r("B", 0), r("C", 0)]),
  [],
);

// 5. Conservation: sum of payments equals sum of winnings.
console.log("Conservation property — random scenario");
const scenario = [
  r("Alice", 7500),
  r("Bob", -2500),
  r("Carol", -3000),
  r("Dave", 1500),
  r("Eve", -3500),
  r("Frank", 0),
];
const sums = calculateSettlements(scenario);
const totalReceived = sums.reduce((s, x) => s + x.amount, 0);
const totalWinnings = scenario
  .filter((p) => p.profitLoss > 0)
  .reduce((s, p) => s + p.profitLoss, 0);
const totalLosses = scenario
  .filter((p) => p.profitLoss < 0)
  .reduce((s, p) => s - p.profitLoss, 0);
check("paid sum equals winnings sum", totalReceived, totalWinnings);
check("paid sum equals losses sum", totalReceived, totalLosses);

// 6. No more settlements than max(payers, receivers)
const txCount = sums.length;
const payerCount = scenario.filter((p) => p.profitLoss < 0).length;
const receiverCount = scenario.filter((p) => p.profitLoss > 0).length;
check(
  "tx count <= payers + receivers - 1",
  txCount <= payerCount + receiverCount - 1,
  true,
);

// 7. Per-player balance check after applying settlements.
console.log("Per-player balance check");
const balances = {};
for (const p of scenario) balances[p.name] = p.profitLoss;
for (const s of sums) {
  balances[s.from] += s.amount;
  balances[s.to] -= s.amount;
}
const allZero = Object.values(balances).every((v) => Math.abs(v) < 0.001);
check("all balances zero after applying settlements", allZero, true);

console.log("");
console.log(`${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
