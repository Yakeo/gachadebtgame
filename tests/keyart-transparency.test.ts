import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { characterById } from "../src/lib/game-data";

const mattes = JSON.parse(readFileSync(new URL("../art-source/roster/transparency.json", import.meta.url), "utf8")) as { id: string; path: string; transparentPixels: number; width: number; height: number }[];

test("white-backed illustrations now reference real alpha WebP assets", () => {
  assert.ok(mattes.length >= 14);
  for (const art of mattes) {
    assert.equal(characterById(art.id).keyart, art.path);
    const url = new URL(`../public${art.path}`, import.meta.url);
    const bytes = readFileSync(url);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(bytes.toString("ascii", 12, 16), "VP8X");
    assert.ok(bytes[20] & 0x10, `${art.id} has lost its alpha channel`);
    assert.ok(art.transparentPixels > art.width * art.height * .005);
    assert.ok(statSync(url).size < 900 * 1024);
  }
});

test("all art references use the new URLs, avoiding opaque cached JPEGs", () => {
  const data = readFileSync(new URL("../src/lib/game-data.ts", import.meta.url), "utf8");
  for (const { id } of mattes) assert.ok(!data.includes(`/images/keyart-${id}.jpg`));
});
