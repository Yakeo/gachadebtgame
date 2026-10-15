import { test, expect } from "@playwright/test";
import { initialState } from "../src/lib/game-data";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

// Mock only persistence, not the app or layout. These checks need no database.
for (const [width, height] of [[1024, 600], [1366, 768], [1920, 1080], [3840, 2160], [1920, 720], [390, 844], [844, 390]]) {
  test(`game frame fits ${width}×${height} without document overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      const url = route.request().url();
      await route.fulfill({ json: url.includes("/api/game") ? {
        player: { id: "layout-test", name: "President", guest: true, email: null }, state: initialState(),
      } : url.includes("/api/auth") ? { googleEnabled: false } : { ok: true } });
    });
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".game-shell")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => page.locator(".game-shell").evaluate(e => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1;
    })).toBe(true);
    const documentSize = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    expect(documentSize.width).toBe(width);
    expect(documentSize.height).toBe(height);
    if (width > 900 || height >= 780) {
      expect(await page.locator(".game-main").evaluate(e => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
      const bottom = await page.locator(".game-main").evaluate(e => e.getBoundingClientRect().bottom);
      for (const button of await page.locator(".home-menu button").all()) {
        const rect = await button.boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width + 1);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(bottom + 1);
      }
    } else {
      // Short landscape phones deliberately scroll inside the app, not the page.
      await page.locator(".daily-strip").scrollIntoViewIfNeeded();
      await expect(page.locator(".daily-strip")).toBeInViewport();
    }
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.locator(".modal")).toBeInViewport();
    const modal = await page.locator(".modal").boundingBox();
    expect(modal!.y).toBeGreaterThanOrEqual(-1);
    expect(modal!.y + modal!.height).toBeLessThanOrEqual(height + 1);
  });
}
