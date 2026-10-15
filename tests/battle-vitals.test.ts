/** Combat readability: HP/energy follow models, not duplicate dashboard rows.
 * Keep legible desktop typography and thick bars as the arena takes 82%.
 * Run with npm test. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/app/globals.css");
const panel = read("src/app/combat.css");
const stage = read("src/components/combat-stage.tsx");

/** The `prop` value (px) of the first rule for `selector` in `text`, or null. */
function ruleValue(text: string, selector: string, prop: string): number | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\{[^}]*?${prop}:(\\d+)px`));
  return match ? Number(match[1]) : null;
}

test("vitals now live beneath the models instead of in duplicate dashboard cards", () => {
  assert.doesNotMatch(stage, /className="enemy-hud"|className="ally-hud"/);
  assert.match(stage, /side="ally" \/><div className="model-vitals"/, "bars must be children of the model art, not a HUD row");
  assert.match(panel, /\.game-shell\.is-combat \.model-vitals\{position:absolute;[^}]*background:none;border:0/, "foot bars must not create another card");
  assert.match(stage, /value=\{ally.energy\} max=\{100\}/);
  assert.match(stage, /<ProgressBar value=\{enemy\.hp\} max=\{enemy\.maxHp\} className="enemy-health" \/>/);
  assert.match(panel, /\.enemy-unit \.combat-unit-label\{[^}]*order:2/);
});

test("the vitals are legible at the sizes people actually play", () => {
  // Floors, not targets: the complaint was text at 6-9px rendering at ~0.8x.
  const floors: [string, string, number][] = [
    ["src/app/combat.css", ".model-vitals>span", 13],
    ["src/app/combat.css", ".game-shell.is-combat .ally-name", 13],
    ["src/app/combat.css", ".game-shell.is-combat .combat-unit-label>span", 13],
    ["src/app/combat.css", ".game-shell.is-combat .combat-unit-label>small", 11],
    ["src/app/combat.css", ".command-detail>p", 14],      // command description
    ["src/app/combat.css", ".inspect-command strong", 13],// command names
    ["src/app/combat.css", ".activate-command", 14],      // the activate button
  ];
  for (const [file, selector, floor] of floors) {
    const value = ruleValue(file.endsWith("combat.css") ? panel : css, selector, "font-size");
    assert.ok(value !== null, `${selector} has no font-size`);
    assert.ok(value! >= floor, `${selector} is ${value}px, below the ${floor}px legibility floor`);
  }
});

test("HP bars are thick enough to see against the battlefield", () => {
  for (const [text, selector, floor] of [
    [css, ".combat-unit-label>.progress-track", 6],
    [panel, ".model-vitals .progress-track", 6],
  ] as [string, string, number][]) {
    const value = ruleValue(text, selector, "height");
    assert.ok(value !== null, `${selector} has no height`);
    assert.ok(value! >= floor, `${selector} is ${value}px tall, below ${floor}px`);
  }
});

test("the battlefield retains at least 80% while the dock has a fixed budget", () => {
  assert.match(panel, /\.game-shell\.is-combat \.battle-arena\{height:82%;flex:0 0 82%/);
  assert.match(panel, /\.game-shell\.is-combat \.battle-dashboard\{height:18%;flex:0 0 18%/);
});
