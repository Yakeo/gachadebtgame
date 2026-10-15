import test from "node:test";
import assert from "node:assert/strict";
import { characters, initialState, missionProgress, missions, type MissionKind } from "../src/lib/game-data";
import { stages } from "../src/lib/campaign";
import { applyGameAction } from "../src/lib/game-engine";

const legacyRewards = {
  "welcome-gift": [3200, 0], "first-stage": [200, 1000], "chapter-one": [500, 3000],
  "first-ten": [320, 1500], "full-squad": [400, 2000], "all-stages": [2000, 15000],
};
const added = missions.filter(m => !(m.id in legacyRewards));
const noRolls = () => { throw new Error("Mission rewards must not roll RNG"); };
const claim = (state: ReturnType<typeof initialState>, id: string, extra = {}) => applyGameAction(state, { ...extra, action: "claim", id }, noRolls).state;
function progressState(kind: MissionKind, progress: number) {
  const state = initialState();
  state.energy = 50; // Keep incidental wall-clock regeneration out of comparisons.
  switch (kind) {
    case "stages": state.cleared = stages.slice(0, progress).map(s => s.id); break;
    case "pulls": state.totalPulls = progress; break;
    case "roster": state.roster = characters.slice(0, progress).map(c => ({ id: c.id, level: 1, potential: 0, duplicates: 0 })); break;
    case "level": state.roster[1].level = progress; break;
    default: throw new Error("Use a progression milestone");
  }
  return state;
}

test("24 new missions add 153 rolls' worth of gems and 960,000 credits without rewriting old rewards", () => {
  assert.equal(missions.length, 30);
  assert.equal(new Set(missions.map(m => m.id)).size, missions.length);
  assert.equal(added.length, 24);
  assert.equal(added.reduce((sum, m) => sum + m.gems, 0), 24480);
  assert.equal(added.reduce((sum, m) => sum + m.credits, 0), 960000);
  for (const [id, rewards] of Object.entries(legacyRewards)) {
    const mission = missions.find(m => m.id === id)!;
    assert.deepEqual([mission.gems, mission.credits], rewards, id);
  }
  for (const m of added) {
    assert.ok(m.gems > 0 && m.credits > 0, `${m.id} needs both currencies`);
    assert.ok(Number.isSafeInteger(m.goal) && m.goal > 0);
    assert.ok(Number.isSafeInteger(m.gems) && Number.isSafeInteger(m.credits));
  }
});

for (const mission of added) {
  test(`${mission.id}: threshold, fixed payout, progress preservation and one-time claim`, () => {
    const below = progressState(mission.kind, mission.goal - 1);
    assert.equal(missionProgress(below, mission.kind), mission.goal - 1);
    assert.throws(() => claim(below, mission.id), /Complete the mission objective/);
    const before = progressState(mission.kind, mission.goal);
    before.claimed = ["welcome-gift"]; before.pity = 17;
    const state = claim(before, mission.id, { gems: 999999, credits: 999999, claimed: [] });
    assert.equal(state.gems, before.gems + mission.gems);
    assert.equal(state.credits, before.credits + mission.credits);
    assert.deepEqual(state.claimed, ["welcome-gift", mission.id]);
    assert.deepEqual({ ...state, gems: before.gems, credits: before.credits, claimed: before.claimed }, before);
    assert.deepEqual(before.claimed, ["welcome-gift"], "input save is not mutated");
    const restored = applyGameAction(JSON.parse(JSON.stringify(state)), { action: "init" }, noRolls).state;
    assert.throws(() => claim(restored, mission.id, { claimed: [] }), /already been claimed/);
    if (mission.kind !== "level" || mission.goal < 50) {
      const above = progressState(mission.kind, mission.goal + 1);
      assert.equal(claim(above, mission.id).gems, above.gems + mission.gems);
    }
  });
}

test("older saves can claim all earned new milestones even after completing every old mission", () => {
  const before = progressState("roster", 30);
  delete before.starterUrClaimed;
  before.cleared = stages.map(s => s.id); before.totalPulls = 300;
  before.roster[5].level = 50;
  before.gems = 123; before.credits = 456; before.pity = 24;
  before.claimed = Object.keys(legacyRewards);
  before.choices = { audit: "refuse" };
  let state = structuredClone(before);
  for (const mission of added) state = claim(state, mission.id);
  assert.equal(state.gems, 123 + 24480);
  assert.equal(state.credits, 456 + 960000);
  assert.equal(state.claimed.length, missions.length);
  assert.deepEqual({ ...state, gems: before.gems, credits: before.credits, claimed: before.claimed }, before);
  for (const mission of missions) assert.throws(() => claim(state, mission.id), /already been claimed/);
});

test("stage/collection milestones count distinct entries; training uses the highest owned level", () => {
  const state = initialState();
  state.cleared = ["1-1", "1-1", "1-1"];
  state.roster.push(structuredClone(state.roster[0]));
  assert.equal(missionProgress(state, "stages"), 1);
  assert.equal(missionProgress(state, "roster"), 3);
  assert.throws(() => claim(state, "stages-3"), /Complete the mission/);
  assert.throws(() => claim(state, "roster-4"), /Complete the mission/);
  state.roster[2].level = 40;
  assert.equal(missionProgress(state, "level"), 40);
  state.roster = [];
  assert.equal(missionProgress(state, "level"), 0);
});

test("replayed stages, duplicate tokens and the free selector cannot fake pull counts", () => {
  const state = initialState();
  state.roster[0].duplicates = 300;
  state.starterUrClaimed = "alice";
  state.cleared = ["1-1"];
  assert.equal(missionProgress(state, "pulls"), 0);
  assert.throws(() => claim(state, "pulls-1"), /Complete the mission/);
  assert.throws(() => claim(state, "not-a-real-mission"), /Mission not found/);
});
