import { test, expect } from "@playwright/test";
import { initialState } from "../src/lib/game-data";
import { stages } from "../src/lib/campaign";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
for (const [width, height] of [[1366, 680], [1920, 1080], [390, 844], [844, 390]]) {
  test(`battlefield fills 80% and all vital bars fit at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const seed = initialState();
    seed.squad = ["ynna", "ninette", "edgelord", "solari"];
    seed.roster = seed.squad.map(id => ({ id, level: 40, potential: 0, duplicates: 0 }));
    seed.cleared = stages.map(stage => stage.id);
    let state = applyGameAction(seed, { action: "startBattle", id: "5-4" }, () => .8).state;
    let retreats = 0, actions = 0;
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action === "retreat") { retreats++; state = applyGameAction(state, input, () => .8).state; }
      if (input?.action === "act") { actions++; state = applyGameAction(state, input, () => .8).state; }
      await route.fulfill({ json: { player: { id: "combat-layout", name: "President", guest: true, email: null }, state } });
    });
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".combat-overlay-toolbar")).toBeVisible();
    await expect(page.locator(".topbar")).toBeHidden();
    await expect(page.locator(".bottom-bar")).toBeHidden();
    const arena = await page.locator(".battle-arena").boundingBox();
    expect(arena!.height / height).toBeGreaterThanOrEqual(.8);
    for (const vitals of await page.locator(".model-vitals, .enemy-unit .combat-unit-label").all()) {
      await expect(vitals).toBeVisible();
      const r = await vitals.boundingBox();
      expect(r!.y).toBeGreaterThanOrEqual(arena!.y);
      expect(r!.y + r!.height).toBeLessThanOrEqual(arena!.y + arena!.height + 1);
    }
    await expect(page.locator(".command-detail")).toBeHidden();
    await page.screenshot({ path: `.cache/battlefield-${width}.png` });
    await page.getByRole("button", { name: /2 Skill/ }).click();
    await expect(page.locator(".command-detail")).toBeVisible();
    expect(actions).toBe(0);
    await page.getByRole("button", { name: "Close skill description" }).click();
    await page.getByRole("button", { name: "Pause battle" }).click();
    await expect(page.getByRole("heading", { name: "Battle paused" })).toBeVisible();
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Leave this operation?" })).toBeVisible();
    expect(retreats).toBe(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Battle paused" })).toBeVisible();
    await page.getByRole("button", { name: "Resume battle" }).click();
    await expect(page.locator(".modal")).toHaveCount(0);
    await page.getByRole("button", { name: "Pause battle" }).click();
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page.getByRole("button", { name: "Leave battle", exact: true }).click();
    await expect(page.locator(".home-menu")).toBeVisible();
    await expect(page.locator(".topbar")).toBeVisible();
    expect(retreats).toBe(1);
    expect(actions).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
