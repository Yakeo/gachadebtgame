import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Set it to your Supabase Postgres connection string " +
      "(Supabase Dashboard → Project Settings → Database → Connection string → Transaction pooler).",
  );
}

/**
 * Supabase / Vercel notes:
 * - Supabase Postgres requires TLS. Its pooler URL carries `?sslmode=require`,
 *   but node-postgres historically downgrades that to `prefer` semantics on
 *   some versions, so force SSL explicitly for Supabase hosts.
 * - On Vercel each function instance is short-lived and can be multiplied
 *   many times over. A large pool per instance exhausts Supabase connections,
 *   so keep it tiny (1 by default) and rely on Supabase's transaction pooler
 *   (port 6543) to multiplex. Override with DB_POOL_MAX if you know better.
 * - Transactions still work through the transaction pooler: a transaction
 *   pins one pooled connection for its duration (which this app relies on
 *   for `select ... for update` in src/app/api/game/route.ts).
 */
function poolConfig(connectionString: string): PoolConfig {
  let isSupabase = false;
  try {
    const { hostname } = new URL(connectionString);
    isSupabase = hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  } catch {
    // Malformed URL: let `pg` surface the real connection error at query time.
  }

  const max = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);

  return {
    connectionString,
    ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
    max: Number.isFinite(max) && max > 0 ? max : 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

// Cache on globalThis in production too: warm Vercel instances reuse the
// module graph, and a fresh Pool per import would leak connections.
export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? new Pool(poolConfig(databaseUrl));

globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
