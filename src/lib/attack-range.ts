import { CHARACTER_PROFILES, type CombatClass } from "./character-stats";

/**
 * Melee and ranged are different attacks, not the same attack with different art.
 *
 * Every strike used to carry the fighter across the arena - Penelope's pan and
 * Purp's grimoire arrived the same way, so a mage closed to arm's length and
 * swung a book at someone. The user's note was blunt: "characters that seem to
 * be magic based or ranged aren't attacking as ranged units, they're attacking
 * like melees."
 *
 * Now the range decides the choreography:
 *   melee  - crosses the arena and lands the blow on contact (unchanged).
 *   ranged - plants their feet, casts, and sends something across the gap.
 *            The projectile is a simple CSS animation with its own kind:
 *            arrow, bolt, orb, card, note or vial. It reaches the enemy on the
 *            same contact frame the melee dash does, so hit reactions, impact
 *            flashes and damage numbers stay in sync for both.
 *
 * Class sets the default, because it is the honest first guess: arcanists cast,
 * rangers shoot, warriors and vanguards close the distance. A character whose
 * weapon disagrees with their class is listed below with the reason, because
 * the weapon is what the player can actually see on the battlefield.
 */
export type AttackRange = "melee" | "ranged";
export type ProjectileKind = "arrow" | "bolt" | "orb" | "card" | "note" | "vial";

const CLASS_RANGE: Record<CombatClass, AttackRange> = {
  Vanguard: "melee",
  Warrior: "melee",
  Ranger: "ranged",
  Arcanist: "ranged",
  Support: "ranged",
};

/** Weapons that contradict the class default. */
const RANGE_OVERRIDES: Record<string, { range: AttackRange; why: string }> = {
  // Ranger, but holding a welding hammer: he walks over and hits things.
  flint: { range: "melee", why: "Welding hammer" },
  // Support with a ceremonial staff: the smite is a downward jab at arm's length.
  solari: { range: "melee", why: "Staff smite" },
  // Ranger, but a clockwork cat: it pounces rather than shoots.
  cat: { range: "melee", why: "Pounce" },
  // Support, but the emergency sandwich is delivered personally.
  mreats: { range: "melee", why: "Sandwich, at close range" },
  // Support, but a tea knight's kettle is a melee weapon.
  teacup: { range: "melee", why: "Kettle and claws" },
};

/** What each ranged fighter throws. */
const PROJECTILES: Record<string, ProjectileKind> = {
  ynna: "bolt", vesper: "bolt", byte: "bolt",
  angelina: "orb", purp: "orb", reroom: "orb", sorcerer: "orb", cobalt: "orb",
  morrow: "orb", alice: "orb", takobuddy: "orb", moth: "orb", maribel: "orb",
  bluecap: "orb", hokusai: "orb",
  vane: "card", quill: "card", seraphine: "card", ninette: "card", kidjester: "card",
  lumi: "note", bell: "note",
  mira: "vial",
  pip: "arrow",
};

const CLASS_PROJECTILE: Record<CombatClass, ProjectileKind> = {
  Vanguard: "orb",
  Warrior: "orb",
  Ranger: "arrow",
  Arcanist: "orb",
  Support: "note",
};

/** The class a character fights as, or Warrior for a stranger. */
export function combatClassOf(id: string): CombatClass {
  return CHARACTER_PROFILES[id]?.[0] ?? "Warrior";
}

export function attackRangeOf(id: string): AttackRange {
  return RANGE_OVERRIDES[id]?.range ?? CLASS_RANGE[combatClassOf(id)];
}

export function isRanged(id: string): boolean {
  return attackRangeOf(id) === "ranged";
}

/** Only meaningful for ranged fighters; melee picks get a harmless default. */
export function projectileKindOf(id: string): ProjectileKind {
  return PROJECTILES[id] ?? CLASS_PROJECTILE[combatClassOf(id)];
}

/** Every character whose weapon overrides their class default, for the docs. */
export const rangeOverrides = RANGE_OVERRIDES;
