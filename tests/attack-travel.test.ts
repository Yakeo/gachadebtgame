/**
 * Attack travel: fighters cross the arena and land the blow themselves.
 *
 * The choreography used to animate the fighter in place while particles flew
 * at the enemy - "a random gush of wind slashing them". Now every blow aimed at
 * a foe carries the fighter there: combat-stage.tsx measures the gap to the
 * chosen enemy, an advance animation crosses it, contact lands at 42% of that
 * animation, and the hit is revealed on contact rather than on server reply.
 *
 * The rules pinned here:
 *  - the shell measures and drives the dash (measured --dash-x/--dash-y);
 *  - every non-R character has their own advance animation;
 *  - Rs share the one generic dash (the user's own scoping: "except the Rs");
 *  - every advance contacts at exactly 42%, because CONTACT_MS is calibrated
 *    to that frame - drift it and hits land before or after the blow;
 *  - restorative moves and Guard stay with the squad;
 *  - ninette/byte/angelina have their own body language per command.
 *
 * Run with: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { characters } from "@/lib/game-data";
import { CONTACT_MS, POSE_HOLD_MS } from "@/components/combat-stage";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const css = read("src/app/combat.css");
const stage = read("src/components/combat-stage.tsx");

const hold = POSE_HOLD_MS / 1000;
const nonR = characters.filter((c) => c.rarity !== "R").map((c) => c.id);
const rIds = characters.filter((c) => c.rarity === "R").map((c) => c.id);

/** Parse `@keyframes name{...}` blocks by matching braces. */
function keyframeBlocks(cssText: string) {
  const blocks = new Map<string, string>();
  const opener = /@keyframes\s+([a-z0-9-]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(cssText))) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < cssText.length && depth > 0) {
      if (cssText[index] === "{") depth++;
      else if (cssText[index] === "}") depth--;
      index++;
    }
    blocks.set(match[1], cssText.slice(match.index + match[0].length, index - 1));
  }
  return blocks;
}
const blocks = keyframeBlocks(css);

/** name + duration of the advance rule for `id`, from its dash override. */
function advanceOf(id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`\\.combat-unit\\.is-dashing \\.sprite-stage\\[data-character="${escaped}"\\]\\{animation:([a-z0-9-]+) (\\d*\\.?\\d+)s`),
  );
  return match ? { name: match[1], duration: Number(match[2]) } : null;
}

test("fighters cross the arena: the shell measures the gap and drives the dash", () => {
  assert.match(stage, /data-unit=\{enemy\.id\}/, "enemy slots need identity for the dash target");
  assert.match(stage, /data-unit=\{ally\.id\}/, "ally slots need identity for the dash source");
  assert.match(stage, /"--dash-x"/, "the measured horizontal gap must be published");
  assert.match(stage, /"--dash-y"/, "the measured vertical gap must be published");
  assert.match(stage, /classList\.add\("is-dashing"\)/, "the advance is driven by an is-dashing class");
  assert.match(stage, /getBoundingClientRect\(\)/, "the gap must be measured, not guessed");
  assert.match(css, /\.combat-unit\.is-dashing \{z-index:9\}|\.combat-unit\.is-dashing\{z-index:9\}/,
    "the travelling fighter must draw over the enemy at contact");
});

test("the blow is revealed on contact, not whenever the server replies", () => {
  assert.match(stage, /if \(elapsed < CONTACT_MS\)/,
    "the hit pose, flash and damage number wait for the contact frame");
  assert.ok(CONTACT_MS > 250 && CONTACT_MS < POSE_HOLD_MS,
    `CONTACT_MS (${CONTACT_MS}) must land inside the pose hold (${POSE_HOLD_MS})`);
});

test("moves that heal stay with the squad", () => {
  assert.match(stage, /const SUPPORT_NOTE = \/restore\|revive\|sanctif\/i/);
  assert.match(stage, /cmd === "attack" \|\| \(\(cmd === "skill" \|\| cmd === "ultimate"\) && hitsFoes\(note\)\)/,
    "the basic attack always travels; skills and ultimates travel when they strike");
});

test("every non-R character has their own advance animation", () => {
  assert.ok(nonR.length >= 29, `expected the full non-R cast, found ${nonR.length}`);
  for (const id of nonR) {
    const parsed = advanceOf(id);
    assert.ok(parsed, `${id} (rarity ${characters.find(c => c.id === id)?.rarity}) needs a per-character advance rule`);
    assert.match(parsed!.name, new RegExp(`^${id}-advance$`),
      `${id}'s travel plays "${parsed!.name}", which is not named after ${id}`);
    assert.ok(parsed!.duration <= hold,
      `${parsed!.name} runs ${parsed!.duration}s > POSE_HOLD_MS ${hold}s and gets cut off`);
    assert.ok(blocks.has(parsed!.name), `${parsed!.name} is referenced but never defined`);
  }
});

test("the Rs share the one generic dash", () => {
  assert.match(css, /\.combat-unit\.is-dashing \.sprite-stage\{animation:dash-strike/,
    "the generic dash must serve characters without an override");
  assert.ok(blocks.has("dash-strike"), "dash-strike keyframes must exist");
  for (const id of rIds) {
    assert.equal(advanceOf(id), null, `${id} is R and should use the shared dash, not a personal one`);
  }
});

test("every advance makes contact at exactly 42%", () => {
  // CONTACT_MS is calibrated to that frame. An advance that contacts at a
  // different point shows the enemy flinching before - or long after - the
  // fighter arrives.
  const wrong: string[] = [];
  for (const [name, body] of blocks) {
    if (!name.endsWith("-advance")) continue;
    const compact = body.replace(/\s+/g, "");
    if (!compact.includes("42%{transform:translate(var(--dash-x,0px),var(--dash-y,0px))")) wrong.push(name);
  }
  assert.deepEqual(wrong, [], `these advances do not contact at 42%: ${wrong.join(", ")}`);
});

test("no two characters travel the same way", () => {
  const seen = new Map<string, string>();
  for (const [name, body] of blocks) {
    if (!name.endsWith("-advance")) continue;
    const compact = body.replace(/\s+/g, "");
    const twin = seen.get(compact);
    assert.equal(twin, undefined, `${name} travels exactly like ${twin}`);
    seen.set(compact, name);
  }
});

test("ninette, byte and angelina have their own body language per command", () => {
  // The SR/UR trio were the only non-R fighters still borrowing the generic
  // swing. Each command now has its own named motion.
  for (const id of ["ninette", "byte", "angelina"]) {
    for (const pose of ["attack", "skill", "ultimate"]) {
      const rule = css.match(
        new RegExp(`\\.sprite-stage\\[data-character="${id}"\\]\\.pose-${pose} \\.sprite-rig\\{animation:([a-z0-9-]+) (\\d*\\.?\\d+)s`),
      );
      assert.ok(rule, `${id}/${pose} needs its own rig animation`);
      assert.match(rule![1], new RegExp(`^${id}-`), `${id}/${pose} plays "${rule![1]}", not named after ${id}`);
      assert.ok(Number(rule![2]) <= hold, `${rule![1]} runs ${rule![2]}s > ${hold}s`);
      assert.ok(blocks.has(rule![1]), `${rule![1]} is referenced but never defined`);
      assert.ok((blocks.get(rule![1]) || "").replace(/\s+/g, "").length > 0, `${rule![1]} is empty`);
    }
  }
});
