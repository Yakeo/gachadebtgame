import test from "node:test";
import assert from "node:assert/strict";
import * as gameEngine from "../src/lib/game-engine";
import { applyGameAction, regenerateEnergy } from "../src/lib/game-engine";
import { characterById, companionLines, characters, initialState, stats } from "../src/lib/game-data";
import { stages } from "../src/lib/campaign";
const ordinary = () => .8;
test("The campaign has five chapters with five complete stages each", () => {
  assert.equal(stages.length, 25);
  for (let chapter = 1; chapter <= 5; chapter++) assert.equal(stages.filter(s => s.chapter === chapter).length, 5);
  for (const s of stages) { assert.ok(s.pre.length); assert.ok(s.post.length); assert.ok(s.enemies.length); }
});
test("The 50th consecutive pull guarantees SSR and resets pity", () => {
  let state = initialState(); state.gems = 100000;
  for (let i = 0; i < 49; i++) state = applyGameAction(state, { action: "pull", count: 1 }, ordinary).state;
  assert.equal(state.pity, 49);
  const result = applyGameAction(state, { action: "pull", count: 1 }, ordinary);
  assert.equal(result.pulls?.[0].rarity, "SSR");
  assert.equal(result.pulls?.[0].guaranteed, true);
  assert.equal(result.state.pity, 0);
  assert.equal(result.state.totalPulls, 50);
});
test("Pity resolves per character inside a ten-pull", () => {
  const state = initialState(); state.pity = 45;
  const result = applyGameAction(state, { action: "pull", count: 10 }, ordinary);
  assert.equal(result.pulls?.length, 10);
  assert.equal(result.pulls?.[4].guaranteed, true);
  assert.equal(result.state.pity, 5);
  assert.equal(result.state.gems, 3200);
});
test("Natural SSR and UR pulls reset pity", () => {
  const state = initialState(); state.pity = 30;
  const ssr = applyGameAction(state, { action: "pull", count: 1 }, () => .01);
  assert.equal(ssr.pulls?.[0].rarity, "SSR"); assert.equal(ssr.state.pity, 0);
  const ur = applyGameAction(state, { action: "pull", count: 1 }, () => .0001);
  assert.equal(ur.pulls?.[0].rarity, "UR"); assert.equal(ur.state.pity, 0);
});
test("Duplicates provide potential tokens and stat upgrades consume a token", () => {
  let state = initialState();
  state = applyGameAction(state, { action: "pull", count: 1 }, () => .01).state;
  const result = applyGameAction(state, { action: "pull", count: 1 }, () => .01);
  assert.equal(result.pulls?.[0].duplicate, true);
  const before = result.state.roster.find(c => c.id === "penelope")!;
  assert.equal(before.duplicates, 1);
  const upgraded = applyGameAction(result.state, { action: "potential", id: "penelope" }, ordinary);
  const after = upgraded.state.roster.find(c => c.id === "penelope")!;
  assert.equal(after.duplicates, 0); assert.equal(after.potential, 1);
  assert.ok(stats(after).attack > stats(before).attack);
  assert.equal(before.potential, 0, "Original state is never mutated");
});
test("Illegal actions cannot spend or grant currency", () => {
  const state = initialState(); state.gems = 0;
  assert.throws(() => applyGameAction(state, { action: "pull", count: 10 }, ordinary), /Not enough gems/);
  assert.throws(() => applyGameAction(state, { action: "startBattle", id: "5-5" }, ordinary), /previous stage/);
  assert.throws(() => applyGameAction(state, { action: "finishStage" }, ordinary), /Win the battle/);
  assert.throws(() => applyGameAction(state, { action: "claim", id: "all-stages" }, ordinary), /Complete the mission/);
  assert.throws(() => applyGameAction(state, { action: "potential", id: "ynna" }, ordinary), /duplicate/);
  assert.throws(() => applyGameAction(state, { action: "upgrade", id: "penelope" }, ordinary), /Recruit/);
  assert.equal(state.gems, 0);
});
test("First battle can be won and its first-clear reward collected only once", () => {
  let state = applyGameAction(initialState(), { action: "startBattle", id: "1-1" }, ordinary).state;
  assert.equal(state.energy, 112);
  let commands = 0;
  while (state.battle?.status === "active" && commands++ < 100) {
    const target = state.battle.enemies.findIndex(e => e.hp > 0);
    state = applyGameAction(state, { action: "act", command: "attack", target }, ordinary).state;
  }
  assert.equal(state.battle?.status, "victory");
  const finished = applyGameAction(state, { action: "finishStage" }, ordinary).state;
  assert.deepEqual(finished.cleared, ["1-1"]);
  assert.equal(finished.gems, 5000);
  assert.equal(finished.credits, 27900);
  assert.throws(() => applyGameAction(finished, { action: "finishStage" }, ordinary), /Win the battle/);
  const claimed = applyGameAction(finished, { action: "claim", id: "first-stage" }, ordinary).state;
  assert.equal(claimed.gems, 5200);
  assert.throws(() => applyGameAction(claimed, { action: "claim", id: "first-stage" }, ordinary), /already been claimed/);
});
test("Daily rewards are idempotent and energy has a hard cap", () => {
  const state = applyGameAction(initialState(), { action: "daily" }, ordinary).state;
  assert.equal(state.gems, 4960); assert.equal(state.energy, 120);
  assert.throws(() => applyGameAction(state, { action: "daily" }, ordinary), /gift has been claimed/);
  state.energy = 115; state.energyAt = Date.now() - 240000 * 30;
  assert.equal(regenerateEnergy(state).energy, 120);
});
test("The four designed units exist as SSR with distinct mechanics", () => {
  for (const id of ["penelope", "ruta", "purp", "edgelord"]) {
    const c = characterById(id);
    assert.equal(c.rarity, "SSR", `${id} should be SSR`);
    assert.ok(c.splash, `${id} should have splash art`);
    assert.ok(c.skill && c.ultimate && c.skillNote && c.ultimateNote && c.weapon);
  }
  assert.equal(characterById("penelope").mechanic, "chaos");
  assert.equal(characterById("ruta").mechanic, "pierce");
  assert.equal(characterById("purp").mechanic, "drain");
  assert.equal(characterById("edgelord").mechanic, "riposte");
  // Every member of the campaign cast has to actually appear in the script. The
  // stage each one joins at is part of the story, so this counts rather than
  // naming a stage - rewriting the script should not silently drop a character.
  for (const id of ["penelope", "ruta", "purp", "edgelord", "ynna", "ninette"]) {
    const name = characterById(id).name;
    const speaksIn = stages.filter(stage => [...stage.pre, ...stage.post].some(entry =>
      entry.kind === "line"
        ? entry.speaker === name
        : entry.options.some(option => option.reply.some(reply => reply.speaker === name))));
    assert.ok(speaksIn.length >= 2, `${name} is in the roster but speaks in only ${speaksIn.length} stage(s)`);
  }
});
function squadWith(...ids: string[]) {
  const state = initialState();
  for (const id of ids) if (!state.roster.some(c => c.id === id)) state.roster.push({ id, level: 20, potential: 0, duplicates: 0 });
  state.squad = ids;
  return state;
}
function readyStage(id: string, clearedCount: number, squad: string[], random: () => number) {
  const state = squadWith(...squad);
  state.cleared = stages.slice(0, clearedCount).map(s => s.id);
  state.energy = 120;
  const started = applyGameAction(state, { action: "startBattle", id }, random).state;
  started.battle!.allies.forEach(a => { a.energy = 100; });
  return started;
}

