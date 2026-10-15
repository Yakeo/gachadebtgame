import { test, expect } from "@playwright/test";
import { initialState } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
for (const width of [1440, 390]) {
  test(`vibrant loading art and quick authoritative D20 opening at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const seed = initialState();
    const state = applyGameAction(seed, { action: "startBattle", id: "1-1" }, () => .5).state;
    await page.addInitScript(() => {
      localStorage.setItem("gd-motion", "false");
      const times: number[] = [];
      Object.assign(window, { diceTimes: times });
      new MutationObserver(() => {
        const present = !!document.querySelector(".initiative-roll-intro");
        if (present && times.length === 0 || !present && times.length === 1) times.push(performance.now());
      }).observe(document, { childList: true, subtree: true });
    });
    await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/api/game") ? {
      player: { id: "d20", name: "President", guest: true, email: null }, state,
    } : { googleEnabled: false } }));
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".loading-screen .boot-bg")).toHaveAttribute("src", "/images/loading-campus.jpg");
    await expect.poll(() => page.locator(".loading-screen .boot-bg").evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(1000);
    await page.screenshot({ path: `.cache/loading-campus-${width}.png` });
    await expect(page.locator(".initiative-strip")).toBeVisible();
    await expect(page.locator(".initiative-roll-intro")).toHaveCount(0);
    const times = await page.evaluate(() => (window as unknown as { diceTimes: number[] }).diceTimes);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(500);
    expect(times[1] - times[0]).toBeLessThan(1500);
    for (const entry of state.battle!.initiative!) {
      const unit = page.locator(`.initiative-strip li.${entry.side}`).filter({ hasText: (entry.side === "ally" ? state.battle!.allies : state.battle!.enemies).find(u => u.id === entry.id)!.name });
      // Duplicate enemy names are allowed; all share this deterministic test roll.
      await expect(unit.first()).toContainText(`D20 ${entry.roll}`);
      await expect(unit.first()).toContainText(`INIT ${entry.score}`);
    }
    await expect(page.locator(".initiative-strip li.current")).toHaveAttribute("aria-current", "step");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `.cache/d20-order-${width}.png` });
  });
}
