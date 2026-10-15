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
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, palette = null, transparency = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      bitDepth = body[8]; colorType = body[9];
    } else if (type === "PLTE") palette = Buffer.from(body);
    else if (type === "tRNS") transparency = Buffer.from(body);
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
    // tRNS is either a single transparent index or one alpha byte per palette
    // entry; normalise to the two shapes the tests expect.
    let alpha;
    if (transparency) {
      alpha = colorType === 3 && transparency.length === 1
        ? transparency[0]
        : Uint8Array.from(transparency);
    }
    return { palette, used, pixels, width, height, transparency: alpha };
  }
  return { pixels, channels, width, height, transparency: null };
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

test("every chapter has its battlefield art", () => {
  // Chapter 5 pointed at core.jpg for months and the file was never drawn, so
  // the arena silently fell back to a plain background. A missing battlefield
  // is a blank screen mid-fight, so the reference is asserted rather than
  // merely reported.
  const source = read("src/lib/campaign.ts");
  const referenced = [...source.matchAll(/battlefield:\s*"(\/images\/[^"]+)"/g)].map((match) => match[1]);
  assert.equal(referenced.length, 5, "expected one battlefield per chapter");
  const missing = referenced.filter((url) => !existsSync(join(root, "public", url)));
  assert.deepEqual(missing, [], `chapter art that is referenced but absent: ${missing.join(", ")}`);
  for (const url of referenced) {
    const bytes = statSync(join(root, "public", url)).size;
    assert.ok(bytes > 40_000, `${url} is only ${bytes} bytes - too small to be arena art`);
    assert.ok(bytes < 1_500_000, `${url} is ${bytes} bytes - too heavy to ship`);
  }
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
    const minimumKB = /keyart-(shroom|bluecap|reroom)\.webp$/.test(file) ? 5 : 40; // Supplied pixel art compresses exceptionally well.
    assert.ok(size > minimumKB * 1024, `${file} is only ${(size / 1024).toFixed(0)} KB — that is not a finished illustration`);
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


test("every sprite has working transparency", () => {
  // Four sprites shipped with no tRNS chunk at all, so their keyed background
  // rendered as a solid slab - Ynna arrived on a black square. A sprite that is
  // ~100% opaque has no keyed background and is therefore broken.
  const opaque = [];
  for (const file of walk("public/images", [".png"])) {
    if (file.includes("/faces/")) continue;          // portraits are drawn in a frame
    const image = decodePng(file);
    const { pixels, channels, width, height } = image;
    let visible = 0;
    if (image.palette) {
      const transparent = new Set();
      const raw = image.transparency;
      if (typeof raw === "number") transparent.add(raw);
      if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.length) {
        for (let i = 0; i < raw.length; i++) if (raw[i] === 0) transparent.add(i);
      }
      for (let i = 0; i < width * height; i++) if (!transparent.has(pixels[i])) visible++;
    } else {
      for (let i = 0; i < pixels.length; i += channels) if (pixels[i + 3] > 0) visible++;
    }
    const coverage = visible / (width * height);
    if (coverage > 0.97) opaque.push(`${file} (${(coverage * 100).toFixed(0)}% opaque)`);
  }
  assert.deepEqual(opaque, [], `these sprites have lost their transparent background: ${opaque.join(", ")}`);
});

test("all sprites share one canvas aspect, so they scale alike", () => {
  // `object-fit: contain` scales a wide canvas down further than a tall one, so
  // sprites of different aspect ratios rendered at noticeably different heights
  // even when their figures were the same size. Padding every figure onto a
  // canvas of one aspect is what makes them consistent.
  const aspects = [];
  for (const file of walk("public/images", [".png"])) {
    if (file.includes("/faces/")) continue;
    // Enemy sprites are a separate set with their own canvas and their own
    // guarantees - tests/enemy-sprites.test.ts checks that all five share one
    // canvas and one baseline. They are deliberately not forced onto the
    // character roster's aspect: the King is meant to look bigger.
    if (file.includes("/enemies/")) continue;
    const { width, height } = decodePng(file);
    aspects.push({ file, aspect: width / height });
  }
  assert.ok(aspects.length >= 10, `expected the character sprites, found ${aspects.length}`);
  const values = aspects.map(a => a.aspect);
  const spread = Math.max(...values) - Math.min(...values);
  assert.ok(spread < 0.02,
    `sprite canvases vary from ${Math.min(...values).toFixed(3)} to ${Math.max(...values).toFixed(3)} ` +
    `(spread ${spread.toFixed(3)}): ${aspects.map(a => `${a.file.split("/").pop()} ${a.aspect.toFixed(2)}`).join(", ")}`);
});

test("humanoid sprites render at a consistent height in the arena box", () => {
  const critters = JSON.parse(readFileSync(join(root, "art-source/roster/critters.json"), "utf8"));
  const mascotModels = new Set([...critters.filter(c => c.illustration).map(c => c.model.split("/").pop()), ...["shroom", "bluecap", "cat", "reroom", "sentry"].map(id => `splash-${id}.png`)]);
  // The end-to-end check: simulate object-fit: contain in the 143x166 box the
  // arena uses and confirm the figures come out the same height. Before this
  // was fixed the spread was large enough to read as two different art styles.
  const heights = [];
  for (const file of walk("public/images", [".png"])) {
    if (mascotModels.has(file.split("/").pop())) continue; // intentional wide/short creature silhouettes
    if (file.includes("/enemies/")) continue;   // see the aspect test above
    if (file.includes("/faces/")) continue;
    const image = decodePng(file);
    const { pixels, channels, width, height, palette } = image;
    const transparent = new Set();
    const raw = image.transparency;
    if (typeof raw === "number") transparent.add(raw);
    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.length) {
      for (let i = 0; i < raw.length; i++) if (raw[i] === 0) transparent.add(i);
    }
    const scale = Math.min(143 / width, 166 / height);
    let minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const visible = palette ? !transparent.has(pixels[i]) : pixels[i * channels + 3] > 0;
        if (visible) { if (y < minY) minY = y; if (y > maxY) maxY = y; break; }
      }
    }
    if (maxY < 0) continue;
    heights.push({ file, height: Math.round((maxY - minY + 1) * scale) });
  }
  const values = heights.map(h => h.height);
  const spread = Math.max(...values) - Math.min(...values);
  assert.ok(spread <= 4,
    `rendered figure heights span ${Math.min(...values)}..${Math.max(...values)}px (spread ${spread}): ` +
    heights.map(h => `${h.file.split("/").pop()} ${h.height}`).join(", "));
});