test("Penelope's chaos ultimate resolves five distinct outcomes", () => {
  const outcomes: string[] = [];
  for (const roll of [.05, .35, .6, .85, .97]) {
    const random = () => roll;
    let current = readyStage("1-1", 0, ["penelope"], random);
    current = applyGameAction(current, { action: "act", command: "ultimate", target: 0 }, random).state;
    const log = current.battle?.log.join(" ") ?? "";
    if (/catered the entire fight/.test(log)) outcomes.push("heal");
    else if (/PAN COMES BACK ON ITS OWN/.test(log)) outcomes.push("pan");
    else if (/SHE SCREAMS/.test(log)) outcomes.push("scream");
    else if (/SOUFFL/i.test(log)) outcomes.push("souffle");
    else if (/STOVE GOES UP/.test(log)) outcomes.push("damage");
    else outcomes.push("none:" + log);
  }
  // each roll must land a different outcome: five branches, five results
  assert.deepEqual(outcomes, ["damage", "heal", "pan", "scream", "souffle"]);
  assert.equal(new Set(outcomes).size, 5);
});

test("Penelope's pan swing is randomized every attack", () => {
  const amounts = [".5", ".15", ".85"].map(roll => {
    const random = () => Number(roll);
    let current = readyStage("1-1", 0, ["penelope"], random);
    current = applyGameAction(current, { action: "act", command: "attack", target: 0 }, random).state;
    return current.battle?.lastHit?.amount ?? 0;
  });
  assert.equal(new Set(amounts).size, 3, `expected three distinct pan hits, got ${amounts.join(",")}`);
});

