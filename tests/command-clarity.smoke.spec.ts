import { test, expect } from "@playwright/test";
import { initialState } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
import { BATTLE_COMMANDS } from "../src/lib/battle-commands";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1440, 390]) for (const command of BATTLE_COMMANDS) {
  test(`${command} dismisses info before the request resolves at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let state = applyGameAction(initialState(), { action: "startBattle", id: "1-1" }, () => .8).state;
    state.battle!.allies.forEach(ally => ally.energy = 100);
    let actions = 0;
    let release: (() => void) | undefined;
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action === "act") {
        actions++;
        await new Promise<void>(resolve => { release = resolve; });
        state = applyGameAction(state, input, () => .8).state;
      }
      await route.fulfill({ json: { player: { id: "clarity", name: "President", guest: true, email: null }, state } });
    });
    await page.goto(`${base}/?signedIn=1`);
    const inspect = page.locator(`.inspect-command.${command}`);
    await expect(inspect).toBeEnabled();
    await inspect.click();
    await expect(page.locator(".command-detail")).toBeVisible();
    const alpha = await page.locator(".command-detail").evaluate(element => Number(getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.[3]));
    expect(alpha).toBeGreaterThanOrEqual(.65);
    expect(alpha).toBeLessThanOrEqual(.75);
    expect(actions).toBe(0); // Inspecting still must never spend a turn.
    await page.getByRole("button", { name: `Activate ${command}`, exact: true }).click();
    await expect.poll(() => actions).toBe(1);
    await expect(page.locator(".command-detail")).toBeHidden();
    await expect(page.locator(".battle-command-panel")).not.toHaveClass(/is-inspecting/);
    await expect(page.locator(".activate-command")).toBeDisabled();
    release!();
    await expect(page.locator(".inspect-command.attack")).toBeEnabled({ timeout: 15000 });
    await expect(page.locator(".command-detail")).toBeHidden();
    await page.locator(".inspect-command.attack").click();
    await expect(page.locator(".command-detail")).toBeVisible();
  });
}
