import { test, expect } from "@playwright/test";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
test.setTimeout(90000);

async function reachLogin(page: import("@playwright/test").Page) {
  await page.goto(base);
  await expect(page.getByRole("button", { name: /Tap anywhere to start/ })).toBeVisible({ timeout: 25000 });
  await page.getByRole("button", { name: /Tap anywhere to start/ }).click();
  await expect(page.getByRole("heading", { name: /Sign in before the story starts/ })).toBeVisible();
}
async function enterAsGuest(page: import("@playwright/test").Page) {
  await reachLogin(page);
  await page.getByRole("button", { name: "Just looking? Play as guest" }).click();
  await expect(page.locator(".online-status")).toContainText("GUEST SESSION", { timeout: 15000 });
}

test("main menu, recruitment, upgrades, account binding, and session restoration", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await reachLogin(page);
  await page.getByRole("button", { name: "Just looking? Play as guest" }).click();
  await expect(page.locator(".online-status")).toContainText("GUEST SESSION");
  await expect(page.locator(".campaign-tile")).toBeVisible();
  await expect(page.locator(".home-keyart")).toBeVisible();
  await page.locator(".main-nav").getByRole("button", { name: /Recruit/ }).click();
  await page.locator(".pull-button.ten").click();
  await expect(page.locator(".pull-result")).toHaveCount(10, { timeout: 20000 });
  await page.getByRole("button", { name: "Back to banner" }).click();
  let data = await page.evaluate(async () => (await fetch("/api/game")).json());
  expect(data.state.gems).toBe(3200);
  expect(data.state.totalPulls).toBe(10);
  await page.locator(".main-nav").getByRole("button", { name: /Characters/ }).click();
  await page.getByRole("button", { name: /Level up/ }).click();
  await expect(page.locator(".level-section strong")).toContainText("02");
  await page.reload();
  await expect(page.getByRole("button", { name: /Tap anywhere to start/ })).toBeVisible({ timeout: 25000 });
  await page.getByRole("button", { name: /Tap anywhere to start/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".online-status")).toContainText("GUEST SESSION");
  data = await page.evaluate(async () => (await fetch("/api/game")).json());
  expect(data.state.totalPulls).toBe(10);
  expect(data.state.roster.find((c: { id: string }) => c.id === "ynna").level).toBe(2);
  const email = `smoke-${Date.now()}@example.com`;
  const password = "TestCouncil!42";
  await page.getByRole("button", { name: "Open account and save progress" }).click();
  await page.getByLabel("What should we call you?").fill("Council Tester");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account & save progress" }).click();
  await expect(page.locator(".online-status")).toContainText("ACCOUNT SYNCED", { timeout: 15000 });
  data = await page.evaluate(async () => (await fetch("/api/game")).json());
  expect(data.player.guest).toBe(false);
  expect(data.state.totalPulls).toBe(10);
  await page.getByRole("button", { name: "Open account and save progress" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Sign in before the story starts/ })).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in and enter" }).click();
  await expect(page.locator(".online-status")).toContainText("ACCOUNT SYNCED");
  data = await page.evaluate(async () => (await fetch("/api/game")).json());
  expect(data.player.name).toBe("Council Tester");
  expect(data.state.totalPulls).toBe(10);
  expect(errors).toEqual([]);
});

test("story, turn-based battle, post-story, rewards, and archive loop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await enterAsGuest(page);
  await page.locator(".main-nav").getByRole("button", { name: /Campaign/ }).click();
  await page.getByRole("button", { name: "Start operation" }).click();
  await expect(page.locator(".story-nameplate")).toContainText("Ninette");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.locator(".battle-header")).toContainText("The Audit");
  for (let i = 0; i < 20; i++) {
    if (await page.locator(".battle-result.victory").isVisible()) break;
    const response = page.waitForResponse(r => r.url().endsWith("/api/game") && r.request().method() === "POST");
    await page.locator(".command.attack").click();
    expect((await response).ok()).toBeTruthy();
    await page.waitForTimeout(150);
  }
  await expect(page.locator(".battle-result.victory")).toBeVisible();
  await page.getByRole("button", { name: "Continue the story" }).click();
  await expect(page.locator(".story-topbar")).toContainText("AFTER THE OPERATION");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.locator(".stage-details")).toContainText("An Unwelcome Visitor");
  const data = await page.evaluate(async () => (await fetch("/api/game")).json());
  expect(data.state.cleared).toEqual(["1-1"]);
  expect(data.state.gems).toBe(5000);
  expect(data.state.battle).toBeNull();
  await page.locator(".main-nav").getByRole("button", { name: /Missions/ }).click();
  await page.locator(".mission-card").filter({ hasText: "The first step" }).getByRole("button", { name: "Claim rewards" }).click();
  await expect(page.locator(".mission-card").filter({ hasText: "The first step" }).getByRole("button", { name: "Claimed" })).toBeDisabled();
  await page.locator(".main-nav").getByRole("button", { name: /Archives/ }).click();
  await page.locator(".archive-stage").filter({ hasText: "The Audit" }).getByRole("button", { name: "After battle" }).click();
  await expect(page.locator(".story-topbar")).toContainText("STORY ARCHIVE");
});

test("daily rewards, settings, mobile navigation, and narrow-screen layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterAsGuest(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.locator(".daily-strip").click();
  await page.getByRole("button", { name: "Claim daily supplies" }).click();
  await expect(page.getByRole("button", { name: "Claimed. See you tomorrow!" })).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("switch", { name: "Reduced motion" }).click();
  await expect(page.getByRole("switch", { name: "Reduced motion" })).toBeChecked();
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const name of ["Campaign", "Characters", "Recruit", "Missions", "Archives"]) {
    await page.locator(".main-nav").getByRole("button", { name: new RegExp(name) }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});
