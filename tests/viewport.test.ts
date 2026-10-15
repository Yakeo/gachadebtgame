import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { gameViewport } from "../src/lib/viewport";

test("desktop frame exactly fills laptop, ultrawide and high-resolution viewports", () => {
  for (const [width, height] of [[1024, 600], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [3440, 1440], [3840, 2160]]) {
    const frame = gameViewport(width, height);
    assert.ok(Math.abs(frame.width * frame.scale - width) < .001);
    assert.ok(Math.abs(frame.height * frame.scale - height) < .001);
    assert.ok(frame.width >= 1440 && frame.height >= 810);
  }
  assert.ok(gameViewport(3840, 2160).scale > 2);
  assert.ok(gameViewport(1366, 768).scale < 1);
});

test("mobile and narrow/zoomed viewports preserve unscaled responsive controls", () => {
  for (const [width, height] of [[390, 844], [360, 640], [844, 390], [900, 1000]]) {
    assert.deepEqual(gameViewport(width, height), { width, height, scale: 1 });
  }
  assert.deepEqual(gameViewport(0, 0), { width: 1440, height: 810, scale: 1 });
});

test("the typography used to size the interface is actually shipped locally", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const fonts = [...css.matchAll(/url\('([^']+\.woff2)'\)/g)].map(m => m[1]);
  assert.ok(fonts.length >= 10);
  for (const font of fonts) assert.ok(existsSync(new URL(`../public${font}`, import.meta.url)), font);
});
