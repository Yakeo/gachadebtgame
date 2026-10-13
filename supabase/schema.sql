-- Gacha Debt — Supabase schema
-- ============================================================================
-- This is the README's "create the tables" step, adapted for Supabase.
-- It creates exactly the tables defined in src/db/schema.ts
-- (auth_limits, game_saves, game_sessions, game_users).
--
-- HOW TO RUN (pick one):
--   A) Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--      Safe to re-run: everything is IF NOT EXISTS / idempotent.
--   B) From this repo, with DIRECT_URL set in .env (session/direct
--      connection, port 5432 — NOT the transaction pooler):
--          npm run db:push
--      (scripts/setup.mjs + `drizzle-kit push` do the same thing.)
--
-- The game connects directly to Postgres as the `postgres` role from
-- server-only code (src/db/index.ts). It never uses Supabase's anon /
-- service-role API keys, so no PostgREST policies are needed. RLS is
-- enabled below with NO public policies on purpose: it stops anyone from
-- reading these tables through Supabase's public Data API (anon key),
-- while the direct Postgres connection used by the game (table owner,
-- bypasses RLS) keeps working. Do NOT add permissive policies and do NOT
-- expose DATABASE_URL to the browser.
-- ============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (incl. every Supabase
-- project), so no extension is required for the uuid defaults below.

create table if not exists "auth_limits" (
  "key" text primary key not null,
  "attempts" integer default 1 not null,
  "reset_at" timestamp not null
);

create table if not exists "game_users" (
  "id" uuid primary key default gen_random_uuid() not null,
  "email" text,
  "password_hash" text,
  "google_id" text,
  "name" text default 'President' not null,
  "guest" boolean default true not null,
  "created_at" timestamp default now() not null,
  constraint "game_users_email_unique" unique ("email"),
  constraint "game_users_google_id_unique" unique ("google_id")
);

create table if not exists "game_saves" (
  "user_id" uuid primary key not null,
  "data" jsonb not null,
  "updated_at" timestamp default now() not null
);

create table if not exists "game_sessions" (
  "token" text primary key not null,
  "user_id" uuid not null,
  "expires_at" timestamp not null
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_saves_user_id_game_users_id_fk') then
    alter table "game_saves"
      add constraint "game_saves_user_id_game_users_id_fk"
      foreign key ("user_id") references "public"."game_users" ("id")
      on delete cascade on update no action;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'game_sessions_user_id_game_users_id_fk') then
    alter table "game_sessions"
      add constraint "game_sessions_user_id_game_users_id_fk"
      foreign key ("user_id") references "public"."game_users" ("id")
      on delete cascade on update no action;
  end if;
end $$;

-- Lock the tables down from Supabase's public Data API (see header note).
alter table "auth_limits"   enable row level security;
alter table "game_users"    enable row level security;
alter table "game_saves"    enable row level security;
alter table "game_sessions" enable row level security;

-- Sanity check — should list the 4 game tables:
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public' order by tablename;
