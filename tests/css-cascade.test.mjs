/**
 * Guard the recruit banner against silent cascade defeats.
 *
 * The banner art is styled by a class-only rule, and a stale element-qualified
 * rule further up the stylesheet once outranked it without any visible error:
 * the page simply rendered wrong. Asserting on the source text is not enough to
 * catch that, so this resolves the cascade for real - it parses the stylesheet,
 * matches the selectors against the banner elements, sorts by specificity and
 * source order, and checks which declaration actually wins.
 *
 * Selectors this cannot model (pseudo-classes, attribute selectors, ...) are
 * skipped rather than guessed at.
 */
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

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

test("the banner backdrop actually receives its positioning", () => {
  // The backdrop selector was once mangled into `.recruit-view>img .x`, which
  // matches nothing, so the image rendered unstyled and inline - the banner
  // visibly broke. Matching the real element is the whole point of this test.
  const style = resolve(element("img", ["recruit-keyart-backdrop"]));
  assert.equal(style.position, "absolute", "backdrop must be taken out of flow");
  assert.equal(style["object-fit"], "cover");
  assert.ok(/blur/.test(style.filter ?? ""), `expected a blur filter, got ${style.filter}`);
  assert.equal(style["z-index"], "-4");
});

test("no element-qualified rule outranks the banner figure", () => {
  const style = resolve(element("img", ["recruit-keyart"]));
  assert.equal(style["object-fit"], "contain", "the figure must not be stretched across the banner");
  assert.equal(style["image-rendering"], "auto", "keyart is not pixel art");
  assert.equal(style["max-width"], "70%");
  assert.equal(style["pointer-events"], "none");
});

test("the banner layers stack in the intended order", () => {
  // The illustration must sit *below* the gradient and grid: they are what tint
  // it and give the banner its depth. Painting it on top leaves the page
  // perfectly usable but flat, which is exactly the kind of regression that
  // slips through a review - so pin the order, not a single magic number.
  const layers = [
    ["wash", element("img", ["recruit-keyart-backdrop"])],
    ["illustration", element("img", ["recruit-keyart"])],
    ["gradient", element("div", ["recruit-gradient"])],
    ["grid", element("div", ["recruit-grid"])],
    ["copy", element("div", ["recruit-copy"])],
  ].map(([name, el]) => {
    const raw = resolve(el)["z-index"];
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
  const narrow = resolve(element("img", ["recruit-keyart"]), 640);
  assert.equal(narrow["max-width"], "88%", "the narrow-screen override must still reach the element");
  assert.equal(narrow.position, "absolute");
});