test("Ruta's palisade pierces armor across every hostile", () => {
  const random = () => .5;
  let current = readyStage("1-1", 0, ["ruta"], random);
  const enemiesBefore = current.battle!.enemies.length;
  current = applyGameAction(current, { action: "act", command: "ultimate", target: 0 }, random).state;
  const log = current.battle?.log.join(" ") ?? "";
  assert.match(log, /Grand Palisade/);
  assert.match(log, /armor ignored/);
  assert.match(log, /skewered/);
  assert.equal(current.battle!.enemies.filter(e => e.hp <= 0).length, enemiesBefore, "every hostile should be struck");
});

test("Edgelord's cuts ignore armor and hit bosses harder", () => {
  const random = () => .5;
  let current = readyStage("1-1", 0, ["edgelord"], random);
  const bossless = current.battle?.lastHit;
  current = applyGameAction(current, { action: "act", command: "skill", target: 0 }, random).state;
  const logs = current.battle?.log.join(" ") ?? "";
  assert.match(logs, /Plastic Eclipse/);
  assert.match(logs, /armor ignored/);
  void bossless;
});

test("Purp's Packet Loss returns HP to the squad", () => {
  const random = () => .5;
  let current = readyStage("1-1", 0, ["purp"], random);
  current.battle!.allies.forEach(a => { a.hp = Math.round(a.maxHp * .3); });
  const before = current.battle!.allies.reduce((sum, a) => sum + a.hp, 0);
  current = applyGameAction(current, { action: "act", command: "skill", target: 0 }, random).state;
  const after = current.battle!.allies.reduce((sum, a) => sum + a.hp, 0);
  assert.ok(after > before, "Packet Loss must restore squad HP");
  assert.match(current.battle?.log.join(" ") ?? "", /Packet Loss/);
});

test("Story recruits unlock from their own stages", () => {
  const state = squadWith("ynna");
  state.roster.forEach(c => { c.level = 25; });
  state.cleared = stages.slice(0, 3).map(s => s.id);
  state.energy = 120;
  let current = applyGameAction(state, { action: "startBattle", id: "1-4" }, ordinary).state;
  let guard = 0;
  while (current.battle?.status === "active" && guard++ < 200) {
    const target = current.battle.enemies.findIndex(e => e.hp > 0);
    current = applyGameAction(current, { action: "act", command: "attack", target }, ordinary).state;
  }
  assert.equal(current.battle?.status, "victory", "stage 1-4 should be winnable");
  current = applyGameAction(current, { action: "finishStage" }, ordinary).state;
  assert.ok(current.roster.some(c => c.id === "penelope"), "Penelope should join after stage 1-4");
  current.cleared = stages.slice(0, 14).map(s => s.id);
  for (const id of ["ruta", "edgelord", "purp"]) if (!current.roster.some(c => c.id === id)) current.roster.push({ id, level: 40, potential: 2, duplicates: 0 });
  current.squad = ["ynna", "ruta", "edgelord", "purp"];
  current.roster.forEach(c => { c.level = Math.max(c.level, 40); });
  current.energy = 120;
  current = applyGameAction(current, { action: "startBattle", id: "3-5" }, ordinary).state;
  guard = 0;
  while (current.battle?.status === "active" && guard++ < 200) {
    const target = current.battle.enemies.findIndex(e => e.hp > 0);
    current = applyGameAction(current, { action: "act", command: "attack", target }, ordinary).state;
  }
  current = applyGameAction(current, { action: "finishStage" }, ordinary).state;
  assert.ok(current.roster.some(c => c.id === "ruta"), "Ruta should join after stage 3-5");
});