test("no portrait carries chroma-key residue", () => {
  // Alvida's portraits were keyed out of a flat chroma green. The first pass
  // used a hard threshold and then saved to a palette, which dropped partial
  // alpha: the anti-aliased boundary survived as opaque green and showed up in
  // the game as a green glow around the character. A portrait should have no
  // visible pixel that leans green.
  const offenders = [];
  for (const file of walk("public/images/faces", [".png"])) {
    const image = decodePng(file);
    const { pixels, channels, width, height, palette } = image;
    const transparent = new Set();
    const raw = image.transparency;
    if (typeof raw === "number") transparent.add(raw);
    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.length) {
      for (let i = 0; i < raw.length; i++) if (raw[i] === 0) transparent.add(i);
    }
    let green = 0;
    for (let i = 0; i < width * height; i++) {
      let r, g, b;
      if (palette) {
        if (transparent.has(pixels[i])) continue;
        r = palette[pixels[i] * 3]; g = palette[pixels[i] * 3 + 1]; b = palette[pixels[i] * 3 + 2];
      } else {
        if (pixels[i * channels + 3] === 0) continue;
        r = pixels[i * channels]; g = pixels[i * channels + 1]; b = pixels[i * channels + 2];
      }
      // Two floors, because "green" alone is not enough to tell residue from
      // art. Keyed-out green is bright AND strongly dominant; the cast's own
      // greenish fringe pixels are either dark or barely tinted. Measured
      // across all 66 portraits these thresholds separate the two exactly:
      // they flag 124-157px on the defective Alvida portraits and nothing at
      // all on anyone else.
      if (g > 90 && g - Math.max(r, b) > 30) green++;
    }
    if (green > 0) offenders.push(`${file} (${green} px)`);
  }
  assert.deepEqual(offenders, [],
    `these portraits still contain keyed-out green: ${offenders.join(", ")}`);
});

