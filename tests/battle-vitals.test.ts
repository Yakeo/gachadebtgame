/**
 * Battle readability and enemy vitals.
 *
 * Two reports from the field, both at a laptop window where the game's
 * viewport scaler runs at ~0.8x (gameViewport scales the frame to fit, so an
 * 8px label reaches the eye at 6.4px):
 *
 *  - "i cannot see the hp at all for the boss" - hostile HP lived only in the
 *    on-field labels above the sprites, in 6px text over busy battlefields.
 *    The dashboard now carries an enemy vitals strip (name, HP bar, numbers)
 *    that doubles as a target selector.
 *  - "the UI in the battle looks really small. like, really. i can barely
 *    read anything" - the battle type scale was tuned for density, not for
 *    reading. These floors keep it readable: if someone "optimises" a font
 *    back to 6px the tests fail first.
 *
 * Run with: npm test
 */
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

test("the dashboard carries an enemy vitals strip", () => {
  assert.match(stage, /className="enemy-hud"/, "hostile HP belongs in the dashboard");
  assert.match(stage, /className=\{`enemy-hud-card /, "each hostile gets a vitals card");
  assert.match(stage, /onClick=\{\(\) => setTarget\(index\)\}/, "clicking a vitals card selects that target");
  assert.match(stage, /<ProgressBar value=\{enemy\.hp\} max=\{enemy\.maxHp\} className="enemy-health" \/>/,
    "the card shows the hostile's HP bar");
  assert.match(css, /\.enemy-hud\{/, "the vitals strip needs layout");
  assert.match(css, /\.enemy-hud-card\.targeted\{/, "the selected hostile's card must stand out");
});

test("the vitals are legible at the sizes people actually play", () => {
  // Floors, not targets: the complaint was text at 6-9px rendering at ~0.8x.
  const floors: [string, string, number][] = [
    ["src/app/globals.css", ".hud-hp>span", 13],          // HP numbers, both sides
    ["src/app/globals.css", ".ally-hud-card strong", 13], // squad names
    ["src/app/globals.css", ".enemy-hud-card strong", 13],// hostile names
    ["src/app/globals.css", ".combat-unit-label>small", 10], // on-field HP readout
    ["src/app/globals.css", ".battle-log-line>p", 11],    // the action log
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
    [css, ".ally-hud-card .progress-track", 6],
    [css, ".enemy-hud-card .progress-track", 6],
  ] as [string, string, number][]) {
    const value = ruleValue(text, selector, "height");
    assert.ok(value !== null, `${selector} has no height`);
    assert.ok(value! >= floor, `${selector} is ${value}px tall, below ${floor}px`);
  }
});

test("the vitals strip survives compact heights without eating the arena", () => {
  assert.match(css, /@media\(max-height:830px\)\{\.enemy-hud\{/,
    "the strip must stay compact where the user actually plays (768px windows)");
});
