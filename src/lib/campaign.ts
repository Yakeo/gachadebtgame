export type Dialogue = { speaker: string; text: string };
export type Stage = { id: string; chapter: number; number: number; title: string; location: string; pre: Dialogue[]; post: Dialogue[]; enemies: { name: string; sprite: string; boss?: boolean }[]; boss: boolean; choices?: string[]; };
// Every chapter fights somewhere different, so `battlefield` points at that
// chapter's own arena art. The story screen, the campaign map and the home
// tile follow the same picture, which keeps the whole journey legible.
export const chapters = [
  { id: 1, title: "The $30,000 Treasury Incident", short: "The Treasury Incident", subtitle: "One banner. An entire semester's budget. What could go wrong?", color: "#238afa", location: "ACADEMY DISTRICT", battlefield: "/images/academy.jpg" },
  { id: 2, title: "The Grand Campus Cleanup", short: "The Hidden Facility", subtitle: "Glowing mushrooms, purple magic, and a very questionable refund.", color: "#a084eb", location: "THE OLD WEST WING", battlefield: "/images/west-wing.jpg" },
  { id: 3, title: "The Sanctum of the Holy Ledger", short: "The Holy Ledger", subtitle: "Some sins cannot be written off. Some ledgers hide the truth.", color: "#d9b765", location: "SAINT ATHANASIUS CHAPEL", battlefield: "/images/chapel.jpg" },
  { id: 4, title: "Corporate Desolation", short: "Corporate Desolation", subtitle: "No more plastic swords. We end this today.", color: "#f08383", location: "GACHACORP HEADQUARTERS", battlefield: "/images/hq.jpg" },
  { id: 5, title: "The Price of Redemption", short: "The Price of Redemption", subtitle: "The most important things were never behind a rate-up banner.", color: "#7ecbdb", location: "THE ZERO-POINT CORE", battlefield: "/images/core.jpg" },
];
/** The arena art for a chapter, with the academy courtyard as the fallback. */
export function battlefieldFor(chapter: number | undefined) {
  return chapters.find(c => c.id === chapter)?.battlefield ?? "/images/academy.jpg";
}
const lines = (script: string): Dialogue[] => script.trim().split("\n").map(line => { const i = line.indexOf("|"); return { speaker: line.slice(0, i), text: line.slice(i + 1) }; });
const enemy = (name: string, sprite: string, boss = false) => ({ name, sprite, boss });
function stage(chapter: number, number: number, title: string, location: string, pre: string, post: string, enemies: Stage["enemies"], boss = false, choices?: string[]): Stage { return { id: `${chapter}-${number}`, chapter, number, title, location, pre: lines(pre), post: lines(post), enemies, boss, choices }; }
export const stages: Stage[] = [
  stage(1, 1, "The Audit", "Student Council Office", `Ninette|(Slams financial binder on the desk) Ynna. Explain this line item. Immediately.
Ynna|(Playing on phone) Which one? The $4 boba tea?
Ninette|No! The THIRTY THOUSAND DOLLAR charge to “GachaCorp — Unlimited Banner Pulls”! That was the entire student council budget for the semester!
Ynna|Okay, hear me out… Angelina Ajimu had a rate-up banner! It was guaranteed SSR pity at 300 pulls!
Ninette|YOU SPENT THE SCHOOL'S TREASURY FOR A PNG OF AN ANIME GIRL?!
Edgelord69|(Leaning dramatically against the broken window frame) Peace, child of light. What is money but a temporary mortal illusion? Her rate-up… is eternal.
Ninette|SHUT UP, EDGELORD! You broke our office window last week with your plastic sword!`, `Ninette|The audit drones are finally quiet. Now we have an even bigger problem.
Ynna|The window?
Ninette|The disciplinary head is on his way. Put. The phone. Down.`, [enemy("Blue Slime", "slime-blue"), enemy("Blue Slime", "slime-blue")]),
  stage(1, 2, "An Unwelcome Visitor", "Student Council Hallway", `Escanooor|I was told the treasury ledger required my personal attention.
Ninette|Sir, we can explain. There has been a… clerical discrepancy.
Ynna|A thirty-thousand-dollar discrepancy, if we're being precise.
Escanooor|The campus security constructs will escort you to my office. Do not make this difficult.
Edgelord69|Alas. Difficulty is my middle name.
Ruta|(Arriving behind the constructs with her spear racked) Disciplinary Committee, armed response. I am the escort.
Ynna|Oh no. We can handle constructs. That one has a lance.
Ruta|You will walk in front of me in an orderly manner. That is the whole arrangement.
Edgelord69|(Eyes widening) A warrior of the Unbroken Line! Your spear sings the song of the eternal—
Ruta|It does not sing. Keep walking.`, `Escanooor|Enough. You have demonstrated considerable energy. Perhaps you can put it toward repaying the academy.
Ninette|Repaying… all of it?
Ruta|(Writing in a small notebook) Escort complete. No resistance. Subjects walked in a straight line and said nothing useful.
Ninette|That is the most terrifying compliment anyone has ever paid us.
Ruta|It is not a compliment. It is a record. But you did not run.`, [enemy("Blue Slime", "slime-blue"), enemy("Red Slime", "slime-red")]),
  stage(1, 3, "Escanooor's Ultimatum", "Disciplinary Office", `Escanooor|Recover the $30,000 before the end of the week. Otherwise, I liquidate the Student Council office.
Ynna|Does that include the snack drawer?
Escanooor|Every drawer. Every chair. Every questionable plastic sword.
Edgelord69|You would confiscate the Blade of Eternal Night?!
Ninette|We'll recover it. Somehow.
Ruta|(Standing at the door, spear planted, reading from the file) One week. The deadline is one week from today.
Ninette|You have our file?
Ruta|I have every file. It is why they assigned me.`, `Ninette|We need a plan that doesn't involve another banner.
Ynna|GachaCorp has a customer-support server under the old west wing. Maybe we can request a refund in person.
Ninette|That is the first sensible thing you've said today.
Ruta|(Pausing in the doorway on her way out) For what it is worth — most people in your position quietly stop trying to repay it.
Ynna|Is that encouragement?
Ruta|It is an observation. Do not put it in the minutes.`, [enemy("Red Slime", "slime-red"), enemy("Gold Slime", "slime-gold"), enemy("Blue Slime", "slime-blue")]),
  stage(1, 4, "Cleanup on Campus", "West Courtyard", `Ninette|The campus cleanup contract pays a little. We'll take it while we find the server entrance.
Ynna|The plants look… unusually enthusiastic.
Narrator|Something enormous screams out of the cafeteria doors, trailing steam and a truly unreasonable amount of glitter.
Penelope|ORDER UP! Nobody touch my station! I've been reduction-cooking these things for THREE HOURS!
Ninette|Penelope, that is a courtyard. That is a weed.
Penelope|It WAS a weed! Now it's a garnish! Also the Culinary Club got defunded, so I'm legally a security contractor now.
Edgelord69|She wields a pan of black iron… and the fury of a thousand unpaid lunch debts.
Penelope|Cast iron. Say cast iron one more time and I'll show you what searing means.
Ninette|They're mushrooms. Just clear the courtyard. All of you.`, `Penelope|AND THAT'S THE LAST ONE! Table's closed! Kitchen's closed! We're closed!
Ynna|Penelope, that was genuinely terrifying. What WAS that final swing?
Penelope|Honestly? No idea. The pan decides. I just hold on and apologize to whatever's in the way.
Ninette|…We are not putting her on the budget. We are not putting her on ANY budget.
Penelope|Too late, I've already filed the paperwork in sauce.
Narrator|Penelope joins the council! Nobody is sure what she just joined, but she's in.
Penelope|Great! Who wants breakfast? It's the only thing I can't destroy.`, [enemy("Cactus Slime", "slime-cactus"), enemy("Cactus Slime", "slime-cactus"), enemy("Red Slime", "slime-red")]),
  stage(1, 5, "The Deadline Begins", "Old West Wing Entrance", `Escanooor|The west wing is restricted. The security gate has been malfunctioning for weeks.
Ninette|Then let us fix it. We need the cleanup payment, and we need what's downstairs.
Escanooor|I cannot officially authorize this. But I can look the other way for five minutes.
Ynna|See? Deep down, he likes us.
Edgelord69|The gates of destiny await!
Ruta|(Opening a small notebook) The gate malfunctioned. Nothing was seen. Nothing was authorized.
Ynna|Wait — how long have you been standing there?
Ruta|I am always standing there. That is what armed response means.`, `Escanooor|The clock is ticking, council. Don't make me regret this.
Ruta|(Closing the notebook) Five minutes. Nothing observed. Log closed.
Ynna|You're not going to stop us?
Ruta|The gate was malfunctioning. It says so in the report.
Ninette|(Narrowing her eyes) …Did you write the report?
Ruta|I wrote the report.
Ninette|We'll bring back the treasury.
Narrator|The old doors creak open. A strange purple glow spills up the basement stairs.`, [enemy("Crowned Slime", "kingslime", true), enemy("Blue Slime", "slime-blue"), enemy("Blue Slime", "slime-blue")], true),
  stage(2, 1, "Spores in the West Wing", "Old West Wing Corridor", `Ruta|(At the gate with a clipboard) Restricted wing. Officially, nobody goes down there until the structural sweep is logged.
Ninette|And unofficially?
Ruta|Unofficially the sweep was logged this morning. Whatever happens in that corridor is not on my record.
Ynna|Ruta, you're the best.
Ruta|I am the paperwork. There is a difference. (Steps aside)
Ninette|(Coughs) Ugh! The humidity down here is insane! Why is the hallway completely overgrown with giant red and blue mushrooms?!
Ynna|(Pokes a mushroom with a ruler) Look, this Spun Shroom has googly eyes! It's kind of cute—
Narrator|The Spun Shroom violently shakes and sprays a cloud of red spores everywhere.
Edgelord69|(Draws plastic katana) BREATHE IT NOT! The spores of the Reroom inflame the soul with unholy rage!
Ninette|They aren't unholy, they're just irritating my allergies! Clear a path to the stairs before we all get fungal infections!`, `Edgelord69|(Sheathes sword) The spores are clinging to my dark cloak. It ruins my brooding shadow aesthetic!
Ynna|At least you didn't accidentally breathe any in. I feel like I'm seeing 5-star banner pulls in the air…`, [enemy("Spun Shroom", "shroom"), enemy("Spun Shroom", "shroom"), enemy("Reroom", "reroom")]),
  stage(2, 2, "Enter Purp", "Basement Junction", `Narrator|A mysterious figure in a yellow-lined cape and purple robe drops down from a giant mushroom cap, holding a floating magical tome.
Mysterious Sorcerer|HALT, TRESPASSERS! Who dares disturb the sacred sanctuary of the Grand Shadow Arcane?!
Edgelord69|Gasp! That aura… that regal yet suspicious purple drip… Could you be…
Purp|I am Purp! Master of the dark arts, ruler of the basement floor, and former president of the defunct Computer Science Club!
Ninette|Wait! You're Purp?! You went missing during midterms three weeks ago! The school put up missing posters for you!
Purp|I didn't go missing! I got permabanned on my main account by GachaCorp, so I moved down here with my squad of Blue Cap Shrooms to live off grid-power and siphon free Wi-Fi from the faculty lounge!
Ynna|Honestly? I respect the dedication to the grind. But we need to get past you to reach the server room and cancel my $30,000 debt!
Purp|Ha! If you want access to the server room, you'll have to prove your resolve against my purple magic first!`, `Purp|Ngh… Such tactical synergy… You have bested my spellcasting…
Ynna|So… are you gonna help us hack the server or what?
Purp|(Instantly drops dramatic persona) Oh yeah, totally. I was getting tired of eating raw basement mushrooms anyway. Let's go kick GachaCorp's butt.
Narrator|Purp joins the council! He is now available in your character roster.`, [enemy("Purp", "purp", true), enemy("Blue Cap Shroom", "bluecap"), enemy("Blue Cap Shroom", "bluecap")], true, ["Join our squad, Purp! Help us raid the server!", "Prepare to get stomped like a Mario Bros level!"]),
  stage(2, 3, "Cursed Clocks & Feline Feuds", "Robotics & Occult Storage Room", `Ninette|Okay, Purp is in our party now. But look at this room—it's a literal warzone between ticking clockwork gears and cursed black cats wearing tiny witch hats!
Purp|Ah, yes. The Clockwork Sentries were built by the Engineering Department to guard the server, but the Occult Society cursed them, so now they just attack anyone who hasn't paid their library fees.
Cursed Cat Mob|Meow~ (Eyes glow red as ticking clock sounds echo from its stomach.)
Edgelord69|A CAT WITH A CLOCKWORK HEART?! THIS IS PEAK ANIME SYNCRETISM!
Ynna|(Tries to pet one) Aw, look at the little cursed baby—
Ninette|YNNA, IT'S WINDING UP A MELEE ATTACK! STEP BACK!`, `Ynna|Phew… the cat dropped a 3-star upgrade gear piece!
Ninette|WHY IS A CAT DROPPING RPG LOOT?! WE DON'T HAVE TIME FOR THIS! THE SERVER ROOM DOOR IS RIGHT UP AHEAD!`, [enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat"), enemy("Clockwork Sentry", "sentry")]),
  stage(2, 4, "The Overclocked Security Gate", "Server Room Outer Vault", `Narrator|The team reaches the heavy steel server vault door, pulsing with red warning lights and surrounded by ticking clockwork machinery.
P.A. Automated Voice|WARNING: UNAUTHORIZED PERSONNEL DETECTED NEAR THE SERVER TERMINAL. DEPLOYING MAXIMUM SECURITY PROTOCOL.
Ninette|Great. The automated security system is locking down the door!
Purp|(Floats up on magical tome) Stand back! GachaCorp installed a high-tier Clockwork Sentry Prime to guard the vault! It's buffed by a pair of Cursed Cats!
Edgelord69|A giant mechanical security gear supported by cursed felines?! THIS IS THE ULTIMATE GUILD RAID!
Ynna|Purp, can't you just magical-blast the lock?!
Purp|I can, but we have to destroy the security sentry first or it'll fry my tome with electric shocks!`, `Narrator|The Sentry Prime explodes into loose screws and gears, unlocking the heavy vault doors.
Ninette|The door is opening! Quick, into the main server room before the backup system kicks in!`, [enemy("Clockwork Sentry Prime", "prime", true), enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat")], true),
  stage(2, 5, "The Overclocked Core", "Main GachaCorp Server Hub", `Narrator|A massive, glowing server tower is covered in vines, spores, spinning clockwork gears, and a giant glowing red eye. HP: 1,500,000 — GACHACORP MAIN SERVER TERMINAL.
Ninette|THERE IT IS! THE MAIN TERMINAL!
Purp|The server has gone hyper-overclocked! It's using the basement spores and clockwork energy to build a physical defense barrier!
Ynna|If we destroy that firewall core… Purp can execute the $30,000 refund script!
Edgelord69|Everyone, sync your ultimate skills! Purp, ready your purple magic! Ynna… don't pull on any banners mid-fight!
Ynna|I CAN'T PULL ANYWAY, MY ACCOUNT HAS ZERO GEMS!
Server Core|BEEP BOOP! REJECTING ALL CHARGEBACK REQUESTS! PREPARE FOR ACCOUNT LIQUIDATION!`, `Narrator|The Server Terminal sparks. Smoke pours out of its cooling vents, and its giant red eye shuts off.
Purp|(Frantically typing) I'm in! Bypassing two-factor authentication… entering the Treasurer's admin panel… AND… TRANSACTION REVERSED!
Ninette|THE $30,000 DEBT IS GONE! WE ARE IN THE CLEAR! WE ARE SAVED!
Ynna|Wait… Purp, what did you just click?
Purp|What? I clicked “Reverse Transaction & Convert to Account Credit.”
Ynna|…Purp… you converted the $30,000 debt into 300,000 In-Game Paid Gems on my account instead of refunding the bank…
Ninette|(Voice trembling) YOU… DID… WHAT?!
Ynna|THREE HUNDRED THOUSAND GEMS?! DO YOU KNOW HOW MANY PULLS THAT IS?!
Ninette|YNNAAAA! PURPPP! I'M GOING TO THROW BOTH OF YOU OFF THE SCHOOL ROOF!
Ruta|(Reading from the clipboard she has carried since the server room) The refund was rejected before you started. It says so in the response header. "Debt instruments are held by GachaCorp Financial Services, a licensed district contractor."
Purp|…That is a different company from the one we just hacked.
Ruta|It is a subsidiary. Same building, separate contract. That is how the money survives.
Ninette|So the debt outlives the server.
Ruta|The debt outlives everything. It is the only thing in this building that is properly documented.`, [enemy("GachaCorp Server Terminal", "terminal", true), enemy("Cursed Clockwork Cat", "cat"), enemy("Cursed Clockwork Cat", "cat")], true),
  stage(3, 1, "An Unholy Anathema", "Cathedral of Saint Athanasius", `Ninette|(Stares blankly at his phone terminal, hands shaking) It's over. The bank froze all remaining accounts. They aren't just taking the desk chairs anymore, Ynna… my scholarship was revoked twenty minutes ago.
Ynna|Ninette… I tried to pull on the banner to see if we could convert the dupes into tradeable currency. The game… locked me out.
Purp|Because that wasn't standard in-game currency. GachaCorp uses the 300,000 Paid Gems as an encrypted digital ledger to hide unrecorded offshore transactions. Your $30,000 accidentally intercepted a corporate laundering node.
Edgelord69|(Dropping plastic katana to his side) Wait… so this isn't just school budget debt anymore?
Ninette|It's corporate financial crime. And if we can't get the transaction officially sanctified and audited by the board's independent trustee… we aren't just getting suspended. We're going to jail.
Purp|The trustee lives in the old school chapel. A sacred auditor sent by the Archdiocese Board of Education… Solari.`, `Ninette|The chapel guards are standing down. Let's hope the trustee will listen.
Ynna|We'll get your scholarship back, Ninette. I promise.`, [enemy("Chapel Sentry", "sentry"), enemy("Ledger Guardian", "sentry")]),
  stage(3, 2, "The Divine Audit", "The Chapel Altar", `Narrator|Standing at the altar is a tiny girl wearing pristine white and gold clerical robes, an oversized ceremonial staff… and a strikingly prominent, perfectly groomed handlebar mustache.
Solari|(Adjusts divine spectacles, her voice deep and authoritative) Halt, sinners.
Ynna|…Is that… a mustache?!
Solari|Silence, heathen! I am Solari, High Cleric of the Holy Audit and Supreme Arbiter of Fiscal Purity! I have reviewed the ledger of $30,000. Your souls are stained with the sin of illegal chargeback manipulation!
Ninette|High Cleric Solari! Please! It was an accident! Our Treasurer has a severe gacha addiction!
Solari|(Raises staff glowing with blinding holy light) An accident does not absolve the ledger! In the eyes of the Divine Law, debt is an unpardonable stain. Prepare to be cleansed of your financial heresy!
Edgelord69|(Stepping in front of Ninette, demeanor turning cold) Step back, Ninette. She isn't playing around… Her aura is real.`, `Solari|…Hold. This signature on the 300,000 Gem transaction node… It bears the seal of GachaCorp Executive Board.
Ynna|What does that mean?
Solari|It means your $30,000 was never spent on Angelina Ajimu. It was stolen by GachaCorp's CEO to fund a predatory buyout of this entire academic district. You were framed.
Narrator|Solari joins the council. The Holy Audit begins.`, [enemy("Solari", "solari", true), enemy("Clockwork Sentry Prime", "sentry"), enemy("Clockwork Sentry Prime", "sentry")], true),
  stage(3, 3, "The Hidden Transactions", "Chapel Archive", `Solari|The ledger cannot lie. Its keepers, unfortunately, can.
Purp|These transfers all lead to the same offshore account. And someone has dispatched constructs to erase the originals.
Ninette|Then we protect the records.
Ynna|For once, I'm keeping every receipt.`, `Purp|I have an encrypted backup. They can't delete what they can't find.
Solari|Good. But evidence must be authenticated before it can face the board.`, [enemy("Archive Purger", "sentry"), enemy("Cursed Clockwork Cat", "cat"), enemy("Archive Purger", "sentry")]),
  stage(3, 4, "Witnesses of the Ledger", "Auxiliary Administrative Office", `Ninette|These are loan agreements. Our school isn't the only one.
Solari|Every signature is a school pushed to the brink. Every interest payment is another missing scholarship.
Edgelord69|Then our little debt is the thread that unravels their empire.
Purp|First, we need to stop their remote wipe. Incoming!`, `Ninette|The contracts are safe.
Solari|I will affix the Holy Audit's seal. Let no one say these students stood alone.`, [enemy("Remote Wipe Construct", "prime", true), enemy("Security Familiar", "cat")], true),
  stage(3, 5, "A Sacred Alliance", "Cathedral Steps", `Solari|GachaCorp has sent an enforcement unit to seize the audit. They are already on the steps.
Ruta|They were followed. Six vehicles. Two of them are still circling the block.
Ninette|Who—
Ruta|Ruta. Disciplinary Committee, armed response. The High Cleric requested a lawful escort. I was assigned.
Ynna|You're the one who stopped the treasury riot! You just… stood there and everyone calmed down!
Ruta|I planted my feet and did not move. That is the entire technique. People stop when the line holds.
Penelope|She's so COOL. I've been trying to get her to eat something for two semesters.
Ruta|Penelope, I have seen your kitchen. I decline.
Solari|No. It is about every future they put a price on. Stand with me.`, `Ruta|Line held. All six withdrew. The audit is intact.
Solari|The evidence is certified. Our next destination is GachaCorp's executive board.
Ruta|Then I am coming with you. GachaCorp's subsidiaries hold every disciplinary contract in this district. Mine included.
Ninette|Ruta, if you come with us, your contract—
Ruta|I know exactly what my contract says. That is why I am coming.
Narrator|Ruta joins the council. The line holds.
Edgelord69|No more hiding in basements.
Ynna|And no more running from what I did. Let's go.`, [enemy("Corporate Enforcer", "enforcer", true), enemy("Asset Collector", "sentry"), enemy("Asset Collector", "sentry")], true),
  stage(4, 1, "The Monolith of Greed", "GachaCorp HQ Tower Plaza", `Solari|GachaCorp controls over 70% of the educational digital infrastructure in this state. They deliberately design predatory microtransactions into student portals to force schools into defaulting on loans.
Ninette|So Escanooor didn't just lose the budget… he was backed into a corner by their high interest rates.
Purp|My account wasn't permabanned because I hacked the game. I was banned because I found their internal files proving they manipulate pull rates dynamically based on a player's real-life bank balance.
Ynna|They took $30,000 from us… they ruined Ninette's scholarship… and they made us think it was just a stupid joke.
Edgelord69|(Unsheathing a genuine steel blade from beneath his coat) No more plastic swords. We end this today.
Ruta|(Turning a dropped guard's badge over in her hand) Their subsidiary issues every disciplinary licence in this district. Mine included. Four years of standing in doorways, and I never once read the clause about who I was standing there for.
Ninette|Ruta—
Ruta|Clause fourteen. "The contractor shall not act against the interests of the corporation." I read it today. In the lobby. While you were fighting.`, `Ninette|The plaza is clear. Purp, find us a way up.
Purp|The service elevator. Someone left the password as “password.” Corporate security, everyone.`, [enemy("Corporate Guard", "sentry"), enemy("Executive Sentry", "sentry"), enemy("Security Familiar", "cat")]),
  stage(4, 2, "Terms & Conditions", "Customer Retention Floor", `P.A. Automated Voice|By entering this facility, you consent to all applicable liquidation fees.
Ynna|I am so done with fine print.
Purp|The doors are tied to their retention system. We have to crash the security process.
Solari|Consider this an independent review.
Ruta|(Sitting on a crate, reading a sixty-page contract under a desk lamp) Clause fifteen. "This agreement is void upon a judicial finding that the corporation has violated district law."
Purp|…Say that again.
Ruta|They wrote their own exit clause. Page eleven.
Ynna|You've been reading it this entire time?
Ruta|I read everything. It is why they assigned me.`, `Purp|Retention process terminated. The doors are open.
Ninette|I'm going to enjoy writing this complaint.`, [enemy("Retention Unit", "sentry"), enemy("Terms Enforcer", "sentry"), enemy("Clockwork Cat", "cat")]),
  stage(4, 3, "The Rate-Up Lie", "Behavioral Analytics Department", `Purp|Here it is. The system that changes pull rates based on bank balances.
Ynna|All those “lucky” banners… they knew exactly what I would spend.
Ninette|Ynna. This isn't your fault alone. Help us make sure it stops here.
Ynna|Give me a target.`, `Purp|The source files are copied to Solari's audit. Actual odds, actual victims, actual proof.
Ynna|No more rigged chances. Not for anyone.`, [enemy("Analytics Prime", "prime", true), enemy("Data Harvester", "cat")], true),
  stage(4, 4, "Upward, Together", "Executive Elevator", `Edgelord69|They're sending everything they have.
Ninette|We didn't get this far to turn back.
Solari|The ledger is on our side.
Ynna|So are we. Together.
Ruta|(Bracing the elevator doors open with her spear so the others can file in) My contract ended on the eighth floor. I read it twice to be sure.
Ynna|Ruta, that's…
Ruta|It is paperwork. Go up.`, `Purp|Top floor. The executive lock is down.
Narrator|The elevator doors open onto a skyline framed in cold glass. One person waits at the end of the boardroom.`, [enemy("Executive Honor Guard", "enforcer", true), enemy("Corporate Guard", "sentry"), enemy("Corporate Guard", "sentry")], true),
  stage(4, 5, "The Executive Floor", "CEO Boardroom Overlooking the City", `Director Vane|Impressive. The student council, a disgraced hacker, and a renegade cleric. Do you really believe uploading a file changes anything? We own the banks. We own the servers.
Ruta|(Stepping forward with the contract held open) Clause fifteen, Director. Violation of district law. You wrote it, your lawyers signed it, and the finding it describes is the audit you are trying to seize.
Director Vane|(A pause exactly one second too long) A licensed contractor. Turning on the company that signs her pay.
Ruta|You paid me to stand in doorways. You did not pay me to stand in this one.
Solari|You own digital illusions! But the Divine Audit acknowledges only truth!
Director Vane|(Heavy corporate armor deploys around him) Then perish under the weight of your own debt!`, `Director Vane|(Falling to his knees) You're too late… The central server in the basement core… is initiating a total wipe of all district assets. In ten minutes… your school, your records, and your futures… will cease to exist.
Ninette|Purp. The core. Now.`, [enemy("Director Vane", "vane", true), enemy("Corporate Armor", "sentry")], true),
  stage(5, 1, "The Descent into Abyssal Code", "Sub-Basement Quantum Core", `Purp|The core is collapsing! It's deleting every student record tied to the $30,000 ledger!
Edgelord69|(Holding off swarms of security constructs, coat torn, standing firm) Keep moving! I'll hold the doorway!
Ynna|Edgelord, no!
Edgelord69|(Looks back with a quiet, genuine smile—no chuunibyou act left) Go, Ynna. Show them what real resolve looks like.`, `Ninette|He'll catch up. He has to.
Ruta|(Reading the corridor readout on the wall) This level loses structural integrity in eleven minutes. He is not behind us.
Purp|How could you possibly know that?
Ruta|I counted the constructs. Two are missing from the ones that were following us. Something is stopping them. (Pauses) Somebody.
Purp|The override terminal is three sectors below. Keep moving!
Ynna|We're coming back for him. That's not negotiable.`, [enemy("Quantum Construct", "sentry"), enemy("Quantum Construct", "sentry"), enemy("Abyssal Familiar", "cat")]),
  stage(5, 2, "Fragments of Tomorrow", "Student Record Storage", `Narrator|Names and grades flicker across the walls. One by one, the records begin to disappear.
Ninette|Those are our classmates.
Solari|I can preserve the data, but I need time.
Ynna|Then we'll buy you every second.`, `Solari|The records are preserved in the audit. Their futures will not vanish today.
Purp|The system noticed. It's rerouting every defense to us.`, [enemy("Record Eraser", "sentry"), enemy("Abyssal Familiar", "cat"), enemy("Record Eraser", "sentry")]),
  stage(5, 3, "The Last Firewall", "Quantum Security Bridge", `Purp|This firewall is running on the encrypted gems in Ynna's account.
Ynna|So my pulls are literally the problem. Again.
Ninette|Then we use the connection to reach the core.
Purp|I'll prepare the master drive. Keep that security prime off my keyboard!`, `Purp|The master override is ready. Once we start, there's no undo.
Ynna|I think I've had enough second chances. Let's make this one count.`, [enemy("Quantum Sentry Prime", "prime", true), enemy("Abyssal Familiar", "cat"), enemy("Abyssal Familiar", "cat")], true),
  stage(5, 4, "Not Leaving Anyone Behind", "Zero-Point Antechamber", `Narrator|A familiar blade strikes the last construct blocking the passage.
Edgelord69|Sorry. Traffic was terrible.
Ynna|You absolute idiot. You came back.
Edgelord69|A council meeting requires a quorum, doesn't it?
Ninette|Everyone's here. One final gate.`, `Solari|The path is clear. The truth is safe. What happens next is your choice, Ynna.
Narrator|Beyond the gate, the heart of GachaCorp pulses with dark red light.`, [enemy("Omega Gatekeeper", "enforcer", true), enemy("Quantum Construct", "sentry")], true),
  stage(5, 5, "The Heart of the System", "The Zero-Point Server Core", `Narrator|The massive quantum brain of GachaCorp hovers over a void, pulsating with dark red data strings. HP: 5,000,000 — SYSTEM CORE OMEGA-GACHA.
Ninette|Ynna… this is it. If we initiate the override, the 300,000 Gems will be permanently erased. The $30,000 debt will be cleared… but all your game progress, your account… everything you spent years on… will be deleted forever.
Narrator|Ynna looks at her phone one last time. She looks at Ninette, Purp, Solari, and a bruised Edgelord who caught up.
Ynna|(Softly) It was just PNGs anyway, Ninette. You guys… are what's real.
Narrator|Ynna crushes her smartphone in her hand, plugging the master hard drive directly into the core console.
System Voice|CRITICAL OVERRIDE DETECTED. INITIATING TOTAL SYSTEM PURGE.`, `Narrator|The data wiped clean. The $30,000 debt vanished from the banking network as if it had never existed. GachaCorp's regional division was put under federal investigation following the release of Solari's Holy Audit files.
Narrator|Student Council Office. Rebuilt, bright, quiet.
Ninette|(Sitting at desk filing clean reports, scholarship reinstated) …You know, the new semester budget came in today.
Ynna|(Sipping a juice box, looking out the window) Oh yeah? How much?
Ninette|(Smiles faintly, sliding a clean folder over) Just enough. And not a single cent for digital pulls.
Solari|(Pokes head through door, adjusting mustache with a small smile) The ledger is balanced. Peace be upon this office.
Penelope|(Carrying a truly heroic stack of empty plates) Breakfast is READY! I used a wok this time. Nobody got hurt. Statistically.
Ruta|(Standing by the window, spear racked beside her) The new security contract is signed. It names the council, not a corporation.
Ruta:smug|(Almost smiles — the first one anyone has seen) I read every page of this one. Twice.
Narrator|Somewhere, a phone that no longer exists would have shown a banner ending in nine minutes. Nobody checks.
Narrator|THE END — Thank you for being part of the council. Your playable roster and campaign save remain yours.`, [enemy("System Core Omega-Gacha", "terminal", true)], true),
];
export function stageById(id: string) { return stages.find(s => s.id === id); }
