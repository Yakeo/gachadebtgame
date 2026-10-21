// Maintenance mode.
//
// The patch changes the rarity ladder, the combat choreography and the UR pool.
// None of that should be applied underneath somebody mid-battle, so this branch
// closes the game and puts Penelope in front of the door. These tests pin the
// parts that are easy to get subtly wrong: the default, the way out, the
// eviction of a tab that was already open, and the fact that nobody gets
// trapped in a jumpscare.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAINTENANCE_BLOCK_MESSAGE, maintenanceEnabled, maintenancePayload, maintenanceStatus } from "../src/lib/maintenance";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const screen = read("src/components/maintenance-screen.tsx");
const context = read("src/components/game-context.tsx");
const page = read("src/app/page.tsx");
const api = read("src/app/api/game/route.ts");

/** Run `fn` with MAINTENANCE_MODE set, restoring the previous value after. */
function withFlag<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.MAINTENANCE_MODE;
  if (value === undefined) delete process.env.MAINTENANCE_MODE;
  else process.env.MAINTENANCE_MODE = value;
  try { return fn(); } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
}

test("the game boots closed until somebody says otherwise", () => {
  // Missing env var means maintenance is ON: an unpatchable game is worse than a
  // sign that stays up for an hour.
  for (const value of [undefined, "", "true", "1", "yes", "lol"]) {
    withFlag(value, () => assert.equal(maintenanceEnabled(), true, `MAINTENANCE_MODE=${value} must keep the game closed`));
  }
  for (const value of ["off", "OFF", " false ", "0", "no", "disabled", "live"]) {
    withFlag(value, () => assert.equal(maintenanceEnabled(), false, `MAINTENANCE_MODE=${value} must open the game`));
  }
});

test("the broadcast names the patch, the star and what is being changed", () => {
  const status = maintenanceStatus();
  assert.equal(status.active, true);
  assert.match(status.patch, /^0\.\d+$/);
  assert.match(status.name, /RARITY/);
  assert.match(status.headline, /Catastrophe/i, "the headline should sound like this game");
  assert.equal(status.star.id, "penelope");
  assert.equal(status.notes.length, 4);
  const text = status.notes.map(n => `${n.title} ${n.body}`).join(" ").toLowerCase();
  for (const subject of ["ultra rare", "highest rarity", "ranged", "ch’en", "hokusai", "save"]) {
    assert.ok(text.includes(subject), `the patch notes never mention ${subject}`);
  }
  // The payload the browser polls is the same story, without the internal flag.
  const payload = maintenancePayload();
  assert.equal(payload.maintenance, true);
  assert.equal(payload.star.name, "Penelope");
  assert.equal("active" in payload, false);
});

test("the page gate runs before the game, per request", () => {
  assert.match(page, /export const dynamic = "force-dynamic"/,
    "a statically rendered page would bake the maintenance flag at build time");
  assert.match(page, /if \(status\.active\) return <MaintenanceScreen/,
    "the home route must render maintenance instead of the game");
  assert.match(page, /maintenanceStatus\(\)/);
  assert.ok(existsSync(join(root, "src/app/api/status/route.ts")), "the poll needs an endpoint");
  assert.match(read("src/app/api/status/route.ts"), /no-store/, "the door check must never be cached");
});

test("game actions are refused while the doors are shut, before the database", () => {
  assert.match(api, /if \(maintenanceEnabled\(\)\) return NextResponse\.json\(\{ error: MAINTENANCE_BLOCK_MESSAGE, maintenance: true \}, \{ status: 503 \}\)/);
  const maintenanceCheck = api.indexOf("maintenanceEnabled()");
  const transaction = api.indexOf("db.transaction");
  assert.ok(maintenanceCheck > -1 && transaction > -1 && maintenanceCheck < transaction,
    "the maintenance check must come before any database work");
  assert.match(MAINTENANCE_BLOCK_MESSAGE, /maintenance/i);
});

test("a tab that is already playing gets kicked out", () => {
  // The page gate only helps on load; somebody mid-battle needs a poll.
  assert.match(context, /fetch\("\/api\/status"/, "the game must ask the door check");
  assert.match(context, /setInterval\(check, \d+\)/, "and keep asking, so a patch lands mid-session");
  assert.match(context, /visibilitychange/, "returning to the tab must re-check");
  assert.match(read("src/components/game-shell.tsx"),
    /if \(maintenance\) return <MaintenanceScreen info=\{maintenance\} onRetry/,
    "the eviction must replace whatever is on screen, including a battle");
  assert.match(context, /result\?\.maintenance/, "a refused action must also trigger the eviction");
});

test("Penelope stars in the notice and the jumpscare is dismissible", () => {
  assert.match(screen, /\/images\/faces\/penelope-shocked\.png/, "the scare must use Penelope's face");
  assert.match(screen, /\/images\/keyart-penelope\.webp/, "the notice must show Penelope");
  assert.match(screen, /className=\{`penelope-scare \$\{shake \? "calm" : ""\}`\}/);
  assert.match(screen, /onClick=\{\(\) => setPhase\("notice"\)\}/, "tapping must end the scare");
  assert.match(screen, /setTimeout\(\(\) => setPhase\("notice"\)/, "the scare must end on its own");
  assert.match(screen, /aria-modal="true"/);
  assert.match(screen, /role="alertdialog"/);
  // A jumpscare that ignores Reduced Motion is a bug report waiting to happen.
  assert.match(screen, /prefers-reduced-motion: reduce/);
  assert.match(read("src/app/maintenance.css"), /prefers-reduced-motion:reduce\)\{[\s\S]{0,200}penelope-scare/);
});
