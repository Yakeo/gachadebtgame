/**
 * Guard the recruit banner against silent cascade defeats.
 *
 * The banner has now been broken twice by stylesheet problems, both times the
 * same way: the art lost its positioning and fell back into normal flow, where
 * a 572x1024 image pushed the copy, the pity bar and both recruit buttons off
 * the screen. The page kept working, it just had nothing on it.
 *
 * So the art's layout moved inline, where no class can outrank it, and the
 * stylesheet kept only the look. These tests check the split actually holds:
 * that the inline styles take the art out of flow, that the content paints in
 * front of it, and that the stylesheet has not quietly grown a competing
 * position rule that would win in some state.
 *
 * Asserting on source text is not enough for the cascade half, so that part
 * resolves for real - it parses the stylesheet, matches selectors against the
 * banner elements, sorts by specificity and source order, and reports which
 * declaration actually wins. Selectors it cannot model (pseudo-classes,
 * attribute selectors, ...) are skipped rather than guessed at.
 */
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { RECRUIT_ART_FIGURE, RECRUIT_ART_WASH, RECRUIT_CONTENT_Z } from "../src/lib/recruit-art.ts";

const CSS = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function parse(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const stack = [];
  let i = 0, buffer = "";

  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") {
      const head = buffer.trim();
      buffer = "";
      if (head.startsWith("@media")) {
        stack.push(head.slice("@media".length).trim());
        i++;
        continue;
      }
      const end = source.indexOf("}", i);
      rules.push({ selector: head, body: source.slice(i + 1, end), media: stack.at(-1) ?? null, order: rules.length });
      i = end + 1;
      continue;
    }
    if (ch === "}") { stack.pop(); buffer = ""; i++; continue; }
    buffer += ch;
    i++;
  }
  return rules;
}

