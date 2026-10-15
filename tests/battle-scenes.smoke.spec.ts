import { test, expect } from "@playwright/test";
import { initialState } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
import { stages } from "../src/lib/campaign";
import { sceneForStage } from "../src/lib/battle-scenes";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const [width, height] of [[1366, 680], [390, 844], [844, 390]]) {
  test(`grounded teams and story-location art at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    let stageId = "1-1";
    const seed = initialState();
    seed.squad = ["ynna", "ninette", "edgelord", "solari"];
    seed.roster = seed.squad.map(id => ({ id, level: 40, potential: 0, duplicates: 0 }));
    seed.cleared = stages.map(s => s.id);
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => route.fulfill({ json: route.request().url().includes("/api/game") ? {
      player: { id: "scene-test", name: "President", guest: true, email: null },
      state: applyGameAction(seed, { action: "startBattle", id: stageId }, () => .8).state,
    } : { googleEnabled: false } }));
    for (const id of ["1-1", "1-5", "2-2", "3-4", "5-5"]) {
      stageId = id;
      await page.goto(`${base}/?signedIn=1`);
      const scene = sceneForStage(stages.find(s => s.id === id)!);
      const arena = page.locator(".battle-arena");
      await expect(arena).toHaveAttribute("data-scene", scene.id);
      await expect(arena.locator(":scope>img")).toHaveAttribute("src", scene.src);
      await expect.poll(() => arena.locator(":scope>img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(1000);
      const bounds = (await arena.boundingBox())!;
      for (const vitals of await page.locator(".model-vitals, .enemy-unit .combat-unit-label").all()) {
        const rect = (await vitals.boundingBox())!;
        expect(rect.y).toBeGreaterThanOrEqual(bounds.y);
        expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      }
      for (const ground of await page.locator(".unit-ground").all()) {
        await expect(ground).toHaveCSS("border-top-width", "0px");
        await expect(ground).toHaveCSS("box-shadow", "none");
      }
      await expect(page.locator(".sprite-footing").first()).toBeVisible();
      await expect(page.locator(".sprite-stage.pose-enter")).toHaveCount(0);
      await page.screenshot({ path: `.cache/scene-${id}-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  });
}