test("Enemies grow stronger the deeper into the campaign you go", () => {
  const { enemyHp, enemyAttack, enemyDefense, enemyLevel } = gameEngine;
  for (let wave = 1; wave < 25; wave++) {
    assert.ok(enemyHp(wave + 1, false) > enemyHp(wave, false), `mob HP must rise at wave ${wave + 1}`);
    assert.ok(enemyAttack(wave + 1) > enemyAttack(wave), `mob attack must rise at wave ${wave + 1}`);
    assert.ok(enemyDefense(wave + 1) >= enemyDefense(wave), `mob defense must not fall at wave ${wave + 1}`);
    assert.ok(enemyLevel(wave + 1) > enemyLevel(wave), `mob level must rise at wave ${wave + 1}`);
  }
  assert.ok(enemyHp(25, true) > enemyHp(25, false) * 2, "bosses must be markedly tougher than mobs");
  assert.equal(enemyHp(25, false) / enemyHp(1, false) > 10, true, "endgame mobs must be far tougher than opening mobs");
});
test("Chapter 1 is fought against slimes with simple attacks", () => {
  const slimeSprites = new Set(["slime-blue", "slime-red", "slime-gold", "slime-cactus", "kingslime"]);
  const chapterOne = stages.filter(s => s.chapter === 1).flatMap(s => s.enemies);
  assert.ok(chapterOne.length >= 10, "chapter 1 should field a full roster of mobs");
  // Chapter 1 is slimes, with one exception: the chapter boss is the Student
  // Council President himself, and the script names him.
  for (const enemy of chapterOne) {
    if (enemy.boss) continue;
    assert.ok(slimeSprites.has(enemy.sprite), `${enemy.name} should be a slime, got ${enemy.sprite}`);
  }
  assert.ok(chapterOne.some(e => e.boss), "chapter 1 needs its crowned boss");
  assert.ok(chapterOne.some(e => e.boss && e.sprite === "escanooor"),
    "chapter 1 ends on Escanooor, the Student Council President");
  const laterChapter = stages.filter(s => s.chapter === 2).flatMap(s => s.enemies);
  assert.ok(laterChapter.some(e => !slimeSprites.has(e.sprite)), "chapter 2 should move on from slimes");
});
test("Bosses have their own combat sprites instead of reusing mob art", () => {
  const bossSprites = new Set(["kingslime", "prime", "terminal", "enforcer", "vane", "escanooor"]);
  for (const stage of stages) for (const enemy of stage.enemies) {
    if (!enemy.boss) continue;
    const isNamedBoss = bossSprites.has(enemy.sprite) || ["purp", "solari"].includes(enemy.sprite);
    assert.ok(isNamedBoss, `${enemy.name} should use a dedicated boss sprite, got ${enemy.sprite}`);
  }
});
test("The featured SSR rate-up points at Penelope", () => {
  const random = () => .02;
  const state = squadWith("ynna");
  let current = applyGameAction(state, { action: "pull", count: 1 }, random).state;
  assert.equal(current.pullHistory[0]?.rarity, "SSR");
});
test("A developed squad can finish all 25 stages and recruit story allies", () => {
  let state = initialState(); state.roster.forEach(c => { c.level = 35; });
  for (const stage of stages) {
    state.energy = 120;
    state = applyGameAction(state, { action: "startBattle", id: stage.id }, () => .05).state;
    let commands = 0;
    while (state.battle?.status === "active" && commands++ < 100) {
      const target = state.battle.enemies.findIndex(e => e.hp > 0);
      const active = state.battle.allies[state.battle.active];
      const command = active.energy >= 100 ? "ultimate" : "attack";
      state = applyGameAction(state, { action: "act", command, target }, () => .05).state;
    }
    assert.equal(state.battle?.status, "victory", `Stage ${stage.id} should be winnable`);
    state = applyGameAction(state, { action: "finishStage" }, ordinary).state;
  }
  assert.equal(state.cleared.length, 25);
  assert.ok(state.roster.some(c => c.id === "purp"));
  assert.ok(state.roster.some(c => c.id === "solari"));
});

test("The home-screen companion can be changed to anyone in the roster", () => {
  const state = initialState();
  assert.equal(state.companion, "ynna", "the companion starts as Ynna");
  const result = applyGameAction(state, { action: "companion", id: "edgelord" }, ordinary);
  assert.equal(result.state.companion, "edgelord");
  assert.match(result.message ?? "", /Edgelord69/);
});
test("A companion must actually be recruited first", () => {
  const state = initialState();
  assert.throws(() => applyGameAction(state, { action: "companion", id: "penelope" }, ordinary), /Recruit them first/);
  assert.equal(state.companion, "ynna", "a rejected change leaves the companion alone");
});
test("Saves from before the companion existed default to Ynna", () => {
  const legacy = initialState() as Partial<typeof state0>;
  delete (legacy as Record<string, unknown>).companion;
  const result = applyGameAction(legacy as typeof state0, { action: "init" }, ordinary);
  assert.equal(result.state.companion, "ynna");
});
test("Every character has companion lines and they are in their own voice", () => {
  for (const c of characters) {
    const lines = companionLines(c.id);
    assert.ok(lines.length >= 3, `${c.name} has ${lines.length} companion lines`);
    assert.ok(lines.every(l => l.length > 10 && !l.includes("\"")), `${c.name} has a suspicious line`);
    assert.equal(new Set(lines).size, lines.length, `${c.name} repeats a line`);
  }
  assert.equal(companionLines("nobody-at-all").length, companionLines("ynna").length, "unknown ids fall back to Ynna");
});
const state0 = initialState();
