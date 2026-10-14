#!/usr/bin/env node
/**
 * Prove the deployed portraits are byte-for-byte the ones we built.
 *
 * The trap this closes: "the deploy succeeded" is not the same as "the fixed
 * image is being served". Portraits live in `public/`, so they are cached
 * against a URL that does not change when the art does. A green deploy can
 * therefore hand a visitor a months-old copy of a portrait we already
 * corrected, and nothing in the pipeline would notice.
 *
 * So: hash every local portrait, fetch it from the live deployment through its
 * content-hashed URL, and compare the bytes. Any mismatch - or any portrait the
 * versioned URL fails to serve - is a failure.
 *
 * Usage: node scripts/verify-deployed-art.mjs <base-url> [name-filter]
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { facesDir, hashFile } from "./gen-portrait-manifest.mjs";

const baseUrl = (process.argv[2] || process.env.VERIFY_BASE_URL || "").replace(/\/+$/, "");
const filter = process.argv[3] || "";

if (!baseUrl) {
  console.error("usage: node scripts/verify-deployed-art.mjs <base-url> [name-filter]");
  process.exit(2);
}

const names = readdirSync(facesDir)
  .filter((name) => name.endsWith(".png") && name.includes(filter))
  .sort();

if (names.length === 0) {
  console.error(`no portraits matched ${JSON.stringify(filter)}`);
  process.exit(2);
}

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const failures = [];

console.log(`verifying ${names.length} portrait(s) against ${baseUrl}`);

for (const name of names) {
  const local = readFileSync(join(facesDir, name));
  const version = hashFile(join(facesDir, name));
  const url = `${baseUrl}/images/faces/${name}?v=${version}`;
  let response;
  try {
    response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  } catch (error) {
    failures.push(`${name}: request failed (${error.message})`);
    console.log(`  FAIL ${name} - could not fetch`);
    continue;
  }
  if (!response.ok) {
    failures.push(`${name}: HTTP ${response.status}`);
    console.log(`  FAIL ${name} - HTTP ${response.status}`);
    continue;
  }
  const served = Buffer.from(await response.arrayBuffer());
  if (served.length !== local.length) {
    failures.push(`${name}: ${served.length} bytes served, ${local.length} expected`);
    console.log(`  FAIL ${name} - size ${served.length} != ${local.length}`);
    continue;
  }
  if (sha(served) !== sha(local)) {
    failures.push(`${name}: served bytes differ from the built file`);
    console.log(`  FAIL ${name} - contents differ`);
    continue;
  }
  console.log(`  ok   ${name} (${local.length} bytes, v=${version})`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} portrait(s) do not match the build:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\nall ${names.length} deployed portrait(s) match the build`);
