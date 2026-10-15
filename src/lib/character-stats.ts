import type { Character } from "./game-data";

export type CombatClass = "Vanguard" | "Warrior" | "Ranger" | "Arcanist" | "Support";
export const CLASS_PROFILES: Record<CombatClass, { hp: number; attack: number; defense: number; speed: number; description: string }> = {
  Vanguard: { hp: 1550, attack: 135, defense: 100, speed: 84, description: "Tank · high HP and defense; slower initiative." },
  Warrior: { hp: 1250, attack: 180, defense: 65, speed: 101, description: "Balanced melee damage and durability." },
  Ranger: { hp: 1000, attack: 180, defense: 40, speed: 116, description: "Fast damage dealer; trades armor for initiative." },
  Arcanist: { hp: 950, attack: 195, defense: 35, speed: 95, description: "Mage · powerful spells with fragile defenses." },
  Support: { hp: 1150, attack: 160, defense: 50, speed: 103, description: "Healing and utility; attack also scales healing." },
};
// Explicit identities, not a hash or rarity-only stat line. Legacy kit roles are
// kept separate so assigning a combat class never changes a character's skills.
export const CHARACTER_PROFILES: Record<string, [CombatClass, number]> = {
  penelope: ["Warrior", -3], ruta: ["Warrior", 5], purp: ["Arcanist", 2], edgelord: ["Warrior", 7],
  ynna: ["Ranger", 2], ninette: ["Support", 4], solari: ["Support", -4], escanooor: ["Vanguard", -2],
  angelina: ["Ranger", 5], byte: ["Arcanist", 7], shroom: ["Vanguard", -6], bluecap: ["Support", -3],
  cat: ["Ranger", 7], reroom: ["Arcanist", -2], vane: ["Arcanist", -3], sorcerer: ["Arcanist", 0],
  sentry: ["Vanguard", -4], aster: ["Warrior", 4], vesper: ["Ranger", 4], maribel: ["Support", 0],
  cobalt: ["Arcanist", 5], octavia: ["Vanguard", -1], flint: ["Ranger", 0], seraphine: ["Support", 6],
  rook: ["Vanguard", 3], morrow: ["Arcanist", -4], tala: ["Warrior", 7], pip: ["Ranger", 3],
  mira: ["Support", 2], quill: ["Arcanist", 3], brass: ["Vanguard", 1], lumi: ["Support", 5],
  altria: ["Warrior", 6], alice: ["Arcanist", 6],
};
export function baseStatBlock(c: Pick<Character, "id" | "hp" | "attack" | "defense" | "rarity">) {
  const [combatClass, speedOffset] = CHARACTER_PROFILES[c.id] ?? ["Warrior", 0];
  const profile = CLASS_PROFILES[combatClass];
  const rarity = { R: .96, SR: 1, SSR: 1.06, UR: 1.1 }[c.rarity];
  return {
    combatClass,
    hp: Math.round((profile.hp * .7 + c.hp * .3) * rarity),
    attack: Math.round((profile.attack * .7 + c.attack * .3) * rarity),
    defense: Math.round((profile.defense * .7 + c.defense * .3) * rarity),
    speed: profile.speed + speedOffset + ({ R: 0, SR: 1, SSR: 2, UR: 3 }[c.rarity]),
  };
}