const SUPPORTED = /^[a-z0-9.#\s>-]+$/i;   // note: hyphens are everywhere in these class names
const parseCompound = part => ({
  tag: part.match(/^[a-z0-9]+/i)?.[0] ?? null,
  classes: [...part.matchAll(/\.([a-z0-9_-]+)/gi)].map(m => m[1]),
});

function compile(selector) {
  if (!SUPPORTED.test(selector)) return null;              // pseudo-classes etc.
  const parts = selector.trim().split(/\s*(>)\s*|\s+/).filter(s => s && s !== " ");
  const chain = [];
  let combinator = " ";
  for (const part of parts) {
    if (part === ">") { combinator = ">"; continue; }
    chain.push({ compound: parseCompound(part), combinator });
    combinator = " ";
  }
  const classes = chain.reduce((n, c) => n + c.compound.classes.length, 0);
  const tags = chain.filter(c => c.compound.tag).length;
  return { chain, specificity: [0, classes, tags] };
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const compoundMatches = (compound, node) =>
  node != null &&
  (!compound.tag || node.tag === compound.tag) &&
  compound.classes.every(c => node.classes.includes(c));

function matches(chain, element) {
  let i = chain.length - 1;
  let node = element;
  while (i >= 0) {
    if (!compoundMatches(chain[i].compound, node)) return false;
    i--;
    if (i < 0) return true;
    if (chain[i + 1].combinator === ">") {
      node = node.parent;                                  // adjacent ancestor only
    } else {
      let found = null;                                    // any ancestor
      for (let p = node.parent; p; p = p.parent) {
        if (compoundMatches(chain[i].compound, p)) { found = p; break; }
      }
      if (!found) return false;
      i--;
      if (i < 0) return true;
      node = found;
    }
  }
  return true;
}

/** Media queries evaluated at a 1440px desktop, where the bug was visible. */
function mediaApplies(media, width = 1440) {
  if (!media) return true;
  if (/prefers-reduced-motion|max-height/.test(media)) return false;
  const max = media.match(/max-width:\s*(\d+)px/);
  const min = media.match(/min-width:\s*(\d+)px/);
  if (max && width > Number(max[1])) return false;
  if (min && width < Number(min[1])) return false;
  return true;
}

function declarations(body) {
  const out = {};
  for (const chunk of body.split(";")) {
    const at = chunk.indexOf(":");
    if (at < 0) continue;
    out[chunk.slice(0, at).trim()] = chunk.slice(at + 1).trim();
  }
  return out;
}

/** The declarations that actually apply to `element`, in the real cascade. */
function resolve(element, width = 1440) {
  const hits = [];
  for (const rule of parse(CSS)) {
    if (!mediaApplies(rule.media, width)) continue;
    for (const selector of rule.selector.split(",")) {
      const compiled = compile(selector);
      if (!compiled || !matches(compiled.chain, element)) continue;
      hits.push({ ...compiled, order: rule.order, declarations: declarations(rule.body) });
      break;
    }
  }
  hits.sort((a, b) => compare(a.specificity, b.specificity) || a.order - b.order);
  return Object.assign({}, ...hits.map(h => h.declarations));
}

const view = { tag: "section", classes: ["recruit-view"], parent: null };
const element = (tag, classes) => ({ tag, classes, parent: view });

/**
 * React inline styles use camelCase (`objectFit`); the stylesheet and the
 * cascade resolver use kebab-case (`object-fit`). Normalise so the two can be
 * compared and merged as one computed style.
 */
function inlineToCss(inline) {
  const out = {};
  for (const [key, value] of Object.entries(inline ?? {})) {
    out[key.startsWith("--") ? key : key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)] = value;
  }
  return out;
}

/** What the browser computes for an element: inline styles win, then the cascade. */
function computed(classes, inline) {
  return { ...resolve(element("img", classes)), ...inlineToCss(inline) };
}

test("the banner backdrop is taken out of flow by its inline style", () => {
  // The backdrop selector was once mangled into `.recruit-view>img .x`, which
  // matches nothing, so the image rendered inline at full size and pushed the
  // page apart. The layout no longer depends on that selector matching.
  const style = computed(["recruit-keyart-backdrop"], RECRUIT_ART_WASH);
  assert.equal(style.position, "absolute", "backdrop must be taken out of flow");
  assert.equal(style["object-fit"], "cover");
  assert.equal(style.inset, 0, "backdrop must cover the banner");
  assert.equal(style["z-index"], -4);
  // the look is still the stylesheet's job
  const look = resolve(element("img", ["recruit-keyart-backdrop"]));
  assert.ok(/blur/.test(look.filter ?? ""), `expected a blur filter, got ${look.filter}`);
});

test("the banner figure is anchored, unscaled and inert", () => {
  const style = computed(["recruit-keyart"], RECRUIT_ART_FIGURE);
  assert.equal(style.position, "absolute", "figure must be taken out of flow");
  assert.equal(style["object-fit"], "contain", "the figure must not be stretched across the banner");
  assert.equal(style.right, 0, "the figure anchors to the right of the banner");
  assert.equal(style["max-width"], "70%");
  assert.equal(style["pointer-events"], "none");
  // `image-rendering` is cosmetic and still comes from the stylesheet
  assert.equal(resolve(element("img", ["recruit-keyart"]))["image-rendering"], "auto",
    "keyart is not pixel art");
});

test("the banner layers stack in the intended order", () => {
  // The illustration must sit *below* the gradient and grid: they are what tint
  // it and give the banner its depth. Painting it on top leaves the page
  // perfectly usable but flat, which is exactly the kind of regression that
  // slips through a review - so pin the order, not a single magic number.
  const layers = [
    ["wash", computed(["recruit-keyart-backdrop"], RECRUIT_ART_WASH)],
    ["illustration", computed(["recruit-keyart"], RECRUIT_ART_FIGURE)],
    ["gradient", resolve(element("div", ["recruit-gradient"]))],
    ["grid", resolve(element("div", ["recruit-grid"]))],
    ["copy", resolve(element("div", ["recruit-copy"]))],
  ].map(([name, style]) => {
    const raw = style["z-index"];
    const value = raw === undefined || raw === "auto" ? 0 : Number(raw);
    assert.ok(Number.isFinite(value), `${name} has an unusable z-index: ${raw}`);
    return { name, value };
  });

  for (let i = 1; i < layers.length; i++) {
    const behind = layers[i - 1], front = layers[i];
    assert.ok(front.value >= behind.value,
      `${front.name} (z-index ${front.value}) is painted behind ${behind.name} ` +
      `(z-index ${behind.value}); expected back-to-front order ` +
      layers.map(l => `${l.name} ${l.value}`).join(" < "));
  }
});

test("only one rule set can style the banner art", () => {
  // Several rules accumulated here over time, written for different versions of
  // the banner, and they fought. Guard against that happening again.
  const setters = { "object-fit": [], position: [], "image-rendering": [] };
  for (const rule of parse(CSS)) {
    if (!mediaApplies(rule.media)) continue;
    for (const selector of rule.selector.split(",")) {
      const compiled = compile(selector);
      if (!compiled || !matches(compiled.chain, element("img", ["recruit-keyart"]))) continue;
      const decls = declarations(rule.body);
      for (const key of Object.keys(setters)) if (decls[key]) setters[key].push(selector.trim());
    }
  }
  for (const [property, selectors] of Object.entries(setters)) {
    assert.ok(selectors.length <= 1,
      `"${property}" is set by ${selectors.length} rules that all match the banner ` +
      `(${selectors.join(", ")}) - they will fight as the stylesheet grows`);
  }
});

test("media queries evaluate without breaking the desktop rules", () => {
  const narrow = computed(["recruit-keyart"], RECRUIT_ART_FIGURE);
  assert.equal(narrow.position, "absolute", "the element stays out of flow at any width");
  const narrowCss = resolve(element("img", ["recruit-keyart"]), 640);
  assert.equal(narrowCss["max-width"], "88%", "the narrow-screen override must still reach the element");
});

test("the stylesheet cannot compete with the inline layout", () => {
  // The whole point of moving the layout inline is that a class rule can no
  // longer take it away. If the stylesheet ever grows a competing position or
  // object-fit rule for the art, the insurance is gone - fail loudly here.
  const contested = ["position", "object-fit", "width", "height"];
  for (const classes of [["recruit-keyart"], ["recruit-keyart-backdrop"]]) {
    const fromCss = resolve(element("img", classes));
    for (const property of contested) {
      assert.equal(fromCss[property], undefined,
        `.${classes[0]} sets "${property}" in the stylesheet; it must come from ` +
        `src/lib/recruit-art.ts instead, or a cascade defeat can push the page apart again`);
    }
  }
});

test("the banner survives a stylesheet that fails to load", () => {
  // The failure this guards against, stated directly: with no stylesheet at
  // all, the only thing keeping a 572x1024 image out of the document flow is
  // the inline style. That is the entire reason the layout lives there.
  for (const [name, style] of [["wash", RECRUIT_ART_WASH], ["figure", RECRUIT_ART_FIGURE]]) {
    assert.equal(style.position, "absolute",
      `the ${name} must be out of flow even with no stylesheet at all`);
    assert.equal(style.pointerEvents, "none",
      `the ${name} must not intercept clicks on the recruit buttons`);
  }
  assert.equal(RECRUIT_ART_WASH.zIndex, -4);
  assert.equal(RECRUIT_ART_FIGURE.zIndex, -3);
  assert.ok(RECRUIT_ART_FIGURE.maxWidth,
    "the figure needs a bound so it cannot cover the copy if positioning is ever lost");
  assert.ok(RECRUIT_ART_FIGURE.zIndex < RECRUIT_CONTENT_Z,
    "the art must paint behind the copy");
});

test("the decision options are centred rather than stretched", () => {
  // The options first spanned the whole dialogue box, which read as a form
  // rather than a decision. They are a centred stack now, so the moment you
  // are asked to choose is the moment the screen points at the middle.
  const stack = resolve(element("div", ["story-choices"]));
  assert.match(String(stack["max-width"] ?? ""), /\d+px/,
    "the option stack needs a width so the bars do not span the whole box");
  assert.match(String(stack.margin ?? ""), /auto/,
    "the option stack must be centred horizontally (margin ... auto)");
  const option = resolve(element("button", ["x"]), undefined) || {};
  const row = resolve(element("div", ["story-choices"]));
  assert.ok(row["max-width"], "story-choices must set max-width");
  // the bar centres its label and pins the tick / arrow to the edges
  const button = {};
  for (const rule of parse(CSS)) {
    if (!mediaApplies(rule.media)) continue;
    for (const selector of rule.selector.split(",")) {
      const compiled = compile(selector);
      if (compiled && matches(compiled.chain, { tag: "button", classes: [], parent: { tag: "div", classes: ["story-choices"], parent: view } })) {
        Object.assign(button, declarations(rule.body));
      }
    }
  }
  assert.equal(button["justify-content"], "center", "the option label must be centred in its bar");
  assert.equal(button["text-align"], "center");
});
