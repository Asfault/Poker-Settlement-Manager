// Compact rupee formatting, mirroring shortINR in lib/format.ts.
// Used for the buy-in chain on the summary image, where a whole chain has
// to fit in a cell sized for one number.
// Run with: node __tests__/format.test.mjs

function shortINR(amount) {
  const n = Math.round(amount);
  if (Math.abs(n) < 1000) return String(n);
  const k = n / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

function buyInChain(amounts) {
  return amounts
    .map((a) => {
      const k = Math.round(a) / 1000;
      return String(Number(k.toFixed(1)));
    })
    .join("+");
}

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.log(
      `  FAIL  ${label}\n        expected ${expected}\n        actual   ${actual}`,
    );
    fail += 1;
  }
}

console.log("\nCompact amounts");
check("whole thousands lose the decimal", shortINR(5000), "5k");
check("halves keep one decimal", shortINR(2500), "2.5k");
check("ten thousand", shortINR(10000), "10k");
check("awkward amounts round to one decimal", shortINR(1250), "1.3k");
check("under a thousand stays exact", shortINR(500), "500");
check("exactly a thousand", shortINR(1000), "1k");
check("nine hundred and ninety nine", shortINR(999), "999");
check("zero", shortINR(0), "0");
check("fractions of a rupee are rounded away", shortINR(2500.4), "2.5k");

console.log("\nBuy-in chains for the summary image");
{
  check("whole thousands lose the decimal", buyInChain([5000]), "5");
  check("halves keep one", buyInChain([2500]), "2.5");
  check(
    "a mixed chain",
    buyInChain([2000, 5000, 3000, 2500]),
    "2+5+3+2.5",
  );
  check("sub-thousand becomes a fraction", buyInChain([500]), "0.5");
  check("ten thousand", buyInChain([10000]), "10");
  check("no buy-ins, empty string", buyInChain([]), "");
  // The reason for dropping "k": eight reloads still has to fit the cell.
  const heavy = buyInChain([5000, 5000, 5000, 5000, 2500, 2500, 5000, 5000]);
  check("eight buy-ins", heavy, "5+5+5+5+2.5+2.5+5+5");
  check("and stays under 20 characters", heavy.length < 20, true);
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
