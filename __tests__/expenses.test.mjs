// Session expense ledger, mirroring lib/expenses.ts + computeNetRows.
// Run with: node __tests__/expenses.test.mjs

function expenseTotal(expense) {
  return expense.shares.reduce((sum, s) => sum + s.amount, 0);
}

function computeExpenseBalances(expenses) {
  const map = new Map();
  function entry(playerId) {
    let e = map.get(playerId);
    if (!e) {
      e = { playerId, paid: 0, owed: 0, balance: 0 };
      map.set(playerId, e);
    }
    return e;
  }
  for (const expense of expenses) {
    const total = expenseTotal(expense);
    if (total > 0) entry(expense.payerPlayerId).paid += total;
    for (const share of expense.shares) {
      entry(share.playerId).owed += share.amount;
    }
  }
  for (const e of map.values()) e.balance = e.paid - e.owed;
  return map;
}

function splitEqually(total, playerIds) {
  const amount = Math.max(0, Math.round(total));
  if (playerIds.length === 0 || amount <= 0) return [];
  const each = Math.floor(amount / playerIds.length);
  if (each <= 0) return [];
  return playerIds.map((playerId) => ({ playerId, amount: each }));
}

function splitRemainder(total, count) {
  const amount = Math.max(0, Math.round(total));
  if (count <= 0 || amount <= 0) return 0;
  return amount % count;
}

function expensesInvolving(expenses, playerId) {
  return expenses.filter(
    (e) =>
      e.payerPlayerId === playerId ||
      e.shares.some((s) => s.playerId === playerId),
  );
}

