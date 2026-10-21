/**
 * Maintenance mode.
 *
 * The game ships with this ON. A patch that changes the rarity ladder, the
 * combat choreography and the UR pool should not be applied underneath someone
 * who is mid-battle, so the first thing this branch does when it deploys is
 * close the door, put Penelope in front of it, and refuse game actions until a
 * human opens it again.
 *
 * Turn it off with `MAINTENANCE_MODE=off` (Vercel → Project → Settings →
 * Environment Variables, or .env.local). Anything else - missing, "true",
 * "1", "lol yes" - leaves it on, because accidentally reopening the game during
 * a migration is worse than accidentally leaving the sign up for an hour.
 *
 * Read through `maintenanceStatus()` rather than at module scope: the value is
 * checked at request time so flipping the env var does not need a rebuild of
 * every module that imported the config.
 */
export type MaintenancePatchNote = { title: string; body: string };

export type MaintenanceInfo = {
  active: boolean;
  patch: string;
  name: string;
  headline: string;
  message: string;
  eta: string;
  startedAt: string;
  notes: MaintenancePatchNote[];
  star: { id: string; name: string; line: string };
};

const BASE = {
  patch: "0.2",
  name: "RARITY REALIGNMENT",
  headline: "Kitchen Catastrophe, Part Two.",
  message:
    "Penelope found the rarity table. She has decided UR is the highest rarity and that the gold badge was on the wrong tier. She has also decided that mages should stop walking into melee range to hit people with books, and she has invited two strangers from other games to live in the UR pool. None of this was approved by the treasurer. All of it is happening.",
  eta: "Back when the smoke clears · patch 0.2 “Rarity Realignment”",
  startedAt: "2026-10-21T00:00:00.000Z",
  notes: [
    {
      title: "UR is the top of the ladder",
      body: "Ultra Rare is now treated as the highest rarity everywhere: badges, pull cards, the rates table and the roster sort. SSR sits directly below it, where it belongs.",
    },
    {
      title: "Ranged fighters stopped walking into melee",
      body: "Casters, healers and rangers hold their ground, cast, and throw something simple across the arena. Melee still dashes in and lands the blow on contact.",
    },
    {
      title: "Two cameo URs moved in",
      body: "Ch’en (Arknights) and Katsushika Hokusai (Fate/Grand Order) joined the UR pool with their own battle models, animations and companion lines.",
    },
    {
      title: "Your save is fine",
      body: "Levels, potential, pity counters and pull history are untouched. The only thing this patch destroyed was the kitchen, and that was already on fire.",
    },
  ],
  star: {
    id: "penelope",
    name: "Penelope",
    line: "I didn’t break the game. I FIXED it. Loudly.",
  },
} as const satisfies Omit<MaintenanceInfo, "active">;

/** True unless the operator explicitly turned maintenance off. */
export function maintenanceEnabled(): boolean {
  const flag = (process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase();
  return !["off", "false", "0", "no", "disabled", "live"].includes(flag);
}

/** The full broadcast, including whether it is on right now. */
export function maintenanceStatus(): MaintenanceInfo {
  return { active: maintenanceEnabled(), ...BASE };
}

/** The payload the API returns while the doors are shut. */
export function maintenancePayload() {
  const status = maintenanceStatus();
  return {
    maintenance: status.active,
    patch: status.patch,
    name: status.name,
    headline: status.headline,
    message: status.message,
    eta: status.eta,
    notes: status.notes,
    star: status.star,
  };
}

/** The message a blocked game action gets. Short: it fits in a toast. */
export const MAINTENANCE_BLOCK_MESSAGE =
  "The council is under maintenance. Penelope is holding the door (and a pan). Please come back shortly.";
