import type { Rarity } from "./game-data";

/**
 * The rarity ladder, in one place.
 *
 * The mistake this module exists to fix: the game treated SSR as if it were the
 * top of the ladder - it was the banner headline, the tier the home carousel
 * advertised, the tier the gold badge and the loudest card treatment belonged
 * to - while UR was presented as a side tier that happened to be pink. UR is
 * the highest rarity there is. SSR sits directly below it.
 *
 * Everything that sorts, labels, colours or explains a rarity reads this file,
 * so the ladder cannot be re-ordered in one screen and left alone in another.
 */
export const RARITY_RANK: Record<Rarity, number> = { R: 1, SR: 2, SSR: 3, UR: 4 };

/** Highest first. This is the order every list, filter and rates table uses. */
export const RARITY_ORDER: Rarity[] = (Object.keys(RARITY_RANK) as Rarity[])
  .sort((a, b) => RARITY_RANK[b] - RARITY_RANK[a]);

export type RarityTier = {
  rarity: Rarity;
  name: string;
  /** One line the rates dialog and the roster legend both show. */
  blurb: string;
  /** Shown as a chip next to the tier name. Only one tier is the top. */
  badge?: string;
};

export const RARITY_TIERS: Record<Rarity, RarityTier> = {
  UR: {
    rarity: "UR",
    name: "Ultra Rare",
    blurb: "The top of the ladder. Cameo legends and the academy's strangest stories.",
    badge: "HIGHEST RARITY",
  },
  SSR: {
    rarity: "SSR",
    name: "Super Special Rare",
    blurb: "One step below UR - still a headline, never the ceiling.",
  },
  SR: { rarity: "SR", name: "Super Rare", blurb: "The dependable middle of the roster." },
  R: { rarity: "R", name: "Rare", blurb: "Where every council starts. Some of them bite." },
};

/** True only for the highest rarity in the game. */
export function isTopRarity(rarity: Rarity): boolean {
  return RARITY_RANK[rarity] === Math.max(...Object.values(RARITY_RANK));
}

/** Rarity of `a` is higher than `b`. */
export function outranks(a: Rarity, b: Rarity): boolean {
  return RARITY_RANK[a] > RARITY_RANK[b];
}

/** Sort highest rarity first, then by name so the order is stable. */
export function byRarity<T extends { rarity: Rarity; name?: string }>(a: T, b: T): number {
  return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || (a.name ?? "").localeCompare(b.name ?? "");
}
