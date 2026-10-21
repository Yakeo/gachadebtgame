import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { initialState, characterById } from "../src/lib/game-data";
import { applyGameAction } from "../src/lib/game-engine";
import { modelUrl } from "../src/lib/model-art";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";

for (const width of [1366, 390]) {
  test(`cameos use the redrawn, versioned battle sprites at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    const seed = initialState();
    seed.roster = ["chen", "hokusai", "altria", "morrow"].map(id => ({ id, level: 10, potential: 0, duplicates: 0 }));
    seed.squad = seed.roster.map(c => c.id);
    const state = applyGameAction(seed, { action: "startBattle", id: "1-1" }, () => .8).state;
    await page.addInitScript(() => localStorage.setItem("gd-motion", "true"));
    await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/api/game")
      ? { state, player: { id: "cameo-models", name: "President", guest: true, email: null } }
      : { googleEnabled: false, maintenance: false } }));
    await page.goto(`${base}/?signedIn=1`);
    await expect(page.locator(".ally-unit")).toHaveCount(4);
    await expect(page.locator(".pose-enter")).toHaveCount(0);
    for (const id of seed.squad) {
      const art = page.locator(`.ally-unit[data-unit="${id}"] .sprite-art`);
      const src = modelUrl(characterById(id).splash!);
      await expect(art).toHaveAttribute("src", src);
      await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(861);
      await expect(art).toBeVisible();
      await expect(art).toHaveCSS("object-fit", "contain");
      const box = (await art.boundingBox())!;
      expect(box.width).toBeGreaterThan(60);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await expect(page.locator(`.ally-unit[data-unit="${id}"] .model-vitals`)).toBeVisible();
      if (id === "chen" || id === "hokusai") {
        const served = await page.request.get(`${base}${src}`);
        expect(served.ok()).toBeTruthy();
        const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
        expect(hash(await served.body())).toBe(hash(readFileSync(`public${characterById(id).splash}`)));
        if (id === "hokusai") {
          const pixels = await art.evaluate((img: HTMLImageElement) => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let bottom = 0, greenResidue = 0, crimson = 0, teal = 0, ivory = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (!data[i + 3]) continue;
              const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
              bottom = Math.floor(i / 4 / canvas.width) + 1;
              if (g > Math.max(r, b) + 18) greenResidue++;
              if (r > 70 && r > g * 1.3 && r > b * 1.3) crimson++;
              if (g > r * 1.2 && b > r * 1.2 && g > 30 && b > 30 && Math.abs(g - b) < 50) teal++;
              if (r > 160 && g > 150 && b > 100) ivory++;
            }
            return { bottom, greenResidue, crimson, teal, ivory, cornerAlpha: data[3] };
          });
          expect(pixels.bottom).toBe(900);
          expect(pixels.cornerAlpha).toBe(0);
          expect(pixels.greenResidue).toBe(0);
          expect(pixels.crimson).toBeGreaterThan(100);
          expect(pixels.teal).toBeGreaterThan(100);
          expect(pixels.ivory).toBeGreaterThan(100);
        }

      }
    }
    await page.screenshot({ path: `.cache/cameo-models-${width}.png`, fullPage: true });
  });
}
