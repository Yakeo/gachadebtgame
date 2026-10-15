import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { characterById } from "../src/lib/game-data";

const recruits = JSON.parse(readFileSync(new URL("../art-source/roster/recruits.json", import.meta.url), "utf8")) as { id: string; rarity: string; modelStyle: string }[];

test("all seventeen expansion recruits use illustrated pixel figures at their existing model paths", () => {
  const illustrated = recruits.filter(c => c.modelStyle === "illustrated-pixel");
  assert.equal(illustrated.length, 17);
  for (const c of illustrated) {
    assert.equal(characterById(c.id).splash, `/images/splash-${c.id}.png`);
    const file = new URL(`../public/images/splash-${c.id}.png`, import.meta.url);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 861);
    assert.equal(bytes.readUInt32BE(20), 1000);
    // Guard against accidentally rebuilding the original tiny template PNGs.
    assert.ok(statSync(file).size > 50_000, `${c.id} has reverted to a coarse placeholder`);
  }
});

test("the template generator preserves finished illustrated models", () => {
  const script = readFileSync(new URL("../scripts/gen-roster-sprites.py", import.meta.url), "utf8");
  assert.match(script, /if c\.get\('modelStyle'\) == 'illustrated-pixel':[\s\S]*?continue/);
  assert.equal(recruits.filter(c => c.modelStyle === "procedural-placeholder").length, 0);
});
