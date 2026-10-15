import { test, expect } from "@playwright/test";
import { initialState, type GameState } from "../src/lib/game-data";
import { critterDefinitions } from "../src/lib/critter-data";
import { applyGameAction } from "../src/lib/game-engine";
import { stages } from "../src/lib/campaign";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
async function mock(page: import("@playwright/test").Page, seed: GameState) {
  let state = seed;
  await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
  await page.route("**/api/**", async route => {
    if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
    const input = route.request().postDataJSON();
    let details = {};
    if (input && input.action !== "init") {
      let count = 0;
      const result = applyGameAction(state, input, () => input.action === "pull" ? (count++ === 0 ? .1 : .45) : .5);
      state = result.state; details = result;
    }
    await route.fulfill({ json: { ...details, player: { id: "critters", name: "President", guest: true, email: null }, state } });
  });
  await page.goto(`${base}/?signedIn=1`);
}
for (const width of [1440, 390]) {
  test(`all ten critters have real illustrations and models in the roster at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const seed = initialState();
    seed.roster.push(...critterDefinitions.map(c => ({ id: c.id, level: 10, potential: 0, duplicates: 0 })), { id: "pip", level: 22, potential: 2, duplicates: 1 });
    await mock(page, seed);
    await page.locator(".characters-tile").click();
    for (const c of critterDefinitions) {
      await page.locator(".character-card").filter({ hasText: c.name }).click();
      await expect(page.locator(".character-hero-info h2")).toHaveText(c.name);
      await expect(page.locator(".detail-splash")).toHaveAttribute("src", c.splash!);
      await expect(page.locator(".detail-keyart-backdrop")).toHaveAttribute("src", c.keyart!);
      await expect.poll(() => page.locator(".detail-splash").evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
    }
    await page.locator(".character-card").filter({ hasText: "Pip" }).click();
    await expect(page.locator(".character-details")).toContainText("LEGACY RECRUIT");
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await expect(page.locator(".character-card").filter({ hasText: "Brass" })).toHaveCount(0);
    await page.locator(".character-card").filter({ hasText: "Kid Jester" }).click();
    await page.screenshot({ path: `.cache/critter-roster-${width}.png` });
  });
  test(`critter models and mushroom enemies load in battle at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const seed = initialState(); seed.squad = ["kidjester", "mreats", "takobuddy", "mrhide"];
    seed.roster = seed.squad.map(id => ({ id, level: 10, potential: 0, duplicates: 0 }));
    seed.cleared = stages.slice(0, 5).map(s => s.id);
    await mock(page, applyGameAction(seed, { action: "startBattle", id: "2-1" }, () => .5).state);
    await expect(page.locator(".ally-unit .sprite-art")).toHaveCount(4);
    for (const image of await page.locator(".combat-unit .sprite-art").all()) {
      await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
    }
    for (const image of await page.locator(".enemy-unit .sprite-art").all()) await expect(image).toHaveAttribute("src", /critter-/);
    await page.screenshot({ path: `.cache/critter-battle-${width}.png` });
    await page.getByRole("button", { name: /1 Attack/ }).click();
    await expect(page.locator(".command-detail")).toBeVisible();
    await page.getByRole("button", { name: "Activate attack" }).click();
    await expect(page.locator(".activate-command")).toBeEnabled({ timeout: 15000 });
  });
}
test("rates show ten active SRs and actual pulls reveal their models", async ({ page }) => {
  await mock(page, initialState());
  await page.locator(".recruit-tile").click();
  await page.getByRole("button", { name: "Rates & details" }).click();
  await expect(page.locator(".rates-pool-row:has(.rarity-SR) .rates-pool-item")).toHaveCount(10);
  await expect(page.locator(".rates-pool")).toContainText("Tako Buddy");
  await expect(page.locator(".rates-pool")).not.toContainText("Ninette");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".pull-button.single").click();
  await page.getByRole("button", { name: "Skip animation" }).click();
  await expect(page.locator(".pull-result h3")).toHaveText("Tako Buddy");
  await expect(page.locator(".result-art img")).toHaveAttribute("src", "/images/splash-takobuddy.png");
});
