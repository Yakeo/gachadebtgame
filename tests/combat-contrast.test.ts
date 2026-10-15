import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowDown } from "lucide-react";

const css = readFileSync("src/app/combat.css", "utf8");
const source = readFileSync("src/components/combat-stage.tsx", "utf8");

test("target reticles are downward arrows, not circles over the model", () => {
  assert.doesNotMatch(source, /className="target-reticle"|<Target /);
  assert.match(source, /className="target-pointer"[^]*?<ArrowDown size=\{32\}/);
  assert.match(renderToStaticMarkup(createElement(ArrowDown)), /lucide-arrow-down/);
  assert.match(css, /\.battle-screen \.target-pointer,\.battle-screen \.turn-pointer\{[^}]*top:-38px/);
});

test("active living allies get a separate arrow and targets expose selection", () => {
  assert.match(source, /battle.active === index && ally.hp > 0 && battle.status === "active" && <span className="turn-pointer"/);
  assert.match(source, /aria-pressed=\{target === index\}/);
  for (const selector of [".ally-unit.current:not(.defeated) .sprite-art", ".enemy-unit.targeted:not(.defeated) .sprite-art"]) {
    assert.ok(css.includes(selector));
  }
  assert.match(css, /filter:brightness\(1.3\) drop-shadow\(1px 0 0 #fff\)/);
});

test("living enemies do not dim when controls are locked; defeated ones stay distinct", () => {
  assert.ok(css.includes(".battle-screen .enemy-unit:disabled:not(.defeated){opacity:1}"));
  assert.match(css, /\.combat-unit:not\(.defeated\) \.sprite-art\{\s*filter:brightness\(1.22\)/);
  // Illumination is on the art, leaving rig hit flashes and dash transforms alone.
  const contrast = css.slice(css.indexOf("/* Stage-independent combat contrast."));
  assert.doesNotMatch(contrast, /\.sprite-rig\{/);
  assert.doesNotMatch(contrast, /animation:|@keyframes/);
});

test("energy is readable independently of the battlefield painting", () => {
  const contrast = css.slice(css.indexOf("/* Stage-independent combat contrast."));
  assert.match(contrast, /\.model-vitals>div:last-child\{\s*color:#10283d;background:#f4faff/);
  assert.match(contrast, /height:7px;background:#15324f/);
  assert.match(contrast, /background:linear-gradient\(90deg,#57bfff,#b3f4ff\)/);
  assert.match(contrast, /@media\(max-width:650px\)/);
});
