/**
 * Navigation is hub-and-back, not tabs.
 *
 * The bottom tab bar was removed because it felt wrong and ate the vertical
 * space that the recruit screen needed at laptop resolutions. Two bugs lived
 * in that bar: it covered page content, and it let players tab out of an
 * active battle into their characters mid-fight. Navigation now lives on the
 * home hub tiles plus a back button, and a battle in progress owns the screen —
 * the only way out is finishing it or the battle's own Retreat.
 *
 * These tests pin that contract at the source level: the tab bar must not come
 * back, the back button must exist, and focused scenes (battle, story) must
 * lock navigation and pin the player to the campaign after a reload.
 */
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the bottom tab bar is gone from the shell", () => {
  const shell = read("src/components/game-shell.tsx");
  assert.doesNotMatch(shell, /main-nav/, "the bottom tab strip must not come back");
  assert.doesNotMatch(shell, /nav-item/, "tab buttons must not come back");
  assert.doesNotMatch(shell, /const navigation = /, "the tab registry must not come back");
});

test("navigation is the home hub plus a back button", () => {
  const shell = read("src/components/game-shell.tsx");
  assert.match(shell, /className="back-button"/, "every non-home screen needs a way back");
  assert.match(shell, /onClick=\{goBack\}/);
  // The home screen is the hub: its tiles are the only entry points now.
  assert.match(shell, /campaign-tile/, "home must still offer the campaign");
  assert.match(shell, /characters-tile/, "home must still offer the roster");
  assert.match(shell, /recruit-tile/, "home must still offer recruitment");
});

test("a battle in progress owns the screen", () => {
  const shell = read("src/components/game-shell.tsx");
  // Reload mid-fight must land back in the operation, not the lobby.
  assert.match(shell, /state\.battle && view !== "campaign"/);
  // And while it lasts, view navigation is refused.
  assert.match(shell, /navLocked = immersive \|\| Boolean\(state\.battle\)/);
  assert.match(shell, /Finish or retreat from your battle first\./,
    "the lock must explain itself instead of silently ignoring clicks");
});

test("focused scenes report themselves so the shell can lock", () => {
  const views = read("src/components/game-views.tsx");
  assert.match(views, /CampaignView\(\{ onImmersive \}:/);
  assert.match(views, /ArchiveView\(\{ onImmersive \}:/);
  assert.match(views, /onImmersive\(phase !== "map"\)/,
    "story and battle phases are focused scenes");
});

test("no stylesheet rule reserves space for a tab bar", () => {
  const css = read("src/app/globals.css");
  assert.doesNotMatch(css, /\.main-nav\{/);
  assert.doesNotMatch(css, /\.nav-item\{/);
  assert.doesNotMatch(css, /\.nav-count\{/);
  assert.doesNotMatch(css, /\.nav-index\{/);
  // Fixed overlays used to clear the tab row (83px = tabs + status strip);
  // they now clear the status strip alone.
  assert.doesNotMatch(css, /bottom:83px/);
  assert.doesNotMatch(css, /inset:67px 0 83px/);
  assert.match(css, /\.back-button\{/, "the back button needs styling");
  assert.match(css, /\.status-bar\{/, "the connection status strip stays");
});
