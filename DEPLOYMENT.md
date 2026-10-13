# Deploying Gacha Debt — Vercel + Supabase

The game is a Next.js app that **will not run without PostgreSQL**
(README §2–4: "The game will not start without a database").
Supabase provides that PostgreSQL; Vercel hosts the app.

```
Browser ──▶ Vercel (Next.js, this repo) ──▶ Supabase Postgres
                                              • DATABASE_URL  → transaction pooler :6543 (runtime)
                                              • DIRECT_URL    → session/direct    :5432 (drizzle-kit only)
```

Nothing in this repo uses Supabase Auth / Storage / the anon key — the app
talks to Postgres directly from server-only code (`src/db/index.ts`), exactly
as it did with a local PostgreSQL. So a Supabase *project* is all you need.

---

## 1. Supabase: create the tables

You need a Supabase project (supabase.com → New project). Note the
**database password** you set at creation — you'll need it below, and
Supabase only shows connection strings with a `[YOUR-PASSWORD]` placeholder.

### 1a. Get the two connection strings

Dashboard → **Project Settings → Database → Connection string**:

| String | Supabase tab | Port | Used for |
|---|---|---|---|
| `DATABASE_URL` | **Transaction** pooler | 6543 | The running game (Vercel + local dev) |
| `DIRECT_URL` | **Session** pooler (or Direct) | 5432 | `drizzle-kit push/migrate` only — creating/altering tables |

Both look like
`postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:<port>/postgres`.
Add `?sslmode=require` if it isn't there already.

> Why two? The transaction pooler multiplexes many serverless instances onto
> few real connections, but it cannot run DDL / prepared statements.
> drizzle-kit therefore needs the session/direct connection, while the game
> itself should use the transaction pooler. (`drizzle.config.ts` already
> prefers `DIRECT_URL`; `src/db/index.ts` already uses a 1-connection pool
> with TLS forced for `*.supabase.co` hosts.)

### 1b. Create the tables (pick ONE)

**Option A — SQL Editor (no repo checkout needed):**
Dashboard → **SQL Editor → New query** → paste the contents of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.
It creates `game_users`, `game_sessions`, `game_saves`, `auth_limits`
(the tables from `src/db/schema.ts`) and is safe to re-run.

**Option B — from this repo:**
```bash
cp .env.example .env   # fill in DATABASE_URL + DIRECT_URL
npm install
npm run db:push        # = npx drizzle-kit push, via DIRECT_URL
```

Either way, verify in Dashboard → **Table Editor** that the 4 tables exist.
The SQL option also enables Row Level Security with no public policies:
that blocks reads via Supabase's public Data API while the game's direct
Postgres connection keeps working. Don't add permissive policies.

## 2. Vercel: deploy

### Option 0 — GitHub Actions (automated, what this repo is set up for)

`.github/workflows/deploy.yml` does everything on a GitHub runner:
applies `supabase/schema.sql`, creates/links the Vercel project, sets
`DATABASE_URL` / `DIRECT_URL` / `APP_URL`, deploys, and verifies
`/api/health`. It needs three repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `SUPABASE_DATABASE_URL` | Transaction pooler (`:6543`) connection string |
| `SUPABASE_SESSION_URL` | Session pooler (`:5432`) connection string |
| `VERCEL_TOKEN` | Token from vercel.com/account/tokens |

Then merge to `main` (pushes to `main` auto-run it) or run it manually
from the **Actions** tab. Note the session pooler string differs from
the direct string only in host/port/user:
`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.

### Option 1 — GitHub integration (set-and-forget)

1. Push this repo to GitHub (already done for `Yakeo/gachadebtgame`).
2. [vercel.com/new](https://vercel.com/new) → import the repo.
   Framework preset **Next.js** is auto-detected; `vercel.json` pins the
   install/build commands. No other build settings needed (Node ≥ 20,
   from `package.json` → `engines`).
3. Add the environment variables from §3 **before** the first deploy
   finishes if you can; otherwise add them and redeploy.
4. Every push to the connected branch then auto-deploys.

### Option 2 — Vercel CLI

```bash
npm i -g vercel
vercel link          # create/link the project
vercel env add DATABASE_URL production    # paste the :6543 string
vercel env add DIRECT_URL production      # paste the :5432 string
vercel env add APP_URL production         # https://<your-app>.vercel.app
# optional Google vars — see §4
vercel deploy --prod
```

The resulting URL will be like `https://<project>.vercel.app` — put that
exact value in `APP_URL` and redeploy once if you guessed it beforehand.

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Production value | Required |
|---|---|---|
| `DATABASE_URL` | Supabase **transaction** pooler (`:6543`, `?sslmode=require`) | ✅ |
| `DIRECT_URL` | Supabase **session/direct** (`:5432`) — only needed if you ever run drizzle-kit against prod from CI/your machine; harmless to set | Recommended |
| `APP_URL` | `https://<your-production-domain>` (no trailing slash) | ✅ for Google |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console (§4) | Only for Google sign-in |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (§4) | Only for Google sign-in |
| `DB_POOL_MAX` | Leave unset (= 1 per instance) | No |

