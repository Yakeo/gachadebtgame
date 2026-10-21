// Melee and ranged are different attacks.
//
// Every strike used to dash the fighter across the arena, so a mage closed to
// arm's length and hit someone with a book. The fix is a range rule
// (src/lib/attack-range.ts) plus a projectile that travels instead of the body.
// These tests hold three things: the classification, the choreography contract
// (contact on the same frame as a melee dash), and the fact that the ranged
// fighters really do not move.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { characters } from "../src/lib/game-data";
import { CLASS_PROFILES } from "../src/lib/character-stats";
import { attackRangeOf, isRanged, projectileKindOf, rangeOverrides } from "../src/lib/attack-range";
import { CONTACT_MS, POSE_HOLD_MS } from "../src/components/combat-stage";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const css = read("src/app/combat.css");
const stage = read("src/components/combat-stage.tsx");

const ranged = characters.filter(c => attackRangeOf(c.id) === "ranged");
const melee = characters.filter(c => attackRangeOf(c.id) === "melee");
const kinds = new Set(ranged.map(c => projectileKindOf(c.id)));

/** A @keyframes body, matched by braces - these blocks end on one line. */
function keyframeBlock(name: string): string {
  const opener = new RegExp(`@keyframes ${name}\\s*\\{`).exec(css);
  if (!opener) return "";
  let depth = 1;
  let index = opener.index + opener[0].length;
  const start = index;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth++;
    else if (css[index] === "}") depth--;
    index++;
  }
  return css.slice(start, index - 1);
}

test("the cast really is split into two kinds of attacker", () => {
  assert.ok(ranged.length >= 15, `only ${ranged.length} ranged fighters found`);
  assert.ok(melee.length >= 10, `only ${melee.length} melee fighters found`);
  for (const id of ["purp", "morrow", "angelina", "mira", "hokusai", "ynna", "pip"]) {
    assert.ok(isRanged(id), `${id} casts or shoots and must be ranged`);
  }
  for (const id of ["penelope", "ruta", "edgelord", "escanooor", "chen", "grimm", "redhood"]) {
    assert.ok(!isRanged(id), `${id} swings a weapon and must be melee`);
  }
});

test("class sets the default, and weapons that disagree are listed with a reason", () => {
  for (const c of characters) {
    const expectedClass = { Vanguard: "melee", Warrior: "melee", Ranger: "ranged", Arcanist: "ranged", Support: "ranged" }[c.combatClass];
    const override = rangeOverrides[c.id];
    assert.equal(attackRangeOf(c.id), override ? override.range : expectedClass,
      `${c.id} (${c.combatClass}) resolves to the wrong range`);
    if (override) assert.ok(override.why.length > 3, `${c.id}'s override needs a stated reason`);
  }
  // Every class the game can assign has a range, or a new class silently
  // defaults to melee and starts headbutting people.
  for (const combatClass of Object.keys(CLASS_PROFILES)) {
    const c = characters.find(ch => ch.combatClass === combatClass);
    assert.ok(c, `no character exercises the ${combatClass} profile`);
    assert.ok(["melee", "ranged"].includes(attackRangeOf(c!.id)));
  }
});

test("ranged fighters do not dash; the shot travels instead", () => {
  // The stage publishes the measured gap for the projectile and flags the shot
  // with is-firing. The melee path keeps is-dashing to itself.
  assert.match(stage, /"is-firing"/, "the shot must be driven by an is-firing class");
  assert.match(stage, /"is-dashing"/, "melee must keep the dash");
  assert.match(stage, /"--shot-x"/, "the projectile needs the measured horizontal gap");
  assert.match(stage, /"--shot-y"/, "the projectile needs the measured vertical gap");
  assert.match(stage, /const ranged = strike && isRanged\(active\.id\)/,
    "the command must ask the range rule, not a hardcoded character list");
  assert.match(stage, /if \(ranged\) \{/, "the ranged branch must be separate from the dash");
  // And the class has to reach the sprite so CSS can find it.
  assert.match(stage, /className=\{`sprite-stage pose-\$\{pose\} side-\$\{side\} is-\$\{range\}`\}/);
  assert.match(stage, /data-projectile=\{projectile\}/);
  assert.match(stage, /<span className="sprite-projectile" data-kind=\{projectile\}/);
});

test("every ranged fighter has a projectile that exists in the stylesheet", () => {
  for (const kind of kinds) {
    assert.match(css, new RegExp(`\\.sprite-projectile\\[data-kind=${kind}\\]::before`),
      `the ${kind} projectile has no visual`);
  }
  assert.ok(kinds.size >= 5, `expected a handful of projectile kinds, found ${[...kinds].join(", ")}`);
  // Melee characters must not be handed a projectile kind they never throw.
  for (const c of melee) assert.ok(["arrow", "orb", "note"].includes(projectileKindOf(c.id)));
});

test("a shot reaches the enemy on the same frame a melee dash does", () => {
  // The hit pose, impact flash and damage number all wait for CONTACT_MS. If the
  // projectile lands elsewhere the enemy reacts before the arrow arrives.
  const duration = css.match(/\.sprite-stage\.is-firing \.sprite-projectile\{animation:shot-volley ([\d.]+)s/);
  assert.ok(duration, "the volley animation must be timeable");
  const seconds = Number(duration![1]);
  assert.ok(Math.abs(seconds * 1000 * 0.42 - CONTACT_MS) <= 20,
    `shot-volley contacts at ${Math.round(seconds * 1000 * 0.42)}ms but CONTACT_MS is ${CONTACT_MS}ms`);
  assert.ok(seconds * 1000 <= POSE_HOLD_MS, "the volley outlasts the pose hold and gets cut off");
  const keyframes = keyframeBlock("shot-volley");
  assert.match(keyframes, /42%\{[^}]*translate\(var\(--shot-x,0px\),var\(--shot-y,0px\)\)/,
    "the projectile must be at the enemy at 42%");
});

test("ranged rigs cast in place instead of lunging", () => {
  assert.match(css, /\.sprite-stage\.is-ranged\.pose-attack \.sprite-rig\{animation:ranged-cast/);
  assert.match(css, /\.sprite-stage\.is-ranged\.pose-skill \.sprite-rig\{animation:ranged-channel/);
  assert.match(css, /\.sprite-stage\.is-ranged\.pose-ultimate \.sprite-rig\{animation:ranged-overcharge/);
  for (const name of ["ranged-cast", "ranged-channel", "ranged-overcharge"]) {
    const block = keyframeBlock(name);
    assert.ok(block, `${name} is referenced but never defined`);
    assert.doesNotMatch(block, /translateX\(var\(--dash-x/, `${name} must not travel to the enemy`);
  }
  // A ranged fighter must never receive the dash even if one is set by accident.
  assert.match(css, /\.combat-unit\.is-dashing \.sprite-stage\.is-ranged\{animation:none!important\}/);
});

test("projectiles are switched off for players who asked for less motion", () => {
  assert.match(css, /\.reduce-motion \.sprite-projectile\{display:none\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.sprite-projectile\{display:none\}/);
});