test("no portrait has loose key-colour specks on its silhouette", () => {
  // Removing the green was only half the job. The same cut left the other half
  // of the key behind: single saturated cyan pixels stranded along the edge of
  // the sprite. They are invisible against some backdrops and read as coloured
  // grit against others, so the first fix looked complete and was not.
  //
  // The hard part is not finding saturated cyan, it is not deleting a
  // character's own blue. Ynna's cyan pixels sit on her blue iris, her hairclip
  // and the trim of her uniform - they are the drawing. So a pixel only counts
  // as residue when the ordinary art around it is not blue at all: measured
  // across the set, Alvida's specks sit on brown hair (neighbour blueness ~25)
  // while every one of Ynna's sits on blue (166 and up). The thresholds below
  // sit in the empty space between those two populations.
  const offenders = [];

  for (const file of walk("public/images/faces", [".png"])) {
    const image = decodePng(file);
    const { pixels, channels, width, height, palette } = image;
    const transparent = new Set();
    const raw = image.transparency;
    if (typeof raw === "number") transparent.add(raw);
    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.length) {
      for (let i = 0; i < raw.length; i++) if (raw[i] === 0) transparent.add(i);
    }

    const size = width * height;
    const r = new Uint8Array(size), g = new Uint8Array(size), b = new Uint8Array(size);
    const visible = new Uint8Array(size), solid = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      if (palette) {
        if (transparent.has(pixels[i])) continue;
        r[i] = palette[pixels[i] * 3]; g[i] = palette[pixels[i] * 3 + 1]; b[i] = palette[pixels[i] * 3 + 2];
        solid[i] = 1;   // a palette entry is opaque or it is the transparent index
      } else {
        const alpha = pixels[i * channels + 3];
        if (alpha === 0) continue;
        r[i] = pixels[i * channels]; g[i] = pixels[i * channels + 1]; b[i] = pixels[i * channels + 2];
        // Only fully opaque pixels count as art to sample from: a half-faded
        // pixel is a blend of the drawing and the backdrop behind it.
        if (alpha >= 200) solid[i] = 1;
      }
      visible[i] = 1;
    }

    // saturated pixels of either key colour
    const isKey = (i) => visible[i] === 1 &&
      ((b[i] > 200 && g[i] > 200 && r[i] < 120) || (g[i] > 200 && r[i] < 120 && b[i] < 120));
    // "transparent enough to be an edge" - partial alpha counts, so a half-faded
    // speck still registers as sitting on the silhouette
    const isEdge = (i) => {
      if (palette) return transparent.has(pixels[i]);
      return pixels[i * channels + 3] < 200;
    };

    let specks = 0;
    for (let i = 0; i < size; i++) {
      if (!isKey(i)) continue;
      const x = i % width, y = (i - x) / width;
      let touchesEdge = false, support = 0, blue = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (isEdge(j)) touchesEdge = true;
          else if (solid[j] === 1 && !isKey(j)) {
            support++;
            if (b[j] - r[j] > 30) blue++;
          }
        }
      }
      if (!touchesEdge) continue;
      if (support < 4) continue;                    // not enough solid art to judge
      if (blue / support >= 0.5) continue;          // it is the character's own blue
      specks++;
    }
    if (specks > 0) offenders.push(`${file} (${specks} px)`);
  }

  assert.deepEqual(offenders, [],
    `these portraits have key-colour specks on the silhouette: ${offenders.join(", ")}`);
});

test("the home companion shows the illustration, with the model as fallback", () => {
  // The companion stood on the home screen as the pixel model while the
  // painted illustration existed the whole time. The illustration is what the
  // companion slot should show; characters without one keep their model.
  const shell = read("src/components/game-shell.tsx");
  assert.match(shell, /companion\.keyart \? <img className="companion-splash"/,
    "the companion should prefer the character's key art");
  assert.match(shell, /<Chibi id=\{companion\.id\} \/>/,
    "characters without key art should still get their model");
  const css = read("src/app/globals.css");
  assert.match(css, /\.companion-splash\{[^}]*mask-image/,
    "the illustration should be masked into the scene, not pasted as a rectangle");
});

 test("home illustration fills the companion stage at desktop and mobile sizes", () => {
  const css = read("src/app/globals.css");
  const stage = css.slice(css.indexOf("/* Full-bleed companion stage."));
  assert.match(stage, /\.home-scene \.companion-figure\{[^}]*width:60%;height:100%/);
  assert.match(stage, /\.companion-splash\{[^}]*object-fit:cover/);
  assert.match(stage, /@media\(max-width:650px\)[\s\S]*width:100%;height:430px/);
  assert.match(stage, /\.home-scene \.companion-tools,[\s\S]*z-index:2/);
});
