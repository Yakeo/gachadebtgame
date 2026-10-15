import { test, expect } from "@playwright/test";
import { initialState, characterById, type GameState } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const recruits = ["angelina", "byte", "shroom", "bluecap", "reroom", "cat", "sentry"];
async function mock(page: import("@playwright/test").Page, seed: GameState) {
  let state = seed;
  await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
  await page.route("**/api/**", async route => {
    if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
    const input = route.request().postDataJSON();
    let details = {};
    if (input && input.action !== "init") {
      const result = applyGameAction(state, input, () => .5); state = result.state; details = result;
    }
    await route.fulfill({ json: { ...details, player: { id: "completion", name: "President", guest: true, email: null }, state } });
  });
  await page.goto(`${base}/?signedIn=1`);
}
for (const width of [1440, 390]) {
  test(`all formerly incomplete recruits load both layers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const seed = initialState();
    seed.roster.push(...recruits.map(id => ({ id, level: 10, potential: 0, duplicates: 0 })));
    await mock(page, seed); await page.locator(".characters-tile").click();
    for (const id of recruits) {
      const c = characterById(id);
      await page.locator(".character-card").filter({ hasText: c.name }).click();
      await expect(page.locator(".detail-splash")).toHaveAttribute("src", c.splash!);
      await expect(page.locator(".detail-keyart-backdrop")).toHaveAttribute("src", c.keyart!);
      await expect.poll(() => page.locator(".detail-splash").evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
      await expect.poll(() => page.locator(".detail-keyart-backdrop").evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(500);
    }
    await page.locator(".character-card").filter({ hasText: "Angelina" }).click();
    await page.screenshot({ path: `.cache/angelina-roster-${width}.png` });
  });
  test(`supplied mushrooms and completed recruit models render in combat at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const seed = initialState(); seed.squad = ["angelina", "byte", "cat", "sentry"];
    seed.roster = seed.squad.map(id => ({ id, level: 10, potential: 0, duplicates: 0 }));
    seed.cleared = ["1-1", "1-2", "1-3", "1-4", "1-5"];
    const battle = applyGameAction(seed, { action: "startBattle", id: "2-1" }, () => .5).state;
    for (const [i, id] of ["shroom", "bluecap", "reroom"].entries()) battle.battle!.enemies[i].sprite = id;
    await mock(page, battle);
    for (const image of await page.locator(".combat-unit .sprite-art").all()) {
      await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
    }
    await expect(page.locator(".enemy-unit .sprite-art").nth(1)).toHaveAttribute("src", "/images/splash-bluecap.png");
    await page.screenshot({ path: `.cache/completed-battle-${width}.png` });
    await page.getByRole("button", { name: /1 Attack/ }).click();
    await page.getByRole("button", { name: "Activate attack" }).click();
    await expect(page.locator(".activate-command")).toBeEnabled({ timeout: 15000 });
  });
}
test("extra supplied mushroom variants and terminal are real images, not SVG fallbacks", async ({ page }) => {
  const seed = initialState();
  seed.cleared = ["1-1", "1-2", "1-3", "1-4", "1-5"];
  seed.roster.forEach(c => { c.level = 10; });
  const battle = applyGameAction(seed, { action: "startBattle", id: "2-1" }, () => .5).state;
  for (const [i, id] of ["yeroom", "boomshroom", "hitmonshroom"].entries()) battle.battle!.enemies[i].sprite = id;
  await mock(page, battle);
  for (const image of await page.locator(".enemy-unit .sprite-art").all()) {
    await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
    await expect(image).toHaveAttribute("src", /upload-/);
  }
  await expect(page.locator(".enemy-unit svg.chibi")).toHaveCount(0);
  battle.battle!.enemies[0].sprite = "terminal";
  await page.goto(`${base}/?signedIn=1`);
  await expect(page.locator(".enemy-unit .sprite-art").first()).toHaveAttribute("src", "/images/enemies/terminal.png");
  await expect.poll(() => page.locator(".enemy-unit .sprite-art").first().evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
});
