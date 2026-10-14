#!/usr/bin/env node
/**
 * Prove the deployed portraits are byte-for-byte the ones we built.
 *
 * The trap this closes: "the deploy succeeded" is not the same as "the fixed
 * image is being served". Portraits live in `public`, so they are cached
 * against a URL that does not change when the art does. A green deploy can
 * hand a visitor a months-old copy of a portrait we already corrected, and
 * nothing in the pipeline would notice.
 *
 * So: hash every local portrait, fetch it from the live deployment through its
 * content-hashed URL, and compare the bytes.
 *
 * Two things keep this from crying wolf:
 *
 *   - It retries. `vercel deploy --prod` returns once the deployment exists,
 *     but the production domain takes a moment to point at it. A mismatch in
 *     the first seconds is usually the previous deployment still answering,
 *     not a bad build.
 *   - It says why. Every failure prints sizes, hashes and the CDN's own cache
 *     headers, and raises a GitHub annotation, so a red run is diagnosable
 *     without digging through logs.
 *
 * Usage: node scripts/verify-deployed-art.mjs <base-url> [name-filter]
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { facesDir, hashFile } from "./gen-portrait-manifest.mjs";

const baseUrl = (process.argv[2] || process.env.VERIFY_BASE_URL || "").replace(/\/+$/, "");
const filter = process.argv[3] || "";
const attempts = Number(process.env.VERIFY_ATTEMPTS || 24);
const delayMs = Number(process.env.VERIFY_DELAY_MS || 10_000);

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
const annotate = (message) => console.log(`::error title=Deployed art mismatch::${message}`);

const local = new Map();
for (const name of names) {
  const bytes = readFileSync(join(facesDir, name));
  local.set(name, { bytes, digest: sha(bytes), version: hashFile(join(facesDir, name)) });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch one portrait and describe precisely how it differs, if it does. */
async function check(name) {
  const { bytes, digest, version } = local.get(name);
  const url = `${baseUrl}/images/faces/${name}?v=${version}`;
  let response;
  try {
    response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  } catch (error) {
    return { name, ok: false, detail: `request failed: ${error.message}` };
  }
  const headers = ["x-vercel-cache", "age", "etag", "cache-control", "content-length"]
    .map((key) => [key, response.headers.get(key)])
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  if (!response.ok) return { name, ok: false, detail: `HTTP ${response.status}`, headers };

  const served = Buffer.from(await response.arrayBuffer());
  if (served.equals(bytes)) return { name, ok: true, detail: `${bytes.length} bytes, v=${version}`, headers };

  const servedDigest = sha(served);
  return {
    name,
    ok: false,
    detail:
      `built ${bytes.length} bytes sha256:${digest.slice(0, 12)} v=${version}, ` +
      `served ${served.length} bytes sha256:${servedDigest.slice(0, 12)}` +
      (servedDigest.slice(0, 8) === version ? "" : " - the served bytes hash to the OLD version"),
    headers,
  };
}

console.log(`verifying ${names.length} portrait(s) against ${baseUrl} (up to ${attempts} attempts)`);

let failures = [];
for (let attempt = 1; attempt <= attempts; attempt++) {
  const results = [];
  for (const name of names) results.push(await check(name));
  failures = results.filter((result) => !result.ok);

  const cached = [...new Set(results.map((r) => r.headers).filter(Boolean))];
  console.log(`attempt ${attempt}/${attempts}: ${names.length - failures.length}/${names.length} match`);
  if (cached.length) for (const header of cached.slice(0, 3)) console.log(`  headers: ${header}`);

  if (failures.length === 0) {
    for (const result of results) console.log(`  ok   ${result.name} (${result.detail})`);
    console.log(`\nall ${names.length} deployed portrait(s) match the build`);
    process.exit(0);
  }

  for (const failure of failures.slice(0, 4)) {
    console.log(`  FAIL ${failure.name} - ${failure.detail}`);
    if (failure.headers) console.log(`       ${failure.headers}`);
  }
  // A brand-new URL for a corrected portrait cannot be a cache hit, so a
  // mismatch means the domain is still answering with the previous
  // deployment. Give the alias time to move.
  if (attempt < attempts) await sleep(delayMs);
}

console.error(`\n${failures.length} portrait(s) still do not match after ${attempts} attempts:`);
for (const failure of failures) {
  console.error(`  - ${failure.name}: ${failure.detail}`);
  if (failure.headers) console.error(`    ${failure.headers}`);
}
annotate(failures.map((failure) => `${failure.name}: ${failure.detail}`).join(" | ").slice(0, 900));
process.exit(1);
