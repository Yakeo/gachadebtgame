/**
 * Campaign script.
 *
 * The script is authored as plain text so the writing stays readable, with two
 * pieces of syntax on top of `Speaker|line`:
 *
 *   CHOICE 1-1|HOW DO YOU RESPOND?     a decision point, inline where it happens
 *   Ninette|...text... [if 1-3==pulls]  a line that only appears given an earlier pick
 *
 * The choices themselves are declared per stage in the `choices` argument, so
 * the options sit next to the scene they belong to. Every choice records its
 * pick on the save under the choice's id, which is what the `[if ...]` markers
 * read. That is the whole branching mechanism: a pick changes what you hear
 * immediately, and later scenes can look back at it.
 *
 * Stage ids are `chapter-number`. Chapters 1 and 2 are complete; the eight
 * unwritten stages (3-3, 3-4, 4-2, 4-3, 4-4, 5-2, 5-3, 5-4) are marked
 * BRIDGE below - written to connect the scenes either side of them, and safe to
 * replace with your own drafts.
 */
export type Flags = Record<string, string>;
export type ScriptLine = {
  speaker: string; text: string;
  when?: (flags: Flags) => boolean;
  /** The raw `[if key==value]` this line was written with, kept so a mistyped
   *  branch can be caught by a test instead of silently never appearing. */
  whenSpec?: string;
};
export type ChoiceOption = { id: string; label: string; reply: ScriptLine[] };
export type ChoicePoint = { id: string; prompt: string; options: ChoiceOption[] };
export type LineEntry = { kind: "line" } & ScriptLine;
export type ChoiceEntry = { kind: "choice" } & ChoicePoint;
export type ScriptEntry = LineEntry | ChoiceEntry;
export type Stage = {
  id: string; chapter: number; number: number; title: string; location: string;
  pre: ScriptEntry[]; post: ScriptEntry[];
  enemies: { name: string; sprite: string; boss?: boolean }[];
  boss: boolean; choices: ChoicePoint[];
};

// Every chapter fights somewhere different, so `battlefield` points at that
// chapter's own arena art. The story screen, the campaign map and the home
// tile follow the same picture, which keeps the whole journey legible.
export const chapters = [
  { id: 1, title: "The Stuco Treasury & The Gacha Debt", short: "The Gacha Debt", subtitle: "One banner. An entire semester's budget. What could possibly go wrong?", color: "#238afa", location: "ACADEMY DISTRICT", battlefield: "/images/academy.jpg" },
  { id: 2, title: "Spores, Servers & The Fungal Underground", short: "The Fungal Underground", subtitle: "The tournament prelims are underground, and the arena is alive.", color: "#a084eb", location: "THE OLD WEST WING", battlefield: "/images/west-wing.jpg" },
  { id: 3, title: "The Supreme Audit & The Sacred Pan", short: "The Supreme Audit", subtitle: "GachaCorp didn't just take the money. They planned to take everything.", color: "#d9b765", location: "SAINT ATHANASIUS CHAPEL", battlefield: "/images/chapel.jpg" },
  { id: 4, title: "Corporate Desolation", short: "Corporate Desolation", subtitle: "No more plastic swords. We end this today.", color: "#f08383", location: "GACHACORP HEADQUARTERS", battlefield: "/images/hq.jpg" },
  { id: 5, title: "The Price of Redemption", short: "The Price of Redemption", subtitle: "The most important things were never behind a rate-up banner.", color: "#7ecbdb", location: "THE ZERO-POINT CORE", battlefield: "/images/core.jpg" },
];
/** The arena art for a chapter, with the academy courtyard as the fallback. */
export function battlefieldFor(chapter: number | undefined) {
  return chapters.find(c => c.id === chapter)?.battlefield ?? "/images/academy.jpg";
}

const CHOICE = /^CHOICE\s+([a-z0-9-]+)\|(.+)$/i;
const CONDITION = /\s*\[if\s+([a-z0-9-]+)\s*(==|!=)\s*([a-z0-9-]+)\]\s*$/i;

function condition(spec: string): (flags: Flags) => boolean {
  const match = spec.match(/^([a-z0-9-]+)(==|!=)([a-z0-9-]+)$/i);
  if (!match) throw new Error(`Unreadable condition: ${spec}`);
  const [, key, op, value] = match;
  return op === "==" ? flags => flags[key] === value : flags => flags[key] !== value;
}

function parse(script: string): ScriptEntry[] {
  return script.trim().split("\n").map(raw => {
    const choice = raw.match(CHOICE);
    if (choice) return { kind: "choice" as const, id: choice[1].trim(), prompt: choice[2].trim(), options: [] };
    const at = raw.indexOf("|");
    if (at < 0) throw new Error(`Script line has no speaker: ${raw}`);
    let text = raw.slice(at + 1);
    let when: ((flags: Flags) => boolean) | undefined;
    let whenSpec: string | undefined;
    const guard = text.match(CONDITION);
    if (guard) {
      text = text.slice(0, text.length - guard[0].length);
      whenSpec = `${guard[1]}${guard[2]}${guard[3]}`;
      when = condition(whenSpec);
    }
    return { kind: "line" as const, speaker: raw.slice(0, at), text, when, whenSpec };
  });
}

/** Reply lines are plain speech - a choice cannot contain another choice. */
function parseLines(script: string): ScriptLine[] {
  return parse(script).map(entry => {
    if (entry.kind !== "line") throw new Error("A choice reply cannot contain a choice.");
    return entry;
  });
}

const enemy = (name: string, sprite: string, boss = false) => ({ name, sprite, boss });

function stage(
  chapter: number, number: number, title: string, location: string,
  pre: string, post: string, enemies: Stage["enemies"], boss = false,
  optionSets: Record<string, { label: string; reply: string }[]> = {},
): Stage {
  const build = (script: string) => parse(script).map(entry => {
    if (entry.kind !== "choice") return entry;
    const options = optionSets[entry.id];
    if (!options) throw new Error(`Choice ${entry.id} has no options`);
    return {
      ...entry,
      options: options.map(option => {
        const [id, ...rest] = option.label.split(":");   // `key: label`
        return { id: id.trim(), label: rest.join(":").trim(), reply: parseLines(option.reply) };
      }),
    };
  });
  return { id: `${chapter}-${number}`, chapter, number, title, location, pre: build(pre), post: build(post), enemies, boss, choices: [] };
}

/**
 * The script the story screen plays.
 *
 * Conditional lines are dropped, and a choice that has already been taken is
 * replaced by the reply to the option that was picked, so replaying a scene
 * - or reading it in the archive - shows the conversation you actually had.
 */
