import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { characterById, characters, companionLines, initialState, pullPool, pullOdds } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";

test("Grimm and Red Hood join the UR pool without changing its total rate", () => {
  const pool = pullPool("UR");
  assert.equal(pool.length, 5);
  assert.ok(Math.abs(pullOdds().filter(o => o.rarity === "UR").reduce((sum,o) => sum+o.chance,0) - .001) < 1e-12);
  for (const id of ["grimm", "redhood"]) {
    const c = characterById(id);
    assert.equal(c.id, id); assert.equal(c.rarity, "UR"); assert.ok(!c.retired);
    assert.equal(companionLines(id).length, 3);
    assert.notDeepEqual(companionLines(id), companionLines("ynna"));
    let calls = 0;
    const result = applyGameAction(initialState(), { action: "pull", count: 1 }, () => calls++ === 0 ? 0 : (pool.findIndex(c => c.id === id)+.5)/pool.length);
    assert.equal(result.pulls![0].id, id);
    assert.ok(result.state.roster.some(c => c.id === id));
  }
  assert.equal(new Set(characters.map(c => c.id)).size, characters.length);
});
test("both guests can equip, level, become companion and execute every battle command", () => {
  for (const id of ["grimm", "redhood"]) {
    let state = initialState(); state.roster.push({ id, level: 1, potential: 0, duplicates: 0 });
    state = applyGameAction(state, { action: "equip", id }, () => .5).state;
    assert.ok(state.squad.includes(id));
    state = applyGameAction(state, { action: "upgrade", id, levels: 2 }, () => .5).state;
    assert.equal(state.roster.find(c => c.id === id)!.level, 3);
    assert.equal(applyGameAction(state, { action: "companion", id }, () => .5).state.companion, id);
    state.squad = [id];
    for (const command of ["attack", "skill", "guard", "ultimate"]) {
      const battle = applyGameAction(state, { action: "startBattle", id: "1-1" }, () => .5).state;
      battle.battle!.allies[0].energy = 100;
      assert.doesNotThrow(() => applyGameAction(battle, { action: "act", command, target: 0 }, () => .5));
    }
  }
});
test("Black Souls guests ship distinct verified transparent art and calibrated battle sprites", () => {
  const entries = JSON.parse(readFileSync("art-source/black-souls/manifest.json", "utf8"));
  assert.equal(entries.length, 4);
  for (const entry of entries) {
    const bytes = readFileSync(`public${entry.path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    assert.ok(entry.transparentPixels > 10000);
    const c = characterById(entry.id);
    if (entry.kind === "model") {
      assert.equal(c.splash, entry.path);
      assert.equal(bytes.readUInt32BE(16), 861); assert.equal(bytes.readUInt32BE(20), 1000);
      assert.equal(entry.bounds[3], 900);
      assert.ok(entry.bounds[0] > 0 && entry.bounds[1] > 0 && entry.bounds[2] < 861);
    } else {
      assert.equal(c.keyart, entry.path);
      assert.ok(statSync(`public${entry.path}`).size > 40000);
      assert.ok(statSync(`public${entry.path}`).size < 900*1024);
    }
    assert.notEqual(c.splash, c.keyart);
  }
});
