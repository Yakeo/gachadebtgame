import type { GameState } from "./game-data";

/** Floors apply to the equipped squad's mean, not its weakest recruit. */
export const CHAPTER_MIN_LEVELS = [1, 7, 15, 23, 31] as const;
export function chapterMinimumLevel(chapter: number) {
  return CHAPTER_MIN_LEVELS[Math.max(0, Math.min(4, chapter - 1))];
}
export function recommendedLevel(wave: number) {
  return Math.min(50, Math.max(1, Math.round(1 + (wave - 1) * 1.6)));
}
export function squadAverageLevel(state: Pick<GameState, "squad" | "roster">) {
  if (!state.squad.length) return 0;
  return state.squad.reduce((sum, id) => sum + (state.roster.find(c => c.id === id)?.level ?? 1), 0) / state.squad.length;
}

/** Credit rewards track the quadratic cost of leveling a four-person team.
 * Replays are useful training, never a second source of first-clear gems. */
export function campaignCredits(wave: number, firstClear: boolean) {
  const progress = Math.max(1, Math.min(25, Math.floor(wave)));
  return firstClear ? 1500 + progress * 1400 : 600 + progress * 400;
}
