#!/usr/bin/env node
// A successful deployment must serve the redrawn sprites, not cached cutouts.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!base) { console.error("usage: node scripts/verify-cameo-models.mjs <base-url>"); process.exit(2); }
const manifest = JSON.parse(readFileSync(join(root, "art-source/cameo/manifest.json"), "utf8"));
const models = manifest.records.map(record => {
  const bytes = readFileSync(join(root, "public", record.model));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== record.modelSha256) throw new Error(`${record.id}: sprite does not match the redraw manifest`);
  return { id: record.id, url: `${base}${record.model}?v=${hash.slice(0, 8)}`, bytes };
});
const attempts = Number(process.env.VERIFY_ATTEMPTS || 24);
const delay = Number(process.env.VERIFY_DELAY_MS || 10000);
for (let attempt = 1; attempt <= attempts; attempt++) {
  const results = await Promise.all(models.map(async model => {
    try {
      const response = await fetch(model.url, { headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const served = Buffer.from(await response.arrayBuffer());
      if (!served.equals(model.bytes)) throw new Error("served bytes differ from the redrawn sprite");
      console.log(`OK ${model.id}: ${served.length} bytes at ${model.url}`);
      return true;
    } catch (error) {
      console.error(`Attempt ${attempt}/${attempts}: ${model.id}: ${error.message}`);
      return false;
    }
  }));
  if (results.every(Boolean)) { console.log("All deployed cameo battle models match the redraws."); process.exit(0); }
  if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delay));
}
console.error("::error title=Cameo model mismatch::The deployed sprites do not match the redrawn battle models.");
process.exit(1);
