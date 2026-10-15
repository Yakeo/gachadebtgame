#!/usr/bin/env node
/**
 * Normalise the five supplied slime designs onto the battle rig's canvas.
 *
 * The enemy sprites ARE the user's own pixel art, kept verbatim in
 * art-source/enemies/ under the names they arrived with (Bluloom.png and
 * friends). The rig wants one 160x200 RGBA canvas per enemy with every figure
 * resting on the same baseline (row 167), so this script crops each design to
 * its drawn pixels, scales the whole set by ONE common factor - King Slooom
 * stays bigger than a plain blob, exactly as drawn - and centres each result
 * on the canvas with its feet on the baseline.
 *
 * Resampling is integer box-averaging over premultiplied alpha, so a run
 * always produces the same bytes. That matters: tests/enemy-sprites.test.ts
 * compares the committed sprites against this script byte for byte, and art
 * nobody can reproduce is art nobody can fix.
 *
 * Usage: node scripts/gen-slime-sprites.mjs [--preview]
 *   --preview writes /tmp/slime-preview.png instead of touching the repo.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "art-source", "enemies");
const outDir = join(root, "public", "images", "enemies");
const PREVIEW = process.argv.includes("--preview");

const CANVAS = { width: 160, height: 200 };
const BASELINE = 167;   // row the figures' feet rest on, shared by all five
const MAX_FIGURE_WIDTH = 156;

/* ---------------------------------------------------------------- PNG read */
/** Decode an 8-bit RGBA, non-interlaced PNG - which is what the art is. */
function decodePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buffer[i] !== signature[i]) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const kind = buffer.toString("ascii", pos + 4, pos + 8);
    const body = pos + 8;
    if (kind === "IHDR") {
      width = buffer.readUInt32BE(body);
      height = buffer.readUInt32BE(body + 4);
      depth = buffer[body + 8];
      type = buffer[body + 9];
      interlace = buffer[body + 12];
    } else if (kind === "IDAT") {
      idat.push(buffer.subarray(body, body + length));
    } else if (kind === "IEND") {
      break;
    }
    pos = body + length + 4;
  }
  if (depth !== 8 || type !== 6 || interlace !== 0) {
    throw new Error(`unsupported PNG layout: depth ${depth}, colour type ${type}, interlace ${interlace}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  let at = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[at++];
    const row = y * stride;
    const above = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[at++];
      const a = x >= 4 ? out[row + x - 4] : 0;
      const b = y > 0 ? out[above + x] : 0;
      const c = x >= 4 && y > 0 ? out[above + x - 4] : 0;
      let predicted;
      if (filter === 0) predicted = 0;
      else if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error(`unknown scanline filter ${filter}`);
      out[row + x] = (value + predicted) & 255;
    }
  }
  return { width, height, data: out };
}

/* --------------------------------------------------------------- geometry */
/** The bounding box of every pixel that was actually drawn. */
function alphaBounds({ width, height, data }) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error("sprite is completely transparent");
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Box-average a cropped figure down to (targetW, targetH).
 *
 * Each target pixel averages the crop pixels whose centres fall inside it -
 * integer edges only, premultiplied by alpha so transparent pixels cannot
 * darken the rim. Sums stay well inside exact-integer float range, so the
 * result is byte-identical on every run.
 */
function resample(drawn, bounds, targetW, targetH) {
  const { width: fullW, data } = drawn;
  const sw = bounds.width, sh = bounds.height;
  const out = Buffer.alloc(targetW * targetH * 4);
  for (let ty = 0; ty < targetH; ty++) {
    const sy0 = Math.floor((ty * sh) / targetH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * sh) / targetH));
    for (let tx = 0; tx < targetW; tx++) {
      const sx0 = Math.floor((tx * sw) / targetW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * sw) / targetW));
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const at = ((bounds.minY + sy) * fullW + (bounds.minX + sx)) * 4;
          const alpha = data[at + 3];
          sumR += data[at] * alpha;
          sumG += data[at + 1] * alpha;
          sumB += data[at + 2] * alpha;
          sumA += alpha;
          n++;
        }
      }
      const at = (ty * targetW + tx) * 4;
      if (sumA === 0) continue;                       // stays transparent
      out[at + 3] = Math.round(sumA / n);
      out[at] = Math.round(sumR / sumA);
      out[at + 1] = Math.round(sumG / sumA);
      out[at + 2] = Math.round(sumB / sumA);
    }
  }
  return out;
}

/* ----------------------------------------------------------------- render */
const SOURCES = [
  { id: "slime-blue", file: "Bluloom.png" },
  { id: "slime-gold", file: "Yelloom.png" },
  { id: "slime-red", file: "Reloom.png" },
  { id: "slime-cactus", file: "Cactloom.png" },
  { id: "kingslime", file: "King Slooom.png" },
];

const cache = new Map();
const decoded = new Map();

function load(file) {
  if (!decoded.has(file)) {
    const drawn = decodePng(readFileSync(join(sourceDir, file)));
    decoded.set(file, { drawn, bounds: alphaBounds(drawn) });
  }
  return decoded.get(file);
}

function build(id) {
  if (cache.has(id)) return cache.get(id);
  const source = SOURCES.find(s => s.id === id);
  const { drawn, bounds } = load(source.file);

  // One common factor for the whole set, sized so the widest figure just fits.
  // King Slooom therefore stays bigger than a plain blob, exactly as drawn,
  // and a re-export of the art re-frames itself.
  const widest = Math.max(...SOURCES.map(s => load(s.file).bounds.width));
  const scale = MAX_FIGURE_WIDTH / widest;
  const targetW = Math.round(bounds.width * scale);
  const targetH = Math.round(bounds.height * scale);

  const figure = resample(drawn, bounds, targetW, targetH);
  const out = Buffer.alloc(CANVAS.width * CANVAS.height * 4);
  const x0 = Math.floor((CANVAS.width - targetW) / 2);
  const y0 = BASELINE - targetH + 1;                  // feet land on the baseline
  for (let y = 0; y < targetH; y++) {
    figure.copy(out, ((y0 + y) * CANVAS.width + x0) * 4, y * targetW * 4, (y + 1) * targetW * 4);
  }
  const result = { ...CANVAS, data: out };
  cache.set(id, result);
  return result;
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

/* -------------------------------------------------------------------- API */
/**
 * The sprite rasters, keyed by sprite id.
 *
 * Exported so tests can re-derive them and fail if the committed PNGs drift
 * from the source art - the same guard the portrait manifest uses. A sprite
 * that stops matching its pipeline is a sprite nobody can reproduce.
 */
export function spriteRasters() {
  return Object.fromEntries(SOURCES.map(s => [s.id, build(s.id)]));
}

export function spriteBytes() {
  return Object.fromEntries(SOURCES.map(s => [s.id, encodePng(build(s.id))]));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  if (PREVIEW) {
    // five figures side by side on one strip, for eyeballing the set
    const gap = 12;
    const width = CANVAS.width * 5 + gap * 6;
    const height = CANVAS.height + gap * 2;
    const strip = { width, height, data: Buffer.alloc(width * height * 4) };
    SOURCES.forEach((s, i) => {
      const raster = build(s.id);
      const x0 = gap + i * (CANVAS.width + gap);
      for (let y = 0; y < CANVAS.height; y++) {
        raster.data.copy(strip.data, ((y + gap) * width + x0) * 4, y * CANVAS.width * 4, (y + 1) * CANVAS.width * 4);
      }
    });
    writeFileSync("/tmp/slime-preview.png", encodePng(strip));
    console.log("preview written to /tmp/slime-preview.png");
  } else {
    mkdirSync(outDir, { recursive: true });
    for (const s of SOURCES) {
      const bytes = encodePng(build(s.id));
      writeFileSync(join(outDir, `${s.id}.png`), bytes);
      console.log(`${s.id}.png  ${bytes.length} bytes`);
    }
    console.log(`${SOURCES.length} enemy sprites written to public/images/enemies`);
  }
}
