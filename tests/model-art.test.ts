import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { modelHashes } from "../src/lib/model-manifest";
import { modelUrl } from "../src/lib/model-art";
import { characterById } from "../src/lib/game-data";

test("the battle-model manifest matches every shipped splash PNG", () => {
  const fresh = Object.fromEntries(readdirSync("public/images").filter(name => /^splash-.+\.png$/.test(name)).sort().map(name => [
    `/images/${name}`, createHash("sha256").update(readFileSync(`public/images/${name}`)).digest("hex").slice(0, 8),
  ]));
  assert.deepEqual(modelHashes, fresh, "run node scripts/gen-model-manifest.mjs after replacing a model");
});

test("both cameo models use versioned redraw URLs, separate from their illustration art", () => {
  const manifest = JSON.parse(readFileSync("art-source/cameo/manifest.json", "utf8"));
  for (const id of ["chen", "hokusai"]) {
    const c = characterById(id);
    const record = manifest.records.find((r: { id: string }) => r.id === id);
    assert.equal(c.splash, record.model);
    assert.equal(c.keyart, record.keyart);
    assert.match(modelUrl(c.splash!), new RegExp(`\\?v=${record.modelSha256.slice(0, 8)}$`));
    assert.notEqual(modelUrl(c.splash!), c.splash, "the old unversioned cutout URL must not be reused");
    assert.equal(modelUrl(c.keyart!), c.keyart, "leave the illustration untouched");
  }
});

test("unknown assets and already-versioned paths remain unchanged", () => {
  for (const path of ["/images/enemies/bluloom.png", "/images/not-a-model.png", modelUrl("/images/splash-chen.png")]) {
    assert.equal(modelUrl(path), path);
  }
});

test("the shared model renderer and build use content hashes", () => {
  const ui = readFileSync("src/components/ui.tsx", "utf8");
  assert.match(ui, /src=\{modelUrl\(art\)\}/);
  const config = readFileSync("next.config.ts", "utf8");
  assert.ok(config.includes("gen-model-manifest.mjs"));
});
