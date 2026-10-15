import test from "node:test";
import assert from "node:assert/strict";
import { characterById, characters, initialState, stats, type GameState } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
import { rollInitiative } from "../src/lib/initiative";
import { baseStatBlock, CHARACTER_PROFILES } from "../src/lib/character-stats";
import { stages } from "../src/lib/campaign";
const random = () => .5;
function start(ids = ["ynna", "ninette", "edgelord"], stageId = "1-1") {
  const state = initialState();
  state.roster = ids.map(id => ({ id, level: 1, potential: 0, duplicates: 0 }));
  state.squad = ids;
  state.cleared = stages.map(s => s.id);
  return applyGameAction(state, { action: "startBattle", id: stageId }, random).state;
}
function act(state: GameState, command = "guard") {
  return applyGameAction(state, { action: "act", command, target: state.battle!.enemies.findIndex(e => e.hp > 0) }, random).state;
}
function order(state: GameState, entries: ["ally" | "enemy", number][]) {
  const b = state.battle!;
  b.initiative = entries.map(([side, index]) => ({ side, id: (side === "ally" ? b.allies : b.enemies)[index].id, score: 120 - index }));
  b.initiativeIndex = 0; b.active = entries[0][1]; b.enemyActions = [];
  return state;
}

test("every recruit has an explicit class, unique identity and a four-stat block", () => {
  assert.equal(Object.keys(CHARACTER_PROFILES).length, characters.length);
  for (const c of characters) {
    assert.ok(CHARACTER_PROFILES[c.id], c.id);
    for (const value of [c.hp, c.attack, c.defense, c.speed]) assert.ok(Number.isInteger(value) && value > 0);
  }
  assert.ok(characterById("brass").hp > characterById("pip").hp);
  assert.ok(characterById("brass").defense > characterById("quill").defense);
  assert.ok(characterById("pip").speed > characterById("brass").speed);
  assert.notDeepEqual(stats({ id: "mira", level: 1, potential: 0, duplicates: 0 }), stats({ id: "lumi", level: 1, potential: 0, duplicates: 0 }));
});
test("rarity bonuses are modest and do not erase class tradeoffs", () => {
  const template = { id: "pip", hp: 1000, attack: 150, defense: 40, rarity: "SR" as const };
  const sr = baseStatBlock(template), ssr = baseStatBlock({ ...template, rarity: "SSR" });
  for (const key of ["hp", "attack", "defense"] as const) assert.ok(ssr[key] > sr[key] && ssr[key] < sr[key] * 1.08);
  const low = stats({ id: "pip", level: 1, potential: 0, duplicates: 0 });
  const high = stats({ id: "pip", level: 50, potential: 5, duplicates: 0 });
  assert.equal(high.speed - low.speed, 9, "speed grows gently rather than multiplying with level");
});
test("speed orders mixed sides, while the roll can reverse nearby speeds", () => {
  const b = start().battle!;
  b.allies.forEach(a => a.hp = 0); b.enemies.forEach(e => e.hp = 0);
  b.allies[0].hp = 100; b.allies[0].speed = 110;
  b.enemies[0].hp = 100; b.enemies[0].speed = 100;
  assert.equal(rollInitiative(b, () => .5)[0].side, "ally");
  const rolls = [0, .5, .999, .5]; let i = 0;
  assert.equal(rollInitiative(b, () => rolls[i++])[0].side, "enemy");
});
test("enemies really damage a slow squad before its first decision", () => {
  const b = start(["brass"]).battle!;
  assert.ok(b.enemyActions!.length > 0);
  assert.ok(b.allies[0].hp < b.allies[0].maxHp);
  assert.equal(b.initiative![0].side, "enemy");
  assert.equal(b.initiative![b.initiativeIndex!].id, b.allies[b.active].id);
});
test("an enemy can act between allies without incrementing the round", () => {
  let state = order(start(), [["ally", 0], ["enemy", 0], ["ally", 1], ["enemy", 1], ["ally", 2]]);
  state = act(state);
  assert.equal(state.battle!.turn, 1);
  assert.equal(state.battle!.active, 1);
  assert.deepEqual(state.battle!.enemyActions!.map(m => m.actor), [state.battle!.enemies[0].id]);
});
test("every survivor receives exactly one slot each round, with no speed extra turns", () => {
  let state = start();
  const b = state.battle!;
  b.allies.forEach(a => { a.hp = a.maxHp = 100000; });
  b.enemies.forEach(e => { e.hp = e.maxHp = 100000; });
  let round = 1;
  const counts = new Map<string, number>();
  b.enemyActions!.forEach(move => counts.set(`${round}:${move.actor}`, 1));
  for (let n = 0; n < 20 && round < 4; n++) {
    const actor = state.battle!.allies[state.battle!.active];
    const key = `${round}:${actor.id}`; counts.set(key, (counts.get(key) ?? 0) + 1);
    const old = state.battle!;
    state = act(state); round = state.battle!.turn;
    // Opening enemy slots of a newly rolled round occur in the same response.
    const remaining = old.initiative!.slice(old.initiativeIndex! + 1).filter(e => e.side === "enemy").map(e => e.id);
    for (const move of state.battle!.enemyActions!) {
      const moveRound = remaining[0] === move.actor ? old.turn : round;
      if (remaining[0] === move.actor) remaining.shift();
      const k = `${moveRound}:${move.actor}`; counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  for (let r = 1; r < round; r++) for (const unit of [...b.allies, ...b.enemies]) assert.equal(counts.get(`${r}:${unit.id}`), 1, `${r}:${unit.id}`);
});
test("dead enemy slots are skipped and victory stops pending attacks", () => {
  let state = order(start(), [["ally", 0], ["enemy", 0], ["ally", 1], ["enemy", 1], ["ally", 2]]);
  state.battle!.enemies[0].hp = 1;
  state = act(state, "attack");
  assert.equal(state.battle!.active, 1);
  assert.equal(state.battle!.enemyActions!.length, 0);
  state.battle!.enemies.forEach(e => { if (e.hp > 0) e.hp = 1; });
  state = act(state, "attack");
  assert.equal(state.battle!.status, "victory");
  assert.equal(state.battle!.enemyActions!.length, 0);
});
test("stun consumes exactly the next enemy initiative slot", () => {
  let state = order(start(), [["ally", 0], ["enemy", 0], ["ally", 1]]);
  state.battle!.enemies[0].stunned = true;
  state = act(state);
  assert.equal(state.battle!.enemies[0].stunned, false);
  assert.equal(state.battle!.enemyActions![0].skipped, true);
  assert.equal(state.battle!.active, 1);
});
test("guard persists across a round boundary until that character acts again", () => {
  let state = order(start(), [["ally", 0], ["enemy", 0], ["ally", 1]]);
  state = act(state);
  assert.equal(state.battle!.allies[0].guard, true);
  state.battle!.allies[0].speed = 1000;
  state = act(state);
  assert.equal(state.battle!.turn, 2);
  assert.equal(state.battle!.allies[0].guard, true);
  assert.equal(state.battle!.active, 0);
  state = act(state, "attack");
  assert.equal(state.battle!.allies[0].guard, false);
});
test("legacy resume preserves the active ally and HP fraction without replaying enemies", () => {
  const state = start(); const b = state.battle!;
  delete b.initiative; delete b.initiativeIndex;
  b.active = 1; b.allies[1].hp = Math.round(b.allies[1].maxHp / 2);
  const next = applyGameAction(state, { action: "init" }, () => { throw Error("resume must not roll"); }).state;
  assert.equal(next.battle!.active, 1);
  assert.equal(next.battle!.initiative![0].id, b.allies[1].id);
  assert.equal(next.battle!.enemyActions!.length, 0);
  assert.equal(next.battle!.allies[1].hp, b.allies[1].hp);
  assert.deepEqual(applyGameAction(next, { action: "init" }, random).state.battle, next.battle);
});
test("opening enemy turns can cause defeat; stale actions are rejected", () => {
  const state = start(["shroom"], "5-4");
  assert.equal(state.battle!.status, "defeat");
  assert.throws(() => act(state), /no active battle/);
});

test("an ally defeated before its slot does not get to act", () => {
  let state = order(start(), [["ally", 0], ["enemy", 0], ["ally", 1], ["ally", 2], ["enemy", 1]]);
  state.battle!.allies[1].hp = 1;
  state = act(state);
  assert.equal(state.battle!.allies[1].hp, 0);
  assert.equal(state.battle!.active, 2);
});
test("reviving someone absent from this round's queue does not grant a bonus action", () => {
  let state = order(start(["solari", "brass"]), [["ally", 0], ["enemy", 0], ["enemy", 1]]);
  state.battle!.allies[0].energy = 100;
  state.battle!.allies[1].hp = 0;
  state = act(state, "ultimate");
  assert.ok(state.battle!.allies[1].hp > 0);
  assert.equal(state.battle!.turn, 2);
  assert.ok(state.battle!.initiative!.some(e => e.id === "brass"));
});
test("shield absorption and enemy energy gain survive initiative resolution", () => {
  let state = order(start(), [["ally", 0], ["enemy", 0], ["ally", 1], ["ally", 2]]);
  const victim = state.battle!.allies[1];
  victim.shield = 1000;
  const hp = victim.hp, energy = victim.energy;
  state = act(state);
  assert.equal(state.battle!.allies[1].hp, hp);
  assert.ok(state.battle!.allies[1].shield! < 1000);
  assert.equal(state.battle!.allies[1].energy, energy + 12);
  assert.equal(state.battle!.enemyActions![0].damage, 0);
});
