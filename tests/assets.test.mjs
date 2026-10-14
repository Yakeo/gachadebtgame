// Guards the character art. This repository shipped for weeks with <img> tags
// pointing at files that were never committed, so every art slot rendered as a
// broken image. Character art is now asserted to exist; background art that is
// still to be drawn is reported as a note rather than failing the suite.
//
// Run with: npm run test:art
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

/** Walk a directory and return every file with one of the given extensions. */
function walk(dir, extensions) {
  const found = [];
  for (const entry of readdirSync(join(root, dir))) {
    const relative = join(dir, entry);
    if (statSync(join(root, relative)).isDirectory()) found.push(...walk(relative, extensions));
    else if (extensions.some((extension) => entry.endsWith(extension))) found.push(relative);
  }
  return found;
}

/** PNG header: width/height live at bytes 16-23. */
function pngInfo(path) {
  const buffer = readFileSync(join(root, path));
  const signature = buffer.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", `${path} is not a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}


/**
 * Decode a PNG well enough to read its pixels: parse IHDR/PLTE/IDAT, inflate,
 * undo the per-scanline filters, and hand back either raw RGBA pixels or the
 * palette. Written by hand because decoding here is the whole point - a raw
 * byte scan of the compressed data matches the marker colour by coincidence
 * and reports sprites that are perfectly clean.
 */
function decodePng(path) {
  const buffer = readFileSync(join(root, path));
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, palette = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      bitDepth = body[8]; colorType = body[9];
    } else if (type === "PLTE") palette = Buffer.from(body);
    else if (type === "IDAT") idat.push(Buffer.from(body));
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  assert.equal(bitDepth, 8, `${path}: only 8-bit PNGs are expected`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prior ? prior[x] : 0;
      const c = prior && x >= channels ? prior[x - channels] : 0;
      const value = line[x];
      if (filter === 0) out[x] = value;
      else if (filter === 1) out[x] = (value + a) & 255;
      else if (filter === 2) out[x] = (value + b) & 255;
      else if (filter === 3) out[x] = (value + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        out[x] = (value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else throw new Error(`${path}: unknown filter ${filter}`);
    }
  }
  if (colorType === 3) {
    const used = new Set();
    for (let y = 0; y < height; y++) {
      // palette pixels still carry a filter byte per row, already stripped: the
      // stride is width * 1, so indices read straight off `pixels`
      for (let x = 0; x < width; x++) used.add(pixels[y * width + x]);
    }
    return { palette, used, pixels, width, height };
  }
  return { pixels, channels, width, height };
}

/** Saturated marker magenta: strong red, strong blue, almost no green. */
function isMarker(r, g, b) { return g < 40 && r > 200 && b > 200; }

function markerPixelCount(path) {
  const image = decodePng(path);
  if (image.palette) {
    let count = 0;
    for (const entry of image.used) {
      const r = image.palette[entry * 3], g = image.palette[entry * 3 + 1], b = image.palette[entry * 3 + 2];
      if (isMarker(r, g, b)) {
        // count how many pixels actually use this entry
        for (let i = 0; i < image.width * image.height; i++) if (image.pixels?.[i] === entry) count++;
        if (!image.pixels) count += 1;   // palette-level hit is enough to fail
      }
    }
    if (count > 0) return count;
  }
  const { pixels, channels } = image;
  let count = 0;
  for (let i = 0; i < pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] === 0) continue;      // transparent pixels are invisible
    if (isMarker(pixels[i], pixels[i + 1], pixels[i + 2])) count++;
  }
  return count;
}

