// End-to-end check of the deployed shape of the app against a real Postgres.
// Mirrors tests/game.smoke.spec.ts at the API level: guest session, ten-pull,
// level up, reload survival, account binding, sign out, sign in again.
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const jar = new Map();
let failures = 0;

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function absorb(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === "" || /expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(name);
    else jar.set(name, value);
  }
}
async function call(path, body, expectStatus = 200) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json", origin: base }),
      ...(jar.size ? { cookie: cookieHeader() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  absorb(response);
  const text = await response.text();
  if (response.status !== expectStatus) {
    failures++;
    console.log(`  ✗ ${path} -> HTTP ${response.status} (wanted ${expectStatus}): ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log("1. health");
const health = await call("/api/health");
check("GET /api/health", JSON.stringify(health), '{"ok":true}');

console.log("2. guest session");
const guest = await call("/api/game", { action: "init" });
check("player.guest", guest.player?.guest, true);
check("starting gems", guest.state?.gems, 9600);

console.log("3. ten-pull");
const pulls = await call("/api/game", { action: "pull", count: 10 });
check("pulls returned", pulls.pulls?.length, 10);
check("gems after ten-pull", pulls.state?.gems, 8000);
check("totalPulls", pulls.state?.totalPulls, 10);
const roster = pulls.state?.roster ?? [];
check("roster has characters", roster.length > 0, true);

console.log("4. level up");
const target = roster[0];
const leveled = await call("/api/game", { action: "upgrade", id: target.id });
check(`level of ${target.id}`, leveled.state?.roster.find((c) => c.id === target.id)?.level, (target.level ?? 1) + 1);

console.log("5. progress survives a fresh request (what a reload does)");
const reload = await call("/api/game");
check("totalPulls still 10", reload.state?.totalPulls, 10);
check("level persisted", reload.state?.roster.find((c) => c.id === target.id)?.level, (target.level ?? 1) + 1);

console.log("6. bind the guest to an account");
const email = `e2e-${Date.now()}@example.com`;
const password = "TestCouncil!42";
const registered = await call("/api/auth", { action: "register", name: "E2E Council", email, password });
check("account is not a guest", registered.player?.guest, false);
check("progress kept through registration", registered.state?.totalPulls, 10);

console.log("7. sign out, then sign in again");
await call("/api/auth", { action: "logout" });
const afterLogout = await call("/api/game");
check("no player while signed out", afterLogout.player, null);
const login = await call("/api/auth", { action: "login", email, password });
check("signed back in", login.player?.email, email);
check("progress survived the round trip", login.state?.totalPulls, 10);

console.log("8. sign-in guards");
const badEmail = await call("/api/auth", { action: "register", name: "Bad", email: "not-an-email", password }, 400);
check("invalid email rejected", typeof badEmail.error === "string", true);
const dupe = await call("/api/auth", { action: "register", name: "Dupe", email, password }, 400);
check("duplicate email rejected", /already exists/i.test(dupe.error ?? ""), true);
const wrongPassword = await call("/api/auth", { action: "login", email, password: "definitely-wrong" }, 400);
check("wrong password rejected", typeof wrongPassword.error === "string", true);
const google = await call("/api/auth");
check("Google button disabled without credentials", google.googleEnabled, false);
const bogus = await call("/api/game", { action: "definitely-not-an-action" }, 400);
check("unknown action rejected", /unknown game action/i.test(bogus.error ?? ""), true);

console.log("9. a brand-new visitor is a separate session");
const visitor = await fetch(base + "/api/game", { headers: { "cache-control": "no-store" } });
const visitorBody = await visitor.json();
check("no cookie -> no player", visitorBody.player, null);

console.log("10. the game is playable from the browser document");
const page = await fetch(base + "/");
const html = await page.text();
check("homepage status", page.status, 200);
check("homepage serves the app", /Tap anywhere to start|<html/i.test(html), true);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
