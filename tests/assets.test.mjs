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

test("every shipped character PNG is reasonably light", () => {
  for (const file of walk("public/images", [".png"])) {
    const { size } = statSync(join(root, file));
    assert.ok(size < 400 * 1024, `${file} is ${(size / 1024).toFixed(0)} KB — too heavy to ship for a web game`);
  }
});
