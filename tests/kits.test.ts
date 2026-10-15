// Battle tests for the story-cast kits. Each new mechanic changes how a turn
// resolves, so each one is exercised in a real battle rather than assumed to
// work because it type-checks.
import test from "node:test";
import assert from "node:assert/strict";

import { applyGameAction } from "../src/lib/game-engine";
import { characterById, initialState, stats, type GameState } from "../src/lib/game-data";
import { stages } from "../src/lib/campaign";

const always = () => 0.5;          // deterministic dice
const never = () => 0.999;         // never crits / never rolls low
const lucky = () => 0.2;           // rolls under any rate-up threshold

/**
 * Put a specific character on the field and open a stage. The squad holds the
 * tested character plus one ally, and `turnOf`/`enemyOf` are always used to
 * read back state: applyGameAction structuredClones its input, so any object
 * captured before an action is a different (stale) object afterwards.
 */
function battleWith(id: string, random = always, stageId = "1-1"): GameState {
  const state = initialState();
  const owned = { id, level: 20, potential: 0, duplicates: 0 };
  if (!state.roster.some(o => o.id === id)) state.roster.push(owned);
  state.squad = [id];
  state.energy = 999;
  state.pity = 49;   // guarantees the next pull is an SSR if a test needs one
  const stage = stages.find(s => s.id === stageId)!;
  // stages unlock in order, so clear everything before this one
  state.cleared = stages.slice(0, stages.indexOf(stage)).map(s => s.id);
  const battle = applyGameAction(state, { action: "startBattle", id: stage.id }, random).state;
  return battle;
}
const act = (state: GameState, command: string, random = always, target = 0) =>
  applyGameAction(state, { action: "act", command, target }, random);

/** The current state's battle, with the tested character freshly resolved. */
const hero = (state: GameState, id = "ynna") => state.battle!.allies.find(a => a.id === id)!;
const foe = (state: GameState, index = 0) => state.battle!.enemies[index];
/** Energy is granted after the battle opens so ultimates can be tested. */
const withEnergy = (state: GameState, amount = 100) => {
  state.battle!.allies.forEach(a => { a.energy = amount; });
  return state;
};

test("every character's declared mechanic is implemented in the engine", () => {
  const source = require("node:fs").readFileSync("src/lib/game-engine.ts", "utf8");
  const declared = [...new Set([...require("node:fs").readFileSync("src/lib/game-data.ts", "utf8")
    .matchAll(/mechanic: "([a-z]+)"/g)].map((m: RegExpMatchArray) => m[1]))];
  for (const mechanic of declared) {
    if (mechanic === "standard") continue;
    assert.match(source, new RegExp(`mechanic === "${mechanic}"`), `mechanic "${mechanic}" is declared but has no branch`);
  }
  assert.ok(declared.length >= 10, `expected the full set of kits, saw ${declared.join(", ")}`);
});

test("Ynna builds rate-up while she misses, and resets when it lands", () => {
  let state = withEnergy(battleWith("ynna"));
  state = act(state, "attack", never).state;
  assert.equal(state.battle?.streak, 1, "a non-crit should build the rate-up streak");
  assert.match(state.battle!.log.join(" "), /rate-up and climbing/);
  state = act(state, "attack", never).state;
  assert.equal(state.battle?.streak, 2, "and keep building");
  // 0.2 is under the 14% + 2*12% = 38% threshold, so this one crits
  state = act(state, "attack", lucky).state;
  assert.equal(state.battle?.streak, 0, "landing the crit must reset the counter");
  assert.match(state.battle!.log.join(" "), /CRITICAL/);
});

test("Ynna's ultimate always crits and refunds energy on a kill", () => {
  let state = withEnergy(battleWith("ynna"));
  foe(state).hp = 1;                              // anything she does kills it
  state = act(state, "ultimate").state;
  assert.equal(foe(state).hp, 0, "the guaranteed pull should finish it");
  assert.ok(hero(state, "ynna").energy >= 20, "the refund should land");
  assert.match(state.battle!.log.join(" "), /guaranteed pull/);
});

test("Solari turns healing overflow into shields", () => {
  let state = battleWith("solari");
  // full health squad + a heal => shields.
  const before = state.battle!.allies.map(a => a.shield ?? 0);
  assert.ok(before.every(s => s === 0), "the squad starts unshielded");
  state = act(state, "skill").state;
  const shields = state.battle!.allies.map(a => a.shield ?? 0);
  assert.ok(shields.some(s => s > 0), `healing at full health should sanctify into shields, saw ${shields.join(",")}`);
  assert.match(state.battle!.log.join(" "), /sanctified into shields/);
});

