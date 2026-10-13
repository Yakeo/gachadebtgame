// Prints a secret-safe report of how the Supabase + Vercel deployment is
// configured, and emits GitHub Actions annotations so the result is readable
// on the run page (and through the API) even when raw logs are not accessible.
//
// Usage:
//   node scripts/diagnose-supabase.mjs              # report + live connection test
//   node scripts/diagnose-supabase.mjs --no-connect # report only (used as the deploy preflight)
//
// Exit code is 1 when something is missing or clearly misconfigured, so a
// workflow can fail fast with a useful message instead of a 30s cryptic one.
//
// SECRECY: this script never prints a connection string, password, or project
// ref — only whether a secret is set and what *shape* it has.
import { Client } from "pg";

import { annotate, classifyUrl, explainError, SUPABASE_TABLES } from "./lib/supabase-diag.mjs";

const connectEnabled = !process.argv.includes("--no-connect");

const values = {
  SUPABASE_SESSION_URL: process.env.SUPABASE_SESSION_URL ?? "",
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL ?? "",
  VERCEL_TOKEN: process.env.VERCEL_TOKEN ?? "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
};

// Secrets saved under a non-standard name show up as "missing" everywhere
// else; listing the usual suspects makes that mistake obvious immediately.
const ALIASES = [
  "SUPABASE_DIRECT_URL",
  "SUPABASE_SESSION_POOLER_URL",
  "SUPABASE_POOLER_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_URL",
  "DATABASE_URL",
  "DIRECT_URL",
].filter((name) => (process.env[name] ?? "").trim().length > 0);

const problems = [];
const say = (line = "") => console.log(line);

say("Supabase / Vercel configuration report");
say("======================================");
say("Secrets in this repository (via Actions secrets -> environment):");
for (const [name, value] of Object.entries(values)) {
  say(`  ${value.trim() ? "set    " : "MISSING"}  ${name}`);
}
if (ALIASES.length > 0) {
  say(`  also set (non-standard names, ignored by the workflow): ${ALIASES.join(", ")}`);
}
say("");

const session = classifyUrl(values.SUPABASE_SESSION_URL, {
  role: "ddl",
  label: "secret SUPABASE_SESSION_URL",
});
const runtime = classifyUrl(values.SUPABASE_DATABASE_URL, {
  role: "runtime",
  label: "secret SUPABASE_DATABASE_URL",
});

for (const [name, result] of [
  ["SUPABASE_SESSION_URL", session],
  ["SUPABASE_DATABASE_URL", runtime],
]) {
  say(`${name}: ${result.present ? (result.ok ? "shape looks OK" : "shape looks WRONG") : "not set"}`);
  for (const note of result.notes) say(`  note: ${note}`);
  for (const problem of result.problems) say(`  PROBLEM: ${problem}`);
  say("");
}

if (!values.VERCEL_TOKEN.trim()) {
  problems.push("Repository secret VERCEL_TOKEN is missing or empty — every Vercel step will fail without it.");
}
problems.push(...session.problems, ...runtime.problems);

if (connectEnabled && session.present) {
  say("Live connection test (schema/session connection)…");
  const client = new Client({
    connectionString: values.SUPABASE_SESSION_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      `select tablename from pg_tables where schemaname = 'public' and tablename = any($1) order by tablename`,
      [SUPABASE_TABLES],
    );
    const found = rows.map((row) => row.tablename);
    const missing = SUPABASE_TABLES.filter((table) => !found.includes(table));
    say(`  connected OK as the configured role.`);
    say(`  game tables present: ${found.length ? found.join(", ") : "(none)"}`);
    if (missing.length > 0) {
      say(`  MISSING: ${missing.join(", ")} — run: npm run db:supabase`);
      annotate(
        "notice",
        "Supabase reachable, tables missing",
        `Connection works but these tables do not exist yet: ${missing.join(", ")}. The deploy's schema step will create them.`,
      );
    }
    say("");
  } catch (error) {
    const { code, message, cause } = explainError(error, values.SUPABASE_SESSION_URL);
    say(`  FAILED (${code}): ${message}`);
    say(`  Likely cause: ${cause}`);
    say("");
    problems.push(`Live connection to Supabase failed (${code}): ${message} — ${cause}`);
  } finally {
    await client.end().catch(() => {});
  }
} else if (connectEnabled) {
  say("Skipping the live connection test (no session URL to test with).");
  say("");
}

if (problems.length > 0) {
  const summary = [
    "The deployment is misconfigured:",
    ...problems.map((problem, index) => `${index + 1}. ${problem}`),
    "",
    "Fix the repository secrets (Settings -> Secrets and variables -> Actions) and re-run this workflow.",
    "Expected shape: postgresql://postgres.<project-ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres?sslmode=require",
  ].join("\n");
  console.error("");
  // Not redacted: every server-supplied string already went through
  // explainError(), which redacts. The rest is written by this file.
  console.error(summary);
  annotate("error", "Supabase configuration problem", summary);
  process.exit(1);
}

say("Everything checked out.");
annotate("notice", "Supabase configuration OK", "Secrets are present, well-formed, and the connection test passed.");