export function stageScript(stage: Stage, phase: "pre" | "post", flags: Flags, picked: Flags): ScriptEntry[] {
  const out: ScriptEntry[] = [];
  for (const entry of stage[phase]) {
    if (entry.kind === "line") {
      if (!entry.when || entry.when(flags)) out.push(entry);
      continue;
    }
    out.push(entry);
    const chosen = picked[entry.id];
    const option = chosen ? entry.options.find(o => o.id === chosen) : undefined;
    if (option) for (const reply of option.reply) if (!reply.when || reply.when(flags)) out.push({ kind: "line", ...reply });
  }
  return out;
}

/** Every choice point in the campaign, for validating a pick and looking one up. */
export const choicePoints: ChoicePoint[] = [];
function withChoices(stageData: Stage): Stage {
  const points: ChoicePoint[] = [];
  const walk = (entries: ScriptEntry[]) => {
    for (const entry of entries) if (entry.kind === "choice") points.push(entry);
  };
  walk(stageData.pre); walk(stageData.post);
  choicePoints.push(...points);
  return { ...stageData, choices: points };
}
export function choicePointById(id: string) { return choicePoints.find(c => c.id === id); }

export const stages: Stage[] = [
  // =========================================================================
  // CHAPTER 1 — THE STUCO TREASURY & THE GACHA DEBT
  // =========================================================================
  stage(1, 1, "Where Are The Funds?!", "Student Council Office", `
Narrator|You know, this story? We really don't know how it started, nor do we know how it came to be. All we know is….
Ninette|YNN! Are you forgetting something?!
Narrator|Yes, you are playing as Ynna. Ynna Rutherford. Creative name, isn't it? I digress, we are currently…
CHOICE 1-1|HOW DO YOU RESPOND?
Ninette|THE FUNDS! THE STUDENT COUNCIL FUNDS!!! MS. YNNA RUTHERFORD OF THE STUCO TREASURER! WHERE ARE THE FUNDS!!!
Ynna|Oh, right. Uhm.
Narrator|(You look towards the conveniently placed box labelled "Funds" in front of you, only to find a fly pop out and reveal the void of the box.)
Ninette|Where did it all go?! We were supposed to remit that today! Oh crud, we are actually gonna be suspended! My scholarship is at stake here!!
P.A. Announcement|ATTENTION: It appears to be that uh…. Little slimes? Have appeared on the school grounds? We don't know how they got into our school, nor HOW THEY EXIST IN THE FIRST PLACE, WHAT IS THIS?! TENSURA?! (cough cough). Anyhow, Student Council… please apprehend these things.
Ninette|Look at them! A Bluloom and a Yelloom are currently chewing on the Student Council budget ledger!
Ynna|Wait, is the Yelloom glowing because it ate my phone charger?!
Ninette|Tch! We'll have a stern discussion after this, missus! Come on now, slacker! Let's deal with these whatever-the-hecks.
`, `
Ninette|(Wipes forehead) Okay, slimes cleared. But don't think a few dead gelatinous blobs are gonna make me forget about the missing treasury!
Ynna|(Sweatdrops) Worth a shot...
`, [enemy("Bluloom", "slime-blue"), enemy("Yelloom", "slime-gold")], false, {
    "1-1": [
      { label: `deny: "Nope, I don't recall anything..."`, reply: `
Ynna|Nope. I don't recall anything. My memory is a clean, well-maintained banner with no rate-ups on it.
Ninette|Your memory has a 403 error and I can see it on your face.
` },
      { label: `attendance: "I forgot to put in my attendance?"`, reply: `
Ynna|I forgot to put in my attendance?
Ninette|ATTENDANCE?! WE CAN FIX ATTENDANCE, YNNA. ATTENDANCE IS NOT THE PROBLEM. THE PROBLEM IS THE ENTIRE TREASURY.
` },
    ],
  }),

  stage(1, 2, "600 Rolls & A Broken Window", "Student Council Hallway", `
Ninette|Uck! Now I'm all slimy! ba dum tss
Narrator|(Ynna chuckles blankly.)
Ninette|Oi, we're not done here. What happened to the funds?! The Pres is gonna kill us!
Narrator|(Flashback to Ynna literally playing Arknights and spending it all just to get Angelina Ajimu.)
Ninette|Ynn…… just.. think for a second.. You rolled….. 600 times…. And spent……… 30 THOUSAND DOLLARS! HOW ARE WE GONNA REPAY ALL OF THIS MAN!!!!!!
Narrator|(Edgelord69 literally comes crashing through the window.)
Edgelord69|You two! I need help! Bad!
Ninette|THE F*****G WINDOW!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! THAT'S GONNA COST US EVEN MORE!
Edgelord69|Wait, what..? (Looks behind)
Ninette|(Creeps up behind Edgelord69 with a dark, menacing grin) You…. better pay for that…
Edgelord69|B-but I'm equally broke…
P.A. Announcement|ERMMMM, STUCO.. WE GOT EVEN MORE COMPANY!
Ninette|Look out! Two Relooms and another Bluloom are swarming the glass shards! Help us out real quick with this, Edgelord. BUT WE'RE NOT OVER THIS, AGAIN!
`, `
Edgelord69|(Sheathes plastic sword dramatically) Phew... defeated in one strike...
Ninette|You took 12 hits and almost got eaten by a red blob. Now start talking before I bill you for the window frame!
`, [enemy("Reloom", "slime-red"), enemy("Reloom", "slime-red"), enemy("Bluloom", "slime-blue")]),

  stage(1, 3, "The Third Casualty", "School Storage Room", `
Ninette|Great. Now we have slimes and a ruined structural safety inspection report. You—whatever your name is—explain yourself before I invoice your parents!
Edgelord69|The name's... Shadow Blade... but my account name is Edgelord69. I was running away from something way worse than low-level slimes!
Ynna|Let me guess. Did you pull a 3-star on a rate-up banner and lose your mind?
Edgelord69|WORSE! A wild mob stole my gacha stash! I was saving for the anniversary banner, and this girl with a giant anchor just swooped in, commandeered the school storage room, and confiscated all my pulls!
Ynna|Oh! That's Alvida from the Disciplinary Committee! She's probably impounding it as "contraband"!
CHOICE 1-3|WHAT DO YOU DO?
Ninette|We are not joining a raid party for gacha tickets! But if Alvida is hoarding confiscated assets in the storage room... there might be emergency school contingency cash in there.
Edgelord69|Watch out! That Cactloom on the left was created when a Reloom tried to swallow a potted cactus in the hallway! It reflects melee damage!
Ninette|WHY IS THERE A CACTUS INVOLVED?! Lead the way, Edgelord, and let's clear a path to the storage room!
`, `
Edgelord69|The storage room doors are right ahead! My pull stash... hold on, papa's coming!
Ninette|If there isn't a single dollar of actual money in there, I'm throwing both of you into the school pool.
`, [enemy("Cactloom", "slime-cactus"), enemy("Reloom", "slime-red"), enemy("Yelloom", "slime-gold")], false, {
    "1-3": [
      { label: `pulls: "We should go save his pulls! A fellow gacha addict in need!"`, reply: `
Ynna|We should go save his pulls! A fellow gacha addict in need!
Ninette|"Fellow gacha addict"? You just described yourself as an addict and expected that to be reassuring.
` },
      { label: `anchor: "Can we sell her anchor for 30 grand to cover my debt?"`, reply: `
Ynna|Can we sell her anchor for 30 grand to cover my Arknights debt?
Edgelord69|That anchor is the property of the Disciplinary Committee, and also roughly four metres of solid iron.
Ynna|So that's a maybe.
` },
    ],
  }),

  stage(1, 4, "Anchor's Away!", "Contraband Vault", `
Alvida|HALT! Disciplinary Committee business! Unauthorized personnel are strictly prohibited from entering the contraband vault!
Ynna|Alvida! Be reasonable! We're here for... uh... official Student Council business! (And definitely not to raid the gacha ticket pile).
Alvida|Save it, Treasurer! I already saw the logbook! 600 pulls for an Arknights operator?! Do you know how many school budget spreadsheets that violates?!
Ninette|SEE?! EVEN THE DISCIPLINARY COMMITTEE KNOWS YOU MESSED UP, YNNA!
Alvida|As punishment, I've seized all liquid assets, including this guy's pull fund, and fed them to my ultimate vault guardian—King Slooom!
Edgelord69|(Gasp!) YOU CAN LITERALLY SEE A RELOOM AND MY TICKETS FLOATING INSIDE HIM! THAT'S DISGUSTING AND DANGEROUS!
CHOICE 1-4|WHAT DO YOU DO?
Ruta|(Pops out from behind gym mats, brandishing her spear) Wait! Before you guys initiate turn-based combat with King Slooom, did everyone sign the liability waiver for the VN screen transitions?!
Ninette|WHY ARE THERE SO MANY PEOPLE IN THIS STORAGE ROOM?! WE JUST NEED MONEY!
`, `
Narrator|(King Slooom pops into jelly, dropping a mountain of confiscated tickets.)
Alvida|Ugh... impossible... their synergy... was too F2P-friendly...
Ruta|I'm... writing a negative review... on the app store...
Ninette|We reclaimed some tickets, but it's still nowhere near $30,000. If we can just find the President, maybe we can negotiate a payment plan—
`, [enemy("King Slooom", "kingslime", true), enemy("Cactloom", "slime-cactus")], false, {
    "1-4": [
      { label: `lootbox: "If we pop him, do the gacha tickets drop like loot boxes?!"`, reply: `
Ynna|If we pop him, do the gacha tickets drop like loot boxes?!
Alvida|You are the single most on-brand student I have ever detained.
` },
      { label: `backbutton: "Is this why our UI has no Back button on this screen?"`, reply: `
Ynna|Is this why our UI has no "Back" button on this screen?
Alvida|There is no "Back" button because there is no backing out of a Disciplinary Committee vault.
Narrator|(There is also no "Back" button because the router was never finished.)
` },
    ],
  }),

  stage(1, 5, "The Boss of Budget Cuts", "School Fountain Courtyard", `
Narrator|(The sky suddenly turns purple. Dramatic boss music plays from nowhere. A massive health bar spans across the top of the screen.)
System|HP: 999,999 / 999,999 — [BOSS] ESCANOOOR (Student Council President)
Escanooor|(Stands atop the school fountain, arms crossed, glowing with aura) So... the rumors are true. The Student Council treasury... emptied. Slaughtered on the altar of PNGs.
Ynna|PREZ?! Since when do you have a dark aura and a multi-phase health bar?!
Escanooor|Since I looked at the bank statement, Ynna! $30,000?! On a single banner?! DO YOU HAVE ANY IDEA HOW MANY ENERGY REFILLS THAT IS?!
Ninette|Prez, wait! It was an accident! She was chasing Angelina!
Escanooor|SILENCE, TREASURER! As President, I shall now execute the ultimate disciplinary protocol: [FULL ROSTER ACCOUNT RESET]!
CHOICE 1-5|HOW DO YOU RESPOND?
Escanooor|THERE IS NO AUTO-SKIP FOR DEBT! Prepare yourselves! Phase 1 begins NOW!
Ninette|Everyone, draw your weapons! If we lose here, the game literally ends before Chapter 2 gets coded!
`, `
Narrator|(Escanooor drops to one knee as his purple aura dissipates.)
Escanooor|(Pant... pant...) Impressive... to think your gacha luck carried over... into combat power...
Ynna|See, Prez? Gacha isn't useless! It saved the school!
Ninette|IT DID NOT SAVE THE SCHOOL, WE ARE STILL $30,000 IN THE HOLE!
Escanooor|(Adjusts glasses) ...However, a contract is a contract. Since you defeated me, I will grant you a temporary grace period. But Chapter 2 won't be so forgiving... We are holding an inter-school tournament next week. The grand prize? $30,000 in cash.
Edgelord69|A tournament arc?! NOW THIS IS REAL ANIME!
Ruta|(Spins spear) $30,000 prize pool? Count me in. My martial arts club needs new training mats anyway.
Ynna|(Glint in her eye) A tournament, huh? Think of all the pulls we can do if we win...
Ninette|WE ARE USING THE PRIZE TO PAY BACK THE BANK! NO MORE PULLS!
`, [enemy("Escanooor", "escanooor", true)], true, {
    "1-5": [
      { label: `ninette: "NOT MY ACCOUNT! TAKE NINETTE INSTEAD!"`, reply: `
Ynna|NOT MY ACCOUNT! TAKE NINETTE INSTEAD!
Ninette|I have been standing next to you for ONE DAY and you have already tried to sell me twice.
` },
      { label: `autoskip: "Wait! Can we at least auto-skip this boss fight?!"`, reply: `
Ynna|Wait! Can we at least auto-skip this boss fight?!
Escanooor|You want to skip the consequences of your own actions. That is a very GachaCorp thing to want.
` },
    ],
  }),

  // =========================================================================
  // CHAPTER 2 — SPORES, SERVERS & THE FUNGAL UNDERGROUND
  // =========================================================================
  stage(2, 1, "Welcome to the Spore Arena", "Tournament Underground", `
Ninette|So this is the underground arena for the Inter-School Tournament Prelims... Why is it completely overgrown with giant red and blue mushrooms?!
Ynna|(Pokes a mushroom with a stick) Maybe it's eco-friendly stadium decoration?
Edgelord69|(Draws plastic katana dramatically) No... I feel a dark, ancient presence... These aren't just plants. They're sentient Spun Shrooms!
Narrator|(A giant red spotted mushroom with googly eyes waddles out from the damp mist.)
Spun Shroom|SPOOOOOORE!
Ynna|Wait, why are we fighting flora now?! Where are the tournament organizers?!
Ninette|According to the handbook, the tournament committee released biological hazards in the underground passages to "test the resolve of the applicants."
CHOICE 2-1|HOW DO YOU TAKE THAT?
Ninette|IT'S BLATANT ATTEMPTED MANSLAUGHTER! But if we don't clear these Spun Shrooms and Rerooms, we can't even reach the main stage!
Ruta|Save the complaining for later! Standard polearm strike—clear a path through these fungi!
`, `
Edgelord69|(Sighs) The spores... they're clinging to my dark cloak. It ruins my brooding aesthetic!
Ynna|At least you didn't accidentally breathe any in. I feel like I'm seeing 5-star banners floating in the sky...
`, [enemy("Spun Shroom", "shroom"), enemy("Spun Shroom", "shroom"), enemy("Reroom", "reroom")], false, {
    "2-1": [
      { label: `osha: "That sounds like a massive OSHA violation!"`, reply: `
Ynna|That sounds like a massive OSHA violation!
Ninette|IT IS A MASSIVE OSHA VIOLATION. Thank you for finally noticing a crime that isn't yours.
` },
      { label: `exp: "Does clearing them grant EXP or account level points?"`, reply: `
Ynna|Does clearing them grant EXP or account level points?
Ruta|It grants a functioning stadium. That is the reward. That is the whole reward.
` },
    ],
  }),

  stage(2, 2, "Enter Purp", "Mushroom Canopy", `
Narrator|(A mysterious figure wearing a yellow-lined cape and purple robe swoops down from a giant mushroom cap, holding a floating magical tome.)
Purp|HALT, TRESPASSERS! Who dares disturb the toxic ecosystem of the Tournament Underground?!
Edgelord69|(Gasp!) That aura... that regal yet wildly suspicious purple drip... Could you be...
Purp|I am Purp! Grand Shadow Sorcerer, master of the forbidden arcane, and... third-place winner in last year's regional tournament!
Ninette|Wait, you're an actual registered participant? Why are you hanging out in a mushroom patch?!
Purp|Because the registration fee was $500, and I spent my life savings on this custom gold-trimmed cape! So I live here now, controlling these Blue Cap Shrooms as my personal bodyguard army!
Ynna|Respect the drip, honestly. But we need to pass through to get the $30,000 prize money!
CHOICE 2-2|HOW DO YOU PLAY THIS?
Purp|Ha! If you want to claim that prize money, you'll have to prove your worth against my elite fungal legion first!
`, `
Narrator|(Purp's tome floats down gently as he holds his arm dramatically.)
Purp|Ngh... Such tactical synergy... Your power is unmatchable...
Ynna|So... are you gonna help us or what?
Purp|(Instantly drops dramatic persona) Yeah sure, honestly I was getting tired of eating raw mushroom stew down here anyway. Count me in.
`, [enemy("Purp", "purp"), enemy("Blue Cap Shroom", "bluecap"), enemy("Blue Cap Shroom", "bluecap")], false, {
    "2-2": [
      { label: `join: "Join our squad, Purp! Help us pay off our $30k debt!"`, reply: `
Ynna|Join our squad, Purp! Help us pay off our $30,000 debt!
Purp|You want me to join a debt? That is the least heroic recruitment pitch I have ever received and I am genuinely considering it.
` },
      { label: `stomp: "Prepare to get stomped like a Mario Bros level!"`, reply: `
Ynna|Prepare to get stomped like a Mario Bros level!
Purp|I am a registered tournament participant, not a goomba, and this cape cost more than your rent.
` },
    ],
  }),

  stage(2, 3, "Cursed Clocks & Feline Feuds", "Arena Floor", `
Ninette|Okay, Purp is in our party now. But look at the arena floor ahead—it's a literal warzone between ticking clockwork gears and cursed black cats wearing tiny witch hats!
Purp|Ah, yes. The Clockwork Sentries were deployed by the tech academy to guard the tournament server hub, but the Occult Club cursed them, so now they attack anyone who hasn't paid their library fees.
Cursed Cat Mob|Meow~ (Eyes glow red as ticking clockwork sounds echo from its stomach)
Edgelord69|A CAT WITH A CLOCKWORK HEART?! THIS IS PEAK ANIME SYNCRETISM!
Ynna|(Tries to pet one) Aw, look at the little cursed baby—
Ninette|YNNA, IT'S WINDING UP A MELEE ATTACK! STEP BACK!
Ruta|(Sweeps spear in wide arc) I'll keep the cursed felines pinned down! Purp, Edgelord, hit the mechanical sentry on the right!
`, `
Ynna|Phew... the cat dropped a 3-star upgrade gear piece!
Ninette|WHY IS A CAT DROPPING RPG LOOT?! WE DON'T HAVE TIME FOR THIS! THE ARENA STAGE IS RIGHT UP AHEAD!
`, [enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat"), enemy("Clockwork Sentry", "sentry")]),

  stage(2, 4, "The Security Gatekeeper", "Server Vault Door", `
Narrator|(The team reaches the heavy steel door leading to the bracket finals, pulsing with red warning lights.)
Automated P.A. System|WARNING: UNAUTHORIZED PERSONNEL DETECTED NEAR TOURNAMENT SERVER. DEPLOYING MAXIMUM SECURITY PROTOCOL.
Ninette|Great! The tournament committee's automated security is locking us out!
Purp|(Floats up on his tome) Stand back! GachaCorp installed a Clockwork Sentry Prime to guard the vault! It's buffed by a pair of Cursed Cats!
Edgelord69|A giant mechanical gear supported by cursed felines?! THIS IS THE ULTIMATE GUILD RAID!
CHOICE 2-4|CALL THE PLAY.
Ruta|I'll draw the Prime Sentry's aggro! Purp, prepare your high-tier burst spell!
`, `
Narrator|(The Sentry Prime explodes into loose screws and gears, unlocking the heavy vault doors.)
Ninette|(Wipes sweat from forehead) The door is opening! Quick, into the main server stage!
`, [enemy("Clockwork Sentry Prime", "prime", true), enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat")], false, {
    "2-4": [
      { label: `cats: "Target the cats first! They're giving the robot speed buffs!"`, reply: `
Ynna|Target the cats first! They're giving the robot speed buffs!
Ruta|Correct read. Support units first, then the frame. You have done this before.
` },
      { label: `awakening: "Edgelord, use your dark awakening on the main sentry!"`, reply: `
Ynna|Edgelord, use your dark awakening on the main sentry!
Edgelord69|(Eyes glowing) FINALLY. SOMEONE WHO UNDERSTANDS MY ROTATION.
` },
    ],
  }),

  stage(2, 5, "The Overclocked Core", "Tournament Server Core", `
Narrator|(In the middle of the arena sits a massive, glowing server tower covered in vines, spores, spinning gears, and a giant glowing red eye.)
System|HP: 1,500,000 / 1,500,000 — [BOSS] TOURNAMENT SERVER CORE
Ninette|THERE IT IS! THE MAIN TERMINAL CONTROLLING THE PRIZE POOL!
Purp|(Taps on floating tome) The server has gone hyper-overclocked! It's using the fungal spores and cursed energy to build a physical defense barrier!
Ynna|If we destroy that firewall core... Purp can execute the transaction to claim our $30,000 tournament check!
Edgelord69|Everyone, sync your ultimate skills! Purp, ready your purple magic! Ynna... don't pull on any banners mid-fight!
Ynna|I CAN'T PULL ANYWAY, MY ACCOUNT HAS ZERO GEMS!
CHOICE 2-5|LAST CALL BEFORE THE RAID.
`, `
Narrator|(The Server Terminal sparks, smoke pours out of its cooling vents, and its giant red eye shuts off.)
Purp|(Frantically typing on terminal keyboard) I'm in! Bypassing two-factor authentication... entering the Treasurer's admin panel... AND... TRANSACTION COMPLETE!
Ninette|(Looks at his phone) THE $30,000 PRIZE IS TRANSFERRED! WE ARE IN THE CLEAR! WE ARE SAVED!
Ynna|(Checks her phone) Wait... Purp, what did you just click?
Purp|What? I clicked "Transfer Prize Money & Convert to Account Credit."
Ynna|...Purp... you converted the $30,000 prize into 300,000 In-Game Paid Gems on my account instead of sending it to the bank...
Ninette|(Veins popping on forehead, voice trembling) YOU... DID... WHAT?!
Ynna|(Eyes glowing with pure insanity) THREE HUNDRED THOUSAND GEMS?! DO YOU KNOW HOW MANY PULLS THAT IS?!
Ninette|(Screams at top of lungs) YNNAAAA! PURPPP! I'M GOING TO THROW BOTH OF YOU OFF THE SCHOOL ROOF!
`, [enemy("Tournament Server Core", "terminal", true), enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat")], true, {
    "2-5": [
      { label: `power: "FULL POWER ATTACK! FOR THE $30k PRIZE!"`, reply: `
Ynna|FULL POWER ATTACK! FOR THE $30,000 PRIZE!
Ninette|FOR THE BANK. SAY "FOR THE BANK." WORDS HAVE POWER, YNNA.
` },
      { label: `linux: "Does this server run on Linux?!"`, reply: `
Ynna|Does this server run on Linux?!
Purp|It runs on spite and unlicensed enterprise software, which is the same thing at this scale.
` },
    ],
  }),

  // =========================================================================
  // CHAPTER 3 — THE SUPREME AUDIT & THE SACRED PAN
  // =========================================================================
  stage(3, 1, "The Vault of Saint Athanasius", "Chapel Vault", `
Narrator|(Inside the dimly lit, overgrown Chapel Vault, the team is ducking behind stone pews to evade automated GachaCorp security sentries.)
Ninette|(Stares blankly at his phone, hands shaking) They froze my personal bank account too, Ynna. They revoked my merit scholarship twenty minutes ago. My future is being erased.
Ynna|(Holding her phone, looking genuinely panicked for the first time) Ninette... I tried to pull on the standard gacha banner to see if we could somehow convert the duplicate pulls into tradeable currency. The game... locked me out with a '403 Forbidden' screen.
Purp|(Closing floating magical tome) Because that wasn't standard in-game currency. GachaCorp uses the 300,000 Paid Gems as an encrypted digital ledger to obscure unrecorded corporate transactions. Your $30,000 accidentally intercepted a global corporate laundering node.
Penelope|(Pours out of a shadowed archway, holding a giant iron frying pan and speaking into a screeching megaphone) ATTENTION REBELS AND COUNTER-REVOLUTIONARY CORRUPTION!
Ynna|Penelope! Lower the megaphone! Security drones are literally everywhere!
Penelope|(Stamps foot in black sneakers, adjusting handlebar mustache) THE SUPREME CHAIRMAN-CLERIC DOES NOT LOWER HER VOICE FOR CORPORATE DOGS! As the official Cleric of this squad, I decree a zero-tolerance policy against financial heresy! Prepare my Divine Frying Pan of Purging!
Edgelord69|(Draws katana) She's unhinged, but she's our unhinged Cleric. Cover her while she channels her healing wards!
`, `
Penelope|(Clangs frying pan against ground as sentries explode into scrap) A glorious victory for the Supreme Audit Bureau!
Ninette|(Panting) Great job, Penelope... but the chapel altar ahead is locked behind a corporate security firewall!
`, [enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat"), enemy("Clockwork Sentry", "sentry")]),

  stage(3, 2, "The Holy Audit Node", "Sanctuary Terminal", `
Narrator|(The party gathers around the central sanctuary terminal. Penelope hoists her oversized staff in one hand and her frying pan in the other, casting a protective pink magic pentagram shield around the squad.)
Penelope|Stand back, comrades! My divine clerical barrier shall protect you from GachaCorp's digital retaliation!
Purp|(Plugs magical tome into altar terminal) Accessing the Archdiocese network... Wait. Look at the signature on this $30,000 transaction node...
Ynna|What does it say?!
Purp|The transaction didn't fail because Ynna spent it. The money was intercepted directly by GachaCorp Executive Director Vane to fund a predatory buyout of our entire school district!
Penelope|(Gasp!) WHAT?! Corporate oligarchs stealing public educational funds?! THIS IS AN INSULT TO MY MUSTACHE! THIS MEANS WAR!
Ninette|So we were framed from the very beginning...
Edgelord69|(Looks toward exit as heavy corporate security mechs surround chapel doors) Looks like they realized we found the proof. They're sending in elite security constructs!
`, `
Penelope|(Standing proudly on top of a smashed security drone, megaphone raised) Hear me, GachaCorp! The Supreme Leader and her Student Council comrades are coming for your executive floor!
`, [enemy("Clockwork Sentry Prime", "prime", true), enemy("Reinforced Security Drone", "sentry"), enemy("Reinforced Security Drone", "sentry")]),

  // BRIDGE — written to connect 3-2 to 3-5. Replace freely.
  stage(3, 3, "The Procession of Piety", "Chapel Cloister", `
Penelope|Comrades! The Archdiocese will not shelter a laundering node under its own roof. We march on the cloister gate, and we march LOUDLY.
Ynna|So, quietly, then.
Penelope|THE SUPREME CHAIRMAN-CLERIC IS ALWAYS QUIET INTERNALLY.
Ninette|She's not going to be quiet.
CHOICE 3-3|HOW DOES THE SUPREME AUDIT PROCEED?
Ninette|(Barely above a whisper) There are forty of them between us and that gate. Forty. I counted.
Ruta|Forty is a number. It is not an obstacle. Stay behind me.
`, `
Penelope|(Dusting flour off her frying pan) A glorious and, importantly, VERY LOUD victory.
Penelope|I woke the entire chapel IN THE NAME OF TRUTH.
`, [enemy("Consecrated Sentry", "sentry"), enemy("Consecrated Sentry", "sentry"), enemy("Reliquary Guardian", "prime")], false, {
    "3-3": [
      { label: `rally: "Penelope, give the troops a speech!"`, reply: `
Ynna|Penelope, give the troops a speech!
Penelope|(Clears throat into megaphone) COMRADES. WE HAVE NO MONEY, NO CHOICE, AND NO INDOOR VOICE. WE HAVE ONLY EACH OTHER. AND A PAN.
Ninette|That was genuinely moving and I hate that it was genuinely moving.
` },
      { label: `requisition: "Check if the chapel has anything we can requisition."`, reply: `
Ynna|Wait—before we go, does the chapel have anything we can requisition?
Ynna|What about the candles?
` },
    ],
  }),

  // BRIDGE — written to connect 3-3 to 3-5. Replace freely.
  stage(3, 4, "Rain on the Courtyard", "Chapel Courtyard Gate", `
Narrator|(Heavy rain. The courtyard gate stands open, and beyond it the road to the city—and to GachaCorp.)
Purp|(Tome flickering in the wet) The audit file is degrading in this rain. We need to move it somewhere dry or it is just a very expensive story we tell people.
Ninette|Then we move. Does anyone actually know how we get to the executive floor?
Purp|I know. I used to work there. (Beat) I was not an employee. I was a problem.
Ruta|(Shields her eyes, looking down the road) Company vanguard. Eight units and something behind them that is not a unit.
Alvida|(Steps out of the rain, anchor over her shoulder) Nine units.
Ynna|ALVIDA?! You followed us?!
Alvida|I did not follow you. I was assigned to the school district's disciplinary response team, and when your school gets flagged for a corporate buyout, so do I.
CHOICE 3-4|ALVIDA IS WAITING. WHAT DO YOU SAY?
Penelope|The Disciplinary Committee stands with us?
Alvida|The Disciplinary Committee stands with the school. Today those are the same thing. Tomorrow we can discuss the tickets.
`, `
Alvida|(Sets the anchor down, rain running off it) Vanguard cleared. But they will have already reported this back.
Purp|Then they know we are coming.
Alvida|Good. I hate arriving unannounced.
`, [enemy("Corporate Vanguard", "enforcer"), enemy("Corporate Vanguard", "enforcer"), enemy("Reinforced Security Drone", "sentry")], false, {
    "3-4": [
      { label: `waiver: "Ask Alvida about the liability waiver."`, reply: `
Ynna|So, about the liability waiver—
Alvida|You are still not covered, and you are still not insured, and I have stopped carrying the forms.
` },
      { label: `anchor2: "Ask if the anchor is actually happening now."`, reply: `
Ynna|Is the anchor... happening now? Like, is that a today thing?
Alvida|It has been a today thing since the storage room. Keep up.
` },
    ],
  }),

  stage(3, 5, "March of the Supreme Crusade", "Chapel Courtyard", `
Narrator|(Location: Chapel Courtyard - Heavy Rain)
Narrator|(GachaCorp's regional enforcement commander, Enforcer Vane-02, blocks the path to the city downtown.)
Enforcer Vane-02|Surrender the audit file, children. You are outmatched, outfunded, and your school records are already scheduled for deletion.
Ninette|We're not surrendering anything. You ruined our lives, stole our school's budget, and tried to frame us for your corporate crimes!
Penelope|(Raises glowing frying pan high into stormy sky, summoning divine holy thunder) BY ORDER OF THE SUPREME CHAIRMAN-CLERIC, YOUR OPPRESSION ENDS TODAY! FORWARD, COMRADES!
`, `
Penelope|(Adjusts mustache with a fierce smile) The path to GachaCorp HQ is clear! Next stop: Total liberation of the Student Council treasury!
`, [enemy("Enforcer Vane-02", "enforcer", true), enemy("Cactloom", "slime-cactus"), enemy("Cactloom", "slime-cactus")], true),

  // =========================================================================
  // CHAPTER 4 — CORPORATE DESOLATION
  // =========================================================================
  stage(4, 1, "The Monolith of Greed", "GachaCorp HQ Tower Plaza", `
Narrator|(Location: GachaCorp HQ Tower Plaza - Raining)
Penelope|GachaCorp controls over 70% of the educational digital infrastructure in this state. They deliberately design predatory microtransactions into student portals to force schools into defaulting on loans.
Ninette|(Looking up at towering glass skyscraper) So Escanooor didn't just lose the budget... he was backed into a corner by their predatory interest rates.
Purp|(Floating tome dimming) My account wasn't permabanned because I hacked the game. I was banned because I found their internal files proving they manipulate pull rates dynamically based on a player's real-life bank balance.
Ynna|(Clenching fists, staring at phone screen) They took $30,000 from us... they ruined Ninette's scholarship... and they made us think it was just a stupid joke.
Edgelord69|(Unsheathing genuine steel blade from beneath coat) No more plastic swords. We end this today.
Ruta|(Grits teeth, gripping spear tightly) Let's take back our school!
`, `
Ninette|They know we're here. The whole tower knows we're here.
Ruta|Good. Let them spend the evening being nervous.
`, [enemy("Reinforced Security Drone", "sentry"), enemy("Reinforced Security Drone", "sentry"), enemy("Reinforced Security Drone", "sentry")]),

  // BRIDGE — written to connect 4-1 to 4-5. Replace freely.
  stage(4, 2, "The Lobby of Implied Consent", "HQ Ground Floor", `
Narrator|(The lobby is white, warm, and completely empty. A screen above the reception desk reads: WELCOME, VALUED PARTNERS.)
Purp|This is the part of the building where they make you sign things. Do not sign anything.
Ynna|What if it's a guest book?
Purp|It is not a guest book. It is never a guest book. It is an arbitration agreement with a guest book printed on the front.
Narrator|(Two reception units unfold from behind the desk and begin walking toward the party with a folder marked SIGN HERE.)
Ninette|THE PLACE IS DEFENDED BY PAPERWORK?!
Purp|The place is defended by the appearance of paperwork. The paperwork is load-bearing.
CHOICE 4-2|THE FOLDER IS COMING. WHAT DO YOU DO?
`, `
Purp|(Watching the last unit fold itself back into the desk) Nobody signed anything. That may be the first legal win this school has had in years.
Ninette|I'm putting it on the report.
`, [enemy("Retention Unit", "sentry"), enemy("Retention Unit", "sentry"), enemy("Terms Enforcer", "enforcer")], false, {
    "4-2": [
      { label: `legal: "Read the folder first. Out-lawyer them."`, reply: `
Ynna|Wait. Let's read it first. Out-lawyer them.
Purp|(Genuinely impressed) You want to read the contract. Nobody reads the contract. That is their entire business model.
Ninette|I have never been prouder of you and also we are being shot at.
` },
      { label: `kick: "Skip the reading. Kick the folder."`, reply: `
Ynna|Skip the reading. Kick the folder.
Purp|(Delighted) Simple. Direct. Legally catastrophic. I love it.
` },
    ],
  }),

  // BRIDGE — written to connect 4-2 to 4-5. Replace freely.
  stage(4, 3, "Floor 34: Human Resources", "HQ Floor 34", `
Narrator|(The elevator opens on a floor of grey desks and grey people who are, on closer inspection, not people.)
Ninette|This is HR.
Purp|This is where they kept the file on you, Ninette.
Ninette|(Stops walking) What file?
Purp|Everyone the district flagged for a revoked scholarship has a file here. It is not a long file. It just has to exist, so the buyout has a reason.
Ninette|(Very quietly) How many of them are there?
Purp|(Not looking at him) Two hundred and eleven.
Ynna|Ninette—
Ninette|Then we're not skipping this floor.
CHOICE 4-3|NINETTE HAS STOPPED WALKING. WHAT DO YOU SAY?
`, `
Ninette|(Standing in front of a desk of smoking scrap) Two hundred and eleven files. I took a photo of every one of them.
Ruta|Why?
Ninette|Because they were going to delete them. Now they can't.
`, [enemy("Records Unit", "enforcer"), enemy("Retention Unit", "sentry"), enemy("Retention Unit", "sentry")], false, {
    "4-3": [
      { label: `empathy: "Tell him the files matter more than the fight."`, reply: `
Ynna|Ninette. The files matter more than the fight. Take the photos.
Ninette|(Barely audible) Thank you for understanding which one this is.
Ynna|(Quietly) I've spent two years understanding the wrong thing. Let me get one right.
` },
      { label: `blackmail: "Tell him those files are leverage."`, reply: `
Ynna|Those files aren't a tragedy, Ninette. They're leverage. Two hundred and eleven families they were going to quietly erase.
Purp|(Low whistle) That is the most strategically alarming thing you have said all week, and it was correct.
Ninette|...Okay. Okay, we take the photos.
` },
    ],
  }),

  // BRIDGE — written to connect 4-3 to 4-5. Replace freely.
  stage(4, 4, "The Ascension Server", "HQ Data Floor", `
Purp|(Walking between towers of humming servers) Here. This is it. This is where the pull rates come from.
Ynna|(Staring) The rates are just... in a room?
Purp|The rates were always just in a room. It's the same room for every gacha game you've ever played. It's some servers, a spreadsheet, and a group of people who have decided that you are a number.
Edgelord69|So what do we do? Burn it?
Purp|No. We photograph it, back it up, and publish it. Burning it makes us the story. Publishing it makes them the story.
`, `
Purp|(Pockets the drive) Copy made. One for the audit, one for the courts, and one for me.
Ynna|What's yours for?
Purp|Insurance. If this goes badly, somebody should still know what they did.
`, [enemy("Server Warden", "prime"), enemy("Data Harvester", "cat"), enemy("Data Harvester", "cat")]),

  stage(4, 5, "The Executive Floor", "CEO Boardroom", `
Narrator|(Location: CEO Boardroom Overlooking the City)
Director Vane|(Sitting behind mahogany desk, swirling a glass of water) Impressive. The student council, a disgraced hacker, a martial artist, and an unhinged cleric. Do you really believe uploading a file changes anything? We own the banks. We own the servers.
Penelope|(Stepping forward, frying pan glowing with blinding radiance) You own digital illusions! But the Supreme Audit acknowledges only truth!
Director Vane|(Stands up as heavy corporate armor deploys around him) Then perish under the weight of your own debt!
`, `
Director Vane|(Falls to knees, smirking) You're too late... The central server in the basement core... is initiating a total wipe of all district assets. In ten minutes... your school, your records, and your futures... will cease to exist.
`, [enemy("Director Vane", "vane", true)], true),

  // =========================================================================
  // CHAPTER 5 — THE PRICE OF REDEMPTION
  // =========================================================================
  stage(5, 1, "Abyssal Code", "Core Access Corridor", `
Purp|(Hands bleeding as he types into energy terminals) The core is collapsing! It's deleting every student record tied to the $30,000 ledger!
Ruta|(Spinning spear with iron resolve, her red-and-black gi torn from combat) You two get to that core terminal! Edgelord and I aren't letting a single one of these corporate mechs past this corridor!
Edgelord69|(Draws steel blade alongside her) A warrior's pact... Let's show them what true discipline looks like!
Ynna|Guys... thank you!
`, `
Ynna|(Looking back down the corridor) They're still standing. Both of them are still standing.
Ninette|Then we keep moving. That's the deal.
`, [enemy("Corrupted Core Fragment", "fragment"), enemy("Corrupted Core Fragment", "fragment"), enemy("Corrupted Core Fragment", "fragment")]),

  // BRIDGE — written to connect 5-1 to 5-5. Replace freely.
  stage(5, 2, "The Corridor of Last Stands", "Core Access Corridor", `
Narrator|(Behind them, the corridor is filling with light and noise. Ruta and Edgelord are holding the door.)
Ruta|(Over the din) Ynna! How long!
Ynna|I don't know! Purp says four minutes!
Ruta|Then we hold for four minutes. Go.
Edgelord69|(Grinning, blade up) Four minutes is nothing. I have waited my entire life for a corridor with a door and a reason.
Ruta|That is the most useful thing you have ever said.
CHOICE 5-2|FOUR MINUTES. WHAT DO YOU DO WITH THEM?
`, `
Narrator|(The door holds. The noise does not stop.)
Ruta|(Breathing hard, still standing) Go. We are still here.
Edgelord69|(Also breathing hard) Tell them the line about the dark awakening. I want it on the record.
Ruta|Absolutely not.
`, [enemy("Corrupted Core Fragment", "fragment"), enemy("Corrupted Core Fragment", "fragment"), enemy("Corrupted Vanguard", "enforcer")], false, {
    "5-2": [
      { label: `fight: "Stay and fight beside them."`, reply: `
Ynna|I'm staying.
Ruta|No.
Ynna|I'm staying!
Ruta|(Without turning) You are the only one who can trigger the override. Your staying is the same as losing. Go.
Ynna|...(Goes.)
` },
      { label: `trust: "Trust them. Keep running."`, reply: `
Ynna|(Turning back to the terminal) They've got this. They've always had this.
Ninette|(Quietly) That's the first time I've seen you trust a roll you didn't make.
` },
    ],
  }),

  // BRIDGE — written to connect 5-2 to 5-5. Replace freely.
  stage(5, 3, "Descent Into the Ledger", "Zero-Point Vestibule", `
Purp|(Reading as he walks) The ledger is not a database. It's a ledger. It's a list of every student whose debt was ever sold up the chain.
Ynna|Our school is on it.
Purp|(Nods) Page four hundred and eleven. Your balance has been sold nine times. The last buyer is a shell company with no address.
Penelope|And what the Supreme Pan finds, the Supreme Pan PURGES!
Edgelord69|(Faintly, from far behind them) FOR THE RECORD, I AM STILL HOLDING THE DOOR!
CHOICE 5-3|THE LEDGER IS OPEN. WHAT MATTERS MORE?
`, `
Purp|Copies away. Three of them, in three different places.
Ninette|Will it be enough?
Purp|It will be enough that they can never again say it didn't happen.
`, [enemy("Ledger Warden", "prime"), enemy("Corrupted Core Fragment", "fragment"), enemy("Corrupted Core Fragment", "fragment")], false, {
    "5-3": [
      { label: `records: "Back up the names. All of them."`, reply: `
Ynna|Back up the names. All of them. Not just ours.
Ninette|(Stops) ...All of them?
Ynna|Two hundred and eleven, remember? Ours is one line in five hundred pages.
Purp|(Typing faster) Copying the whole ledger. It will take an extra ninety seconds.
Ninette|Take two hundred. Nobody has ever taken the time for that list.
` },
      { label: `debt: "Erase the debt now. Deal with the rest later."`, reply: `
Ynna|Can we just erase our debt? Right now, from here?
Purp|(Looks up) Yes. And they would notice, and they would bill you for the deletion, and then you would owe twice what you owe now.
Ynna|...Right. Back up first.
` },
    ],
  }),

  // BRIDGE — written to connect 5-3 to 5-5. Replace freely.
  stage(5, 4, "The Last Banner", "Zero-Point Antechamber", `
Narrator|(Before the final door, the corridor opens into a small, quiet room with a single lit screen showing a gacha banner.)
Ynna|(Stops dead) ...Why is there a banner here?
Purp|Because they ran out of walls. Because it's the last thing they want you to see before the end.
Narrator|(The banner reads: ANGELINA AJIMU — RATE UP. GUARANTEED SSR AT 300 PULLS.)
Ynna|(Long pause) It's the same one.
Ninette|Ynna. Don't.
Ynna|I'm not going to. I just... I want to look at it for a second.
CHOICE 5-4|THE BANNER IS RIGHT THERE.
`, `
Ynna|(Turns away from the screen) Let's go.
Ninette|(Quietly) Are you okay?
Ynna|No. But I'm not looking at it anymore.
`, [enemy("Antechamber Sentinel", "sentry"), enemy("Antechamber Sentinel", "sentry"), enemy("Corrupted Vanguard", "enforcer")], false, {
    "5-4": [
      { label: `look: "Look at it. Say goodbye properly."`, reply: `
Ynna|(Looking at the banner) I spent six hundred rolls on you. You weren't even real. You were a picture and a percentage.
Narrator|(The banner does not answer, because it is a banner.)
Ynna|(Turning away) Okay. I'm done.
Ninette|(Not saying anything, which is the kindest thing he has done all week)
` },
      { label: `walk: "Walk past it. Don't give it the satisfaction."`, reply: `
Ynna|(Doesn't slow down) No.
Ninette|...Good.
Ynna|I've given that thing six months and thirty thousand dollars. It doesn't get a goodbye too.
` },
    ],
  }),

  stage(5, 5, "Heart of the System", "The Zero-Point Core", `
Narrator|(Location: The Zero-Point Server Core)
Ninette|Ynna... this is it. If we initiate the override, the 300,000 Gems will be permanently erased. The $30,000 debt will be cleared... but all your game progress, your account... everything you spent years on... will be deleted forever.
Ynna|(Looks at her phone one last time. She looks at Ninette, who fought for his scholarship. At Purp, who found a home. At Edgelord and Ruta, who bled for them. At Penelope, who put her faith in them.)
Ynna|(Softly) It was just PNGs anyway, Ninette. You guys... are what's real.
Narrator|(Ynna crushes her smartphone in her hand, plugging the master hard drive directly into the core console.)
System Voice|CRITICAL OVERRIDE DETECTED. INITIATING TOTAL SYSTEM PURGE.
`, `
Narrator|The data wiped clean. The $30,000 debt vanished from the banking network as if it had never existed. GachaCorp's regional division was put under federal investigation following the release of Penelope's Holy Audit files.
Narrator|(Location: Student Council Office - Rebuilt, bright, quiet)
Ninette|(Sitting at desk, filing clean, normal student council reports. His scholarship reinstated.)
Ynna|(Sitting across from him, sipping a juice box, staring out the newly repaired window.)
Ninette|...You know, the new semester budget came in today.
Ynna|(Looks up) Oh yeah? How much?
Ninette|(Smiles faintly, sliding a clean folder over) Just enough. And not a single cent for digital pulls.
Penelope|(Pokes head through door, adjusting divine mustache with a small, rare smile) The ledger is balanced. Peace be upon this office.
Ruta|(Leaning against the doorframe, spear racked) The Disciplinary Committee has closed its file on the Student Council.
Ynna|(Hopefully) ...And?
Ruta|The file says you did not run. It is not a compliment. It is a record.
Narrator|(The window is new. The fly is back. Somewhere, a banner ends.)
Narrator|THE END
`, [enemy("[SYSTEM CORE] OMEGA-GACHA", "terminal", true)], true),
].map(withChoices);

export function stageById(id: string) { return stages.find(s => s.id === id); }
/** Kept for callers that only want the spoken lines of a stage. */
export const chaptersById = (id: number) => chapters.find(c => c.id === id);
