export type Rarity = "R" | "SR" | "SSR" | "UR";
export type Mechanic =
  | "standard" | "chaos" | "pierce" | "drain" | "riposte"
  // Story-cast kits. Each one changes how a turn resolves rather than just
  // scaling a number, which is what keeps the roster from feeling interchangeable.
  | "rateup"    // Ynna:            crit chance builds every action, resets when it lands
  | "sanctify"  // Solari:          healing past full becomes a shield
  | "detention" // Escanooor:       guarding hardens the whole squad
  | "audit"     // Ninette:         marks a target, the squad cashes in on it
  | "takeover"  // Director Vane:   takes what the enemy has and banks it
  | "siphon"    // Sorcerer:        copies a share of every point of damage dealt
  ;
export type Character = {
  id: string; name: string; title: string; rarity: Rarity; element: string; role: string;
  color: string; hair: string; splash?: string; mechanic?: Mechanic;
  hp: number; attack: number; defense: number;
  skill: string; ultimate: string; skillNote: string; ultimateNote: string;
  weapon: string; description: string;
};
export const characters: Character[] = [
  {
    id: "penelope", name: "Penelope", title: "Certified Kitchen Disaster", rarity: "SSR", element: "Flame", role: "Chaos",
    color: "#ef6ec0", hair: "#e9eef2", splash: "/images/splash-penelope.png", mechanic: "chaos", weapon: "Cast-Iron Frying Pan",
    hp: 1080, attack: 188, defense: 42,
    skill: "Flambé Special", ultimate: "Kitchen Catastrophe",
    skillNote: "Hits every enemy with a different random amount, then feeds the squad a random amount of HP. She does not measure.",
    ultimateNote: "One of three unpredictable outcomes. She is not sure which one either.",
    description: "Culinary Club, department of one. She was asked to leave the cafeteria. Then the courtyard. Then the west wing. Nobody has ever actually beaten her in a fight, mostly because nobody can predict what the pan is going to do.",
  },
  {
    id: "ruta", name: "Ruta", title: "The Unbroken Line", rarity: "SSR", element: "Steel", role: "Lancer",
    color: "#e0574f", hair: "#8a5a3b", splash: "/images/splash-ruta.png", mechanic: "pierce", weapon: "Long Lance",
    hp: 1320, attack: 182, defense: 78,
    skill: "Spiral Thrust", ultimate: "Grand Palisade",
    skillNote: "Two precise strikes on one target. Reach gives her a second attack that most units simply do not get.",
    ultimateNote: "Skewers every hostile in the line and ignores armor entirely. Nothing behind her is safe either.",
    description: "Disciplinary Committee, armed response. She kept the treasury audit from becoming a riot, and never once raised her voice. Ruta does not chase. She plants her feet, and the problem comes to her.",
  },
  {
    id: "purp", name: "Purp", title: "The Midnight Prodigy", rarity: "SSR", element: "Dark", role: "Caster",
    color: "#9b6bed", hair: "#e4e2ea", splash: "/images/splash-purp.png", mechanic: "drain", weapon: "Floating Grimoire",
    hp: 980, attack: 205, defense: 36,
    skill: "Packet Loss", ultimate: "Grand Shadow Arcane",
    skillNote: "Arcane damage to every hostile, and the squad recovers part of what he took. He calls it routing.",
    ultimateNote: "A full arcane cascade across all enemies, returning a large share as squad HP.",
    description: "Former Computer Science Club president, current basement sorcerer. He was permabanned for reading the wrong internal files. His forbidden magic is mostly stolen faculty Wi-Fi and a grimoire that argues with him.",
  },
  {
    id: "edgelord", name: "Edgelord69", title: "Child of the Abyss", rarity: "SSR", element: "Dark", role: "Vanguard",
    color: "#8f9fd4", hair: "#22242f", splash: "/images/splash-edgelord.png", mechanic: "riposte", weapon: "Steel Katana",
    hp: 1420, attack: 172, defense: 72,
    skill: "Plastic Eclipse", ultimate: "No More Plastic Swords",
    skillNote: "Cuts straight through armor, and refunds a large share of the energy it costs. He intends to keep swinging.",
    ultimateNote: "One enormous single-target draw cut that ignores armor, and hits bosses far harder than anything else should.",
    description: "He introduced himself with a plastic katana and a speech about eternal night. Underneath the scarf and the theatrics is the person who holds the doorway so everyone else can keep moving.",
  },
  {
    id: "ynna", name: "Ynna", title: "One More Pull", rarity: "SSR", element: "Wind", role: "Striker",
    color: "#2895ef", hair: "#e7e8ff", splash: "/images/splash-ynna.png", mechanic: "rateup", weapon: "Blessed Smartphone",
    hp: 1050, attack: 175, defense: 40,
    skill: "Rate-up Rush", ultimate: "All-In: Ten Pull!",
    skillNote: "Builds certainty with every swing: her crit chance climbs the longer she goes without one, then cashes it in.",
    ultimateNote: "The pity counter comes due. Ten hits land as one blow that always crits, and refunds energy on a kill.",
    description: "The council treasurer. An optimist, a loyal friend, and an absolute menace to the semester budget.",
  },
  {
    id: "ninette", name: "Ninette", title: "Keeper of the Ledger", rarity: "SR", element: "Water", role: "Support",
    color: "#30b8c5", hair: "#5a6684", splash: "/images/splash-ninette.png", mechanic: "audit", weapon: "Financial Binder",
    hp: 1250, attack: 130, defense: 65,
    skill: "Budget Recovery", ultimate: "Perfectly Balanced",
    skillNote: "Marks a target for audit - the whole squad then bills it 20% harder. This skill collects the open line items and heals the squad for the trouble.",
    ultimateNote: "Every audited target is collected at once at triple rate, and the whole squad is refunded 25 energy.",
    description: "The exhausted student council president. His spreadsheets are impeccable. His blood pressure is not.",
  },
  {
    id: "solari", name: "Solari", title: "The Holy Audit", rarity: "SSR", element: "Light", role: "Healer",
    color: "#d7ad50", hair: "#f8e9b4", splash: "/images/splash-solari.png", mechanic: "sanctify", weapon: "Ceremonial Staff",
    hp: 1150, attack: 150, defense: 55,
    skill: "Divine Reconciliation", ultimate: "Fiscal Purity",
    skillNote: "Reconciles the books and sanctifies the surplus: healing that exceeds a full health bar becomes a shield.",
    ultimateNote: "Fiscal purity - the dead are audited back onto the payroll. Revives a fallen ally and shields everyone.",
    description: "Supreme Arbiter of Fiscal Purity. Carries an oversized staff, an impeccable mustache, and absolutely no tolerance for financial heresy.",
  },
  {
    id: "escanooor", name: "Escanooor", title: "Disciplinary Head", rarity: "SSR", element: "Fire", role: "Guardian",
    color: "#ee815b", hair: "#c66c3d", splash: "/images/splash-escanooor.png", mechanic: "detention", weapon: "Disciplinary Gauntlet",
    hp: 1650, attack: 165, defense: 90,
    skill: "Final Warning", ultimate: "Office Liquidation",
    skillNote: "Final Warning: a heavy strike that shields the entire squad with his own guard, not just himself.",
    ultimateNote: "Office Liquidation: a critical 3.2x strike that detains the target - a detained enemy is locked out and loses its next turn entirely.",
    description: "He gave the council a deadline, not a death sentence. There may be more to his ultimatum than it seems.",
  },
  {
    id: "angelina", name: "Angelina", title: "The Banner Legend", rarity: "UR", element: "Light", role: "Striker",
    color: "#ed87b8", hair: "#f4b1ce", weapon: "Starlight Rapier",
    hp: 1400, attack: 235, defense: 70,
    skill: "Starlight Echo", ultimate: "A Thousand Wishes",
    skillNote: "A powerful single-target strike.",
    ultimateNote: "An overwhelming single-target strike.",
    description: "A dazzling legend from a very expensive banner.",
  },
  {
    id: "byte", name: "Byte", title: "The Campus Debugger", rarity: "SR", element: "Lightning", role: "Caster",
    color: "#44b7b7", hair: "#78d6d1", weapon: "Salvaged Tablet",
    hp: 1000, attack: 160, defense: 40,
    skill: "Hotfix", ultimate: "System Reboot",
    skillNote: "Arcane damage to all enemies.",
    ultimateNote: "Heavy arcane damage to all enemies.",
    description: "A small robotics club helper with a large collection of suspiciously useful admin passwords.",
  },
  { id: "shroom", name: "Spun Shroom", title: "Just a Little Guy", rarity: "R", element: "Earth", role: "Guardian", color: "#a2b768", hair: "#b0bc77", weapon: "Spore Cloud", hp: 900, attack: 100, defense: 60, skill: "Spore Surprise", ultimate: "Mushroom Mayhem", skillNote: "A single-target strike.", ultimateNote: "A single-target strike.", description: "Has googly eyes. Will absolutely weaponize them. Recruited from the old west wing." },
  { id: "bluecap", name: "Blue Cap", title: "Basement Bestie", rarity: "R", element: "Water", role: "Support", color: "#59a7da", hair: "#67b7eb", weapon: "Cooling Mist", hp: 850, attack: 110, defense: 45, skill: "Cooling Spores", ultimate: "Blue Bloom", skillNote: "Restores the whole squad's HP.", ultimateNote: "Restores the whole squad's HP.", description: "Purp's original roommate. A reliable little mushroom with impeccable taste in damp corners." },
  { id: "cat", name: "Clockwork Cat", title: "A Cursed Little Baby", rarity: "R", element: "Dark", role: "Striker", color: "#8b88b5", hair: "#45405e", weapon: "Clockwork Pounce", hp: 800, attack: 135, defense: 35, skill: "Tick-Tock Pounce", ultimate: "Nine Lives, No Fees", skillNote: "A single-target strike.", ultimateNote: "A single-target strike.", description: "An occult experiment with a clockwork heart. Accepts head pats, refuses overdue library fees." },
  { id: "reroom", name: "Reroom", title: "Tiny Temper", rarity: "R", element: "Fire", role: "Caster", color: "#e97878", hair: "#e97878", weapon: "Rage Spores", hp: 800, attack: 125, defense: 35, skill: "Rage Spores", ultimate: "Big Red Bloom", skillNote: "Arcane damage to all enemies.", ultimateNote: "Arcane damage to all enemies.", description: "A surprisingly angry mushroom. Please do not poke it with a ruler." },
  { id: "vane", name: "Director Vane", title: "The Hostile Takeover", rarity: "SSR", element: "Light", role: "Caster", color: "#c9a04a", hair: "#c9c3bb", splash: "/images/splash-vane.png", mechanic: "takeover", weapon: "Signed Contract", hp: 1080, attack: 196, defense: 48, skill: "Acquisition Clauses", ultimate: "Hostile Takeover", skillNote: "Takes what the enemy has, then takes it back with them.", ultimateNote: "An outright acquisition - every hostile pays, and the squad is funded from the proceeds.", description: "GachaCorp's chief executive. He signs contracts the way other people breathe, and every clause has a hidden fee." },
  { id: "sorcerer", name: "Mysterious Sorcerer", title: "The Fine Print", rarity: "SSR", element: "Dark", role: "Caster", color: "#6f5bd6", hair: "#4a3f7a", splash: "/images/splash-sorcerer.png", mechanic: "siphon", weapon: "Ledger of Debts", hp: 1000, attack: 190, defense: 42, skill: "Compound Interest", ultimate: "Unpaid Debts Take Form", skillNote: "Siphons a share of the damage he deals back into the ledger - and the ledger pays the squad.", ultimateNote: "Every debt comes due at once, and he pockets a portion of the total.", description: "Nobody has seen the face under the hood, and the faculty insists he has never enrolled. He keeps the whole ledger anyway." },
  { id: "sentry", name: "Sentry", title: "Engineering Project 07", rarity: "R", element: "Lightning", role: "Guardian", color: "#819bb6", hair: "#a7bed1", weapon: "Security Sweep", hp: 1150, attack: 95, defense: 80, skill: "Security Sweep", ultimate: "Maximum Protocol", skillNote: "A single-target strike.", ultimateNote: "A single-target strike.", description: "Built to protect the server. Now protects its friends. Still occasionally asks for library fees." },
];
export const ssrFeaturedId = "penelope";
export function characterById(id: string) { return characters.find(c => c.id === id) ?? characters[characters.length - 1]; }
export type OwnedCharacter = { id: string; level: number; potential: number; duplicates: number };
export type Combatant = { id: string; name: string; hp: number; maxHp: number; energy: number; attack: number; defense: number; level?: number; sprite?: string; guard?: boolean; boss?: boolean; shield?: number; audited?: boolean; stunned?: boolean };
export type Battle = { stageId: string; enemies: Combatant[]; allies: Combatant[]; turn: number; active: number; status: "active" | "victory" | "defeat"; log: string[]; lastHit?: { target: string; amount: number; critical: boolean }; streak?: number };
export type GameState = { gems: number; credits: number; energy: number; energyAt: number; pity: number; totalPulls: number; roster: OwnedCharacter[]; squad: string[]; cleared: string[]; claimed: string[]; lastDaily: string | null; battle: Battle | null; pullHistory: { id: string; date: string; rarity: Rarity }[] };
export type Player = { id: string; name: string; email: string | null; guest: boolean };
export type PullResult = { id: string; rarity: Rarity; duplicate: boolean; guaranteed: boolean };
export function initialState(): GameState {
  return { gems: 4800, credits: 25000, energy: 120, energyAt: Date.now(), pity: 0, totalPulls: 0, roster: ["ynna", "ninette", "edgelord"].map(id => ({ id, level: 1, potential: 0, duplicates: 0 })), squad: ["ynna", "ninette", "edgelord"], cleared: [], claimed: [], lastDaily: null, battle: null, pullHistory: [] };
}
export function stats(owned: OwnedCharacter) {
  const c = characterById(owned.id);
  const scale = (1 + (owned.level - 1) * .065) * (1 + owned.potential * .05);
  return { hp: Math.round(c.hp * scale), attack: Math.round(c.attack * scale), defense: Math.round(c.defense * scale) };
}
export const missions = [
  { id: "first-stage", title: "The first step", description: "Clear your first campaign stage.", goal: 1, kind: "stages", gems: 200, credits: 1000 },
  { id: "chapter-one", title: "A very expensive mistake", description: "Clear all 5 stages of Chapter 01.", goal: 5, kind: "stages", gems: 500, credits: 3000 },
  { id: "first-ten", title: "Just one more pull…", description: "Recruit 10 characters.", goal: 10, kind: "pulls", gems: 320, credits: 1500 },
  { id: "full-squad", title: "Better together", description: "Own 6 different characters.", goal: 6, kind: "roster", gems: 400, credits: 2000 },
  { id: "all-stages", title: "The ledger is balanced", description: "Complete all 25 campaign stages.", goal: 25, kind: "stages", gems: 2000, credits: 15000 },
] as const;
export function missionProgress(state: GameState, kind: string) { return kind === "stages" ? state.cleared.length : kind === "pulls" ? state.totalPulls : state.roster.length; }
