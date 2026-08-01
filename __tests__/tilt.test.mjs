// Tilt episode rules, mirroring tiltState() in lib/display/derive.ts
const WINDOW = 15 * 60 * 1000;
const HOLD = 5 * 60 * 1000;
const M = 60 * 1000;

function tiltState(times, now) {
  const s = [...times].sort((a, b) => a - b);
  let expiry = null;
  let episodeStart = null;
  for (let i = 0; i < s.length; i += 1) {
    const t = s[i];
    if (expiry !== null && t <= expiry) {
      expiry = t + HOLD;
      continue;
    }
    expiry = null;
    episodeStart = null;
    if (i > 0 && t - s[i - 1] <= WINDOW) {
      expiry = t + HOLD;
      episodeStart = t;
    }
  }
  return { tilted: expiry !== null && now <= expiry, startedAt: expiry !== null && now <= expiry ? episodeStart : null };
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`); fail++; }
}

console.log("Single buy-in never tilts");
check("one buy-in", tiltState([0], 1 * M).tilted, false);

console.log("Two buy-ins inside 15 min starts it");
check("10 min apart, checked immediately", tiltState([0, 10 * M], 10 * M).tilted, true);
check("16 min apart — too slow", tiltState([0, 16 * M], 16 * M).tilted, false);

console.log("Aura lasts 5 min from the last buy-in");
check("4 min after 2nd", tiltState([0, 10 * M], 14 * M).tilted, true);
check("5 min after 2nd (boundary)", tiltState([0, 10 * M], 15 * M).tilted, true);
check("6 min after 2nd — lapsed", tiltState([0, 10 * M], 16 * M).tilted, false);

console.log("Reloading while tilted extends it");
// buy-ins at 0 and 10 → tilt until 15. Another at 13 → extends to 18.
check("at 17 min, still tilted", tiltState([0, 10 * M, 13 * M], 17 * M).tilted, true);
check("at 19 min, lapsed", tiltState([0, 10 * M, 13 * M], 19 * M).tilted, false);

console.log("Episode start is stable across extra reloads");
const twoBuyIns = tiltState([0, 10 * M], 12 * M);
const fourBuyIns = tiltState([0, 10 * M, 13 * M, 15 * M], 16 * M);
check("2nd buy-in opens the episode", twoBuyIns.startedAt, 10 * M);
check("3rd and 4th don't restart it", fourBuyIns.startedAt, 10 * M);
console.log("  ^ same id, so the alert fires once per episode");

console.log("A fresh episode can start later");
// 0,10 → tilt ends 20. Quiet. Then 40,45 → new episode starting at 45.
const later = tiltState([0, 10 * M, 40 * M, 45 * M], 46 * M);
check("tilted again", later.tilted, true);
check("new episode start", later.startedAt, 45 * M);

console.log("Slow reloads never tilt");
check("every 20 min", tiltState([0, 20 * M, 40 * M, 60 * M], 61 * M).tilted, false);

console.log("");
console.log(`${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
