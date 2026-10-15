// Guards the SSR attack choreography in src/app/combat.css.
//
// Before this, every character shared one generic swing: Penelope's cast-iron
// pan and Purp's floating grimoire moved identically. Each SSR now has their
// own animation per command, and these tests keep that true as the cast grows.
// They also enforce the rule that is invisible until it is wrong: an animation
// that outlasts the pose hold gets cut off mid-swing.
//
// The roster comes from the real module rather than being scraped out of the
// source. Parsing `game-data.ts` with a regex looked fine until an entry that
// puts `id:` on its own line silently dropped out of the list.
//
// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { characterById, characters } from "@/lib/game-data";
import { POSE_HOLD_MS } from "@/components/combat-stage";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const css = read("src/app/combat.css");
const stage = read("src/components/combat-stage.tsx");

const poses = ["attack", "skill", "ultimate"] as const;
const ssrIds = characters.filter((character) => character.rarity === "SSR").map((character) => character.id);

/** Parse `@keyframes name{ ... }` blocks by matching braces.
 *  A regex ending in `\n}` silently missed every block whose closing brace
 *  shares a line with the last step, which is most of this stylesheet. */
function keyframeBlocks(cssText: string) {
  const blocks = new Map<string, string>();
  const opener = /@keyframes\s+([a-z0-9-]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(cssText))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (index < cssText.length && depth > 0) {
      const character = cssText[index];
      if (character === "{") depth++;
      else if (character === "}") depth--;
      index++;
    }
    blocks.set(match[1], cssText.slice(start, index - 1));
  }
  return blocks;
}

/** The declarations of the rule that choreographs `id`'s `pose`. */
function rule(id: string, pose: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`\\.sprite-stage\\[data-character="${escaped}"\\]\\.pose-${pose} \\.sprite-rig\\{([^}]*)\\}`),
  );
  return match ? match[1] : null;
}

/** name + duration (seconds) from an `animation:` shorthand. */
function animation(declaration: string | null) {
  if (!declaration) return null;
  const shorthand = declaration.match(/animation:\s*([^;]+)/);
  if (!shorthand) return null;
  const parts = shorthand[1].trim().split(/\s+/);
  const keywords = /^(ease|ease-in|ease-out|ease-in-out|linear|both|forwards|backwards|none|infinite)$/;
  const name = parts.find((part) => /^[a-z][a-z0-9-]*$/i.test(part) && !keywords.test(part));
  const time = parts.find((part) => /^[\d.]+m?s$/.test(part));
  if (!name || !time) return null;
  const duration = time.endsWith("ms") ? Number(time.slice(0, -2)) / 1000 : Number(time.slice(0, -1));
  return { name, duration };
}

/** Every (character, pose) pair the suite cares about. */
function pairs() {
  return ssrIds.flatMap((id) => poses.map((pose) => ({ id, pose })));
}

const blocks = keyframeBlocks(css);
const hold = POSE_HOLD_MS / 1000;

test("the roster has the SSR characters this suite checks", () => {
  for (const expected of ["penelope", "ruta", "purp", "edgelord", "ynna", "solari", "escanooor", "vane", "sorcerer"]) {
    assert.ok(ssrIds.includes(expected), `${expected} should be an SSR`);
  }
  assert.ok(ssrIds.length >= 9, `expected at least 9 SSR characters, found ${ssrIds.length}`);
  // Ninette is SR (and Angelina UR) - the trio's own body language lives in
  // tests/attack-travel.test.ts alongside the travel system.
  assert.ok(!ssrIds.includes("ninette"), "Ninette is SR and should not be in the SSR set");
});

test("every SSR has a choreographed attack, skill and ultimate", () => {
  const missing = pairs()
    .filter(({ id, pose }) => !animation(rule(id, pose)))
    .map(({ id, pose }) => `${id}/${pose}`);
  assert.deepEqual(missing, [], `SSR characters with no readable animation for a command: ${missing.join(", ")}`);
});

