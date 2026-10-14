#!/usr/bin/env node
/**
 * Draw the five slime enemies as pixel art.
 *
 * These enemies were inline SVG shapes, which cannot be animated as one piece
 * with the battle rig. Committing them as PNGs lets the whole sprite squash,
 * stretch and pounce together.
 *
 * The geometry and the palettes are the ones the SVG slimes already used, so
 * the enemies keep the look the rest of the game was built around: a domed
 * body, a 1px rim, a highlight on the upper left, a streak down the right and
 * a shadow band across the base. The eyes are new - the SVG slimes had none,
 * and the designs this is drawn from wear them.
 *
 * Everything is authored on a 40x50 grid and scaled up by an integer factor,
 * which is what makes it read as pixel art rather than a small drawing.
 *
 * Usage: node scripts/gen-slime-sprites.mjs [--preview]
 *   --preview writes /tmp/slime-preview.png instead of touching the repo.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "images", "enemies");
const PREVIEW = process.argv.includes("--preview");

const W = 40, H = 50, SCALE = 4;   // 40x50 -> 160x200, matching the old SVG viewBox

/* ------------------------------------------------------------------ canvas */
function createGrid() {
  const pixels = new Array(W * H).fill(null);
  return {
    set(x, y, color) {
      const px = Math.round(x), py = Math.round(y);
      if (px < 0 || py < 0 || px >= W || py >= H) return;
      if (!color) return;
      pixels[py * W + px] = color;
    },
    at(x, y) {
      const px = Math.round(x), py = Math.round(y);
      if (px < 0 || py < 0 || px >= W || py >= H) return null;
      return pixels[py * W + px];
    },
    all: pixels,
  };
}

/* --------------------------------------------------------------- primitives */

/** A domed body: a semicircular top over straight sides and a flat base. */
function dome(g, { cx, rx, top, bottom, color }) {
  const arcCentre = top + rx;
  for (let y = top; y <= bottom; y++) {
    let half;
    if (y < arcCentre) {
      const dy = arcCentre - y;
      const squared = rx * rx - dy * dy;
      if (squared < 0) continue;
      half = Math.sqrt(squared);
    } else {
      half = rx;
    }
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) g.set(x, y, color);
  }
}

function rect(g, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, color);
}

function ellipse(g, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.set(x, y, color);
    }
  }
}

function line(g, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let oy = 0; oy < thickness; oy++) for (let ox = 0; ox < thickness; ox++) g.set(x + ox, y + oy, color);
  }
}

/** Rotate a list of points about a pivot - for the cactus, which sits crooked. */
function rotate(points, pivotX, pivotY, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  return points.map(p => {
    const dx = p.x - pivotX, dy = p.y - pivotY;
    return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos, color: p.color };
  });
}

