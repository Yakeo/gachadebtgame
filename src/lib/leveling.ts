/** Shared pricing for the slider and the authoritative game action. */
export const MAX_CHARACTER_LEVEL = 50;
export const CREDITS_PER_LEVEL = 200;

export function upgradeCost(level: number, levels = 1): number {
  if (!Number.isInteger(level) || level < 1 || level >= MAX_CHARACTER_LEVEL ||
      !Number.isInteger(levels) || levels < 1 || level + levels > MAX_CHARACTER_LEVEL) {
    throw new Error("Choose a valid number of levels, up to level 50.");
  }
  // Sum the existing per-level price: 200L + 200(L+1) + …
  return CREDITS_PER_LEVEL * levels * (2 * level + levels - 1) / 2;
}

export function affordableLevels(level: number, credits: number): number {
  if (!Number.isInteger(level) || level < 1 || level >= MAX_CHARACTER_LEVEL || !Number.isFinite(credits) || credits < 0) return 0;
  let count = 0;
  while (level + count < MAX_CHARACTER_LEVEL && upgradeCost(level, count + 1) <= credits) count++;
  return count;
}