test("nobody borrows anybody else's animation", () => {
  // Copy-pasting a rule and forgetting to rename it is the failure this
  // catches: the character does animate, just as somebody else.
  const owners = new Map<string, string>();
  for (const id of ssrIds) {
    const owned: string[] = [];
    for (const pose of poses) {
      const parsed = animation(rule(id, pose));
      if (!parsed) continue;
      owned.push(parsed.name);
      assert.match(parsed.name, new RegExp(`^${id}-`),
        `${id}'s ${pose} plays "${parsed.name}", which is not named after ${id}`);
      const previous = owners.get(parsed.name);
      assert.equal(previous, undefined, `${parsed.name} is claimed by both ${previous} and ${id}`);
      owners.set(parsed.name, id);
    }
    assert.equal(new Set(owned).size, owned.length, `${id} reuses one of their own animations across commands`);
  }
  assert.equal(new Set(owners.keys()).size, owners.size, "two SSR characters share an animation");
});

test("every choreographed animation is defined", () => {
  const undefinedNames = pairs()
    .map(({ id, pose }) => ({ id, pose, parsed: animation(rule(id, pose)) }))
    .filter(({ parsed }) => parsed && !blocks.has(parsed.name))
    .map(({ id, pose, parsed }) => `${parsed!.name} (${id}/${pose})`);
  assert.deepEqual(undefinedNames, [], `keyframes referenced but never defined: ${undefinedNames.join(", ")}`);
});

test("no animation outlasts the pose hold", () => {
  // combat-stage.tsx drops the pose class after POSE_HOLD_MS. Anything longer
  // is truncated mid-swing, which reads as bad art direction rather than a
  // wrong number - so the durations are checked against the constant itself.
  const overruns = pairs()
    .map(({ id, pose }) => animation(rule(id, pose)))
    .filter((parsed): parsed is { name: string; duration: number } => !!parsed)
    .filter((parsed) => parsed.duration > hold)
    .map((parsed) => `${parsed.name} ${parsed.duration}s > ${hold}s`);
  assert.deepEqual(overruns, [], `these animations are cut off before they finish: ${overruns.join(", ")}`);
  // Still a sanity band, not a target: it is here to catch a constant that is a
  // typo. The move set was slowed by 40%, so the ceiling moved with it - the
  // invariant that matters is the one above, that nothing outruns the hold.
  assert.ok(hold > 0 && hold <= 1.5, `POSE_HOLD_MS looks wrong: ${POSE_HOLD_MS}`);
});

test("each character's body motion matches the weapon in their art", () => {
  // The point of the change was that the pan and the grimoire stop moving the
  // same way. If two characters' signature rules end up with identical
  // keyframe bodies, the work has quietly been undone.
  const seen = new Map<string, string>();
  for (const id of ssrIds) {
    for (const pose of poses) {
      const parsed = animation(rule(id, pose));
      if (!parsed) continue;
      const body = (blocks.get(parsed.name) || "").replace(/\s+/g, "");
      assert.ok(body.length > 0, `${parsed.name} is empty`);
      const twin = seen.get(body);
      assert.equal(twin, undefined, `${parsed.name} has the same motion as ${twin}`);
      seen.set(body, parsed.name);
    }
  }
});

