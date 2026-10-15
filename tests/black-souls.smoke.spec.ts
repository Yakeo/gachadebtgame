import { test, expect } from "@playwright/test";
import { initialState, characterById } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
for (const width of [1440, 390]) {
  test(`Black Souls URs have real splash art and functional battle sprites at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    let state = initialState();
    state.roster.push(...["grimm", "redhood"].map(id => ({ id, level: 10, potential: 0, duplicates: 0 })));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      let details = {};
      if (input && input.action !== "init") { const result = applyGameAction(state, input, () => .5); state = result.state; details = result; }
      await route.fulfill({ json: { ...details, player: { id: "black-souls", name: "President", guest: true, email: null }, state } });
    });
    await page.goto(`${base}/?signedIn=1`);
    await page.locator(".characters-tile").click();
    for (const id of ["grimm", "redhood"]) {
      const c = characterById(id);
      await page.locator(".character-card").filter({ hasText: c.name }).click();
      await expect(page.locator(".detail-splash")).toHaveAttribute("src", c.splash!);
      await expect(page.locator(".detail-keyart-backdrop")).toHaveAttribute("src", c.keyart!);
      await expect.poll(() => page.locator(".detail-splash").evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
      await expect.poll(() => page.locator(".detail-keyart-backdrop").evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(500);
      await page.locator(".character-detail-hero").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.cache/${id}-roster-${width}.png` });
    }
    state.squad = ["grimm", "redhood"];
    state = applyGameAction(state, { action: "startBattle", id: "1-1" }, () => .5).state;
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".ally-unit .sprite-art")).toHaveCount(2);
    for (const image of await page.locator(".ally-unit .sprite-art").all()) {
      await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(861);
    }
    await expect(page.locator(".pose-enter")).toHaveCount(0);
    await page.screenshot({ path: `.cache/black-souls-battle-${width}.png` });
    await page.getByRole("button", { name: /1 Attack/ }).click();
    await page.getByRole("button", { name: "Activate attack" }).click();
    await expect(page.locator(".activate-command")).toBeEnabled({ timeout: 15000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