/* ----------------------------------------------------------------- colours */
function shade(hex, amount) {
  // amount < 0 darkens toward black, > 0 lightens toward white
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const base = (value >> shift) & 255;
    return Math.max(0, Math.min(255, Math.round(amount < 0 ? base * (1 + amount) : base + (255 - base) * amount)));
  };
  return `#${[16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The shared slime body, exactly the shape and palette the SVG used, plus eyes.
 * `extras` runs after the body and before the rim clean-up so accessories can
 * overlap the shoulders the way the cactus and crown do.
 */
function slimeBody(g, { edge, body, light, extras }) {
  // Squatter than the old SVG shape, which is how the supplied art draws them:
  // a little wider than it is tall, with the crown of the dome flattened off.
  const cx = 19.5;
  dome(g, { cx, rx: 16, top: 12, bottom: 41, color: edge });    // rim
  dome(g, { cx, rx: 15, top: 13, bottom: 40, color: body });    // fill

  // highlight on the upper left, as a short diagonal streak
  for (let i = 0; i < 10; i++) {
    const x = 9 + i, y = 18 - Math.floor(i / 3.5);
    g.set(x, y, light); g.set(x, y + 1, light);
  }
  // the streak running down the right flank
  line(g, 31, 20, 31, 30, light, 2);
  line(g, 33, 22, 33, 27, shade(light, -0.25), 1);

  // shadow band across the base, before any accessory lands on top of it
  rect(g, 12, 35, 27, 36, shade(body, -0.28));

  // accessories next: the cactus, crown, helm and companion all overlap the body
  if (extras) extras(g);

  // Eyes last, so nothing paints over them. A shallow flattened peak reads as
  // a contented squint; a valley in the same place reads as an angry brow, so
  // the shape is deliberately low at the edges and high in the middle.
  const eye = shade(edge, -0.45);
  for (const x0 of [10, 22]) {
    g.set(x0, 26, eye);
    g.set(x0 + 1, 25, eye); g.set(x0 + 2, 25, eye);
    g.set(x0 + 3, 26, eye);
  }
}

/* --------------------------------------------------------------- the five */
const SPRITES = {
  "slime-blue": { edge: "#4a86d8", body: "#79b3ef", light: "#b6d7ff" },
  "slime-red": { edge: "#8c2d34", body: "#b8474d", light: "#e5848a" },
  "slime-gold": { edge: "#e3c44a", body: "#c99f28", light: "#f2dd80" },
};

function drawCactloom(g) {
  const palette = { edge: "#8c2d34", body: "#b8474d", light: "#e5848a" };
  // Sized to fit the canvas: the supplied art puts the cactus in the top right
  // with the wings out, which clips if it is drawn any larger.
  const parts = [];
  const put = (x, y, color) => parts.push({ x, y, color });

  // tapered pot
  for (let y = 0; y < 9; y++) {
    const inset = Math.floor(y / 3.5);
    for (let x = -1 + inset; x < 8 - inset; x++) put(x, y, y < 2 ? "#8c6132" : "#b8874a");
  }
  for (let y = -2; y < 0; y++) for (let x = -2; x < 9; x++) put(x, y, "#a9793f");

  // trunk
  for (let y = -16; y < 0; y++) for (let x = 0; x < 6; x++) put(x, y, x < 2 ? "#4e8340" : "#5f9a4c");
  // left arm, elbowing up
  for (let y = -11; y < -7; y++) for (let x = -3; x < 1; x++) put(x, y, "#5f9a4c");
  for (let y = -14; y < -11; y++) for (let x = -3; x < 0; x++) put(x, y, "#5f9a4c");
  // right arm
  for (let y = -13; y < -9; y++) for (let x = 6; x < 10; x++) put(x, y, "#5f9a4c");
  for (let y = -16; y < -13; y++) for (let x = 7; x < 10; x++) put(x, y, "#5f9a4c");

  // the little wings it is trying to look threatening with
  for (let y = -12; y < -8; y++) for (let x = -6; x < -3; x++) put(x, y, y < -10 ? "#d5dae2" : "#b9c0ca");
  for (let y = -15; y < -11; y++) for (let x = 10; x < 13; x++) put(x, y, y < -13 ? "#d5dae2" : "#b9c0ca");

  // needles, then a face
  for (const [x, y] of [[1, -14], [4, -12], [2, -8], [5, -15]]) put(x, y, "#3f5a36");
  put(1, -6, "#3b3f4a"); put(4, -6, "#3b3f4a"); put(2, -5, "#3b3f4a"); put(3, -5, "#3b3f4a");

  // +21, not +24: the right wing was reaching past the canvas edge and being
  // cut off. Sprites are asserted unclipped by tests/enemy-sprites.test.mjs.
  for (const p of rotate(parts, 2, 0, 14)) g.set(p.x + 21, p.y + 22, p.color);

  slimeBody(g, { ...palette, extras: null });
}

function drawKingSlooom(g) {
  const palette = { edge: "#5c3d94", body: "#6d4aa8", light: "#a583d8" };
  const extras = (grid) => {
    // The little pink slime keeping him company, with its own rim so it reads
    // as a separate creature rather than a smudge of his own colour.
    dome(grid, { cx: 11, rx: 7, top: 27, bottom: 40, color: "#8f5573" });
    dome(grid, { cx: 11, rx: 6, top: 28, bottom: 39, color: "#c0779f" });
    grid.set(7, 32, "#6d3f56"); grid.set(11, 32, "#6d3f56");
    rect(grid, 7, 37, 15, 38, "#8f5573");

    // A crown with real prongs: a solid band and three tapering points, so it
    // reads as a crown at sprite size instead of a row of antennae.
    for (let x = 17; x <= 33; x++) { grid.set(x, 16, "#8a6134"); grid.set(x, 15, "#c99a55"); grid.set(x, 14, "#e0b877"); }
    for (const x of [18, 24, 30]) {
      const heights = [7, 6, 5, 4, 3, 2, 1];
      heights.forEach((height, i) => {
        const width = Math.max(1, 5 - i);
        for (let w = 0; w < width; w++) grid.set(x + w, 13 - i, i % 2 ? "#e0b877" : "#f0d69c");
      });
      grid.set(x + 1, 5, "#fff0c4");
    }

    // The helm he is wearing slightly wrong: a compact grey dome with a brim
    // under it, sitting on the right shoulder. Kept small - at sprite size a
    // large helmet reads as a second head.
    for (let y = 24; y <= 36; y++) {
      const dy = (y - 32) / 8;
      if (Math.abs(dy) > 1) continue;
      const half = Math.round(5 * Math.sqrt(1 - dy * dy));
      for (let x = 32 - half; x <= 32; x++) grid.set(x, y, "#b0a8c4");
    }
    for (let y = 26; y <= 34; y++) {
      const dy = (y - 32) / 6;
      if (Math.abs(dy) > 1) continue;
      const half = Math.round(4 * Math.sqrt(1 - dy * dy));
      for (let x = 31 - half; x <= 31; x++) grid.set(x, y, "#c6bfd6");
    }
    for (let x = 25; x <= 33; x++) { grid.set(x, 32, "#8a82a6"); grid.set(x, 33, "#6f6889"); }
    for (let x = 26; x <= 32; x++) grid.set(x, 36, "#8a82a6");           // brim
    grid.set(28, 28, "#f0d69c");
    // two of the little boulders he has been carrying around
    ellipse(grid, 23, 29, 2, 2, "#b0a8c4");
    ellipse(grid, 19, 34, 1.5, 1.5, "#a49bbd");
  };
  slimeBody(g, { ...palette, extras });
}

/* ------------------------------------------------------------------- colour */

function hexToRgb(hex, alpha = 255) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

function render(sprite) {
  const g = createGrid();
  if (sprite.kind === "cactloom") drawCactloom(g);
  else if (sprite.kind === "kingslime") drawKingSlooom(g);
  else slimeBody(g, { edge: sprite.edge, body: sprite.body, light: sprite.light, extras: null });

  // scale up by whole pixels, nearest neighbour, into the final canvas
  const width = W * SCALE, height = H * SCALE;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = g.at(Math.floor(x / SCALE), Math.floor(y / SCALE));
      const offset = (y * width + x) * 4;
      if (!color) continue;                      // transparent background
      const [r, gg, b, a] = hexToRgb(color);
      out[offset] = r; out[offset + 1] = gg; out[offset + 2] = b; out[offset + 3] = a;
    }
  }
  return { width, height, data: out };
}

/* ---------------------------------------------------------------- PNG write */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;                                    // filter: none
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;      // bit depth
  header[9] = 6;      // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------- main */
const definitions = [
  { id: "slime-blue", kind: "plain", ...SPRITES["slime-blue"] },
  { id: "slime-gold", kind: "plain", ...SPRITES["slime-gold"] },
  { id: "slime-red", kind: "plain", ...SPRITES["slime-red"] },
  { id: "slime-cactus", kind: "cactloom" },
  { id: "kingslime", kind: "kingslime" },
];

const built = definitions.map(definition => ({ definition, png: encodePng(render(definition)) }));

/**
 * The sprite bytes, keyed by sprite id.
 *
 * Exported so tests can re-derive them and fail if the committed PNGs drift
 * from this script - the same guard the portrait manifest uses. A sprite that
 * stops matching its generator is a sprite nobody can reproduce.
 */
export function spriteRasters() {
  return Object.fromEntries(
    definitions.map(definition => {
      const { width, height, data } = render(definition);
      return [definition.id, { width, height, data }];
    }),
  );
}

export function spriteBytes() {
  return Object.fromEntries(
    definitions.map(definition => [definition.id, encodePng(render(definition))]),
  );
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!invokedDirectly) {
  // imported by a test: nothing to do
} else if (PREVIEW) {
  // lay them out side by side on a dark card, for eyeballing
  const gap = 12;
  const width = built.length * W * SCALE + gap * (built.length + 1);
  const height = H * SCALE + gap * 2;
  const sheet = { width, height, data: Buffer.alloc(width * height * 4) };
  for (let i = 0; i < width * height; i++) {
    sheet.data[i * 4] = 24; sheet.data[i * 4 + 1] = 38; sheet.data[i * 4 + 2] = 56; sheet.data[i * 4 + 3] = 255;
  }
  built.forEach(({ png }, index) => {
    // decode our own PNG the lazy way: rebuild from the same renderer
    const sprite = render(built[index].definition);
    const originX = gap + index * (W * SCALE + gap);
    const originY = gap;
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const src = (y * sprite.width + x) * 4;
        if (sprite.data[src + 3] === 0) continue;
        const dst = ((originY + y) * width + originX + x) * 4;
        sprite.data.copy(sheet.data, dst, src, src + 4);
      }
    }
  });
  writeFileSync("/tmp/slime-preview.png", encodePng(sheet));
  console.log(`preview written to /tmp/slime-preview.png (${width}x${height})`);
} else {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const { definition, png } of built) {
    const path = join(outDir, `${definition.id}.png`);
    writeFileSync(path, png);
    console.log(`${definition.id}.png  ${png.length} bytes`);
  }
  console.log(`\n${built.length} enemy sprites written to public/images/enemies`);
}
