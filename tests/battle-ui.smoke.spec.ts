import { test, expect } from "@playwright/test";
import { initialState, characterById } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
import { stages, battlefieldFor } from "../src/lib/campaign";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1440, 390]) {
  test(`inspect skills without acting at ${width}px, then explicitly activate`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let state = applyGameAction(initialState(), { action: "startBattle", id: "1-1" }, () => .8).state;
    let actions = 0;
    const actor = characterById(state.battle!.allies[0].id);
    await page.route("**/api/**", async route => {
      const url = route.request().url();
      if (!url.includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action === "act") {
        actions++;
        state = applyGameAction(state, input, () => .8).state;
      }
      await route.fulfill({ json: { player: { id: "battle-test", name: "President", guest: true, email: null }, state } });
    });
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".battle-command-panel")).toBeVisible();
    await expect(page.locator(".command-detail p")).toHaveText(actor.skillNote);
    await page.getByRole("button", { name: /4.*Ultimate/ }).click();
    await expect(page.locator(".command-detail p")).toHaveText(actor.ultimateNote);
    await expect(page.getByRole("button", { name: "Activate ultimate" })).toBeDisabled();
    expect(actions).toBe(0);
    await page.keyboard.press("1");
    await expect(page.locator(".command-detail-heading strong")).toHaveText("Attack");
    expect(actions).toBe(0);
    await page.locator(".activate-command").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.cache/battle-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Activate attack" }).click();
    await expect.poll(() => actions).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("every campaign chapter actually renders its own anime environment", async ({ page }) => {
  const seed = initialState();
  seed.roster.forEach(c => c.level = 40);
  seed.cleared = stages.map(s => s.id);
  let chapter = 1;
  await page.route("**/api/**", async route => route.fulfill({ json: route.request().url().includes("/api/game") ? {
    player: { id: "environments", name: "President", guest: true, email: null },
    state: applyGameAction(seed, { action: "startBattle", id: `${chapter}-1` }, () => .8).state,
  } : { googleEnabled: false } }));
  for (chapter = 1; chapter <= 5; chapter++) {
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.goto(`${base}/?signedIn=1`);
    const image = page.locator(".battle-arena > img");
    await expect(image).toHaveAttribute("src", battlefieldFor(chapter));
    await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(1000);
    await expect(image).toHaveCSS("image-rendering", "auto");
  }
});
