// Guards the slime enemies: their art, and the way they move.
//
// These five used to be inline SVG - a body, a pair of eyes and a crown as
// separate shapes, which could only jiggle together. They are the supplied
// pixel-art PNGs now (art-source/enemies/, the "loom" designs), normalised
// onto the rig's canvas by scripts/gen-slime-sprites.mjs and animated as one
// piece, so there are two things that can silently rot: the committed art
// drifting from the pipeline that builds it, and the animation rules losing
// to the generic ones they sit on top of.
//
// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { POSE_HOLD_MS, IMPACT_BEAT_MS, COUNTER_HOLD_MS } from "@/components/combat-stage";
import { spriteBytes, spriteRasters } from "../scripts/gen-slime-sprites.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const css = read("src/app/combat.css");
const stage = read("src/components/combat-stage.tsx");
const ui = read("src/components/ui.tsx");

const SLIMES = ["slime-blue", "slime-gold", "slime-red", "slime-cactus", "kingslime"];
const CANVAS = { width: 160, height: 200 };

test("every slime is a committed sprite that matches its generator", () => {
  // The generator is the source of truth for the art. If somebody edits it and
  // does not re-run it, the game keeps drawing the old creatures and no test
  // would otherwise notice.
  const generated = spriteBytes();
  const stale: string[] = [];
  for (const id of SLIMES) {
    const committed = readFileSync(join(root, "public", "images", "enemies", `${id}.png`));
    if (!committed.equals(generated[id])) stale.push(id);
  }
  assert.deepEqual(stale, [], `art is out of date with scripts/gen-slime-sprites.mjs - run npm run art:enemies: ${stale.join(", ")}`);
});

