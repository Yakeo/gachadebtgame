import test from "node:test";
import assert from "node:assert/strict";
import { initialState, characters, starterUrPool, STARTER_GEMS, STARTER_CREDITS } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const noRolls = () => { throw new Error("A selector must never roll RNG"); };
const act = (state: ReturnType<typeof initialState>, id: unknown) => applyGameAction(state, { action: "starterUr", id }, noRolls).state;

test("a fresh save gets 60 pulls' worth of gems and a free UR entitlement", () => {
  const state = initialState();
  assert.equal(STARTER_GEMS, 9600);
  assert.equal(state.gems / 160, 60);
  assert.equal(state.credits, STARTER_CREDITS);
  assert.equal(state.starterUrClaimed, null);
  assert.ok(starterUrPool().length >= 3);
  assert.deepEqual(starterUrPool(), characters.filter(c => !c.retired && c.rarity === "UR"));
});
for (const pick of starterUrPool()) {
  test(`the free selector grants exactly ${pick.name}, with no currency or pity spend`, () => {
    const before = initialState(); before.pity = 23; before.totalPulls = 27;
    const state = act(before, pick.id);
    assert.equal(state.starterUrClaimed, pick.id);
    assert.deepEqual(state.roster.find(c => c.id === pick.id), { id: pick.id, level: 1, potential: 0, duplicates: 0 });
    assert.equal(state.roster.length, before.roster.length + 1);
    assert.equal(state.gems, before.gems);
    assert.equal(state.credits, before.credits);
    assert.equal(state.pity, before.pity);
    assert.equal(state.totalPulls, before.totalPulls);
    assert.deepEqual(state.pullHistory, before.pullHistory);
    assert.deepEqual(state.squad, before.squad);
    assert.equal(before.starterUrClaimed, null, "input save is not mutated");
  });
}
test("reloading, init, and changing choices cannot claim another UR", () => {
  const claimed = act(initialState(), starterUrPool()[0].id);
  const reloaded = applyGameAction(JSON.parse(JSON.stringify(claimed)), { action: "init" }, noRolls).state;
  for (const pick of starterUrPool()) assert.throws(() => act(reloaded, pick.id), /already been claimed/);
  assert.deepEqual(reloaded.roster, claimed.roster);
  assert.equal(reloaded.gems, claimed.gems);
});
test("invalid, non-UR and unknown choices never consume the gift", () => {
  const before = initialState();
  for (const id of [null, undefined, "", "not-a-character", "penelope", "shroom"]) {
    assert.throws(() => act(before, id), /Choose an available UR/);
  }
  assert.equal(before.starterUrClaimed, null);
  assert.equal(before.roster.length, 3);
});
test("claiming an already-owned UR gives one token, not a second roster entry", () => {
  const before = initialState(); const id = starterUrPool()[0].id;
  before.roster.push({ id, level: 12, potential: 2, duplicates: 3 });
  const state = act(before, id);
  assert.deepEqual(state.roster.find(c => c.id === id), { id, level: 12, potential: 2, duplicates: 4 });
  assert.equal(state.roster.length, before.roster.length);
  assert.equal(state.credits, before.credits + 100);
  assert.equal(state.gems, before.gems);
  assert.equal(state.starterUrClaimed, id);
});
test("older preview saves get one selector, without resetting or topping up their gems", () => {
  const before = initialState(); delete before.starterUrClaimed;
  before.gems = 431; before.totalPulls = 100;
  const state = act(before, starterUrPool()[0].id);
  assert.equal(state.gems, 431);
  assert.equal(state.totalPulls, 100);
  assert.throws(() => act(state, starterUrPool()[1].id), /already been claimed/);
});
test("battle state cannot be edited via the welcome selector", () => {
  const before = applyGameAction(initialState(), { action: "startBattle", id: "1-1" }, () => .8).state;
  assert.throws(() => act(before, starterUrPool()[0].id), /Finish or retreat/);
});
test("client-supplied balance and claim flags cannot override the server grant", () => {
  const before = initialState(); const id = starterUrPool()[0].id;
  const state = applyGameAction(before, { action: "starterUr", id, gems: 999999, starterUrClaimed: null, roster: [] }, noRolls).state;
  assert.equal(state.gems, before.gems);
  assert.equal(state.roster.length, before.roster.length + 1);
  assert.equal(state.starterUrClaimed, id);
  assert.throws(() => applyGameAction(state, { action: "starterUr", id, starterUrClaimed: null }, noRolls), /already been claimed/);
});