test("lunges are direction-aware, so nobody attacks their own team", () => {
  // One animation serves both sides of the arena: allies face left, enemies
  // face right, and every distance is multiplied by --facing.
  assert.match(css, /\.side-ally\{--facing:-1\}/, "allies must face left");
  assert.match(css, /\.side-enemy\{--facing:1\}/, "enemies must face right");
  for (const side of ["ally", "enemy"]) {
    assert.match(css, new RegExp(`\\.${side}-unit \\.combat-unit-art\\{--facing:`),
      `.${side}-unit needs its own --facing for the impact recoil`);
  }

  const moves = [...css.matchAll(/translateX\(calc\(var\(--facing\) \* (-?[\d.]+)px\)\)/g)].map((m) => Number(m[1]));
  assert.ok(moves.length >= 10, `expected the cast to move, found ${moves.length} direction-aware moves`);
  assert.ok(moves.some((value) => value > 0), "somebody must actually lunge forward");
  // A wind-up pulls back on purpose, so the check is per character: everyone
  // who attacks has at least one move toward the enemy.
  const withoutLunge = ssrIds.filter((id) => {
    const rules = poses.map((pose) => rule(id, pose)).join(" ");
    const distances = [...rules.matchAll(/var\(--facing\) \* (-?[\d.]+)px\)/g)].map((m) => Number(m[1]));
    return distances.length > 0 && !distances.some((value) => value > 0);
  });
  assert.deepEqual(withoutLunge, [], `these characters never move toward the enemy: ${withoutLunge.join(", ")}`);
});

test("the attacker's colour reaches the struck enemy", () => {
  assert.match(stage, /"--impact-color": impactColor/, "the battle screen must publish --impact-color");
  assert.match(stage, /data-hit=\{impact && battle\.lastHit\?\.target === enemy\.id \? "on" : undefined\}/,
    "the struck enemy must be flagged with data-hit");
  assert.match(css, /\.combat-unit\[data-hit="on"\] \.combat-unit-art::after\{[^}]*var\(--impact-color/,
    "the impact effect should use the attacker's colour");
  assert.match(stage, /"--character-color": characterById\(id\)\.color/,
    "allied sprites must publish their own colour for their effects");
  // The colour has to be a real cast colour, not a placeholder.
  assert.equal(characterById("penelope").color, "#ef6ec0");
});

test("the effect layers the rules target really exist", () => {
  // The choreography drives five <i> particles plus the stage's own
  // ::before/::after. Add a rule for a sixth particle and it styles nothing.
  const particles = stage.match(/<div className="sprite-fx" aria-hidden="true">([\s\S]*?)<\/div>/);
  assert.ok(particles, "could not find the sprite-fx layer");
  const count = (particles[1].match(/<i \/>/g) || []).length;
  assert.ok(count >= 5, `sprite-fx has ${count} particles, the choreography uses 5`);

  const used = new Set([...css.matchAll(/\.sprite-fx i:nth-child\((\d)\)/g)].map((m) => Number(m[1])));
  const beyond = [...used].filter((index) => index > count);
  assert.deepEqual(beyond, [], `rules target particle ${beyond.join(", ")} which does not exist`);
  assert.match(css, /\.sprite-stage::before,\s*\.sprite-stage::after\{/, "stage pseudo-elements need a base rule");
});

test("stage-level effects attach to the stage, not to a descendant of it", () => {
  // The element carrying data-character IS .sprite-stage, so a selector like
  // `.pose-ultimate[data-character="x"] .sprite-stage::before` matches nothing
  // at all and the effect silently never appears.
  const wrong = [...css.matchAll(/\.pose-[a-z]+\[data-character="[a-z0-9]+"\] \.sprite-stage::/g)].map((m) => m[0]);
  assert.deepEqual(wrong, [], `these stage effects can never match: ${wrong.join(", ")}`);
  const right = [...css.matchAll(/\.sprite-stage\.pose-[a-z]+\[data-character="([a-z0-9]+)"\]::(before|after)/g)];
  assert.ok(right.length >= 4, `expected stage-level effects for the ultimates, found ${right.length}`);
});

test("the untouched poses keep their original motions", () => {
  for (const pose of ["guard", "hit", "counter", "enter", "victory"]) {
    assert.match(css, new RegExp(`\\.pose-${pose} \\.sprite-rig\\{animation:sprite-`),
      `the generic ${pose} animation should still be in place`);
  }
});

test("reduced-motion still switches the choreography off", () => {
  const globals = read("src/app/globals.css");
  assert.match(globals, /@media\(prefers-reduced-motion:reduce\)/,
    "the global reduced-motion rule is what neutralises these animations; it must survive");
});
