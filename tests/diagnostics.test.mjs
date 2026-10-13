// Regression tests for the deploy diagnostics (scripts/lib/supabase-diag.mjs).
// Run with: npm run test:diag   (node --test, no build step needed)
//
// These exist because a bug in the checker is worse than no checker: the
// deploy workflow trusts its verdict, and the whole point is that a failure
// produces an explanation instead of a stack trace.
import test from "node:test";
import assert from "node:assert/strict";

import { classifyUrl, explainError, hostOf, redact, sslFor } from "../scripts/lib/supabase-diag.mjs";

const SESSION = "postgresql://postgres.abcdefghijklmnopqrst:S3cret%2Fp%40ss@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require";
const RUNTIME = "postgresql://postgres.abcdefghijklmnopqrst:S3cret%2Fp%40ss@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("hostOf understands pooler URLs, socket URLs, and rejects nonsense", () => {
  assert.deepEqual(hostOf(SESSION), { host: "aws-0-eu-central-1.pooler.supabase.com", port: 5432, tolerant: false });

  // pg accepts a unix-socket target; `new URL()` does not. This must not throw.
  const socket = hostOf("postgresql://postgres:@/postgres?host=/tmp/pgdata");
  assert.equal(socket.tolerant, true);
  assert.equal(socket.host, "");
  assert.equal(socket.port, 5432);

  assert.equal(hostOf("not a url at all"), null);
  assert.equal(hostOf(""), null);
  // An unencoded "@" in the password must still resolve the host, as pg does.
  assert.equal(hostOf("postgresql://u:p@ss@host.example.com:5432/db").host, "host.example.com");
});

test("a well-formed session pooler string passes the DDL check", () => {
  const result = classifyUrl(SESSION, { role: "ddl", label: "SUPABASE_SESSION_URL" });
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
});

test("a pooler URL with a username suffix does not throw (regression)", () => {
  // This exact shape once crashed the checker with a ReferenceError, which
  // meant the deploy annotation never fired.
  for (const [value, role] of [[SESSION, "ddl"], [RUNTIME, "runtime"]]) {
    const result = classifyUrl(value, { role, label: "secret" });
    assert.equal(typeof result.ok, "boolean");
    assert.ok(Array.isArray(result.problems));
  }
});

test("the transaction pooler is rejected where DDL is needed", () => {
  const result = classifyUrl(RUNTIME, { role: "ddl", label: "SUPABASE_SESSION_URL" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /transaction pooler/i);
});

test("the IPv6-only direct host is rejected", () => {
  const result = classifyUrl("postgresql://postgres.abcdefghijklmnopqrst:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres", { role: "ddl", label: "secret" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /IPv6/i);
});

test("leftover .env.example placeholder text is rejected", () => {
  const result = classifyUrl("postgresql://postgres.YOUR_PROJECT_REF:[YOUR-PASSWORD]@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres", { role: "ddl", label: "secret" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /placeholder/i);
});

test("an unencoded password character is named explicitly", () => {
  const result = classifyUrl("postgresql://postgres.abcdefghijklmnopqrst:pa@ss#1@aws-0-eu-central-1.pooler.supabase.com:5432/postgres", { role: "ddl", label: "secret" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /URL-encode/i);
  assert.match(result.problems.join(" "), /%40/);
});

test("a pooler username without the project-ref suffix is rejected", () => {
  const result = classifyUrl("postgresql://postgres:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres", { role: "ddl", label: "secret" });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /postgres\.<project-ref>/);
});

test("localhost is a problem on CI but only a note locally", () => {
  const value = "postgresql://postgres:pw@localhost:5432/gacha_debt";
  const previous = process.env.CI;
  try {
    delete process.env.CI;
    const local = classifyUrl(value, { role: "ddl", label: "secret" });
    assert.equal(local.ok, true, "localhost must stay usable for local development");
    assert.match(local.notes.join(" "), /GitHub runner cannot reach/);

    process.env.CI = "true";
    const ci = classifyUrl(value, { role: "ddl", label: "secret" });
    assert.equal(ci.ok, false);
    assert.match(ci.problems.join(" "), /GitHub runner cannot reach/);
  } finally {
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  }
});

test("an empty secret is reported as missing, not as a parse error", () => {
  const result = classifyUrl("", { role: "ddl", label: "SUPABASE_SESSION_URL" });
  assert.equal(result.present, false);
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /empty/);
});

test("sslFor matches the app: TLS for Supabase, nothing forced elsewhere", () => {
  assert.deepEqual(sslFor(SESSION), { rejectUnauthorized: false });
  assert.equal(sslFor("postgresql://postgres:pw@localhost:5432/db"), undefined);
  assert.equal(sslFor("postgresql://postgres:pw@localhost:5432/db?sslmode=disable"), false);
  assert.deepEqual(sslFor("postgresql://postgres:pw@10.0.0.5:5432/db?sslmode=require"), { rejectUnauthorized: false });
});

test("pg errors get a plain-English cause", () => {
  assert.match(explainError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND x" }, SESSION).cause, /DNS/);
  assert.match(explainError({ message: "password authentication failed for user \"postgres\"" }, SESSION).cause, /rejected the password/);
  assert.match(explainError({ message: "Connection terminated unexpectedly" }, SESSION).cause, /pooler closed the connection/);
  assert.match(explainError({ code: "28P01", message: "invalid_password" }, SESSION).cause, /password/i);
});

test("nothing sensitive survives redaction", () => {
  const leaked = "connection to postgresql://postgres.abcdefghijklmnopqrst:S3cret%2Fp%40ss@aws-0-eu-central-1.pooler.supabase.com:5432/postgres failed";
  const output = redact(leaked, SESSION);
  // The marker itself contains "postgresql://", so check the parts that
  // actually identify the project: password, project ref, and host.
  assert.doesNotMatch(output, /S3cret/);
  assert.doesNotMatch(output, /abcdefghijklmnopqrst/);
  assert.doesNotMatch(output, /pooler\.supabase\.com/);
  assert.match(output, /<redacted>/);

  // A bare password echoed by the driver must also be scrubbed.
  assert.doesNotMatch(redact('password authentication failed for user "postgres.abcdefghijklmnopqrst"', SESSION), /abcdefghijklmnopqrst/);
  assert.doesNotMatch(redact("FATAL: password authentication failed (S3cret%2Fp%40ss)", SESSION), /S3cret/);
});
