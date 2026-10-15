// The gacha is the one place a player can be told something untrue and never
// find out. These tests pin the pool contents, the odds the dialog prints, and
// the promise the home screen makes about who is "rate up".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyGameAction, initialState } from "../src/lib/game-engine";
import { characters, pullOdds, pullPool, PULL_RATES, SSR_FEATURED_SHARE, ssrFeaturedId } from "../src/lib/game-data";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the four hand-made designs are all obtainable", () => {
  // These are the designs the game is built around. If one of them is missing
  // from the pool it is unreachable forever, and nothing else would notice.
  const obtainable = new Set(pullOdds().filter(o => o.chance > 0).map(o => o.id));
  obtainable.add(ssrFeaturedId);
  for (const id of ["penelope", "ruta", "purp", "edgelord"]) {
    assert.ok(obtainable.has(id), `${id} is not obtainable from any banner`);
  }
});

test("every active character has odds and legacy retirees have zero odds", () => {
  const odds = pullOdds();
  assert.equal(odds.length, characters.length, "every character should have a stated chance");
  for (const entry of odds) {
    if (characters.find(c => c.id === entry.id)!.retired) assert.equal(entry.chance, 0);
    else assert.ok(entry.chance > 0, `${entry.id} has a chance of ${entry.chance}`);
  }
  // the pool split for a rarity must account for the whole band
  for (const rarity of ["UR", "SSR", "SR", "R"] as const) {
    const total = odds.filter(o => o.rarity === rarity).reduce((sum, o) => sum + o.chance, 0);
    assert.ok(Math.abs(total - PULL_RATES[rarity]) < 1e-9,
      `${rarity} odds total ${total}, expected ${PULL_RATES[rarity]}`);
  }
});

test("the featured character is the only one with a boosted share", () => {
  const featured = pullOdds().filter(o => o.featured);
  assert.equal(featured.length, 1, "exactly one character may be featured");
  assert.equal(featured[0].id, ssrFeaturedId);
  const poolSsr = pullOdds().filter(o => o.rarity === "SSR" && !o.featured);
  for (const entry of poolSsr) {
    assert.equal(entry.chance, PULL_RATES.SSR * (1 - SSR_FEATURED_SHARE) / poolSsr.length);
    assert.ok(entry.chance < featured[0].chance, `${entry.id} should not beat the featured rate`);
  }
});

test("the odds the dialog prints are the odds the engine rolls", () => {
  // The dialog and the engine read the same constants; this proves the numbers
  // have not diverged by simulating real pulls and comparing.
  const RUNS = 120_000;
  const tally: Record<string, number> = {};
  let seed = 987654321;
  // Mulberry32 avoids the low-bit correlations and floating-point loss of
  // the former LCG, which starved some slots when the pool grew.
  const rand = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  let state = initialState();
  state.gems = 10 ** 9;
  let done = 0;
  while (done < RUNS) {
    const before = state.totalPulls;
    state = applyGameAction(state, { action: "pull", count: 10 }, rand).state;
    done += state.totalPulls - before;
    for (const entry of state.pullHistory.slice(0, 10)) tally[entry.id] = (tally[entry.id] ?? 0) + 1;
    state.pullHistory = [];
  }

  for (const entry of pullOdds()) {
    const observed = (tally[entry.id] ?? 0) / done;
    // The pity guarantee lifts every SSR's real-world rate above the stated
    // band, so only assert the floor: nobody may come in *below* their stated
    // odds, and the featured character must clearly lead the other SSRs.
    // Small pools tolerated a fixed 20% deviation; expanded pools need a
    // sample-size-aware bound, especially for the very rare UR guests.
    const sigma = Math.sqrt(entry.chance * (1 - entry.chance) / done);
    // Pity replaces some R/SR outcomes, so retain the original 20%
    // allowance as well as the low-count statistical bound.
    assert.ok(observed >= Math.min(entry.chance * 0.8, entry.chance - 5 * sigma),
      `${entry.id} rolled ${(observed * 100).toFixed(3)}% but is advertised at ${(entry.chance * 100).toFixed(3)}%`);
  }
  const featuredRate = (tally[ssrFeaturedId] ?? 0) / done;
  for (const other of pullOdds().filter(o => o.rarity === "SSR" && !o.featured)) {
    assert.ok(featuredRate > (tally[other.id] ?? 0) / done,
      `${ssrFeaturedId} should out-roll ${other.id} on its own banner`);
  }
});

test("only the featured character may be advertised as rate up", () => {
  // The home carousel advertised "SSR Purp RATE UP" while the engine only ever
  // boosted Penelope, so players pulled for a banner that did not exist.
  const shell = read("src/components/game-shell.tsx");
  const claims = [...shell.matchAll(/([A-Za-z0-9]+)\s*<b>RATE UP/g)].map(m => m[1]);
  const featuredName = characters.find(c => c.id === ssrFeaturedId)!.name;
  for (const claimed of claims) {
    assert.equal(claimed, featuredName,
      `${claimed} is advertised as rate up but ${ssrFeaturedId} is the featured character`);
  }
});

test("the rates dialog reads the live pool rather than a hardcoded list", () => {
  const view = read("src/components/game-views.tsx");
  assert.match(view, /pullOdds\(\)/, "the dialog must list the pool from pullOdds()");
  assert.match(view, /PULL_RATES\./, "the dialog must read the shared rate constants");
  // a hardcoded percentage table is what drifted before
  assert.doesNotMatch(view, /\["UR", "Ultra Rare", "0\.10%"\]/,
    "the dialog still contains a hardcoded rate table");
});
