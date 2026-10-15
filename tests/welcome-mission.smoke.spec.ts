import { test, expect } from "@playwright/test";
import { initialState, WELCOME_MISSION } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1440, 390]) {
  test(`existing guest can claim the welcome mission once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let state = initialState(); delete state.starterUrClaimed;
    state.gems = 123; state.totalPulls = 7; state.pity = 7;
    state.cleared = ["1-1"]; state.claimed = ["first-stage"];
    let claims = 0;
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action) {
        try {
          const result = applyGameAction(state, input, () => .8);
          state = result.state;
          if (input.action === "claim") claims++;
          return route.fulfill({ json: { ...result, player: { id: "old-guest", name: "President", guest: true, email: null } } });
        } catch (error) { return route.fulfill({ status: 400, json: { error: (error as Error).message } }); }
      }
      return route.fulfill({ json: { state, player: { id: "old-guest", name: "President", guest: true, email: null } } });
    });
    await page.goto(`${base}/?signedIn=1`);
    const missions = page.getByRole("button", { name: /Missions.*20 FREE ROLLS/ });
    await expect(missions).toBeVisible();
    await missions.click();
    await page.getByRole("button", { name: "Ready to claim", exact: true }).click();
    const gift = page.locator(".mission-card").filter({ hasText: WELCOME_MISSION.title });
    await expect(gift).toBeVisible();
    await expect(gift.locator(".mission-progress > span")).toHaveText("1 / 1");
    await expect(gift.locator(".mission-rewards")).toHaveText("3200");
    await gift.getByRole("button", { name: "Claim rewards" }).click();
    await expect(gift).toHaveCount(0);
    expect(state.gems).toBe(3323);
    expect(state.pity).toBe(7);
    expect(state.totalPulls).toBe(7);
    expect(state.cleared).toEqual(["1-1"]);
    expect(claims).toBe(1);
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(gift.getByRole("button", { name: "Claimed", exact: true })).toBeDisabled();
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.getByRole("button", { name: /Missions.*MAKE IT COUNT/ })).toBeVisible();
    await page.getByRole("button", { name: /Missions.*MAKE IT COUNT/ }).click();
    await expect(gift.getByRole("button", { name: "Claimed", exact: true })).toBeDisabled();
    expect(claims).toBe(1);
    expect(state.gems).toBe(3323);
  });
}
