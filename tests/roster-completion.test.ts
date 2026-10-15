import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { characters, initialState } from "../src/lib/game-data";
import { enemyArt, bestiary } from "../src/components/ui";
import { applyGameAction } from "../src/lib/game-engine";

test("every recruit, including owned legacy units, has both real model and illustration", () => {
  for (const c of characters) {
    assert.ok(c.splash, `${c.id} still relies on a placeholder model`);
    assert.ok(c.keyart, `${c.id} still lacks illustration art`);
    assert.notEqual(c.splash, c.keyart);
    assert.ok(existsSync(`public${c.splash}`));
    assert.ok(existsSync(`public${c.keyart}`));
  }
});
test("completion models have verified alpha, unclipped silhouettes and a common floor", () => {
  const records = JSON.parse(readFileSync("art-source/roster/completion.json", "utf8"));
  assert.equal(records.length, 16);
  for (const entry of records) {
    const bytes = readFileSync(`public${entry.model}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    assert.equal(bytes.readUInt32BE(16), 861); assert.equal(bytes.readUInt32BE(20), 1000);
    assert.equal(bytes[25], 6);
    assert.ok(entry.bounds[0] > 0 && entry.bounds[1] > 0 && entry.bounds[2] < 861);
    assert.equal(entry.bounds[3], 900);
    assert.ok(entry.transparentPixels > 861000 * .4);
  }
});
test("all six mushroom uploads are registered, Buroom preserves the existing bluecap save ID", () => {
  for (const id of ["shroom", "reroom", "bluecap", "yeroom", "boomshroom", "hitmonshroom"]) {
    assert.equal(enemyArt[id], `/images/enemies/upload-${id}.png`);
    assert.ok(bestiary[id]);
  }
  assert.equal(enemyArt.buroom, enemyArt.bluecap);
  assert.equal(enemyArt.terminal, "/images/enemies/terminal.png");
  for (const id of ["byte", "angelina", "shroom", "bluecap", "reroom", "cat", "sentry"]) {
    const state = initialState(); state.squad = [id];
    state.roster = [{ id, level: 10, potential: 0, duplicates: 0 }];
    assert.ok(applyGameAction(state, { action: "startBattle", id: "1-1" }, () => .5).state.battle);
  }
});
test("Angelina uses the fetched official Aceship E2 asset rather than generated keyart", () => {
  const official = JSON.parse(readFileSync("art-source/official/angelina-e2.json", "utf8"));
  assert.match(official.source, /Aceship\/Arknight-Images.*char_291_aglina_2\.png/);
  for (const [path, hash] of [[official.original, official.originalSha256], [`public${official.keyart}`, official.keyartSha256]]) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash);
  }
  assert.equal(characters.find(c => c.id === "angelina")!.keyart, official.keyart);
});
