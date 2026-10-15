import { baseStatBlock, type CombatClass } from "./character-stats";
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
  color: string; hair: string;
  // `splash` is the in-game model: the pixel sprite drawn on the battlefield,
  // in the roster and in the story. It is NOT the illustration.
  splash?: string;
  // `keyart` is the painted illustration - the expensive one. It is shown where
  // there is room to appreciate it (character detail, recruit banner, pull
  // reveal). Keeping the two separate is what lets the roster keep its pixel
  // models while the character pages get real splash art.
  keyart?: string;
  mechanic?: Mechanic;
  hp: number; attack: number; defense: number; speed: number; combatClass: CombatClass;
  skill: string; ultimate: string; skillNote: string; ultimateNote: string;
  weapon: string; description: string;
};
const characterDefinitions: Omit<Character, "speed" | "combatClass">[] = [
  {
    id: "penelope", name: "Penelope", title: "Certified Kitchen Disaster", rarity: "SSR", element: "Flame", role: "Chaos",
    color: "#ef6ec0", hair: "#e9eef2", splash: "/images/splash-penelope.png", keyart: "/images/keyart-penelope.webp", mechanic: "chaos", weapon: "Cast-Iron Frying Pan",
    hp: 1080, attack: 188, defense: 42,
    skill: "Flambé Special", ultimate: "Kitchen Catastrophe",
    skillNote: "Serves every enemy a different portion with a wooden spoon and vibes, then either feeds the squad or puts the lid on it. She does not measure, and she will not be measuring.",
    ultimateNote: "Five outcomes, one of which is a perfect souffle. She has no idea which one is coming. Neither does the kitchen.",
    description: "Culinary Club, department of one. She was asked to leave the cafeteria. Then the courtyard. Then the west wing. Nobody has ever actually beaten her in a fight, mostly because nobody can predict what the pan is going to do.",
  },
  {
    id: "ruta", name: "Ruta", title: "The Unbroken Line", rarity: "SSR", element: "Steel", role: "Lancer",
    color: "#e0574f", hair: "#8a5a3b", splash: "/images/splash-ruta.png", keyart: "/images/keyart-ruta.webp", mechanic: "pierce", weapon: "Long Lance",
    hp: 1320, attack: 182, defense: 78,
    skill: "Spiral Thrust", ultimate: "Grand Palisade",
    skillNote: "Two precise strikes on one target, and her reach does not always stop where she planned: the thrust sometimes keeps going down the whole line.",
    ultimateNote: "Skewers every hostile in the line and ignores armor entirely. Nothing behind her is safe either.",
    description: "Disciplinary Committee, armed response. She kept the treasury audit from becoming a riot, and never once raised her voice. Ruta does not chase. She plants her feet, and the problem comes to her.",
  },
  {
    id: "purp", name: "Purp", title: "The Midnight Prodigy", rarity: "SSR", element: "Dark", role: "Caster",
    color: "#9b6bed", hair: "#e4e2ea", splash: "/images/splash-purp.png", keyart: "/images/keyart-purp.webp", mechanic: "drain", weapon: "Floating Grimoire",
    hp: 980, attack: 205, defense: 36,
    skill: "Packet Loss", ultimate: "Grand Shadow Arcane",
    skillNote: "Arcane damage to every hostile, and the squad recovers part of what he took. His grimoire does not always close when the spell ends.",
    ultimateNote: "A full arcane cascade across all enemies, returning a large share as squad HP.",
    description: "Former Computer Science Club president, current basement sorcerer. He was permabanned for reading the wrong internal files. His forbidden magic is mostly stolen faculty Wi-Fi and a grimoire that argues with him.",
  },
  {
    id: "edgelord", name: "Edgelord69", title: "Child of the Abyss", rarity: "SSR", element: "Dark", role: "Vanguard",
    color: "#8f9fd4", hair: "#22242f", splash: "/images/splash-edgelord.png", keyart: "/images/keyart-edgelord.webp", mechanic: "riposte", weapon: "Steel Katana",
    hp: 1420, attack: 172, defense: 72,
    skill: "Plastic Eclipse", ultimate: "No More Plastic Swords",
    skillNote: "Cuts straight through armor, and refunds a large share of the energy it costs. He monologues through the swing, and occasionally the monologue is the attack.",
    ultimateNote: "One enormous single-target draw cut that ignores armor, and hits bosses far harder than anything else should.",
    description: "He introduced himself with a plastic katana and a speech about eternal night. Underneath the scarf and the theatrics is the person who holds the doorway so everyone else can keep moving.",
  },
  {
    id: "ynna", name: "Ynna", title: "One More Pull", rarity: "SSR", element: "Wind", role: "Striker",
    color: "#2895ef", hair: "#e7e8ff", splash: "/images/splash-ynna.png", keyart: "/images/keyart-ynna.webp", mechanic: "rateup", weapon: "Blessed Smartphone",
    hp: 1050, attack: 175, defense: 40,
    skill: "Rate-up Rush", ultimate: "All-In: Ten Pull!",
    skillNote: "Builds certainty with every swing: her crit chance climbs the longer she goes without one, then cashes it in.",
    ultimateNote: "The pity counter comes due. Ten hits land as one blow that always crits, and refunds energy on a kill.",
    description: "The council treasurer. An optimist, a loyal friend, and an absolute menace to the semester budget.",
  },
  {
    id: "ninette", name: "Ninette", title: "Keeper of the Ledger", rarity: "SR", element: "Water", role: "Support",
    color: "#30b8c5", hair: "#5a6684", splash: "/images/splash-ninette.png", keyart: "/images/keyart-ninette.jpg", mechanic: "audit", weapon: "Financial Binder",
    hp: 1250, attack: 130, defense: 65,
    skill: "Budget Recovery", ultimate: "Perfectly Balanced",
    skillNote: "Marks a target for audit - the whole squad then bills it 20% harder. This skill collects the open line items and heals the squad for the trouble.",
    ultimateNote: "Every audited target is collected at once at triple rate, and the whole squad is refunded 25 energy.",
    description: "The exhausted student council president. His spreadsheets are impeccable. His blood pressure is not.",
  },
  {
    id: "solari", name: "Solari", title: "The Holy Audit", rarity: "SSR", element: "Light", role: "Healer",
    color: "#d7ad50", hair: "#f8e9b4", splash: "/images/splash-solari.png", keyart: "/images/keyart-solari.webp", mechanic: "sanctify", weapon: "Ceremonial Staff",
    hp: 1150, attack: 150, defense: 55,
    skill: "Divine Reconciliation", ultimate: "Fiscal Purity",
    skillNote: "Reconciles the books and sanctifies the surplus: healing that exceeds a full health bar becomes a shield.",
    ultimateNote: "Fiscal purity - the dead are audited back onto the payroll. Revives a fallen ally and shields everyone.",
    description: "Supreme Arbiter of Fiscal Purity. Carries an oversized staff, an impeccable mustache, and absolutely no tolerance for financial heresy.",
  },
  {
    id: "escanooor", name: "Escanooor", title: "Disciplinary Head", rarity: "SSR", element: "Fire", role: "Guardian",
    color: "#ee815b", hair: "#c66c3d", splash: "/images/splash-escanooor.png", keyart: "/images/keyart-escanooor.webp", mechanic: "detention", weapon: "Disciplinary Gauntlet",
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
  { id: "vane", name: "Director Vane", title: "The Hostile Takeover", rarity: "SSR", element: "Light", role: "Caster", color: "#c9a04a", hair: "#c9c3bb", splash: "/images/splash-vane.png", keyart: "/images/keyart-vane.jpg", mechanic: "takeover", weapon: "Signed Contract", hp: 1080, attack: 196, defense: 48, skill: "Acquisition Clauses", ultimate: "Hostile Takeover", skillNote: "Takes what the enemy has, then takes it back with them.", ultimateNote: "An outright acquisition - every hostile pays, and the squad is funded from the proceeds.", description: "GachaCorp's chief executive. He signs contracts the way other people breathe, and every clause has a hidden fee." },
  { id: "sorcerer", name: "Mysterious Sorcerer", title: "The Fine Print", rarity: "SSR", element: "Dark", role: "Caster", color: "#6f5bd6", hair: "#4a3f7a", splash: "/images/splash-sorcerer.png", keyart: "/images/keyart-sorcerer.jpg", mechanic: "siphon", weapon: "Ledger of Debts", hp: 1000, attack: 190, defense: 42, skill: "Compound Interest", ultimate: "Unpaid Debts Take Form", skillNote: "Siphons a share of the damage he deals back into the ledger - and the ledger pays the squad.", ultimateNote: "Every debt comes due at once, and he pockets a portion of the total.", description: "Nobody has seen the face under the hood, and the faculty insists he has never enrolled. He keeps the whole ledger anyway." },
  { id: "sentry", name: "Sentry", title: "Engineering Project 07", rarity: "R", element: "Lightning", role: "Guardian", color: "#819bb6", hair: "#a7bed1", weapon: "Security Sweep", hp: 1150, attack: 95, defense: 80, skill: "Security Sweep", ultimate: "Maximum Protocol", skillNote: "A single-target strike.", ultimateNote: "A single-target strike.", description: "Built to protect the server. Now protects its friends. Still occasionally asks for library fees." },
  {
    id: "aster",
    name: "Aster",
    title: "After-Hours Cartographer",
    rarity: "SSR",
    element: "Wind",
    role: "Lancer",
    color: "#39b9aa",
    hair: "#153d48",
    weapon: "Surveyor’s Spear",
    hp: 1140,
    attack: 181,
    defense: 48,
    skill: "Contour Cut",
    ultimate: "Campus Without Borders",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Maps the tunnels beneath the academy. The facilities office keeps deleting them.",
    splash: "/images/splash-aster.png",
    keyart: "/images/keyart-aster.jpg"
  },
  {
    id: "vesper",
    name: "Vesper",
    title: "Last Train Treasurer",
    rarity: "SSR",
    element: "Lightning",
    role: "Striker",
    color: "#eeb33f",
    hair: "#31313d",
    weapon: "Conductor’s Baton",
    hp: 1175,
    attack: 184,
    defense: 52,
    skill: "Express Strike",
    ultimate: "End of the Line",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Runs the student night shuttle. Fare evasion is encouraged; corporate checkpoints are not.",
    splash: "/images/splash-vesper.png",
    keyart: "/images/keyart-vesper.webp"
  },
  {
    id: "maribel",
    name: "Maribel",
    title: "Emergency Bloom",
    rarity: "SSR",
    element: "Earth",
    role: "Healer",
    color: "#ec83a9",
    hair: "#914652",
    weapon: "Medic’s Greenhouse",
    hp: 1210,
    attack: 162,
    defense: 56,
    skill: "Petal Dressing",
    ultimate: "Greenhouse Sanctuary",
    skillNote: "Restore the living squad for 160% of attack.",
    ultimateNote: "Restore the living squad for 300% of attack.",
    description: "The greenhouse medic grows remedies in confiscated corporate planters. Every prescription includes a lecture.",
    splash: "/images/splash-maribel.png",
    keyart: "/images/keyart-maribel.webp"
  },
  {
    id: "cobalt",
    name: "Cobalt",
    title: "Unauthorized Broadcast",
    rarity: "SSR",
    element: "Water",
    role: "Caster",
    color: "#3897db",
    hair: "#e6f2ff",
    weapon: "Pirate Radio Rig",
    hp: 1140,
    attack: 190,
    defense: 48,
    skill: "Feedback Loop",
    ultimate: "Flood the Airwaves",
    skillNote: "Deal 165% attack damage to all enemies.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Hijacks campus announcements to read the fine print aloud. Has never once used an indoor voice.",
    splash: "/images/splash-cobalt.png",
    keyart: "/images/keyart-cobalt.webp"
  },
  {
    id: "octavia",
    name: "Octavia",
    title: "The Final Bell",
    rarity: "SSR",
    element: "Steel",
    role: "Guardian",
    color: "#a17edd",
    hair: "#3c284f",
    weapon: "Bell-Tower Shield",
    hp: 1405,
    attack: 181,
    defense: 89,
    skill: "Bell Check",
    ultimate: "All-Campus Alarm",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Keeps the bell tower running after the maintenance budget vanished. Nothing passes her watch unpaid.",
    splash: "/images/splash-octavia.png",
    keyart: "/images/keyart-octavia.webp"
  },
  {
    id: "flint",
    name: "Flint",
    title: "Workshop Wildfire",
    rarity: "SSR",
    element: "Fire",
    role: "Striker",
    color: "#ed7345",
    hair: "#b65e32",
    weapon: "Welding Hammer",
    hp: 1210,
    attack: 184,
    defense: 56,
    skill: "Spark Test",
    ultimate: "Forge the Future",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Builds replacement equipment from repossessed hardware. His warranty is a confident thumbs-up.",
    splash: "/images/splash-flint.png",
    keyart: "/images/keyart-flint.jpg"
  },
  {
    id: "seraphine",
    name: "Seraphine",
    title: "Appeals Committee",
    rarity: "SSR",
    element: "Light",
    role: "Support",
    color: "#e3bd52",
    hair: "#eee1b7",
    weapon: "Annotated Casebook",
    hp: 1140,
    attack: 162,
    defense: 48,
    skill: "Stay of Collection",
    ultimate: "Everyone Gets an Appeal",
    skillNote: "Restore the living squad for 160% of attack.",
    ultimateNote: "Restore the living squad for 300% of attack.",
    description: "Her appeals have overturned three expulsions and one vending-machine price increase. She considers all four equally important.",
    splash: "/images/splash-seraphine.png",
    keyart: "/images/keyart-seraphine.jpg"
  },
  {
    id: "rook",
    name: "Rook",
    title: "Locker-Room Sentinel",
    rarity: "SSR",
    element: "Steel",
    role: "Guardian",
    color: "#e85c65",
    hair: "#273c50",
    weapon: "Reinforced Goalpost",
    hp: 1405,
    attack: 190,
    defense: 89,
    skill: "Hold the Line",
    ultimate: "Home Court Advantage",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "The athletics captain turned the locker room into a shelter for students facing eviction. Try moving him.",
    splash: "/images/splash-rook.png",
    keyart: "/images/keyart-rook.jpg"
  },
  {
    id: "morrow",
    name: "Morrow",
    title: "Overdue at Midnight",
    rarity: "SSR",
    element: "Dark",
    role: "Caster",
    color: "#866de0",
    hair: "#e4d8ef",
    weapon: "Archive Lantern",
    hp: 1210,
    attack: 181,
    defense: 56,
    skill: "Index Hex",
    ultimate: "The Stacks Remember",
    skillNote: "Deal 165% attack damage to all enemies.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "The restricted archive librarian lends forbidden books for free. The books still charge interest.",
    splash: "/images/splash-morrow.png",
    keyart: "/images/keyart-morrow.jpg"
  },
  {
    id: "tala",
    name: "Tala",
    title: "Festival Firework",
    rarity: "SSR",
    element: "Lightning",
    role: "Lancer",
    color: "#e877bc",
    hair: "#332b51",
    weapon: "Firework Lance",
    hp: 1140,
    attack: 184,
    defense: 48,
    skill: "Sparkler Step",
    ultimate: "The Sky Is Our Receipt",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Funds the academy festival with elaborate raffles. Nobody has proved the prizes are technically legal.",
    splash: "/images/splash-tala.png",
    keyart: "/images/keyart-tala.jpg"
  },
  {
    id: "pip",
    name: "Pip",
    title: "Parcel Priority",
    rarity: "SR",
    element: "Wind",
    role: "Striker",
    color: "#65bde8",
    hair: "#ad784c",
    weapon: "Courier Slingshot",
    hp: 1025,
    attack: 151,
    defense: 52,
    skill: "Special Delivery",
    ultimate: "Return to Sender",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Delivers club supplies through windows when the front gates are locked. Signature optional.",
    splash: "/images/splash-pip.png",
    keyart: "/images/keyart-pip.jpg"
  },
  {
    id: "mira",
    name: "Mira",
    title: "Practical Magic Lab",
    rarity: "SR",
    element: "Light",
    role: "Healer",
    color: "#ee9876",
    hair: "#533b31",
    weapon: "Alchemical First-Aid Kit",
    hp: 1060,
    attack: 129,
    defense: 56,
    skill: "Field Remedy",
    ultimate: "Restock the Infirmary",
    skillNote: "Restore the living squad for 160% of attack.",
    ultimateNote: "Restore the living squad for 300% of attack.",
    description: "Her healing lab is accredited by nobody and appreciated by everyone. Labels all the bottles now.",
    splash: "/images/splash-mira.png",
    keyart: "/images/keyart-mira.webp"
  },
  {
    id: "quill",
    name: "Quill",
    title: "Uncensored Edition",
    rarity: "SR",
    element: "Dark",
    role: "Caster",
    color: "#7393ca",
    hair: "#222b39",
    weapon: "Enchanted Fountain Pen",
    hp: 990,
    attack: 145,
    defense: 48,
    skill: "Ink Spill",
    ultimate: "Extra! Extra!",
    skillNote: "Deal 165% attack damage to all enemies.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Prints the student paper on both sides of eviction notices. Refuses to retract a single comma.",
    splash: "/images/splash-quill.png",
    keyart: "/images/keyart-quill.webp"
  },
  {
    id: "brass",
    name: "Brass",
    title: "Maintenance on Call",
    rarity: "SR",
    element: "Steel",
    role: "Guardian",
    color: "#d6a66a",
    hair: "#80654b",
    weapon: "Pipe Wrench Shield",
    hp: 1255,
    attack: 148,
    defense: 89,
    skill: "Pressure Check",
    ultimate: "Nothing Breaks Tonight",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "Keeps the dormitories habitable with borrowed tools and a heroic disregard for procurement rules.",
    splash: "/images/splash-brass.png",
    keyart: "/images/keyart-brass.jpg"
  },
  {
    id: "lumi",
    name: "Lumi",
    title: "Snack-Time Solidarity",
    rarity: "SR",
    element: "Water",
    role: "Support",
    color: "#62c9c1",
    hair: "#e7eef5",
    weapon: "Tea-Service Wand",
    hp: 1060,
    attack: 126,
    defense: 56,
    skill: "Warm Cup",
    ultimate: "Tea for the Whole Council",
    skillNote: "Restore the living squad for 160% of attack.",
    ultimateNote: "Restore the living squad for 300% of attack.",
    description: "The tea club secretary can stretch one snack budget across a whole rebellion. Nobody leaves her table hungry.",
    splash: "/images/splash-lumi.png",
    keyart: "/images/keyart-lumi.jpg"
  },
  {
    id: "altria",
    name: "Altria Pendragon",
    title: "Guest of the Round Table",
    rarity: "UR",
    element: "Light",
    role: "Striker",
    color: "#3c79df",
    hair: "#ebd58b",
    weapon: "Excalibur",
    hp: 1420,
    attack: 238,
    defense: 48,
    skill: "Invisible Air",
    ultimate: "Excalibur: Promised Victory",
    skillNote: "Deal 165% attack damage to one enemy.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "A visiting King of Knights drawn through a faulty summoning terminal. She offers her sword to students defending their home.",
    splash: "/images/splash-altria.png",
    keyart: "/images/keyart-altria.jpg"
  },
  {
    id: "alice",
    name: "Alice",
    title: "Guest Beyond the Looking Glass",
    rarity: "UR",
    element: "Dark",
    role: "Caster",
    color: "#b95a9b",
    hair: "#e7d29a",
    weapon: "Looking-Glass Grimoire",
    hp: 1455,
    attack: 229,
    defense: 52,
    skill: "Looking-Glass Fracture",
    ultimate: "Wonderland Without End",
    skillNote: "Deal 165% attack damage to all enemies.",
    ultimateNote: "Deal 340% attack damage to all enemies.",
    description: "A visitor from a broken fairy tale found wandering the archive. Her borrowed books have endings the librarians do not remember.",
    splash: "/images/splash-alice.png",
    keyart: "/images/keyart-alice.webp"
  },
];
export const ssrFeaturedId = "penelope";
/**
 * Pull probabilities. The engine and the "Rates & details" dialog both read
 * these, so the odds a player is shown are the odds the engine rolls - they
 * cannot drift apart.
 */
export const PULL_RATES = { UR: .001, SSR: .02, SR: .2, R: .779 } as const;
export type PullRarity = keyof typeof PULL_RATES;
/** Share of SSR hits that go to the featured character rather than the pool. */
export const SSR_FEATURED_SHARE = .5;

export const characters: Character[] = characterDefinitions.map(c => ({ ...c, ...baseStatBlock(c) }));

/** The characters available at a rarity, with the featured SSR out of the pool. */
export function pullPool(rarity: string) {
  return characters.filter(c => c.rarity === rarity && (rarity !== "SSR" || c.id !== ssrFeaturedId));
}

/**
 * Per-pull odds for every obtainable character, in the same units the engine
 * uses. The featured character takes SSR_FEATURED_SHARE of SSR hits and the
 * pool splits the rest.
 */
export function pullOdds(): { id: string; rarity: Rarity; chance: number; featured: boolean }[] {
  return characters.map(c => {
    const featured = c.rarity === "SSR" && c.id === ssrFeaturedId;
    const pool = pullPool(c.rarity);
    const share = featured ? SSR_FEATURED_SHARE
      : c.rarity === "SSR" ? (1 - SSR_FEATURED_SHARE) / pool.length
      : 1 / pool.length;
    return { id: c.id, rarity: c.rarity, chance: PULL_RATES[c.rarity as PullRarity] * share, featured };
  });
}
export function characterById(id: string) { return characters.find(c => c.id === id) ?? characters[characters.length - 1]; }
export type OwnedCharacter = { id: string; level: number; potential: number; duplicates: number };
export type Combatant = { id: string; name: string; hp: number; maxHp: number; energy: number; attack: number; defense: number; speed?: number; level?: number; sprite?: string; guard?: boolean; boss?: boolean; shield?: number; audited?: boolean; stunned?: boolean };
export type InitiativeEntry = { side: "ally" | "enemy"; id: string; score: number };
export type EnemyAction = { actor: string; target?: string; damage?: number; skipped?: boolean };
export type Battle = { initiative?: InitiativeEntry[]; initiativeIndex?: number; enemyActions?: EnemyAction[]; balanceVersion?: number; stageId: string; enemies: Combatant[]; allies: Combatant[]; turn: number; active: number; status: "active" | "victory" | "defeat"; log: string[]; lastHit?: { target: string; amount: number; critical: boolean }; streak?: number };
export type GameState = { gems: number; credits: number; energy: number; energyAt: number; pity: number; totalPulls: number; roster: OwnedCharacter[]; squad: string[]; cleared: string[]; claimed: string[]; lastDaily: string | null; battle: Battle | null; pullHistory: { id: string; date: string; rarity: Rarity }[]; choices: Record<string, string>; companion: string };
export type Player = { id: string; name: string; email: string | null; guest: boolean };
export type PullResult = { id: string; rarity: Rarity; duplicate: boolean; guaranteed: boolean };
/**
 * What each character says while they are your home-screen companion.
 *
 * The companion used to be Ynna alone, with four hardcoded lines in the shell.
 * Anyone in the roster can hold the job now, so the lines live here next to the
 * people who say them. Three each: a greeting, a bit of business, and one that
 * is a bad idea. Voices follow `campaign_script.md`.
 */
export const companionQuotes: Record<string, string[]> = {
  aster: ["The short route is under the campus. Bring a torch, not a permission slip.", "I drew a map. Facilities called it a security concern.", "Welcome back. Ready to find a way around the gates?"],
  vesper: ["Last shuttle is leaving. Council members ride free.", "They tried to install a fare meter. I installed a second exit.", "Welcome aboard. No one gets left behind tonight."],
  maribel: ["Sit down. The greenhouse has room for one more patient.", "Those planters were confiscated. The flowers disagree.", "Please stop testing my medicine by jumping off things."],
  cobalt: ["You are listening to the only campus station without a sponsor.", "I read the service agreement on air. They cut the power at clause six.", "Welcome back. Your microphone is live."],
  octavia: ["One bell for class. Three bells for corporate intruders.", "The tower is not for sale. Neither is the view.", "Come up when you need a quiet place. Before I ring anything."],
  flint: ["It works. The smoke is a separate issue.", "Procurement said no. The scrap pile said yes.", "Need a repair? I accept gratitude and replacement fuses."],
  seraphine: ["Denied is not the same thing as final.", "Everyone deserves a hearing. Even the vending machine.", "Bring me their contract. I brought three colors of ink."],
  rook: ["The locker room has spare beds. Nobody sleeps outside.", "We are defending home court. That means everyone.", "Want a warm-up? No debt collectors on my team."],
  morrow: ["Your book is overdue. Its curse is surprisingly punctual.", "The archive does not close. It occasionally vanishes.", "Welcome back. This shelf remembered your name."],
  tala: ["The festival is happening. Budget or no budget.", "The prizes are real. The permit is a work in progress.", "Come watch the fireworks. We earned a little color."],
  pip: ["Signature? Never mind, I already put it through the window.", "Your parcel survived. The packaging made sacrifices.", "Express delivery for the council!"],
  mira: ["This bottle is medicine. That bottle is a lesson.", "I label everything now. Ask the old lab curtains why.", "Welcome back. Let me check those bandages."],
  quill: ["They asked for a retraction. I printed a second edition.", "The truth fits on both sides of a repossession notice.", "Have a story? I have ink."],
  brass: ["That leak is fixed. That other leak is a tomorrow problem.", "I borrowed the wrench. Permanently, if they close the dorms.", "Welcome home. I kept the lights on."],
  lumi: ["One pot of tea, seventeen cups. Watch me.", "The snack budget is small. My portions are not.", "Sit with us. Nobody gets left out of tea."],
  altria: ["My sword is yours while this academy needs defending.", "A king must protect her people, not collect their debts.", "Is the dining hall still open? I would like to thank its cooks."],
  alice: ["The library has a door that was not there yesterday.", "Every story ends. Some simply refuse to stay ended.", "Will you walk with me a little farther?"],
  ynna: [
    "Just one more pull… What could possibly go wrong?",
    "Welcome back! Ninette says we're not allowed near the treasury. Again.",
    "A whole new adventure, and my favorite person to share it with. Ready?",
    "It's not a spending problem. It's a character-building experience!",
  ],
  ninette: [
    "Welcome back. I've already logged this visit under 'miscellaneous expenses.'",
    "The books balance. My patience, less so. What do you need?",
    "Whoever approved that purchase order is answering to me. That's you. That's always you.",
  ],
  penelope: [
    "I made lunch! The fire alarm is just the meal's way of announcing itself.",
    "Don't worry, I measured everything. The pan decided the portions.",
    "The kitchen is fine. The kitchen is FINE. ...Do you own a fire extinguisher?",
  ],
  ruta: [
    "Perimeter secure. Treasury... present. You may proceed.",
    "Rest while it's quiet. It won't stay quiet.",
    "I don't bend. Not the rules, not the lance, and not my schedule.",
  ],
  purp: [
    "The basement is quiet at this hour. Perfect for forbidden research.",
    "I fixed the campus network. Then I improved it. Then it asked me questions.",
    "Sleep is a suggestion. The deadline is a fact.",
  ],
  edgelord: [
    "The abyss gazed back... and then asked for my homework.",
    "Shadow Blade stands ready. Also, do you have snacks?",
    "Eternal night can wait until after the meeting.",
  ],
  solari: [
    "By the sacred ledger, your accounts are... almost acceptable.",
    "A blessing on your pulls. Rates are still rates, of course.",
    "Purity of spirit. Purity of spreadsheets. Both are non-negotiable.",
  ],
  escanooor: [
    "You have my attention. For exactly four minutes.",
    "A deadline is a promise. I collect on promises.",
    "Rest. Tomorrow we train. That wasn't encouragement.",
  ],
  angelina: [
    "A legend never checks the drop table. A legend believes.",
    "Every banner is a stage, darling. Wave to the crowd.",
    "Limited time? Please. I'm limited edition.",
  ],
  byte: [
    "I have admin access and zero supervision. Best combination.",
    "Ping! All systems nominal. Mostly. Don't open the logs.",
    "If it has a terminal, I can befriend it.",
  ],
  shroom: [
    "Hi! I'm helping! ...Am I helping?",
    "Googly eyes: ON. Morale: IMMACULATE.",
    "I was recruited from the west wing. I miss the dust sometimes.",
  ],
  bluecap: [
    "Damp corners are underrated. Five stars. Would loiter again.",
    "Purp says hi. From the basement. Where it's damp. Which is perfect.",
    "I watered the moss. The moss says thanks. We're friends now.",
  ],
  cat: [
    "Purr... That will be three credits in late fees.",
    "Head pats accepted. Overdue books: less so.",
    "The heart ticks, the world turns, the fines compound.",
  ],
  reroom: [
    "I'm not yelling. This is just my voice!",
    "Somebody poked me with a ruler. I remember everything.",
    "Angry? Me? ...Okay, a little. All the time.",
  ],
  vane: [
    "Let's chat. Consider this conversation non-binding. Mostly.",
    "Every clause has a fee. Friendship included.",
    "Sign here. And here. Don't read page nine.",
  ],
  sorcerer: [
    "You've been reading the fine print. Good. Keep reading.",
    "The face under the hood? Trade secret. Ask the ledger.",
    "Everything balances. Eventually. One way or another.",
  ],
  sentry: [
    "Server integrity: 100%. Library fines: still overdue.",
    "Threat level: minimal. Tea level: also minimal. Fix that.",
    "I protect my friends. And the Wi-Fi. Mostly the Wi-Fi.",
  ],
};

/** The companion's lines, falling back to Ynna's if a character has none. */
export function companionLines(id: string): string[] {
  return companionQuotes[id] ?? companionQuotes.ynna;
}

export function initialState(): GameState {
  return { gems: 4800, credits: 25000, energy: 120, energyAt: Date.now(), pity: 0, totalPulls: 0, roster: ["ynna", "ninette", "edgelord"].map(id => ({ id, level: 1, potential: 0, duplicates: 0 })), squad: ["ynna", "ninette", "edgelord"], cleared: [], claimed: [], lastDaily: null, battle: null, pullHistory: [], choices: {}, companion: "ynna" };
}
export function stats(owned: OwnedCharacter) {
  const c = characterById(owned.id);
  const scale = (1 + (owned.level - 1) * .065) * (1 + owned.potential * .05);
  return { hp: Math.round(c.hp * scale), attack: Math.round(c.attack * scale), defense: Math.round(c.defense * scale), speed: c.speed + Math.floor((owned.level - 1) / 10) + owned.potential };
}
export const missions = [
  { id: "first-stage", title: "The first step", description: "Clear your first campaign stage.", goal: 1, kind: "stages", gems: 200, credits: 1000 },
  { id: "chapter-one", title: "A very expensive mistake", description: "Clear all 5 stages of Chapter 01.", goal: 5, kind: "stages", gems: 500, credits: 3000 },
  { id: "first-ten", title: "Just one more pull…", description: "Recruit 10 characters.", goal: 10, kind: "pulls", gems: 320, credits: 1500 },
  { id: "full-squad", title: "Better together", description: "Own 6 different characters.", goal: 6, kind: "roster", gems: 400, credits: 2000 },
  { id: "all-stages", title: "The ledger is balanced", description: "Complete all 25 campaign stages.", goal: 25, kind: "stages", gems: 2000, credits: 15000 },
] as const;
export function missionProgress(state: GameState, kind: string) { return kind === "stages" ? state.cleared.length : kind === "pulls" ? state.totalPulls : state.roster.length; }
