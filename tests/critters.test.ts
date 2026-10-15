import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { characters, characterById, companionLines, initialState, pullOdds, pullPool } from "../src/lib/game-data";
import { critterDefinitions } from "../src/lib/critter-data";
import { applyGameAction } from "../src/lib/game-engine";
import { recommendedLevel } from "../src/lib/campaign-balance";
import { stages } from "../src/lib/campaign";
const manifest = JSON.parse(readFileSync("art-source/roster/critters.json", "utf8")) as { id: string; model: string; illustration: string | null; transparentPixels: number; bounds: number[]; sha256: string }[];

test("SR pulls contain exactly the five uploads and five new critters, at unchanged total rate", () => {
  assert.equal(critterDefinitions.length, 10);
  assert.deepEqual(pullPool("SR").map(c => c.id), critterDefinitions.map(c => c.id));
  assert.ok(Math.abs(pullOdds().filter(o => o.rarity === "SR").reduce((sum, o) => sum + o.chance, 0) - .2) < 1e-12);
  for (const c of critterDefinitions) {
    assert.equal(c.rarity, "SR");
    assert.ok(Math.abs(pullOdds().find(o => o.id === c.id)!.chance - .02) < 1e-12);
    assert.equal(companionLines(c.id).length, 3);
  }
});
test("each new SR can actually be pulled, upgraded, equipped, duplicated and used in battle", () => {
  for (let i = 0; i < critterDefinitions.length; i++) {
    const id = critterDefinitions[i].id;
    let rolls = 0;
    let state = applyGameAction(initialState(), { action: "pull", count: 1 }, () => rolls++ === 0 ? .1 : (i + .5) / 10).state;
    assert.ok(state.roster.some(o => o.id === id));
    state = applyGameAction(state, { action: "upgrade", id, levels: 1 }, () => .5).state;
    assert.ok(state.roster.find(o => o.id === id)!.level > 1);
    state = applyGameAction(state, { action: "equip", id }, () => .5).state;
    assert.ok(state.squad.includes(id));
    rolls = 0;
    state = applyGameAction(state, { action: "pull", count: 1 }, () => rolls++ === 0 ? .1 : (i + .5) / 10).state;
    assert.equal(state.roster.find(o => o.id === id)!.duplicates, 1);
    state.squad = [id];
    for (const command of ["attack", "skill", "guard", "ultimate"]) {
      const battle = applyGameAction(state, { action: "startBattle", id: "1-1" }, () => .5).state;
      battle.battle!.allies[0].energy = 100;
      assert.doesNotThrow(() => applyGameAction(battle, { action: "act", command, target: 0 }, () => .5));
    }
  }
});
test("retiring SRs never rewrites owned levels, potentials, duplicates, squad or history", () => {
  const state = initialState();
  const old = { id: "pip", level: 26, potential: 3, duplicates: 2 };
  state.roster.push(old); state.squad = ["pip"];
  state.pullHistory.push({ id: "pip", rarity: "SR", date: "2026-10-15" });
  const resumed = applyGameAction(state, { action: "init" }, () => .5).state;
  assert.deepEqual(resumed.roster, state.roster);
  assert.deepEqual(resumed.squad, state.squad);
  assert.deepEqual(resumed.pullHistory, state.pullHistory);
  assert.ok(characterById("pip").retired);
  assert.ok(!pullPool("SR").some(c => c.id === "pip"));
  assert.equal(pullOdds().find(o => o.id === "pip")!.chance, 0);
  assert.ok(applyGameAction(resumed, { action: "startBattle", id: "1-1" }, () => .5).state.battle);
  assert.equal(characterById("ninette").name, "Ninette");
});
test("all critter models are genuine transparent PNGs with preserved floor baseline", () => {
  assert.equal(manifest.filter(e => e.illustration).length, 10);
  assert.equal(manifest.filter(e => !e.illustration).length, 8);
  for (const entry of manifest) {
    const bytes = readFileSync(`public${entry.model}`);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 861); assert.equal(bytes.readUInt32BE(20), 1000);
    assert.equal(bytes[25], 6, "must retain RGBA");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    assert.ok(entry.transparentPixels > 861000 * .4);
    assert.equal(entry.bounds[3], 900, "visible feet must meet the standard rig baseline");
    if (entry.illustration) {
      const c = characterById(entry.id);
      assert.equal(c.splash, entry.model); assert.equal(c.keyart, entry.illustration);
      assert.equal(readFileSync(`public${entry.illustration}`).toString("ascii", 0, 4), "RIFF");
    }
  }
});
test("new enemy art is wired before placeholder fallbacks, including friendly R variants", () => {
  const ui = readFileSync("src/components/ui.tsx", "utf8");
  for (const id of ["shroom", "bluecap", "reroom", "cat", "sentry", "prime", "enforcer", "fragment"]) assert.ok(ui.includes(`/images/enemies/critter-${id}.png`));
  assert.match(ui, /c\.splash \?\? enemyArt\[id\]/);
  assert.equal(characters.filter(c => !c.retired && c.rarity === "SR").length, 10);
});
test("two critter squads can clear all 25 stages at recommended levels", () => {
  for (const ids of [["kidjester", "mreats", "takobuddy", "mrhide"], ["mrblack", "teacup", "moth", "mrhide"]]) {
    for (let stage = 0; stage < stages.length; stage++) for (let seed = 1; seed <= 3; seed++) {
      let x = seed;
      const random = () => { x = Math.imul(x, 1664525) + 1013904223 | 0; return (x >>> 0) / 4294967296; };
      const start = initialState(); start.squad = ids;
      start.roster = ids.map(id => ({ id, level: recommendedLevel(stage + 1), potential: 0, duplicates: 0 }));
      start.cleared = stages.slice(0, stage).map(s => s.id);
      let state = applyGameAction(start, { action: "startBattle", id: stages[stage].id }, random).state;
      for (let n = 0; state.battle!.status === "active" && n < 400; n++) {
        const b = state.battle!, actor = b.allies[b.active];
        const heal = ["Healer", "Support"].includes(characterById(actor.id).role);
        const hurt = b.allies.some(a => a.hp > 0 && a.hp < a.maxHp * .7);
        const command = heal && !hurt ? "attack" : actor.energy >= 100 ? "ultimate" : actor.energy >= 20 ? "skill" : "attack";
        const target = b.enemies.reduce((best, e, i) => e.hp > 0 && (best < 0 || e.hp < b.enemies[best].hp) ? i : best, -1);
        state = applyGameAction(state, { action: "act", command, target }, random).state;
      }
      assert.equal(state.battle!.status, "victory", `${ids[0]} stage ${stages[stage].id}, seed ${seed}`);
    }
  }
});
