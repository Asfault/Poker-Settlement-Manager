// Runtime tests for the house-fee net settlement model.
// Mirrors lib/houseFee.ts + settleBalances from lib/settlement.ts.

function settleBalances(balances) {
  const payers = balances
    .filter((r) => r.balance < 0)
    .map((r) => ({ name: r.name, amount: -r.balance }))
    .sort((a, b) => b.amount - a.amount);
  const receivers = balances
    .filter((r) => r.balance > 0)
    .map((r) => ({ name: r.name, amount: r.balance }))
    .sort((a, b) => b.amount - a.amount);

  const out = [];
  let i = 0, j = 0;
  const EPS = 0.0001;
  while (i < payers.length && j < receivers.length) {
    const pay = Math.min(payers[i].amount, receivers[j].amount);
    if (pay > EPS) {
      out.push({ from: payers[i].name, to: receivers[j].name, amount: Math.round(pay) });
    }
    payers[i].amount -= pay;
    receivers[j].amount -= pay;
    if (payers[i].amount <= EPS) i += 1;
    if (receivers[j].amount <= EPS) j += 1;
  }
  return out;
}

function computeNetRows(players, houseFeePerPlayer, hostPlayerId) {
  const fee = Math.max(0, Math.round(houseFeePerPlayer));
  const payingCount = players.filter(
    (p) => p.paysHouseFee && p.playerId !== hostPlayerId,
  ).length;
  const totalCollected = fee * payingCount;
  return players.map((p) => {
    const profitLoss = p.chipsLeft - p.totalBuyIn;
    const isHost = p.playerId === hostPlayerId;
    const owed = !isHost && p.paysHouseFee ? fee : 0;
    const received = isHost ? totalCollected : 0;
    return {
      playerId: p.playerId, name: p.name,
      totalBuyIn: p.totalBuyIn, chipsLeft: p.chipsLeft,
      profitLoss, houseFeeOwed: owed, houseFeeReceived: received,
      net: profitLoss - owed + received,
    };
  });
}

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  PASS  ${label}`); passed++; }
  else {
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${e}`);
    console.log(`        actual:   ${a}`);
    failed++;
  }
}
function P(id, name, buy, chips, pays = true) {
  return { playerId: id, name, totalBuyIn: buy, chipsLeft: chips, paysHouseFee: pays };
}

// ---------------------------------------------------------------
console.log("Scenario: 7 players, ₹2000 buy-in, ₹200 fee, Dhermesh hosts");
// Chips must tally against buy-ins — pure poker, fee excluded.
const players = [
  P("d", "Dhermesh", 2000, 3000),
  P("r", "Ram", 2000, 1500),
  P("h", "Hari", 2000, 1700),
  P("s", "Sita", 2000, 2000),
  P("g", "Geeta", 2000, 2500),
  P("k", "Kula", 2000, 1300),
  P("j", "Jas", 2000, 2000),
];
const totalBuy = players.reduce((s, p) => s + p.totalBuyIn, 0);
const totalChips = players.reduce((s, p) => s + p.chipsLeft, 0);
check("poker ledger balances", totalBuy, totalChips);

const rows = computeNetRows(players, 200, "d");

// Poker P/L must be fee-free.
check("Dhermesh poker P/L excludes fee", rows.find(r => r.playerId === "d").profitLoss, 1000);
check("Ram poker P/L excludes fee", rows.find(r => r.playerId === "r").profitLoss, -500);

// Host collects from the other six, pays nothing himself.
check("host owes nothing", rows.find(r => r.playerId === "d").houseFeeOwed, 0);
check("host receives 6 x 200", rows.find(r => r.playerId === "d").houseFeeReceived, 1200);
check("Ram owes the fee", rows.find(r => r.playerId === "r").houseFeeOwed, 200);

// Net = poker + fee movement.
check("Dhermesh net", rows.find(r => r.playerId === "d").net, 2200);
check("Ram net", rows.find(r => r.playerId === "r").net, -700);

// ---------------------------------------------------------------
console.log("Conservation");
check("poker P/L sums to zero", rows.reduce((s, r) => s + r.profitLoss, 0), 0);
check("net sums to zero", rows.reduce((s, r) => s + r.net, 0), 0);
check(
  "fees owed equal fees received",
  rows.reduce((s, r) => s + r.houseFeeOwed, 0),
  rows.reduce((s, r) => s + r.houseFeeReceived, 0),
);

// ---------------------------------------------------------------
console.log("Settlements balance every player to zero");
const setts = settleNetOf(rows);
function settleNetOf(rs) { return settleBalances(rs.map(r => ({ name: r.name, balance: r.net }))); }
const bal = {};
for (const r of rows) bal[r.name] = r.net;
for (const s of setts) { bal[s.from] += s.amount; bal[s.to] -= s.amount; }
check("all balances zero after settling", Object.values(bal).every(v => Math.abs(v) < 0.001), true);

// ---------------------------------------------------------------
console.log("Old baked-in method produces the SAME cash, different stats");
// Old way: everyone buys in at 2200, host adds 1400 to his stack.
const oldRows = [
  { name: "Dhermesh", pl: (3000 + 1400) - 2200 },
  { name: "Ram", pl: 1500 - 2200 },
];
check("old Dhermesh P/L was inflated", oldRows[0].pl, 2200);
check("new Dhermesh net matches old cash", rows.find(r => r.name === "Dhermesh").net, 2200);
check("old Ram P/L was deflated", oldRows[1].pl, -700);
check("new Ram net matches old cash", rows.find(r => r.name === "Ram").net, -700);
console.log("  ^ cash identical, but poker stats now clean (1000 vs 2200, -500 vs -700)");

// ---------------------------------------------------------------
console.log("Edge: zero fee behaves like plain poker");
const noFee = computeNetRows(players, 0, "d");
check("net equals poker P/L when fee is 0",
  noFee.every(r => r.net === r.profitLoss), true);

// ---------------------------------------------------------------
console.log("Edge: no host set");
const noHost = computeNetRows(players, 200, null);
check("nobody receives when there's no host",
  noHost.reduce((s, r) => s + r.houseFeeReceived, 0), 0);
check("everyone still charged — would not balance, so UI must require a host",
  noHost.reduce((s, r) => s + r.houseFeeOwed, 0), 1400);

// ---------------------------------------------------------------
console.log("Edge: a player exempted from the fee");
const exempt = computeNetRows(
  [P("d", "Dhermesh", 2000, 2500), P("r", "Ram", 2000, 1500), P("x", "Guest", 2000, 2000, false)],
  200, "d",
);
check("exempt player owes nothing", exempt.find(r => r.playerId === "x").houseFeeOwed, 0);
check("host collects only from the one payer", exempt.find(r => r.playerId === "d").houseFeeReceived, 200);
check("net still sums to zero", exempt.reduce((s, r) => s + r.net, 0), 0);

console.log("");
console.log(`${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
