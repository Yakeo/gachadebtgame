import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { initialState, characterById } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
import { modelUrl } from "../src/lib/model-art";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1366, 390]) {
  test(`cameos use the redrawn, versioned battle sprites at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    const seed = initialState();
    seed.roster = ["chen", "hokusai", "altria", "morrow"].map(id => ({ id, level: 10, potential: 0, duplicates: 0 }));
    seed.squad = seed.roster.map(c => c.id);
    const state = applyGameAction(seed, { action: "startBattle", id: "1-1" }, () => .8).state;
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/api/game")
      ? { state, player: { id: "cameo-models", name: "President", guest: true, email: null } }
      : { googleEnabled: false, maintenance: false } }));
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".ally-unit")).toHaveCount(4);
    await expect(page.locator(".pose-enter")).toHaveCount(0);
    for (const id of seed.squad) {
      const art = page.locator(`.ally-unit[data-unit="${id}"] .sprite-art`);
      const src = modelUrl(characterById(id).splash!);
      await expect(art).toHaveAttribute("src", src);
      await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(861);
      await expect(art).toBeVisible();
      await expect(art).toHaveCSS("object-fit", "contain");
      const box = (await art.boundingBox())!;
      expect(box.width).toBeGreaterThan(60);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await expect(page.locator(`.ally-unit[data-unit="${id}"] .model-vitals`)).toBeVisible();
      if (id === "chen" || id === "hokusai") {
        const served = await page.request.get(`${base}${src}`);
        expect(served.ok()).toBeTruthy();
        const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
        expect(hash(await served.body())).toBe(hash(readFileSync(`public${characterById(id).splash}`)));
      }
    }
    await page.screenshot({ path: `.cache/cameo-models-${width}.png`, fullPage: true });
  });
}