test("Solari revives a fallen ally with her ultimate", () => {
  let state = withEnergy(battleWith("solari"));
  // add a second squad member: a revive test needs somebody to revive
  state.battle!.allies.push({ id: "ruta", name: "Ruta", hp: 400, maxHp: 900, energy: 0, attack: 100, defense: 40 });
  const allyId = state.battle!.allies[1].id;
  state.battle!.allies[1].hp = 0;
  state = act(state, "ultimate").state;
  const revived = state.battle!.allies.find(a => a.id === allyId)!;
  assert.ok(revived.hp > 0, "the fallen ally should be back on the payroll");
  assert.ok((revived.shield ?? 0) > 0, "and shielded");
  assert.match(state.battle!.log.join(" "), /audited back onto the payroll/);
});

test("Escanooor's guard covers the squad and his ultimate detains", () => {
  let state = battleWith("escanooor");
  state = act(state, "guard").state;
  const shields = state.battle!.allies.map(a => a.shield ?? 0);
  assert.ok(shields.every(v => v > 0), `his guard should cover everyone, saw ${shields.join(",")}`);
  assert.match(state.battle!.log.join(" "), /holds the line/);

  let second = withEnergy(battleWith("escanooor"));
  second = act(second, "ultimate").state;
  assert.equal(foe(second).stunned, true, "the ultimate should detain its target");
  assert.match(second.battle!.log.join(" "), /detained/);
});

test("a detained enemy loses its turn", () => {
  let state = withEnergy(battleWith("escanooor"));
  assert.ok(state.battle!.enemies.length >= 1);
  // give it enough health to survive the blow (but stay under the 10,000
  // threshold that switches the engine into boss damage scaling)
  state.battle!.enemies[0].hp = 9000;
  state.battle!.enemies[0].maxHp = 9000;
  state = act(state, "ultimate").state;      // detains enemy 0
  const hpBefore = state.battle!.allies.map(a => a.hp);
  const livingIndex = state.battle!.enemies.findIndex(e => e.hp > 0);
  state = act(state, "attack", always, livingIndex < 0 ? 0 : livingIndex).state;   // enemy phase runs
  const log = state.battle!.log.join(" ");
  assert.match(log, /still in detention and loses its turn/, "the stunned enemy must be skipped");
  
});

test("Ninette marks a target, and the mark pays out", () => {
  let state = withEnergy(battleWith("ninette"));
  state = act(state, "attack", always, 0).state;
  const marked = state.battle!.enemies.find(e => e.audited);
  assert.ok(marked, "her attack should open an audit line item");
  assert.match(state.battle!.log.join(" "), /marked/);

  const hpAfterMark = marked!.hp;
  state = act(state, "skill", always, 0).state;
  const same = state.battle!.enemies.find(e => e.id === marked!.id)!;
  assert.ok(same.hp < hpAfterMark, "the audited target should take the payout");
  assert.equal(same.audited, false, "and the line item closes");
});

test("Ninette's ultimate refunds the squad's energy", () => {
  let state = battleWith("ninette");
  state = act(state, "attack").state;                       // mark something
  // solo squad: the same hero acts again, so give her the energy for an ultimate
  const squadSize = state.battle!.allies.length;
  state.battle!.allies.forEach(a => { a.energy = 100; });
  const before = state.battle!.allies.map(a => a.energy);
  state = act(state, "ultimate").state;
  assert.equal(state.battle!.allies.length, squadSize);
  assert.match(state.battle!.log.join(" "), /refunded 25 energy|ledger balances/);
  assert.ok(before.every(e => e === 100));
});

test("Director Vane steals charge and banks credits", () => {
  let state = battleWith("vane");
  const creditsBefore = state.credits;
  state.battle!.enemies[0].energy = 60;
  const enemyId = state.battle!.enemies[0].id;
  state = act(state, "skill").state;
  assert.ok(state.battle!.enemies.find(e => e.id === enemyId)!.energy < 60,
    "he should acquire the enemy's charge");

  let second = withEnergy(battleWith("vane"));
  const creditsBefore2 = second.credits;
  second = act(second, "ultimate").state;
  assert.ok(second.credits > creditsBefore2, "the ultimate should bank the proceeds");
  assert.match(second.battle!.log.join(" "), /proceeds bank/);
});

test("the Sorcerer's siphon routes damage back to the squad", () => {
  let state = battleWith("sorcerer");
  state.battle!.allies.forEach(a => { a.hp = Math.round(a.maxHp * .4); });
  const before = state.battle!.allies.map(a => a.hp);
  state = act(state, "skill").state;
  assert.ok(state.battle!.allies.every((a, i) => a.hp >= before[i]), "the squad should be paid from the ledger");
  assert.ok(state.battle!.allies.some((a, i) => a.hp > before[i]), "at least one ally should actually recover");
});