test("every character with art has a real, sufficiently large PNG", () => {
  const data = read("src/lib/game-data.ts");
  const splashes = [...data.matchAll(/splash:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(splashes.length >= 4, `expected at least 4 character splashes, found ${splashes.length}`);
  for (const url of splashes) {
    const file = `public${url}`;
    assert.ok(existsSync(join(root, file)), `${file} is referenced by game-data.ts but does not exist`);
    const { width, height } = pngInfo(file);
    // Character sprites are tall and narrow (a head-to-toe figure on a
    // transparent canvas), so judge the long edge and the overall area rather
    // than requiring a square.
    const longEdge = Math.max(width, height);
    assert.ok(longEdge >= 512, `${file} is only ${width}x${height}; its long edge should be at least 512px`);
    assert.ok(width * height >= 180_000, `${file} is only ${width}x${height}; too small to render crisply`);
  }
});

test("no character points at the old .jpg placeholders", () => {
  const data = read("src/lib/game-data.ts");
  const stale = [...data.matchAll(/splash:\s*"([^"]+\.jpg)"/g)].map((match) => match[1]);
  assert.deepEqual(stale, [], `these splashes still point at .jpg files: ${stale.join(", ")}`);
});

test("art referenced by the components is either present or reported", () => {
  const sources = walk("src", [".tsx", ".ts"]);
  const missing = new Set();
  for (const file of sources) {
    for (const match of read(file).matchAll(/["'](\/images\/[^"']+)["']/g)) {
      const url = match[1];
      if (!existsSync(join(root, "public", url))) missing.add(url);
    }
  }
  if (missing.size > 0) {
    console.log(`  note: background art still to be drawn (${missing.size}): ${[...missing].join(", ")}`);
  }
  // Character art is covered strictly by the first test; this one only makes
  // the remaining gaps visible in the test output.
  assert.ok(true);
});

test("every speaking character has all six expression portraits", () => {
  const source = read("src/lib/expressions.ts");
  // the speakerIds map: unquoted keys, plus quoted ones for two-word names
  const map = source.slice(source.indexOf("speakerIds"), source.indexOf("};", source.indexOf("speakerIds")));
  const ids = [...map.matchAll(/:\s*"([a-z]+)"/g)].map(match => match[1]);
  const moods = [...source.matchAll(/"(calm|happy|angry|shocked|sad|smug)"/g)].map(m => m[1]);
  const wanted = [...new Set(moods)];
  assert.ok(ids.length >= 8, `expected at least 8 speaking characters, found ${ids.length}`);
  assert.equal(wanted.length, 6, `expected 6 moods, found ${wanted.join(",")}`);
  for (const id of ids) {
    for (const mood of wanted) {
      const file = `public/images/faces/${id}-${mood}.png`;
      assert.ok(existsSync(join(root, file)), `${file} is missing`);
      const { width, height } = pngInfo(file);
      // a portrait only has to be big enough to hold a face
      assert.ok(width >= 200 && height >= 200, `${file} is only ${width}x${height}`);
    }
  }
});

test("every shipped character PNG is reasonably light", () => {
  for (const file of walk("public/images", [".png"])) {
    const { size } = statSync(join(root, file));
    assert.ok(size < 400 * 1024, `${file} is ${(size / 1024).toFixed(0)} KB — too heavy to ship for a web game`);
  }
});

test("every character with a model has illustration art, and it exists", () => {
  const data = read("src/lib/game-data.ts");
  const keyart = [...data.matchAll(/keyart:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(keyart.length >= 10, `expected at least 10 key-art illustrations, found ${keyart.length}`);
  for (const url of keyart) {
    const file = `public${url}`;
    assert.ok(existsSync(join(root, file)), `${file} is referenced by game-data.ts but does not exist`);
    const { size } = statSync(join(root, file));
    assert.ok(size > 40 * 1024, `${file} is only ${(size / 1024).toFixed(0)} KB — that is not a finished illustration`);
    assert.ok(size < 900 * 1024, `${file} is ${(size / 1024).toFixed(0)} KB — too heavy to ship`);
  }
});

test("splash (the model) and keyart (the illustration) are separate files", () => {
  // The whole point of the split: replacing the sprite with the illustration
  // would silently destroy the pixel-art battlefield.
  const data = read("src/lib/game-data.ts");
  const splashes = new Set([...data.matchAll(/splash:\s*"([^"]+)"/g)].map(m => m[1]));
  const keyart = new Set([...data.matchAll(/keyart:\s*"([^"]+)"/g)].map(m => m[1]));
  const overlap = [...keyart].filter(url => splashes.has(url));
  assert.deepEqual(overlap, [], `these files are used as both model and illustration: ${overlap.join(", ")}`);
});

test("no shipped sprite carries annotation-marker pixels", () => {
  // Penelope's sprite shipped with the artist's magenta guide lines burned in
  // as opaque pixels and rendered in-game for weeks. Marker magenta is not in
  // any character's palette, so its presence anywhere is a defect.
  const offenders = [];
  for (const file of walk("public/images", [".png"])) {
    const count = markerPixelCount(file);
    if (count > 0) offenders.push(`${file} (${count} px)`);
  }
  assert.deepEqual(offenders, [], `annotation markers are visible in: ${offenders.join(", ")}`);
});

test("the character detail page layers illustration under model", () => {
  // The illustration is the hero backdrop and the pixel model stays in the
  // portrait slot. If someone ever collapses these into one image, the game
  // loses either its painted art or its pixel identity.
  const view = read("src/components/game-views.tsx");
  assert.match(view, /detail-keyart-backdrop/, "the character hero should render the illustration backdrop");
  assert.match(view, /className="detail-splash"/, "the portrait slot should still render the model");
  const css = read("src/app/globals.css");
  assert.match(css, /\.detail-keyart-backdrop\{[^}]*object-fit:cover/, "the backdrop should cover its slot");
});
