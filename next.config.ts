import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Refresh portrait and battle-model content hashes before every build.
 *
 * This deliberately does not live in an npm `prebuild` script. The deploy runs
 * `vercel build`, which invokes `next build` directly and never fires npm
 * lifecycle hooks - a prebuild step would silently never run in CI, and a
 * corrected portrait would keep shipping behind a stale hash and stay
 * invisible in cache. Loading this config is the one thing every build does.
 *
 * A failure here must not break the build: the committed manifest is still
 * valid, it would just be one revision behind. So warn and carry on.
 */
const root = dirname(fileURLToPath(import.meta.url));
const generators = ["gen-portrait-manifest.mjs", "gen-model-manifest.mjs"];

if (process.env.SKIP_ART_MANIFEST !== "1") {
  for (const name of generators) {
    const generator = join(root, "scripts", name);
    if (!existsSync(generator)) continue;
    try {
      execFileSync(process.execPath, [generator], { cwd: root, stdio: "pipe" });
    } catch (error) {
      console.warn(`[art] could not refresh ${name}; using the committed manifest.`, error);
    }
  }
}

const nextConfig: NextConfig = {};

export default nextConfig;