function computeNetRows(players, houseFeePerPlayer, hostPlayerId, expenses = []) {
  const fee = Math.max(0, Math.round(houseFeePerPlayer));
  const payingCount = players.filter(
    (p) => p.paysHouseFee && p.playerId !== hostPlayerId,
  ).length;
  const totalCollected = fee * payingCount;
  const balances = computeExpenseBalances(expenses);
  return players.map((p) => {
    const profitLoss = p.chipsLeft - p.totalBuyIn;
    const isHost = p.playerId === hostPlayerId;
    const owed = !isHost && p.paysHouseFee ? fee : 0;
    const received = isHost ? totalCollected : 0;
    const e = balances.get(p.playerId);
    const expensePaid = e?.paid ?? 0;
    const expenseOwed = e?.owed ?? 0;
    return {
      playerId: p.playerId,
      name: p.name,
      profitLoss,
      houseFeeOwed: owed,
      houseFeeReceived: received,
      expensePaid,
      expenseOwed,
      net: profitLoss - owed + received + expensePaid - expenseOwed,
    };
  });
}

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
  let i = 0;
  let j = 0;
  const EPS = 0.0001;
  while (i < payers.length && j < receivers.length) {
    const pay = Math.min(payers[i].amount, receivers[j].amount);
    if (pay > EPS) {
      out.push({
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
  return out;
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
      `  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(expected === undefined ? actual : actual)}`,
    );
    fail += 1;
  }
}

function bal(expenses, playerId) {
  return computeExpenseBalances(expenses).get(playerId)?.balance ?? 0;
}
function sumBalances(expenses) {
  let total = 0;
  for (const e of computeExpenseBalances(expenses).values()) total += e.balance;
  return total;
}
function share(playerId, amount) {
  return { playerId, amount };
}

// ---------- the scenarios Dhermesh described ----------

console.log("\nTwo orders, two payers, one player in neither");
{
  // Hari pays ₹900 pizza for himself, Vishal and RA.
  // Dhermesh pays ₹600 burgers for himself, Sanjay and Ram.
  // Kula ordered nothing.
  const expenses = [
    {
      id: "e1",
      label: "Pizza",
      payerPlayerId: "hari",
      shares: [share("hari", 300), share("vishal", 300), share("ra", 300)],
    },
    {
      id: "e2",
      label: "Burgers",
      payerPlayerId: "dhermesh",
      shares: [share("dhermesh", 200), share("sanjay", 200), share("ram", 200)],
    },
  ];
  check("the payer nets what the others owe", bal(expenses, "hari"), 600);
  check("the second payer likewise", bal(expenses, "dhermesh"), 400);
  check("a diner owes their share", bal(expenses, "vishal"), -300);
  check("and on the other order", bal(expenses, "sanjay"), -200);
  check("someone who ordered nothing owes nothing", bal(expenses, "kula"), 0);
  check("balances sum to zero", sumBalances(expenses), 0);
}

console.log("\nA payer who isn't eating");
{
  // Hari orders for others twice and eats neither time.
  const expenses = [
    {
      id: "e1",
      label: "Pizza",
      payerPlayerId: "hari",
      shares: [share("ram", 300), share("kula", 300)],
    },
    {
      id: "e2",
      label: "Burgers",
      payerPlayerId: "hari",
      shares: [share("sanjay", 200), share("vishal", 200)],
    },
  ];
  check("is owed the full amount of both", bal(expenses, "hari"), 1000);
  check("each diner owes only their own", bal(expenses, "ram"), -300);
  check("balances still sum to zero", sumBalances(expenses), 0);
}

console.log("\nOverlapping orders, one player owing two different people");
{
  // Ram pays ₹900 pizza for Ram, Hari, Sanjay.
  // Vishal pays ₹600 burgers for Vishal, Hari, RA.
  const expenses = [
    {
      id: "e1",
      label: "Pizza",
      payerPlayerId: "ram",
      shares: [share("ram", 300), share("hari", 300), share("sanjay", 300)],
    },
    {
      id: "e2",
      label: "Burgers",
      payerPlayerId: "vishal",
      shares: [share("vishal", 200), share("hari", 200), share("ra", 200)],
    },
  ];
  check("debts to two payers add up", bal(expenses, "hari"), -500);
  check("first payer's credit", bal(expenses, "ram"), 600);
  check("second payer's credit", bal(expenses, "vishal"), 400);
  check("balances sum to zero", sumBalances(expenses), 0);
}

console.log("\nUneven per-person amounts");
{
  // Ram's pizza was ₹350, Kula's ₹250. No total is stored — it's the sum.
  const expenses = [
    {
      id: "e1",
      label: "Blinkit",
      payerPlayerId: "hari",
      shares: [share("ram", 350), share("kula", 250)],
    },
  ];
  check("the total is the sum of shares", expenseTotal(expenses[0]), 600);
  check("payer is credited that sum", bal(expenses, "hari"), 600);
  check("each owes their own amount", bal(expenses, "ram"), -350);
  check("balances sum to zero", sumBalances(expenses), 0);
}

console.log("\nEqual split, exact to the rupee");
{
  check(
    "a clean split gives everyone the same",
    splitEqually(900, ["a", "b", "c"]).map((s) => s.amount),
    [300, 300, 300],
  );
  check(
    "an unclean split rounds every share down",
    splitEqually(850, ["a", "b", "c"]).map((s) => s.amount),
    [283, 283, 283],
  );
  check("the payer absorbs the odd rupees", splitRemainder(850, 3), 1);
  check("nothing is absorbed on a clean split", splitRemainder(900, 3), 0);
  check("no people, no shares", splitEqually(500, []), []);
  check("zero total, no shares", splitEqually(0, ["a", "b"]), []);
  check(
    "a total smaller than the headcount produces nothing rather than zeroes",
    splitEqually(2, ["a", "b", "c"]),
    [],
  );
}

console.log("\nBlocking removal");
{
  const expenses = [
    {
      id: "e1",
      label: "Pizza",
      payerPlayerId: "hari",
      shares: [share("ram", 300)],
    },
  ];
  check("the payer is involved", expensesInvolving(expenses, "hari").length, 1);
  check("a diner is involved", expensesInvolving(expenses, "ram").length, 1);
  check(
    "someone uninvolved is free to remove",
    expensesInvolving(expenses, "kula").length,
    0,
  );
}

console.log("\nNet and settlements with poker, fee and expenses together");
{
  // Three players. Dhermesh hosts, so pays no fee and collects it.
  // Hari fronted ₹600 of food that Dhermesh and Ram split.
  const players = [
    {
      playerId: "dhermesh",
      name: "Dhermesh",
      totalBuyIn: 2000,
      chipsLeft: 3000,
      paysHouseFee: false,
    },
    {
      playerId: "hari",
      name: "Hari",
      totalBuyIn: 2000,
      chipsLeft: 1500,
      paysHouseFee: true,
    },
    {
      playerId: "ram",
      name: "Ram",
      totalBuyIn: 2000,
      chipsLeft: 1500,
      paysHouseFee: true,
    },
  ];
  const expenses = [
    {
      id: "e1",
      label: "Biryani",
      payerPlayerId: "hari",
      shares: [share("dhermesh", 300), share("ram", 300)],
    },
  ];
  const rows = computeNetRows(players, 200, "dhermesh", expenses);
  const by = Object.fromEntries(rows.map((r) => [r.playerId, r]));

  check("poker P/L ignores the fee and the food", by.dhermesh.profitLoss, 1000);
  check("a losing night is still just cards", by.hari.profitLoss, -500);
  check(
    "host nets poker plus collected fees minus their food share",
    by.dhermesh.net,
    1000 + 400 - 300,
  );
  check(
    "the food payer nets poker minus fee plus what they're owed",
    by.hari.net,
    -500 - 200 + 600,
  );
  check("a plain player nets poker minus fee minus food", by.ram.net, -500 - 200 - 300);
  check(
    "net sums to zero so settlements balance",
    rows.reduce((s, r) => s + r.net, 0),
    0,
  );

  const settlements = settleBalances(
    rows.map((r) => ({ name: r.name, balance: r.net })),
  );
  check(
    "settlements clear every balance",
    settlements.reduce((s, x) => s + x.amount, 0),
    1100,
  );
}

console.log("\nNo expenses at all");
{
  const players = [
    {
      playerId: "a",
      name: "A",
      totalBuyIn: 1000,
      chipsLeft: 2000,
      paysHouseFee: true,
    },
    {
      playerId: "b",
      name: "B",
      totalBuyIn: 1000,
      chipsLeft: 0,
      paysHouseFee: true,
    },
  ];
  const withArg = computeNetRows(players, 0, null, []);
  const without = computeNetRows(players, 0, null);
  check(
    "omitting expenses matches passing an empty list",
    withArg.map((r) => r.net),
    without.map((r) => r.net),
  );
  check("and leaves net as pure poker", without[0].net, 1000);
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
