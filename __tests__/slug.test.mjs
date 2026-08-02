// Shared-stats slug rules, mirroring validateSlug in lib/db/shared-stats.ts.
// Run with: node __tests__/slug.test.mjs

const RESERVED_SLUGS = [
  "host",
  "display",
  "login",
  "api",
  "_next",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
];

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

function validateSlug(raw) {
  const slug = raw.trim().toLowerCase();
  if (!slug) return "Pick a link name.";
  if (slug.length < 3) return "At least 3 characters.";
  if (slug.length > 40) return "Keep it under 40 characters.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Lowercase letters, numbers and hyphens only, and it can't start or end with a hyphen.";
  }
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is reserved.`;
  return null;
}

let pass = 0;
let fail = 0;
function ok(label, slug) {
  const result = validateSlug(slug);
  if (result === null) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.log(`  FAIL  ${label}\n        rejected with: ${result}`);
    fail += 1;
  }
}
function rejects(label, slug) {
  const result = validateSlug(slug);
  if (result !== null) {
    console.log(`  PASS  ${label}`);
    pass += 1;
  } else {
    console.log(`  FAIL  ${label}\n        expected a rejection, got null`);
    fail += 1;
  }
}

console.log("\nAccepted");
ok("a plain name", "iknowdhermesh");
ok("hyphens in the middle", "poker-night");
ok("digits", "table9");
ok("exactly three characters", "abc");
ok("forty characters", "a".repeat(40));
ok("uppercase is lowercased rather than refused", "IKnowDhermesh");
ok("surrounding whitespace is trimmed", "  pokernight  ");

console.log("\nRejected");
rejects("empty", "");
rejects("whitespace only", "   ");
rejects("two characters", "ab");
rejects("forty-one characters", "a".repeat(41));
rejects("a leading hyphen", "-poker");
rejects("a trailing hyphen", "poker-");
rejects("spaces inside", "poker night");
rejects("underscores", "poker_night");
rejects("a slash, which would break the route", "poker/night");
rejects("a dot", "poker.night");
rejects("accents and non-ascii", "pokeréshé");
rejects("emoji", "poker🃏");

console.log("\nReserved routes");
for (const word of RESERVED_SLUGS) {
  rejects(`"${word}" collides with a real route`, word);
}
rejects("reserved words are caught regardless of case", "HOST");

console.log(`\n${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
