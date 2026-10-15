import test from "node:test";
import assert from "node:assert/strict";
import { stages } from "../src/lib/campaign";
import { initialState, characterById } from "../src/lib/game-data";
import { applyGameAction, enemyAttack, enemyHp } from "../src/lib/game-engine";
import { campaignCredits, chapterMinimumLevel, recommendedLevel, squadAverageLevel } from "../src/lib/campaign-balance";

const ordinary = () => .8;
function ready(index: number, level: number, ids = ["pip", "mira", "quill", "brass"]) {
  const state = initialState();
  state.roster = ids.map(id => ({ id, level, potential: 0, duplicates: 0 }));
  state.squad = ids;
  state.cleared = stages.slice(0, index).map(s => s.id);
  return state;
}

test("chapter floors and recommendations rise without demanding max-level recruits", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(chapterMinimumLevel), [1, 7, 15, 23, 31]);
  assert.equal(recommendedLevel(1), 1);
  assert.equal(recommendedLevel(25), 39);
  for (let wave = 1; wave < 25; wave++) {
    assert.ok(recommendedLevel(wave + 1) > recommendedLevel(wave));
    assert.ok(enemyAttack(wave + 1) > enemyAttack(wave));
    assert.ok(campaignCredits(wave + 1, false) > campaignCredits(wave, false));
  }
  assert.ok(enemyAttack(25) > 750 && enemyAttack(25) < 1000);
});

test("new chapter requires average equipped levels before spending energy; replays remain open", () => {
  const state = ready(5, 6);
  const before = structuredClone(state);
  assert.throws(() => applyGameAction(state, { action: "startBattle", id: "2-1" }, ordinary), /average squad level of 7/);
  assert.deepEqual(state, before);
  const replay = applyGameAction(state, { action: "startBattle", id: "1-5" }, ordinary).state;
  assert.ok(replay.battle);
  const mixed = ready(5, 6);
  mixed.roster[0].level = 10; // (10 + 6 + 6 + 6) / 4 = 7
  assert.equal(squadAverageLevel(mixed), 7);
  assert.ok(applyGameAction(mixed, { action: "startBattle", id: "2-1" }, ordinary).state.battle);
});

test("first clears and replays award exactly the displayed scalable credit amounts", () => {
  for (const index of [0, 9, 24]) {
    for (const first of [true, false]) {
      const state = ready(index, 50);
      if (!first) state.cleared.push(stages[index].id);
      const fighting = applyGameAction(state, { action: "startBattle", id: stages[index].id }, ordinary).state;
      fighting.battle!.status = "victory";
      const result = applyGameAction(fighting, { action: "finishStage" }, ordinary).state;
      assert.equal(result.credits - state.credits, campaignCredits(index + 1, first));
      assert.equal(result.gems - state.gems, first ? 200 : 0);
      assert.throws(() => applyGameAction(result, { action: "finishStage" }, ordinary), /Win the battle/);
    }
  }
});

test("boss HP and actual damage have no million-HP or thousandfold-damage cliffs", () => {
  assert.ok(enemyHp(10, true, "2-5") < 20000);
  assert.ok(enemyHp(25, true, "5-5") < 30000);
  const state = applyGameAction(ready(24, 39), { action: "startBattle", id: "5-5" }, ordinary).state;
  const target = state.battle!.enemies.findIndex(e => e.boss);
  const originalHp = state.battle!.enemies[target].hp;
  const out = applyGameAction(state, { action: "act", command: "attack", target }, ordinary).state;
  assert.ok(out.battle!.enemies[target].hp > 0);
  const damage = originalHp - out.battle!.enemies[target].hp;
  assert.ok(damage > 0 && damage < state.battle!.allies[0].attack * 2);
});

test("recommended-level zero-potential SR and SSR teams can clear all stages with sensible skill use", () => {
  for (const ids of [["pip", "mira", "quill", "brass"], ["aster", "vesper", "maribel", "rook"]]) {
    for (let index = 0; index < stages.length; index++) {
      for (let seed = 1; seed <= 6; seed++) {
        let randomState = seed;
        const random = () => {
          let t = randomState += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        let state = applyGameAction(ready(index, recommendedLevel(index + 1), ids), { action: "startBattle", id: stages[index].id }, random).state;
        for (let commands = 0; state.battle!.status === "active" && commands < 400; commands++) {
          const b = state.battle!;
          const actor = b.allies[b.active];
          const healer = ["Healer", "Support"].includes(characterById(actor.id).role);
          const hurt = b.allies.some(a => a.hp > 0 && a.hp < a.maxHp * .7);
          const command = healer && !hurt ? "attack" : actor.energy >= 100 ? "ultimate" : actor.energy >= 20 ? "skill" : "attack";
          const target = b.enemies.reduce((best, enemy, i) => enemy.hp > 0 && (best < 0 || enemy.hp < b.enemies[best].hp) ? i : best, -1);
          state = applyGameAction(state, { action: "act", command, target }, random).state;
        }
        assert.equal(state.battle!.status, "victory", `${ids[0]}, stage ${stages[index].id}, seed ${seed}`);
      }
    }
  }
});

test("older active boss saves are rebased once without losing damage or status effects", () => {
  const original = applyGameAction(ready(24, 39), { action: "startBattle", id: "5-5" }, ordinary).state;
  delete original.battle!.balanceVersion;
  const boss = original.battle!.enemies.find(e => e.boss)!;
  boss.maxHp = 5000000;
  boss.hp = 2500000;
  boss.audited = true;
  const rebased = applyGameAction(original, { action: "init" }, ordinary).state;
  const updated = rebased.battle!.enemies.find(e => e.boss)!;
  assert.equal(rebased.battle!.balanceVersion, 2);
  assert.equal(updated.maxHp, enemyHp(25, true));
  assert.equal(updated.hp, Math.round(updated.maxHp * .5));
  assert.equal(updated.audited, true);
  assert.equal(updated.attack, enemyAttack(25));
  assert.equal(original.battle!.enemies.find(e => e.boss)!.maxHp, 5000000);
  const again = applyGameAction(rebased, { action: "init" }, ordinary).state;
  assert.deepEqual(again.battle, rebased.battle);
});
