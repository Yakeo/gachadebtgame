// The rarity ladder.
//
// The bug this pins: UR is the highest rarity in the game, but the UI treated
// SSR as the ceiling - SSR wore the gold badge and the loudest pull card, the
// rates table listed UR and SSR in an order nobody could read as a ranking, and
// nothing in the game ever *said* which tier was on top. These tests hold the
// order in one place and check that the screens agree with it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { characters, pullPool, RARITY_ORDER, RARITY_RANK, RARITY_TIERS, ssrFeaturedId, starterUrPool } from "../src/lib/game-data";
import { byRarity, isTopRarity, outranks } from "../src/lib/rarity";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const globals = read("src/app/globals.css");
const views = read("src/components/game-views.tsx");
const shell = read("src/components/game-shell.tsx");

test("UR is the top of the ladder and SSR is directly below it", () => {
  assert.equal(RARITY_RANK.UR, 4);
  assert.equal(RARITY_RANK.SSR, 3);
  assert.equal(RARITY_RANK.SR, 2);
  assert.equal(RARITY_RANK.R, 1);
  assert.deepEqual(RARITY_ORDER, ["UR", "SSR", "SR", "R"]);
  assert.ok(isTopRarity("UR"), "UR must be reported as the highest rarity");
  assert.ok(!isTopRarity("SSR"), "SSR is not the highest rarity");
  assert.ok(outranks("UR", "SSR") && outranks("SSR", "SR") && !outranks("SR", "SSR"));
});

test("UR is never advertised as a lower tier than SSR", () => {
  // A single sentence in the rates dialog is the only place the game states the
  // order in words; without it a player could reasonably read SSR as the top.
  assert.match(views, /UR is the top of the ladder/);
  assert.match(views, /highest rarity/i);
  assert.equal(RARITY_TIERS.UR.badge, "HIGHEST RARITY");
  assert.equal(RARITY_TIERS.SSR.badge, undefined, "SSR must not wear the top-tier chip");
  assert.match(RARITY_TIERS.SSR.blurb, /below UR/i);
});

test("every screen ranks rarities through the shared ladder, not its own list", () => {
  // This is the regression that matters: a hardcoded ["SSR", "UR", ...] array
  // drifts the moment the ladder is corrected.
  assert.match(views, /RARITY_ORDER\.map\(/,
    "the roster filter and the rates table must read RARITY_ORDER");
  assert.doesNotMatch(views, /\["SSR",\s*"UR"/, "no screen may hand-order the tiers");
  assert.doesNotMatch(views, /\["UR",\s*"SSR",\s*"SR",\s*"R"\]\s*as const/,
    "the rates table must not hardcode the tier list any more");
  // Sorting the collection uses the ladder too.
  assert.match(views, /byRarity|RARITY_ORDER/);
  const sample = [{ rarity: "SR" as const, name: "b" }, { rarity: "UR" as const, name: "a" }, { rarity: "R" as const, name: "c" }];
  assert.deepEqual(sample.sort(byRarity).map(c => c.rarity), ["UR", "SR", "R"]);
});

test("the gold badge and the brightest pull card belong to UR", () => {
  // Colours are how most players read the ladder, and they used to say the
  // opposite of the truth: SSR had the gold, UR had a quiet pink.
  const urBadge = globals.match(/\.rarity-badge\.rarity-UR\{([^}]*)\}/g)?.at(-1) ?? "";
  const ssrBadge = globals.match(/\.rarity-badge\.rarity-SSR\{([^}]*)\}/g)?.at(-1) ?? "";
  assert.match(urBadge, /ffd977|linear-gradient/, "UR must carry the gold grading");
  assert.doesNotMatch(ssrBadge, /ffd977/, "SSR must not still be the gold tier");
  assert.match(globals, /\.pull-result\.rarity-UR\{[^}]*box-shadow/, "the UR pull card needs the strongest glow");
  assert.match(globals, /\.pull-result\.rarity-UR::after/, "UR needs its own sheen treatment");
});

test("a UR pull reads as rarer than an SSR pull", () => {
  // The star row is the one place the reveal states the ranking numerically.
  const stars = views.match(/c\.rarity === "UR" \? (\d+) : c\.rarity === "SSR" \? (\d+)/);
  assert.ok(stars, "the pull reveal must rank UR and SSR explicitly");
  assert.ok(Number(stars![1]) > Number(stars![2]), "UR must show more stars than SSR");
  // And the featured banner character stays an SSR - it is the tier below the
  // top, which is exactly what a rate-up banner is for.
  assert.equal(characters.find(c => c.id === ssrFeaturedId)!.rarity, "SSR");
  assert.ok(pullPool("UR").length > 0);
  assert.ok(starterUrPool().every(c => c.rarity === "UR"), "the free pick must stay UR-only");
});

test("the home screen does not describe SSR as the best thing available", () => {
  // "SSR Penelope RATE UP" is fine; "the highest rarity, SSR" is not.
  assert.doesNotMatch(shell, /highest rarity[^.]*SSR/i);
  assert.doesNotMatch(shell, /SSR[^.]*is the top/i);
});
