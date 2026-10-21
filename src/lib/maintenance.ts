/**
 * Maintenance mode.
 *
 * The game is OPEN unless somebody deliberately closes it. Patch 0.2 shipped
 * with the doors shut (a rarity realignment, a combat rewrite and two new URs
 * should not land underneath someone mid-battle), and once that deploy was
 * verified the sign came down. The machinery stays: closing the game is one
 * environment variable away, and it still kicks out whoever is playing.
 *
 * Close it with `MAINTENANCE_MODE=on` (Vercel → Project → Settings →
 * Environment Variables, or .env.local). Missing, empty, `off`, `false`, `0`,
 * `no`, `open`, `live` - and any typo - leave the game open: the shutdown is
 * now a deliberate act, so an unrecognised value must not take the game down
 * by accident.
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

/** Values that deliberately close the doors. Anything else leaves them open. */
const CLOSED_FLAGS = new Set(["on", "true", "1", "yes", "y", "maintenance", "closed", "down", "shutdown"]);

/** True only while an operator has explicitly closed the game. */
export function maintenanceEnabled(): boolean {
  const flag = (process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase();
  return CLOSED_FLAGS.has(flag);
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
