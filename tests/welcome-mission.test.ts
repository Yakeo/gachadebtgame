import test from "node:test";
import assert from "node:assert/strict";
import { initialState, missionProgress, missions, STARTER_GEMS, WELCOME_MISSION } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const noRolls = () => { throw new Error("A free mission must never roll RNG"); };
const claim = (state: ReturnType<typeof initialState>) => applyGameAction(state, { action: "claim", id: WELCOME_MISSION.id }, noRolls);

test("the welcome mission is immediately ready without stages, pulls or roster requirements", () => {
  const state = initialState(); state.roster = []; state.squad = [];
  assert.equal(missions.filter(m => m.id === WELCOME_MISSION.id).length, 1);
  assert.equal(WELCOME_MISSION.gems / 160, 20);
  assert.equal(missionProgress(state, WELCOME_MISSION.kind), WELCOME_MISSION.goal);
  const result = claim(state);
  assert.equal(result.state.gems, STARTER_GEMS + 3200);
  assert.equal(result.state.credits, state.credits);
  assert.equal(result.message, "Mission complete! +3200 gems.");
});

test("an older guest save receives the bonus without resetting or replacing its progress", () => {
  const state = initialState(); delete state.starterUrClaimed;
  state.gems = 123; state.pity = 34; state.totalPulls = 77;
  state.cleared = ["1-1"]; state.claimed = ["first-stage"];
  state.roster[0].level = 12; state.choices = { audit: "refuse" };
  const result = claim(state).state;
  assert.equal(result.gems, 3323);
  assert.deepEqual(result.claimed, ["first-stage", WELCOME_MISSION.id]);
  assert.deepEqual({ ...result, gems: state.gems, claimed: state.claimed }, state);
  assert.equal(state.gems, 123, "input save was not mutated");
  assert.deepEqual(state.claimed, ["first-stage"]);
});

test("welcome claims survive serialization and init, and cannot be repeated", () => {
  const claimed = claim(initialState()).state;
  const reloaded = applyGameAction(JSON.parse(JSON.stringify(claimed)), { action: "init" }, noRolls).state;
  assert.throws(() => claim(reloaded), /already been claimed/);
  assert.equal(reloaded.gems, claimed.gems);
  assert.equal(reloaded.claimed.filter(id => id === WELCOME_MISSION.id).length, 1);
});

test("welcome claim payload cannot override reward size or claim tracking", () => {
  const state = initialState();
  const result = applyGameAction(state, { action: "claim", id: WELCOME_MISSION.id, gems: 999999, claimed: [] }, noRolls).state;
  assert.equal(result.gems, state.gems + 3200);
  assert.throws(() => applyGameAction(result, { action: "claim", id: WELCOME_MISSION.id, claimed: [] }, noRolls), /already been claimed/);
});

test("other mission objectives remain locked for a fresh save", () => {
  for (const mission of missions.filter(m => m.id !== WELCOME_MISSION.id)) {
    assert.throws(() => applyGameAction(initialState(), { action: "claim", id: mission.id }, noRolls), /Complete the mission/);
  }
});
