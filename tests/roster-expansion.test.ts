import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { characters, characterById, companionLines, initialState, pullOdds } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";

const manifest = JSON.parse(readFileSync(new URL("../art-source/roster/recruits.json", import.meta.url), "utf8")) as { id: string; rarity: string; keyart: string }[];

test("expansion adds exactly ten SSRs, five SRs and two URs with unique IDs", () => {
  assert.equal(manifest.length, 17);
  for (const [rarity, count] of [["SSR", 10], ["SR", 5], ["UR", 2]] as const) {
    assert.equal(manifest.filter(c => c.rarity === rarity).length, count);
  }
  assert.equal(new Set(characters.map(c => c.id)).size, characters.length);
  for (const recruit of manifest) {
    const c = characterById(recruit.id);
    assert.equal(c.id, recruit.id);
    assert.equal(c.rarity, recruit.rarity);
    assert.ok(pullOdds().find(o => o.id === c.id)!.chance > 0);
    assert.ok(c.hp > 0 && c.attack > 0 && c.defense > 0);
    assert.ok(c.description && c.weapon && c.skillNote && c.ultimateNote);
    assert.equal(companionLines(c.id).length, 3);
  }
});

test("every new recruit has separate real sprite and illustration assets", () => {
  for (const { id, keyart } of manifest) {
    const c = characterById(id);
    assert.equal(c.splash, `/images/splash-${id}.png`);
    assert.ok(existsSync(new URL(`../public${c.splash}`, import.meta.url)));
    {
      assert.equal(c.keyart, keyart);
      assert.ok(existsSync(new URL(`../public${c.keyart}`, import.meta.url)));
    }
  }
});

test("every expansion recruit can be equipped, welcomed as companion and use all combat commands", () => {
  for (const { id } of manifest) {
    const initial = initialState();
    initial.roster.push({ id, level: 1, potential: 0, duplicates: 0 });
    const equipped = applyGameAction(initial, { action: "equip", id }, () => .5).state;
    assert.ok(equipped.squad.includes(id));
    assert.equal(applyGameAction(equipped, { action: "companion", id }, () => .5).state.companion, id);
    for (const command of ["attack", "skill", "ultimate"]) {
      const state = initialState();
      state.roster.push({ id, level: 1, potential: 0, duplicates: 0 });
      state.squad = [id];
      const battle = applyGameAction(state, { action: "startBattle", id: "1-1" }, () => .5).state;
      battle.battle!.allies[0].energy = 100;
      battle.battle!.allies[0].hp -= 100;
      const result = applyGameAction(battle, { action: "act", command, target: 0 }, () => .5).state;
      assert.ok(result.battle!.log.some(line => line.includes(characterById(id).name)), `${id}/${command} did not resolve`);
    }
  }
});
