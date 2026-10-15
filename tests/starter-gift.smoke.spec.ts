import { test, expect } from "@playwright/test";
import { initialState, starterUrPool, STARTER_GEMS } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1440, 390]) {
  test(`free UR preview, confirmation and saved claim at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let state = initialState();
    let claims = 0;
    let failNextClaim = width === 390;
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action) {
        if (input.action === "starterUr" && failNextClaim) {
          failNextClaim = false;
          return route.fulfill({ status: 503, json: { error: "Council server is busy. Try again." } });
        }
        try {
          const result = applyGameAction(state, input, () => .8);
          state = result.state;
          if (input.action === "starterUr") claims++;
          return route.fulfill({ json: { ...result, player: { id: "welcome", name: "President", guest: true, email: null } } });
        } catch (error) { return route.fulfill({ status: 400, json: { error: (error as Error).message } }); }
      }
      return route.fulfill({ json: { state, player: { id: "welcome", name: "President", guest: true, email: null } } });
    });
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".starter-gift-button:visible")).toBeVisible();
    await page.locator(".starter-gift-button:visible").click();
    await expect(page.getByRole("heading", { name: "Choose your free UR" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(starterUrPool().length);
    await expect(page.locator(".starter-ur-confirm")).toBeDisabled();
    const pick = starterUrPool()[1];
    await page.getByRole("radio", { name: new RegExp(pick.name) }).check();
    await expect(page.locator(".starter-ur-preview")).toContainText(pick.weapon);
    await page.getByRole("button", { name: "Close dialog" }).click();
    expect(claims).toBe(0);
    expect(state.starterUrClaimed).toBeNull();
    await page.locator(".starter-gift-button:visible").click();
    await expect(page.locator(".starter-ur-confirm")).toBeDisabled();
    await page.getByRole("radio", { name: new RegExp(pick.name) }).check();
    await page.screenshot({ path: `.cache/starter-ur-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: `Confirm free UR · ${pick.name}` }).click();
    if (width === 390) {
      await expect(page.getByText("Council server is busy. Try again.")).toBeVisible();
      expect(state.starterUrClaimed).toBeNull();
      await expect(page.getByRole("radio", { name: new RegExp(pick.name) })).toBeChecked();
      await page.getByRole("button", { name: `Confirm free UR · ${pick.name}` }).click();
    }
    await expect(page.locator(".starter-ur-success")).toContainText(`${pick.name} is yours`);
    expect(state.gems).toBe(STARTER_GEMS);
    expect(state.totalPulls).toBe(0);
    expect(state.starterUrClaimed).toBe(pick.id);
    expect(claims).toBe(1);
    await page.getByRole("button", { name: "View characters" }).click();
    await expect(page.locator(".starter-ur-modal")).toHaveCount(0);
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".home-menu")).toBeVisible();
    await expect(page.locator(".starter-gift-button")).toHaveCount(0);
    await page.getByRole("button", { name: "Open inbox" }).click();
    await page.getByRole("button", { name: "View claimed UR gift" }).click();
    await expect(page.locator(".starter-ur-success")).toContainText(pick.name);
    expect(claims).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}
