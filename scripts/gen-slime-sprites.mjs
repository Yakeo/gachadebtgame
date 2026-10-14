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
 * The shared slime body.
 *
 * The supplied designs are wide and squat rather than domed: a broad arc over
 * near-vertical sides, about 1.35 times as wide as it is tall, with a flat
 * base. Four bands make one up - a bright rim, a fill, a darker shadow across
 * the base, and a pale gloss streak down the right flank - so the fill is a
 * parameter rather than something derived from the rim. Red, gold and purple
 * all run darker on the inside; the blue design is the one that runs lighter.
 *
 * `extras` runs after the body and before the eyes. Anything the slime carries
 * has to be drawn here rather than before: painted before the body it is
 * covered up, and the cactus ends up floating above its shoulder with nothing
 * joining it to the creature.
 */
function slimeBody(g, { rim, body, dark, light, extras }) {
  const cx = 20, rx = 18, top = 14, bottom = 41;   // bottom row 41 -> screen y167

  dome(g, { cx, rx, top, bottom, color: rim });
  dome(g, { cx, rx: rx - 1, top: top + 1, bottom: bottom - 1, color: body });

  // Shadow across the base, inset far enough that the bright rim still shows
  // beneath it - the designs read as lit from the front, so the lit edge has to
  // survive. The flanks darken a little as well, which stops the band floating.
  rect(g, 6, 37, 33, 39, dark);
  rect(g, 5, 34, 5, 39, dark);
  rect(g, 34, 34, 34, 39, dark);

  // Gloss: a short dash high on the left, then the stepped streak down the right
  // flank. The dash sits just above the eye line and the streak starts level
  // with it, which is where the supplied art puts both.
  for (let i = 0; i < 3; i++) g.set(8 + i, 19 - i, light);
  for (const [x, y0, length] of [[33, 23, 3], [32, 28, 3], [33, 33, 2]]) {
    for (let i = 0; i < length; i++) g.set(x, y0 + i, light);
  }

  // The cactus, the crown, whatever else this one is carrying.
  if (extras) extras(g);

  // Closed, contented eyes: a zigzag two humps wide, a quarter of the way down
  // the body. Drawn last so that no accessory can sit on top of the face.
  for (const x0 of [11, 23]) {
    for (let i = 0; i < 6; i++) g.set(x0 + i, 22 + (i % 2 ? 0 : 1), dark);
  }
}

/* --------------------------------------------------------------- the five */
const SPRITES = {
  "slime-blue": { rim: "#4a93e8", body: "#6cb0f5", dark: "#2d63b0", light: "#cfe8ff" },
  "slime-red": { rim: "#c0453f", body: "#9c3a3a", dark: "#6b1d1d", light: "#e0a0a0" },
  "slime-gold": { rim: "#f0c419", body: "#ab8b1c", dark: "#6f5a10", light: "#f7e6a0" },
};

/**
 * Cactloom: a cactus in a banded pot, planted into his top right shoulder.
 *
 * The assembly is drawn flat in its own coordinates and then rotated about the
 * pot, which is how the supplied art has it - leaning, not standing up. The
 * trunk carries a chequer of two greens rather than flat fill, and a row of
 * spines down each flank: at sprite size a plain green column reads as a
 * rectangle, and the texture is what makes it a cactus.
 */
