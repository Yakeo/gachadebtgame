# Gacha Debt

A browser game: a visual-novel campaign, turn-based battles, character upgrades, and a 50-pull recruitment guarantee. Accounts and progress are saved in PostgreSQL.

This folder is the complete project. You can unzip it, install it on your computer, and run it locally. You can also push this folder to GitHub.

## What you need

Install these before anything else:

1. **Node.js 20 or newer**, including npm. Check with:

   ```bash
   node -v
   npm -v
   ```

   Download it from [https://nodejs.org](https://nodejs.org) if the command is missing or the version is below 20.

2. **PostgreSQL 14 or newer.** The game will not start without a database. The easiest local login used by the sample config is user `postgres`, password `postgres`, database `gacha_debt`.

You do not need a Google account to play. Email registration works on its own.

## 1. Get the project onto your computer

If you downloaded `gacha-debt.zip`:

```bash
unzip gacha-debt.zip
cd gacha-debt
```

On Windows, right-click the zip, choose **Extract All**, then open that folder in a terminal.

If you cloned it from Git:

```bash
git clone <your-repository-url>
cd gacha-debt
```

The folder name can be anything. All commands below are run from inside that folder.

## 2. Create the database

The database only needs to exist. The game creates its own tables in the next step.

### macOS with Homebrew

```bash
brew install postgresql@16
brew services start postgresql@16
createdb gacha_debt
```

Homebrew often logs you in as your Mac username, not `postgres`. If `createdb` works without a password, use this connection string later:

```text
postgresql://YOUR_MAC_USERNAME@127.0.0.1:5432/gacha_debt
```

### Windows

1. Install PostgreSQL from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/).
2. Remember the password you choose for the `postgres` user.
3. Open **SQL Shell (psql)** from the Start menu and accept the defaults until it asks for the password.
4. Run:

   ```sql
   CREATE DATABASE gacha_debt;
   ```

### Linux

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE gacha_debt;"
```

## 3. Configure the connection

Copy the sample environment file:

```bash
cp .env.example .env
```

Windows Command Prompt:

```bat
copy .env.example .env
```

Open `.env` in any text editor. The important line is:

```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/gacha_debt
```

Change `postgres:postgres` to your real username and password if they are different. Do not add quotes, and do not commit `.env`. It is already ignored by Git.

Leave the Google lines empty for now.

## 4. Install and create the tables

From the project folder:

```bash
node scripts/setup.mjs
```

That command installs the npm packages and creates the account, session, and save tables. You only need to run it once on a new machine.

If you prefer to do the steps yourself:

```bash
npm install
npx drizzle-kit push
```

`drizzle-kit push` should end with a message that the changes were applied. If it says it cannot connect, PostgreSQL is not running or `DATABASE_URL` is wrong. Fix that before continuing. The game cannot save progress without it.

## 5. Start the game

The first screen is not the menu. A visual-novel loading sequence fades through the disclaimers and developer cards while it waits for the server. It will not continue until `/api/health` answers. Then you get **Tap anywhere to start**, and only then the sign-in screen. Register, sign in, or choose **Play as guest**. Signing out returns you to that sign-in screen.

Combat characters already play small idle, entrance, attack, skill, guard, ultimate, hit, and victory motions. Those motions are on a wrapper (`data-anim`) so your future animated character art can replace the temporary drawings without losing the battle timing.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You should see the council-room main menu, not a campaign screen. The first visit creates a guest save in the browser. Register from the profile button at the top if you want that progress kept after you sign out.

Stop the server with `Ctrl+C`.

To check that the database connection works, open [http://localhost:3000/api/health](http://localhost:3000/api/health). A working install returns:

```json
{"ok":true}
```

## 6. Play

- **Register / sign in:** profile button in the header. Guest progress is kept when you create a new account on that same browser. Signing into an existing account loads that account's save instead.
- **Campaign:** 5 chapters, 5 stages each. Every stage has a story before and after the battle.
- **Recruit:** 160 gems per pull, 1,600 for ten. Pull 50 without an SSR or UR and the 50th is guaranteed to be SSR or higher.
- **Rarity:** UR (Ultra Rare) is the highest rarity in the game; SSR sits directly below it, then SR, then R. `src/lib/rarity.ts` owns that order and every badge, filter, sort and rates table reads it.
- **Attack range:** melee fighters dash in and land the blow on contact; casters, healers and rangers hold their ground, cast, and send a projectile that reaches the enemy on the same frame. `src/lib/attack-range.ts` decides who is which, with a stated reason for every weapon that overrides its class.
- **Cameo guests:** the UR pool includes visitors from other games (Ch'en — Arknights; Katsushika Hokusai — Fate/Grand Order). They are ordinary recruits mechanically and are labelled as cameos in the character page.
- **Maintenance mode:** the game ships with the doors shut while a patch lands (`MAINTENANCE_MODE=off` reopens them). See `DEPLOYMENT.md` §8.
- **Characters:** level with credits. Duplicate pulls become potential tokens. Each potential adds 5% to all stats, up to 5. Potential 3 also adds 10% damage.
- **Missions and the daily gift** are claimed once. The daily gift resets at 00:00 UTC.

All gems and credits are fictional. There is no real-money shop.

## Optional: sign in with Google

Skip this section if email login is enough. The Google button stays disabled until both secrets are set.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Go to **APIs & Services → OAuth consent screen**, choose External, and add your email as a test user while the app is in testing.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Choose **Web application**.
5. Add this authorized redirect URI exactly:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

6. Copy the client ID and client secret into `.env`:

   ```text
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   APP_URL=http://localhost:3000
   ```

7. Restart `npm run dev`. The redirect URI must match `APP_URL` plus `/api/auth/google/callback`, including `http` or `https` and with no extra slash.

If a Google account uses an email that already has a password account, sign in with the password first, then use **Connect or sign in with Google** from the account dialog. The game will not silently merge those two accounts.

## Deploy to Vercel + Supabase

For a public deployment (Vercel hosting, Supabase PostgreSQL instead of a
local database), see **[DEPLOYMENT.md](DEPLOYMENT.md)**. In short: run
[`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor (or
`npm run db:push` with `DIRECT_URL` set), set `DATABASE_URL` (transaction
pooler, port 6543), `DIRECT_URL` (session/direct, port 5432) and `APP_URL`
in Vercel, then deploy. Verify at `https://<your-domain>/api/health`.

