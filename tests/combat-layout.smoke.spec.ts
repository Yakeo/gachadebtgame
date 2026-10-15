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
    await expect(page.locator(".ally-hud, .enemy-hud")).toHaveCount(0);
    await expect(page.locator(".pose-enter")).toHaveCount(0); // Measure settled size, not the entrance squash.
    for (const image of await page.locator(".ally-unit .sprite-art").all()) {
      const box = await image.boundingBox();
      // Short landscape keeps the 12% lift (80→90px tall), rather than
      // crowding the toolbar by imposing a portrait-sized minimum.
      expect(box!.width).toBeGreaterThanOrEqual(width > 900 ? 170 : height < 500 ? 78 : 95);
      // Enlarged models must not disappear over a phone's outer screen edges.
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    // Selection cues must remain white and visible on the dark chapter-5 field.
    const selected = page.locator(".enemy-unit.targeted");
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect(selected.locator(".target-pointer")).toBeVisible();
    await expect(selected.locator(".target-pointer")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator(".turn-pointer")).toHaveCount(1);
    await expect(page.locator(".ally-unit.current .turn-pointer")).toBeVisible();
    await expect(page.locator(".target-reticle")).toHaveCount(0);
    for (const energy of await page.locator(".model-vitals>div:last-child").all()) {
      await expect(energy).toHaveCSS("background-color", "rgb(244, 250, 255)");
      await expect(energy).toHaveCSS("color", "rgb(16, 40, 61)");
    }
    const nextTarget = page.locator(".enemy-unit:not(.defeated):not(.targeted)").first();
    if (await nextTarget.count()) {
      await nextTarget.click();
      await expect(page.locator(".enemy-unit[aria-pressed=true]")).toHaveCount(1);
      await expect(page.locator(".target-pointer")).toHaveCount(1);
    }

    for (const vitals of await page.locator(".model-vitals, .enemy-unit .combat-unit-label").all()) {
      // The sprite is the positioning parent: never another row/card beneath the arena.
      expect(await vitals.evaluate(e => e.parentElement!.classList.contains("combat-unit-art"))).toBe(true);
      await expect(vitals).toHaveCSS("position", "absolute");
      await expect(vitals).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      const art = await vitals.locator("..").boundingBox();
      const bar = await vitals.boundingBox();
      expect(Math.abs(bar!.y - (art!.y + art!.height))).toBeLessThan(12);
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
