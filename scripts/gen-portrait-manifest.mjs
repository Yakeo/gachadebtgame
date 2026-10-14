#!/usr/bin/env node
/**
 * Generate a content manifest for the portrait PNGs.
 *
 * Why this exists: portraits live in `public/`, so their URL does not change
 * when their bytes do. The app serves them with `Cache-Control: public` plus an
 * ETag, which means a browser (or an edge cache) can keep showing a copy of a
 * portrait that was corrected several deploys ago. That is how a fixed image
 * can be "deployed" and still look broken on screen.
 *
 * Hashing each file and appending the digest as a query string makes the URL
 * change whenever the art changes, so a corrected portrait simply cannot be
 * served from a stale cache: the new bytes have a new URL.
 *
 * The output is a committed TypeScript module, and every build refreshes it
 * (see next.config.ts). `npm run art:manifest` regenerates it by hand.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const facesDir = join(root, "public", "images", "faces");
export const manifestPath = join(root, "src", "lib", "portrait-manifest.ts");

/** First 8 hex characters of the file's sha256 - enough to change on any edit. */
export function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
}

/**
 * Map of `<id>-<mood>` to content hash, e.g. `{ "alvida-calm": "855137aa" }`.
 * The key matches the basename portraitUrl() builds, less the extension.
 */
export function portraitManifest() {
  const files = readdirSync(facesDir).filter((name) => name.endsWith(".png"));
  const entries = files.map((name) => [name.slice(0, -4), hashFile(join(facesDir, name))]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

export function renderManifest(manifest) {
  const lines = Object.entries(manifest).map(([key, hash]) => `  ${JSON.stringify(key)}: ${JSON.stringify(hash)},`);
  return `// GENERATED FILE - do not edit by hand.
// Written by scripts/gen-portrait-manifest.mjs; refreshed on every build.
//
// Each portrait's content hash, appended to its URL as ?v=<hash>. Without this
// a corrected portrait is served from a cache that still holds the old bytes.

export const portraitHashes: Record<string, string> = {
${lines.join("\n")}
};
`;
}

/** Write the manifest if it changed. Returns true when a write happened. */
export function writeManifest() {
  const manifest = portraitManifest();
  const next = renderManifest(manifest);
  let current = null;
  try {
    current = readFileSync(manifestPath, "utf8");
  } catch {
    // First run: nothing to compare against.
  }
  if (current !== next) writeFileSync(manifestPath, next);
  return { changed: current !== next, count: Object.keys(manifest).length, manifest };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { changed, count } = writeManifest();
  console.log(`portrait manifest ${changed ? "written" : "already current"} (${count} portraits)`);
}