Never commit these. `.env` is git-ignored; `.env.example` documents the
shapes only. `DATABASE_URL` must never be exposed to the browser — in this
codebase it is only read in `src/db/index.ts` (server-only).

## 4. Google sign-in (production)

Email + guest login work without this. To enable the Google button:

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select
   a project → **APIs & Services → OAuth consent screen** (External; add
   yourself as a test user while in Testing).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized redirect URI** — exactly, using your real Vercel domain:
   ```
   https://<your-production-domain>/api/auth/google/callback
   ```
   (If you also develop locally, add `http://localhost:3000/api/auth/google/callback` as a second URI.)
4. Put the client ID/secret in Vercel env (§3), set `APP_URL` to the same
   domain, and redeploy. The redirect URI Google checks is built as
   `{APP_URL}/api/auth/google/callback` (`src/app/api/auth/google/callback/route.ts`),
   so `APP_URL` must match the domain players actually visit — including any
   custom domain; if you attach a custom domain later, update `APP_URL`,
   add the new redirect URI in Google Console, and redeploy.

## 5. Verify the deployment

1. Open `https://<your-domain>/api/health` → expect `{"ok":true}`.
   (`{"ok":false}`/500 = the app can't reach Supabase — see §6.)
2. Open the site: the boot sequence waits for `/api/health`, then
   **Tap anywhere to start** → sign-in screen. Choose **Play as guest**,
   do a recruit pull, reload — progress must survive (it's in
   `game_saves`). Register an account and confirm a row appears in
   Supabase → Table Editor → `game_users`.
3. If Google is enabled, the Google button should no longer be disabled.

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `DATABASE_URL is required` in Vercel logs | Env var missing for the Production environment, or added after the deploy. Add it, then **Redeploy**. |
| `/api/health` → `{"ok":false}` | Wrong password (URL-encode special chars, e.g. `@` → `%40`), wrong pooler host/region, or tables not created (§1b). Check Vercel → Logs for the pg error. |
| `prepared statement ... already exists` / drizzle-kit fails | You pointed drizzle-kit at the `:6543` transaction pooler. Use `DIRECT_URL` (`:5432`) — `drizzle.config.ts` already prefers it. |
| `no pg_hba.conf entry ... SSL off` / connection terminated | TLS not on. Supabase requires SSL; keep `?sslmode=require` and the Supabase host in `DATABASE_URL` (the app forces TLS for `*.supabase.co`). |
| Too many connections / `max clients` errors | A pool got enlarged. Keep `DB_POOL_MAX` unset/1 and use the **transaction** pooler at runtime, not the direct connection. |
| Google: `redirect_uri_mismatch` | The URI in Google Console ≠ `{APP_URL}/api/auth/google/callback` exactly (scheme, domain, no trailing slash). Fix + redeploy. |
| Progress disappears | Guest saves live in the DB but are tied to the guest session cookie; register to keep them. If even account saves vanish, §1b wasn't run on this project. |
| Changed `src/db/schema.ts` | Re-run `npm run db:push` (with `DIRECT_URL`) or re-run `supabase/schema.sql`, then redeploy. `npm run db:generate` refreshes `drizzle/`. |

## Pre-existing note (not a deploy blocker)

The repo references key art at `public/images/*.jpg`
(`council-keyart.jpg`, `academy.jpg`, `splash-*.jpg`, `midnight-banner.jpg`)
but ships no `public/` folder, so those `<img>`s 404 (broken-image icon over
the CSS gradients) until the art is dropped in with those file names, as the
README's "Change the game" table describes. The game logic, auth, and saves
are unaffected.
