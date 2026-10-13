// Applies supabase/schema.sql to a Supabase Postgres database and verifies
// the four game tables exist. Used by .github/workflows/deploy.yml (CI cannot
// reach Supabase on the direct db.* host, which is IPv6-only, so DDL goes
// through the session pooler on port 5432).
//
// Usage:
//   SUPABASE_SESSION_URL=postgresql://...5432/postgres node scripts/apply-supabase-schema.mjs
// Falls back to DIRECT_URL, then DATABASE_URL.
//
// On failure this prints a redacted explanation and raises a GitHub Actions
// annotation, so a broken deploy says *why* on the run page instead of only
// "Process completed with exit code 1".
import { readFileSync } from "node:fs";

import { Client } from "pg";

import { annotate, classifyUrl, explainError } from "./lib/supabase-diag.mjs";

const url =
  process.env.SUPABASE_SESSION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  const message =
    "No connection string found. Set the repository secret SUPABASE_SESSION_URL to the Supabase " +
    "Session pooler string (port 5432) and re-run the workflow. Run the \"Diagnose Supabase config\" " +
    "workflow for a full report.";
  console.error(message);
  annotate("error", "Missing SUPABASE_SESSION_URL", message);
  process.exit(1);
}

// Shape check first: it turns the most common mistakes (placeholder text left
// in, a direct/IPv6 host, the transaction pooler on :6543, an unencoded
// password) into a one-line explanation instead of a raw driver error.
const shape = classifyUrl(url, { role: "ddl", label: "SUPABASE_SESSION_URL" });
for (const note of shape.notes) console.log(`note: ${note}`);
if (!shape.ok) {
  const message = [
    "SUPABASE_SESSION_URL does not look usable for creating tables:",
    ...shape.problems.map((problem) => `- ${problem}`),
  ].join("\n");
  console.error(message);
  annotate("error", "SUPABASE_SESSION_URL looks wrong", message);
  process.exit(1);
}

const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
} catch (error) {
  const { code, message, cause } = explainError(error, url);
  console.error(`Could not connect to Supabase (${code}): ${message}`);
  console.error(`Likely cause: ${cause}`);
  annotate("error", "Supabase connection failed", `(${code}) ${message}\nLikely cause: ${cause}`);
  process.exit(1);
}

try {
  await client.query(sql);
  const { rows } = await client.query(
    `select tablename, rowsecurity from pg_tables
      where schemaname = 'public'
        and tablename in ('game_users','game_sessions','game_saves','auth_limits')
      order by tablename`,
  );
  console.log("Tables in Supabase:");
  for (const r of rows) console.log(`  ${r.tablename} (RLS: ${r.rowsecurity})`);
  if (rows.length !== 4) {
    const message = `Expected 4 game tables, found ${rows.length}. Check the Supabase role has CREATE privileges on schema public.`;
    console.error(message);
    annotate("error", "Schema applied but tables are missing", message);
    process.exit(1);
  }
  console.log("Supabase schema OK.");
} catch (error) {
  const { code, message, cause } = explainError(error, url);
  console.error(`Schema could not be applied (${code}): ${message}`);
  console.error(`Likely cause: ${cause}`);
  annotate("error", "Supabase schema failed", `(${code}) ${message}\nLikely cause: ${cause}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