test("every slime is drawn on the same canvas and none of it is cut off", () => {
  const rasters = spriteRasters();
  for (const id of SLIMES) {
    const raster = rasters[id];
    assert.ok(raster, `${id} has no raster`);
    assert.equal(raster.width, CANVAS.width, `${id} canvas width`);
    assert.equal(raster.height, CANVAS.height, `${id} canvas height`);

    // Find the footprint of the drawn pixels. Touching any edge means the
    // sprite is being clipped, which is how the cactus lost a wing before.
    let minX = raster.width, maxX = -1, minY = raster.height, maxY = -1;
    for (let y = 0; y < raster.height; y++) {
      for (let x = 0; x < raster.width; x++) {
        if (raster.data[(y * raster.width + x) * 4 + 3] === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    assert.ok(maxX >= 0, `${id} is completely transparent`);
    assert.ok(minX > 0 && minY > 0 && maxX < raster.width - 1 && maxY < raster.height - 1,
      `${id} touches the canvas edge (footprint ${minX}..${maxX} x ${minY}..${maxY}) and is being clipped`);
  }
});

test("the slimes rest on a shared baseline", () => {
  // They line up along the bottom of the arena. If one sits lower than the
  // others it will look like it is falling through the floor.
  const rasters = spriteRasters();
  const baselines = SLIMES.map(id => {
    const raster = rasters[id];
    for (let y = raster.height - 1; y >= 0; y--) {
      for (let x = 0; x < raster.width; x++) {
        if (raster.data[(y * raster.width + x) * 4 + 3] > 0) return y;
      }
    }
    return -1;
  });
  const spread = Math.max(...baselines) - Math.min(...baselines);
  assert.ok(spread <= 1, `slime baselines vary by ${spread}px: ${baselines.join(", ")}`);
});

test("every slime id is served as a sprite, and nothing draws it twice", () => {
  for (const id of SLIMES) {
    // the map mixes quoted and unquoted keys, so both forms are accepted
    assert.match(ui, new RegExp(`"?${id}"?:\\s*"\\/images\\/enemies\\/${id}\\.png"`),
      `${id} is not registered in enemyArt`);
  }
  assert.match(ui, /kingslime: "\/images\/enemies\/kingslime\.png"/, "kingslime is not registered in enemyArt");
  // The inline SVG branches for these five are unreachable now. Leaving them
  // behind means two drawings of the same creature to keep in step.
  assert.doesNotMatch(ui, /if \(id === "slime-blue"\)/, "the old slime SVG is still present");
  assert.doesNotMatch(ui, /if \(id === "slime-cactus"\)/, "the old cactus SVG is still present");
  assert.doesNotMatch(ui, /if \(id === "kingslime"\)/, "the old kingslime SVG is still present");
  // The artwork path is chosen before the SVG fallbacks render.
  assert.match(ui, /const art = known \? \(c\.splash \?\? enemyArt\[id\]\) : enemyArt\[id\];/, "Chibi must consult enemyArt");
});

/* ------------------------------------------------------------------ motion */

/** Parse `@keyframes name{ ... }` by matching braces. */
function keyframeBody(name: string) {
  const opener = css.indexOf(`@keyframes ${name}{`);
  if (opener < 0) return null;
  const start = css.indexOf("{", opener) + 1;
  let depth = 1;
  let index = start;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth++;
    else if (css[index] === "}") depth--;
    index++;
  }
  return css.slice(start, index - 1);
}

/** The animations applied to a slime's `pose`. */
function slimeRule(pose: string) {
  const match = css.match(new RegExp(`\\.sprite-stage\\[data-enemy="slime"\\]\\.pose-${pose} \\.sprite-rig\\{([^}]*)\\}`));
  return match ? match[1] : null;
}

test("slimes breathe, hop, gather, pounce, squash and melt", () => {
  const expected: Record<string, { name: string; seconds: number }> = {
    idle: { name: "slime-idle", seconds: 3.5 },
    attack: { name: "slime-hop", seconds: 1 },
    skill: { name: "slime-gather", seconds: 1.05 },
    counter: { name: "slime-pounce", seconds: 1.2 },
    hit: { name: "slime-squash", seconds: 0.75 },
    down: { name: "slime-melt", seconds: 1.1 },
  };
  for (const [pose, want] of Object.entries(expected)) {
    const declaration = slimeRule(pose);
    assert.ok(declaration, `no rule for the slime's ${pose} pose`);
    const shorthand = declaration!.match(/animation:\s*([^;]+)/)![1].trim().split(/\s+/);
    assert.equal(shorthand[0], want.name, `${pose} should play ${want.name}`);
    // compare the parsed number: the stylesheet writes `.7s`, not `0.7s`
    const time = shorthand.find(part => /^[\d.]+m?s$/.test(part))!;
    const seconds = time.endsWith("ms") ? Number(time.slice(0, -2)) / 1000 : Number(time.slice(0, -1));
    assert.equal(seconds, want.seconds, `${pose} duration`);
    assert.ok(keyframeBody(want.name), `${want.name} is not defined`);
  }
});

test("the slime poses are scoped so they cannot override another creature's", () => {
  // The generic rules are (.pose-attack .sprite-rig) at (0,2,0). These have to
  // beat those for a slime, and must never reach anyone else: every rule is
  // keyed on both the pose and the enemy flag. A rule missing .pose- would sit
  // at (0,2,1) and silently swallow every other enemy's flinch animation.
  const rules = [...css.matchAll(/\.sprite-stage\[data-enemy="slime"\]([^{]*)\{/g)].map(m => m[1]);
  assert.ok(rules.length >= 6, `expected the slime rules, found ${rules.length}`);
  for (const suffix of rules) {
    assert.match(suffix, /^\.pose-[a-z]+ (\.sprite-rig|\.sprite-fx i:nth-child\(\d\))$/,
      `slime rule not pose-scoped: ${suffix}`);
  }
  // ...and no slime rule may be keyed on a character, or vice versa.
  assert.doesNotMatch(css, /\[data-character="[a-z0-9]+"\][^{]*\[data-enemy="slime"\]/, "a slime rule is bound to a character");
});

test("the pounce crosses the arena, toward the squad", () => {
  const pounce = keyframeBody("slime-pounce")!;
  assert.ok(pounce, "slime-pounce is not defined");
  // Enemies are on the right and face left, so --facing is +1 for them and the
  // travel has to be negative. A positive value would pounce off-screen.
  const travels = [...pounce.matchAll(/translate\(calc\(var\(--facing\) \* (-?[\d.]+)px\),(-?[\d.]+)px\)/g)]
    .map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
  assert.ok(travels.length >= 3, `expected the pounce to travel, found ${travels.length} moves`);
  assert.ok(travels.every(t => t.x < 0), "the pounce must travel toward the enemy's facing, not away");
  assert.ok(travels.some(t => t.y < -20), "the pounce should leave the ground");
  assert.ok(Math.min(...travels.map(t => t.x)) <= -70, "the pounce should cross a real distance");
  assert.match(css, /\.side-enemy\{--facing:1\}/, "enemies must face the squad");
});

test("the pounce is slow enough to fit the hold it is given", () => {
  // A pounce longer than the pose hold is cut off mid-air, which is the exact
  // complaint this was meant to fix.
  const pounce = Number(slimeRule("counter")!.match(/animation:[^;]*?([\d.]+)s/)![1]);
  assert.ok(pounce * 1000 <= POSE_HOLD_MS * 1.2,
    `the pounce runs ${pounce}s against a ${POSE_HOLD_MS / 1000}s hold`);
  assert.ok(pounce >= 1.1, "the pounce was asked to be slowed down, not sped up");
});

test("a command that does not end the round still holds for its own animation", () => {
  // The engine only advances the turn on the last ally's action, so most
  // commands have no round to hang the beat on. Without a hold there, the
  // buttons returned while the attack was still swinging.
  assert.match(stage,
    /setBeat\(true\);\s*if \(!enemyMoves\.length\) \{[\s\S]{0,900}?setTimeout\(resolve, POSE_HOLD_MS\)[\s\S]{0,300}?setBeat\(false\);/,
    "an ordinary command hands input back mid-animation");
  // auto-battle ticks between actions, not on top of their animations
  const tick = stage.match(/void command\([\s\S]{0,400}?\}, (\d+)\);/);
  assert.ok(tick, "could not find the auto-battle tick");
  const auto = Number(tick[1]);
  assert.ok(auto > 0 && auto < 1000, `the auto-battle tick looks wrong: ${auto}ms`);
});

test("the answer gets to land before the player can move", () => {
  // Input used to return the moment the counter pose was set, so the next
  // command replaced the leap mid-air. The beat has to outlast the animation.
  const pounce = Number(slimeRule("counter")!.match(/animation:[^;]*?([\d.]+)s/)![1]) * 1000;
  assert.ok(COUNTER_HOLD_MS >= pounce,
    `the pounce runs ${pounce}ms but input returns after ${COUNTER_HOLD_MS}ms`);
  assert.match(stage, /setTimeout\(resolve, COUNTER_HOLD_MS\)/, "the counter hold is not being waited out");
  // ...and it has to be released again, or the battle stops accepting input.
  assert.match(stage, /await new Promise\(resolve => setTimeout\(resolve, COUNTER_HOLD_MS\)\);[\s\S]{0,200}?setBeat\(false\)/,
    "the beat is never released after the counter");
});

test("no command animation outlasts the pose hold it is given", () => {
  // The hold is what drops the pose class again. An animation longer than it
  // is the original bug: the move gets cut off before the player sees it land.
  // Only the poses the stage actually times out are on a hold. Victory and
  // idle are not, so they are allowed to run long. Read the set out of the
  // component so this cannot drift from it.
  const oneShots = [...stage.match(/const oneShots = new Set\(\[([^\]]+)\]\)/)![1].matchAll(/"([a-z]+)"/g)].map(m => m[1]);
  assert.ok(oneShots.length >= 5 && oneShots.includes("counter"), `could not read the one-shot poses: ${oneShots}`);
  const rigRules = [...css.matchAll(/\.sprite-stage(\[data-character="[a-z0-9]+"\]|\[data-enemy="slime"\])\.pose-([a-z]+) \.sprite-rig\{animation:([^}]+)\}/g)];
  assert.ok(rigRules.length >= 20, `expected the choreography rules, found ${rigRules.length}`);
  const overruns = rigRules.map(([, scope, pose, declaration]) => {
    const parts = declaration.trim().split(/\s+/);
    const name = parts[0];
    const time = parts.find(part => /^[\d.]+m?s$/.test(part))!;
    const seconds = time.endsWith("ms") ? Number(time.slice(0, -2)) / 1000 : Number(time.slice(0, -1));
    return { scope, pose, name, seconds };
  })
    .filter(({ pose }) => oneShots.includes(pose))
    .filter(({ seconds }) => seconds * 1000 > POSE_HOLD_MS)
    .map(({ scope, pose, name, seconds }) => `${scope} .pose-${pose} ${name} ${seconds}s > ${POSE_HOLD_MS / 1000}s`);
  assert.deepEqual(overruns, [], `these animations are cut off before they finish: ${overruns.join(", ")}`);
});

test("a blow and its answer are two separate beats", () => {
  // The engine returns both in one payload. Drawing them in the same frame is
  // what made the animations easy to miss.
  assert.ok(IMPACT_BEAT_MS >= 300 && IMPACT_BEAT_MS <= 900, `IMPACT_BEAT_MS looks wrong: ${IMPACT_BEAT_MS}`);
  assert.match(stage, /setTimeout\(resolve, IMPACT_BEAT_MS\)/, "the beat is not being waited out");
  assert.match(stage, /nextBattle\.enemyActions/, "enemy animations must use resolved initiative slots");
  assert.match(stage, /for \(const move of enemyMoves\)/, "enemy slots must animate in order");
  assert.match(stage, /setBeat\(true\)/, "input should be locked while the enemies answer");
  for (const label of ["command", "enemy", "retreat"]) {
    assert.ok(stage.includes(`${label}`), `${label} should still exist`);
  }
  // Inspection is now separate from activation; both controls inherit the beat lock.
  assert.match(stage, /<BattleCommandPanel[^\n]*locked=\{busy \|\| beat/);
  const panel = read("src/components/battle-command-panel.tsx");
  assert.match(panel, /disabled=\{locked\}/, "inspection ignores the animation lock");
  assert.match(panel, /disabled=\{locked \|\| \(insufficient/, "activation ignores the animation lock");
  assert.match(panel, /if \(!locked && !insufficient\) \{[^}]*setExpanded\(false\);[^}]*onActivate\(selected\);/, "activation must respect the lock and dismiss inspection before dispatch");
});

test("only the enemy that was struck reacts to a blow", () => {
  // Marking every surviving enemy as "counter" made a whole row flinch at
  // once, which is what gave the pounce away as a generic animation.
  assert.match(stage, /next\[enemy\.id\] = enemy\.hp <= 0 \? "down" : nextBattle\.lastHit\?\.target === enemy\.id \? "hit" : "idle"/,
    "unstruck enemies should hold still, not react");
  // The allies who were hit by the retaliation do flinch, which is read from
  // the HP that changed rather than assumed.
  assert.match(stage, /const hurt = \(id: string\) => \{/, "the damage taken by allies is not being detected");
  assert.match(stage, /next\[ally\.id\] = ally\.hp <= 0 \? "down" : ally\.id === active\.id \? pose : hurt\(ally\.id\) \? "hit" : "idle"/,
    "an ally that took damage should flinch");
});

test("the slime effects are landing splashes, not weapon swings", () => {
  // A slime has no weapon, so the shared slash streak and the ring of light
  // are the wrong vocabulary. Each of its beats gets a ground splash instead.
  for (const pose of ["attack", "skill", "counter", "hit"]) {
    assert.match(css, new RegExp(`\\.pose-${pose}\\[data-enemy="slime"\\] \\.sprite-fx i:nth-child\\(4\\)\\{[^}]*animation:fx-ground`),
      `the slime's ${pose} should splash on landing`);
  }
});
