import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

// drizzle-kit (push / migrate / studio) must NOT go through Supabase's
// transaction pooler (port 6543): DDL + prepared statements need a real
// session. Prefer DIRECT_URL (Supabase: session pooler on port 5432, or the
// direct `db.<project>.supabase.co:5432` connection). The app itself uses
// DATABASE_URL at runtime, which should point at the transaction pooler.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DIRECT_URL (or DATABASE_URL) is missing. Copy .env.example to .env and set your Supabase PostgreSQL connection string.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
