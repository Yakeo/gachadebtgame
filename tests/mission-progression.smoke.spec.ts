import { test, expect } from "@playwright/test";
import { characters, initialState, missions } from "../src/lib/game-data";
import { stages } from "../src/lib/campaign";
import { applyGameAction } from "../src/lib/game-engine";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1440, 390]) {
  test(`returning guest sees earned milestones and receives both currencies at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let state = initialState(); delete state.starterUrClaimed;
    state.roster = characters.slice(0, 15).map((c, i) => ({ id: c.id, level: i === 0 ? 30 : 1, potential: 0, duplicates: 0 }));
    state.cleared = stages.slice(0, 15).map(s => s.id);
    state.totalPulls = 100; state.pity = 19; state.gems = 2000; state.credits = 4321;
    state.claimed = ["welcome-gift", "first-stage", "chapter-one", "first-ten", "full-squad"];
    const earned = ["level-10", "stages-10", "roster-15", "pulls-100"].map(id => missions.find(m => m.id === id)!);
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/game")) return route.fulfill({ json: { googleEnabled: false } });
      const input = route.request().postDataJSON();
      if (input?.action) {
        try {
          const result = applyGameAction(state, input, () => .8);
          state = result.state;
          return route.fulfill({ json: { ...result, player: { id: "mission-guest", name: "President", guest: true, email: null } } });
        } catch (error) { return route.fulfill({ status: 400, json: { error: (error as Error).message } }); }
      }
      return route.fulfill({ json: { state, player: { id: "mission-guest", name: "President", guest: true, email: null } } });
    });
    const card = (title: string) => page.locator(".mission-card").filter({ hasText: title });
    await page.goto(`${base}/?signedIn=1`);
    await page.getByRole("button", { name: /Missions.*MAKE IT COUNT/ }).click();
    await expect(page.locator(".mission-card")).toHaveCount(30);
    await expect(page.locator(".mission-number").nth(9)).toHaveText("10");
    await expect(page.locator(".mission-number").nth(29)).toHaveText("30");
    await page.locator(".filter-tabs").getByRole("button", { name: "In progress", exact: true }).click();
    const locked = card("A very good investment");
    await expect(locked.locator(".mission-progress > span")).toHaveText("30 / 40");
    await expect(locked.getByRole("button", { name: "In progress", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Ready to claim", exact: true }).click();
    await expect(locked).toHaveCount(0);
    for (const milestone of earned) {
      const reward = card(milestone.title);
      await expect(reward.locator(".mission-rewards > span").first()).toHaveText(milestone.gems.toLocaleString());
      await expect(reward.locator(".mission-rewards > span").last()).toHaveText(milestone.credits.toLocaleString());
      await reward.getByRole("button", { name: "Claim rewards" }).click();
      await expect(reward).toHaveCount(0);
    }
    expect(state.gems).toBe(2000 + earned.reduce((sum, m) => sum + m.gems, 0));
    expect(state.credits).toBe(4321 + earned.reduce((sum, m) => sum + m.credits, 0));
    expect(state.totalPulls).toBe(100);
    expect(state.pity).toBe(19);
    expect(state.cleared).toHaveLength(15);
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    for (const milestone of earned) await expect(card(milestone.title).getByRole("button", { name: "Claimed", exact: true })).toBeDisabled();
    await page.goto(`${base}/?signedIn=1`);
    await page.getByRole("button", { name: /Missions.*MAKE IT COUNT/ }).click();
    for (const milestone of earned) await expect(card(milestone.title).getByRole("button", { name: "Claimed", exact: true })).toBeDisabled();
    await card("Fully funded hero").scrollIntoViewIfNeeded();
    await expect(card("Fully funded hero").locator(".mission-rewards")).toContainText("90,000");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `.cache/missions-${width}.png`, fullPage: true });
  });
}
