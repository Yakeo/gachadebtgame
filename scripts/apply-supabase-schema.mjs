// Applies supabase/schema.sql to a Supabase Postgres database and verifies
// the four game tables exist. Used by .github/workflows/deploy.yml (this
// sandbox/CI cannot reach Supabase on the direct db.* host, which is
// IPv6-only, so DDL goes through the session pooler on port 5432).
//
// Usage:
//   SUPABASE_SESSION_URL=postgresql://...5432/postgres node scripts/apply-supabase-schema.mjs
// Falls back to DIRECT_URL, then DATABASE_URL.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const url =
  process.env.SUPABASE_SESSION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("Set SUPABASE_SESSION_URL (or DIRECT_URL) to the Supabase session/direct connection string.");
  process.exit(1);
}

const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

await client.connect();
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
    console.error(`Expected 4 game tables, found ${rows.length}.`);
    process.exit(1);
  }
  console.log("Supabase schema OK.");
} finally {
  await client.end();
}
