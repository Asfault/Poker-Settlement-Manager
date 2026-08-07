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

console.log("\nA realistic chain fits");
{
  const chain = [5000, 2500, 5000, 2500].map(shortINR).join(" + ");
  check("four buy-ins", chain, "5k + 2.5k + 5k + 2.5k");
  check("and stays short", chain.length <= 24, true);
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