## Run the production build

Development mode is enough for playing and editing. For the optimized version:

```bash
npm run build
npm run start
```

The production server also uses [http://localhost:3000](http://localhost:3000). On a public host, set `APP_URL` to that public address and add the matching Google redirect URI.

## Put it on GitHub

From the project folder, after [installing Git](https://git-scm.com/):

```bash
git init
git add .
git commit -m "Initial Gacha Debt playable build"
```

Create an empty repository on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_NAME/gacha-debt.git
git branch -M main
git push -u origin main
```

`.env` is ignored. Teammates copy `.env.example` to `.env` on their own machines. Do not upload your Google client secret.

## Change the game

| What you want to change | Where it lives |
| --- | --- |
| Chapter and stage dialogue | `src/lib/campaign.ts` |
| Character names, rarities, and base stats | `src/lib/game-data.ts` |
| Pull rates, pity, rewards, and battle rules | `src/lib/game-engine.ts` |
| Account and Google login | `src/lib/auth.ts` and `src/app/api/auth/` |
| Database tables | `src/db/schema.ts` |
| Menus, recruitment, and roster screens | `src/components/` |
| Key art (backgrounds) | `public/images/` |
| Character art | `public/images/splash-<id>.png` — drop in art and it appears everywhere |
| Placeholder drawings | `Chibi` in `src/components/ui.tsx` (fallback when a character has no art) |

After changing `src/db/schema.ts`, run `npx drizzle-kit push` again.

Character art: the four SSR sprites ship in `public/images/` as
`splash-penelope.png`, `splash-ruta.png`, `splash-purp.png`, and
`splash-edgelord.png`, referenced by the `splash` field in
`src/lib/game-data.ts`. To add art for another character, drop a transparent
PNG at `public/images/splash-<id>.png` and add that `splash` field — `Chibi`
renders it in battle, in the story, on the roster, in pull results, and in
avatars automatically. Only the four SSRs have art so far; every other
character uses the `Chibi` drawing.

Background art is still missing: `public/images/council-keyart.jpg`
(boot screen, home scene) and `public/images/academy.jpg` (battle arena,
story backgrounds, campaign tiles). Until those two files exist, those
slots show the CSS gradients instead. Keep the same names or update the
paths in the components. `npm run test:art` lists anything still missing.

## If something fails

**`DATABASE_URL is required` or `DATABASE_URL is missing`**

You are not in the project folder, or `.env` does not exist. Copy `.env.example` to `.env`.

**`ECONNREFUSED 127.0.0.1:5432`**

PostgreSQL is not running. Start it with `brew services start postgresql@16`, the Windows PostgreSQL service, or `sudo service postgresql start`.

**`database "gacha_debt" does not exist`**

Create it with `createdb gacha_debt` or the SQL in step 2. The name must match the last part of `DATABASE_URL`.

**`password authentication failed`**

The username or password in `DATABASE_URL` does not match PostgreSQL. Special characters in a password must be URL-encoded. For example, `@` becomes `%40`.

**Port 3000 is already in use**

Stop the other server, or start this one with:

```bash
npx next dev -p 3001
```

If you do that, open `http://localhost:3001` and set `APP_URL` to the same address before using Google login.

**Google says `redirect_uri_mismatch`**

The URI in Google Cloud Console must be exactly `{APP_URL}/api/auth/google/callback`. Restart the server after changing `.env`.

**The page loads but progress disappears**

Guest progress is stored in the browser that created it. Register an account to keep it after sign-out. A brand-new guest is created after you sign out.

## Checks you can run

```bash
npx tsx --test tests/game-engine.test.ts
npm run typecheck
npm run build
```

The browser test needs Playwright and a running app:

```bash
npx playwright install chromium
npx playwright test tests/game.smoke.spec.ts --workers=1
```