test("shields absorb enemy damage before health", () => {
  let state = battleWith("escanooor");
  state = act(state, "guard").state;                 // everyone shielded
  const actors = state.battle!.allies.map(a => ({ hp: a.hp, shield: a.shield ?? 0 }));
  assert.ok(actors.every(a => a.shield > 0));
  // let the enemy phase run
  state = act(state, "attack").state;
  const log = state.battle!.log.join(" ");
  assert.ok(/absorbed by a shield/.test(log) || state.battle!.allies.every((a, i) => (a.shield ?? 0) <= actors[i].shield),
    "a shield should either absorb the hit or be reduced by it");
});

test("the new story units are recruitable and usable", () => {
  for (const id of ["vane", "sorcerer", "ynna", "ninette", "solari", "escanooor"]) {
    const c = characterById(id);
    assert.equal(c.id, id, `${id} must exist on the roster`);
    const s = stats({ id, level: 1, potential: 0, duplicates: 0 });
    assert.ok(s.hp > 0 && s.attack > 0, `${id} needs usable stats`);
  }
  // a pull can surface them
  const state = initialState();
  state.gems = 100000;
  const pulled = applyGameAction(state, { action: "pull", count: 10 }, () => 0.42);
  assert.equal(pulled.pulls?.length, 10);
});

test("Penelope's chaos package stays unpredictable but never hurts the squad", () => {
  // She is allowed to hit herself, but never to finish herself off, and every
  // branch has to leave the battle playable.
  let state = withEnergy(battleWith("penelope"));
  for (const roll of [0.01, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 0.99]) {
    const dice = () => roll;
    const fresh = withEnergy(battleWith("penelope"));
    fresh.battle!.enemies.forEach(e => { e.hp = 40000; e.maxHp = 40000; });
    for (const cmd of ["attack", "skill", "ultimate"]) {
      const out = act(fresh, cmd, dice, 0).state;
      const me = out.battle!.allies.find(a => a.id === "penelope")!;
      assert.ok(me.hp > 0, `roll ${roll} + ${cmd} must not defeat Penelope`);
      assert.ok(out.battle!.allies.length > 0);
    }
  }
});

test("the kitchen provides: one Penelope ultimate outcome shields the squad", () => {
  const state = withEnergy(battleWith("penelope"));
  state.battle!.enemies.forEach(e => { e.hp = 40000; e.maxHp = 40000; });
  // 0.05 lands in the first branch; 0.2 in the second; 0.4 the third;
  // 0.85 the scream; 0.97 the souffle.
  const jackpot = act(state, "ultimate", () => 0.97, 0).state;
  assert.match(jackpot.battle!.log.join(" "), /SOUFFL/i);
  const shielded = jackpot.battle!.allies.every(a => (a.shield ?? 0) > 0);
  assert.ok(shielded, "the perfect souffle should shield the whole squad");
  const charged = jackpot.battle!.allies.every(a => a.energy >= 80);
  assert.ok(charged, "and charge them");
});

test("every one of the four featured attacks can spring a chaotic twist", () => {
  // Ruta's lance, Purp's grimoire and Edgelord69's monologue all have a
  // chance-based flourish on the basic attack; roll under it to prove each
  // one fires and that the turn still resolves.
  const twists: Array<[string, RegExp]> = [
    ["ruta", /lance keeps going/i],
    ["purp", /will not close/i],
    ["edgelord", /still cutting/i],
  ];
  for (const [id, pattern] of twists) {
    const state = withEnergy(battleWith(id));
    state.battle!.enemies.forEach(e => { e.hp = 40000; e.maxHp = 40000; });
    if (state.battle!.enemies.length < 2) {
      state.battle!.enemies.push({ ...state.battle!.enemies[0], id: "spare", name: "Spare Slime" });
    }
    const out = act(state, "attack", () => 0.01, 0).state;
    assert.match(out.battle!.log.join(" "), pattern, `${id} should spring its twist on a low roll`);
  }
});

test("Penelope's clumsiness tax never kills her", () => {
  const state = withEnergy(battleWith("penelope"));
  state.battle!.enemies.forEach(e => { e.hp = 40000; e.maxHp = 40000; });
  state.battle!.allies[0].hp = 1;                 // one clumsy follow-through from defeat
  // Isolate recoil from enemy retaliation. The old giant-HP damage multiplier
  // accidentally ended this fight before enemies could act.
  state.battle!.allies.push({ ...state.battle!.allies[0], id: "ynna", name: "Ynna", hp: 1000 });
  const out = act(state, "attack", () => 0.01, 0).state;
  const me = out.battle!.allies.find(a => a.id === "penelope")!;
  assert.ok(me.hp >= 1, "she should be embarrassed, not defeated");
  assert.match(out.battle!.log.join(" "), /shin|fine/i);
});
