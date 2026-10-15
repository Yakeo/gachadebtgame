import type { Battle, InitiativeEntry } from "./game-data";

/** Roll once per living combatant per round, then persist the result. */
export function rollInitiative(battle: Battle, random: () => number): InitiativeEntry[] {
  return (["ally", "enemy"] as const).flatMap(side => (side === "ally" ? battle.allies : battle.enemies)
    .filter(unit => unit.hp > 0).map(unit => ({ side, id: unit.id, score: (unit.speed ?? 100) + Math.floor(random() * 25), tie: random() })))
    .sort((a, b) => b.score - a.score || b.tie - a.tie)
    .map(({ side, id, score }) => ({ side, id, score }));
}
export function enemySpeed(wave: number, sprite: string, boss = false) {
  const offset: Record<string, number> = { "slime-blue": -7, "slime-red": 3, "slime-gold": 14, "slime-cactus": -10, kingslime: -9, shroom: -8, bluecap: -2, reroom: 5, cat: 17, sentry: -5, prime: 10, terminal: -3, enforcer: 4, vane: 9, purp: 2, solari: 0 };
  return 101 + (offset[sprite] ?? 0) + Math.floor((wave - 1) / 5) + (boss ? 3 : 0);
}
