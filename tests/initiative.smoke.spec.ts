import { test, expect } from "@playwright/test";
import { initialState } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
for (const width of [1440, 390]) {
  test(`mixed initiative and enemy opening are visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const seed = initialState();
    seed.squad = ["brass", "mira"];
    seed.roster = seed.squad.map(id => ({ id, level: 1, potential: 0, duplicates: 0 }));
    let state = applyGameAction(seed, { action: "startBattle", id: "1-1" }, () => .5).state;
    const first = state.battle!.allies[state.battle!.active].name;
    expect(state.battle!.enemyActions!.length).toBeGreaterThan(0);
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action === "act") state = applyGameAction(state, input, () => .5).state;
      await route.fulfill({ json: { player: { id: "initiative", name: "President", guest: true, email: null }, state } });
    });
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.getByRole("region", { name: "Round initiative order" })).toBeVisible();
    await expect(page.locator(".initiative-strip li.current")).toContainText(first);
    expect(await page.locator(".initiative-strip li.enemy.spent").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: /3.*Guard/ }).click();
    await page.getByRole("button", { name: "Activate guard" }).click();
    await expect(page.locator(".activate-command")).toBeDisabled();
    await expect(page.locator(".activate-command")).toBeEnabled({ timeout: 10000 });
    await expect(page.locator(".initiative-strip li.current")).not.toContainText(first);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width > 900) {
      expect(await page.locator(".game-main").evaluate(e => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: `.cache/initiative-${width}.png` });
  });
}

test("character details expose class, HP, attack, defense and speed", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
  await page.route("**/api/**", async route => route.fulfill({ json: route.request().url().includes("/api/game") ? {
    player: { id: "statblock", name: "President", guest: true, email: null }, state: initialState(),
  } : { googleEnabled: false } }));
  await page.goto(`${base}/?signedIn=1`);
  await page.locator(".characters-tile").click();
  await expect(page.locator(".character-stat-grid > div")).toHaveCount(4);
  await expect(page.locator(".character-stat-grid")).toContainText("SPD");
  await expect(page.locator(".character-hero-info")).toContainText("Ranger");
  await expect(page.locator(".initiative-help")).toContainText("enemies can go first");
});
