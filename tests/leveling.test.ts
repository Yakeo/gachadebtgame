import test from "node:test";
import assert from "node:assert/strict";
import { applyGameAction } from "../src/lib/game-engine";
import { initialState } from "../src/lib/game-data";
import { affordableLevels, MAX_CHARACTER_LEVEL, upgradeCost } from "../src/lib/leveling";

function ownedState(level = 1, credits = 10000) {
  const state = initialState();
  state.roster = [{ id: "ynna", level, potential: 0, duplicates: 0 }];
  state.credits = credits;
  return state;
}
const ordinary = () => .8;

test("bulk pricing exactly matches repeated single-level purchases at every level", () => {
  for (let level = 1; level < MAX_CHARACTER_LEVEL; level++) {
    for (let count = 1; count <= MAX_CHARACTER_LEVEL - level; count++) {
      let expected = 0;
      for (let i = 0; i < count; i++) expected += (level + i) * 200;
      assert.equal(upgradeCost(level, count), expected);
    }
  }
});

test("affordable count handles exact budgets, no credits and the level cap", () => {
  assert.equal(affordableLevels(1, 0), 0);
  assert.equal(affordableLevels(1, 199), 0);
  assert.equal(affordableLevels(1, 200), 1);
  assert.equal(affordableLevels(1, 1199), 2);
  assert.equal(affordableLevels(1, 1200), 3);
  assert.equal(affordableLevels(49, 9800), 1);
  assert.equal(affordableLevels(50, 999999), 0);
  assert.equal(affordableLevels(1, Infinity), 0);
  assert.equal(affordableLevels(1, 1e9), 49);
  for (let level = 1; level < 50; level++) {
    for (const credits of [0, 999, 1000, 4800, 20000, 100000, 245000]) {
      const count = affordableLevels(level, credits);
      if (count) assert.ok(upgradeCost(level, count) <= credits);
      if (level + count < 50) assert.ok(upgradeCost(level, count + 1) > credits);
    }
  }
});

test("a bulk upgrade spends the cumulative price once and matches single upgrades", () => {
  const initial = ownedState(7, 20000);
  const result = applyGameAction(initial, { action: "upgrade", id: "ynna", levels: 5 }, ordinary);
  assert.equal(result.state.roster[0].level, 12);
  assert.equal(result.state.credits, 11000);
  assert.match(result.message, /level 12/);
  let repeated = initial;
  for (let i = 0; i < 5; i++) repeated = applyGameAction(repeated, { action: "upgrade", id: "ynna" }, ordinary).state;
  assert.deepEqual(result.state.roster, repeated.roster);
  assert.equal(result.state.credits, repeated.credits);
  assert.equal(initial.roster[0].level, 7);
  assert.equal(initial.credits, 20000);
});

test("server rejects malformed, unaffordable and over-cap batches without changing the save", () => {
  for (const levels of [0, -1, .5, NaN, Infinity, 50, 1e9, "3", null, true, {}, []]) {
    const state = ownedState();
    const before = structuredClone(state);
    assert.throws(() => applyGameAction(state, { action: "upgrade", id: "ynna", levels }, ordinary), /valid number/);
    assert.deepEqual(state, before);
  }
  const state = ownedState(1, 1199);
  assert.throws(() => applyGameAction(state, { action: "upgrade", id: "ynna", levels: 3 }, ordinary), /Not enough credits/);
  assert.equal(state.credits, 1199);
  assert.equal(state.roster[0].level, 1);
  assert.throws(() => applyGameAction(ownedState(49), { action: "upgrade", id: "ynna", levels: 2 }, ordinary), /valid number/);
  assert.throws(() => applyGameAction(ownedState(50), { action: "upgrade", id: "ynna" }, ordinary), /Maximum level/);
  assert.throws(() => applyGameAction(ownedState(), { action: "upgrade", id: "penelope", levels: 2 }, ordinary), /Recruit/);
});

test("exact-balance purchase reaches level 50 with zero remaining credits", () => {
  const state = ownedState(1, upgradeCost(1, 49));
  const result = applyGameAction(state, { action: "upgrade", id: "ynna", levels: 49 }, ordinary).state;
  assert.equal(result.roster[0].level, 50);
  assert.equal(result.credits, 0);
});