function drawCactloom(g) {
  const palette = { rim: "#c0453f", body: "#9c3a3a", dark: "#6b1d1d", light: "#e0a0a0" };
  const parts = [];
  const put = (x, y, color) => parts.push({ x, y, color });

  // Pot: wider at the lip than the foot, with three banded weave rows.
  for (let y = 0; y < 10; y++) {
    const inset = Math.floor(y / 3.4);
    for (let x = -5 + inset; x < 7 - inset; x++) {
      const banded = y === 2 || y === 5 || y === 8;
      const edge = x === -5 + inset || x === 6 - inset;
      put(x, y, banded ? "#8a6132" : edge ? "#a9793f" : "#c8a05a");
    }
  }
  for (let y = -2; y < 0; y++) for (let x = -6; x < 8; x++) put(x, y, y === -2 ? "#e0c088" : "#6f4d28");

  // Trunk, with the chequer the designs use instead of flat green.
  for (let y = -19; y < 0; y++) {
    for (let x = -2; x < 4; x++) put(x, y, (x + y) % 4 === 0 ? "#2f7a30" : "#4aa844");
  }
  // Left arm, elbowing out and up; right arm, shorter.
  for (let y = -13; y < -10; y++) for (let x = -6; x < -2; x++) put(x, y, "#4aa844");
  for (let y = -17; y < -13; y++) for (let x = -6; x < -3; x++) put(x, y, "#4aa844");
  for (let y = -16; y < -13; y++) for (let x = 4; x < 8; x++) put(x, y, "#4aa844");
  for (let y = -20; y < -16; y++) for (let x = 5; x < 8; x++) put(x, y, "#4aa844");

  // Spines: a tick every other row down both flanks, plus a few on the arms.
  for (let y = -19; y < 0; y += 2) { put(-3, y, "#24531f"); put(4, y, "#24531f"); }
  for (const [x, y] of [[-7, -11], [8, -14], [-7, -15], [8, -17], [0, -20], [2, -20]]) put(x, y, "#24531f");

  // A face, so it has somewhere to be smug from.
  put(0, -16, "#1c3f18"); put(2, -16, "#1c3f18"); put(1, -15, "#1c3f18");

  // A 14 degree lean at +24, not 21 at +25: the rotation swings the tall right
  // arm outward, and at 21 degrees its tip reached the canvas edge and was
  // clipped. tests/enemy-sprites.test.mjs asserts none of them touch it.
  const extras = (grid) => {
    for (const p of rotate(parts, 1, 0, 14)) grid.set(p.x + 24, p.y + 22, p.color);
  };
  slimeBody(g, { ...palette, extras });
}

/**
 * King Slooom: the crown, and the things you can see through him.
 *
 * The interiors are the interesting part of this design - a little pink slime
 * and a pale loaf suspended in the body, which is what makes him read as
 * translucent rather than just purple. They are mixed toward his own purple, so
 * they look like they are inside the jelly instead of stuck to the front, and
 * drawn before the face so the eyes stay legible on top of the clutter.
 */
function drawKingSlooom(g) {
  const palette = { rim: "#a05fe0", body: "#6b3fa0", dark: "#3f2266", light: "#d0a8f0" };
  const extras = (grid) => {
    // The pale loaf on the right, with a rim of its own.
    for (let y = 30; y <= 37; y++) {
      const dy = (y - 33.5) / 3.6;
      if (Math.abs(dy) > 1) continue;
      const half = Math.round(6 * Math.sqrt(1 - dy * dy));
      for (let x = 24 - half; x <= 24 + half; x++) grid.set(x, y, "#7a6aa8");
    }
    for (let y = 31; y <= 36; y++) {
      const dy = (y - 33.5) / 3.2;
      if (Math.abs(dy) > 1) continue;
      const half = Math.round(5 * Math.sqrt(1 - dy * dy));
      for (let x = 24 - half; x <= 24 + half; x++) grid.set(x, y, "#9587b8");
    }

    // The little pink slime keeping him company, lower left.
    dome(grid, { cx: 10, rx: 7, top: 29, bottom: 39, color: "#7d3a5c" });
    dome(grid, { cx: 10, rx: 6, top: 30, bottom: 38, color: "#9c4f73" });
    rect(grid, 6, 35, 14, 36, "#65304c");
    for (const x of [8, 12]) { grid.set(x, 33, "#542840"); grid.set(x + 1, 32, "#542840"); }

    // Two of the pebbles he has been swallowing.
    ellipse(grid, 19, 28, 2, 2, "#8a7fb0");
    ellipse(grid, 16, 32, 1.5, 1.5, "#7a6aa8");

    // Crown: three points over a banded circlet, perched on the upper right of
    // the head and leaning outward the way the supplied art has it. Drawn as an
    // accessory so it sits on the head rather than disappearing behind it, and
    // outlined darkly enough to separate from the purple it stands on.
    const crown = [];
    const put = (x, y, color) => crown.push({ x, y, color });
    for (let x = -9; x <= 9; x++) {
      put(x, 0, "#5c3d16");
      put(x, -1, "#c9922e");
      put(x, -2, x % 3 === 0 ? "#e8c98a" : "#a87526");
    }
    for (const x of [-7, -1, 5]) {
      for (let i = 0; i < 8; i++) {
        const width = Math.max(1, 3 - Math.floor(i / 3));
        for (let w = 0; w < width; w++) put(x + w, -3 - i, (i + w) % 2 ? "#c9922e" : "#e8c98a");
      }
      put(x, -11, "#5c3d16");
      put(x + 1, -11, "#e8c98a");
    }
    for (const p of rotate(crown, 0, 0, 20)) grid.set(p.x + 25, p.y + 14, p.color);
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
  else slimeBody(g, { ...sprite, extras: null });

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
