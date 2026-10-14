import { characterById, characters, initialState, missionProgress, missions, pullPool, PULL_RATES, SSR_FEATURED_SHARE, ssrFeaturedId, stats, type Battle, type Combatant, type GameState, type PullResult } from "./game-data";
import { stageById, stages } from "./campaign";

// Enemy pressure is driven by how far into the campaign the stage sits, not by
// chapter number alone, so difficulty climbs monotonically across all 25 stages.
export function enemyLevel(wave: number) { return Math.max(1, Math.round(1 + (wave - 1) * 2.1)); }
export function enemyHp(wave: number, boss: boolean, stageId?: string) {
  if (boss && stageId === "2-5") return 1500000;
  if (boss && stageId === "5-5") return 5000000;
  const growth = 240 + wave * 118 + Math.pow(wave, 1.55) * 26;
  return Math.round(growth * (boss ? 2.4 : 1));
}
export function enemyAttack(wave: number) { return Math.round(58 + wave * 13.5 + Math.pow(wave, 1.3) * 2.6); }
export function enemyDefense(wave: number) { return Math.round(10 + wave * 4.6); }

const enemyMoves: Record<string, string[]> = {
  "slime-blue": ["Bounce", "Wobble Slam"],
  "slime-red": ["Acid Spit", "Hot Bounce"],
  "slime-gold": ["Coin Toss", "Gilded Slam"],
  "slime-cactus": ["Prickle Rush", "Potted Toss"],
  kingslime: ["Royal Squash", "Crown Slam"],
  shroom: ["Spore Spray", "Cap Bonk"],
  bluecap: ["Cooling Burst", "Cap Bonk"],
  reroom: ["Rage Spores", "Cap Bonk"],
  cat: ["Tick-Tock Pounce", "Winding Swipe"],
  sentry: ["Security Sweep", "Gear Strike"],
  prime: ["Overclock Blast", "Servo Crush"],
  terminal: ["Firewall Sweep", "Account Liquidation"],
  enforcer: ["Debt Collection", "Compliance Strike"],
  vane: ["Liquidation Order", "Hostile Takeover"],
  purp: ["Purple Packet", "Grimoire Slam"],
  solari: ["Holy Rebuke", "Staff of Audit"],
};
const fallbackMoves = ["Strike", "Heavy Blow"];
function moveFor(sprite: string, random: () => number) {
  const list = enemyMoves[sprite] ?? fallbackMoves;
  return list[Math.floor(random() * list.length)];
}

export function regenerateEnergy(state: GameState) {
  const now = Date.now();
  const ticks = Math.floor((now - state.energyAt) / 240000);
  if (state.energy >= 120) state.energyAt = now;
  else if (ticks > 0) { state.energy = Math.min(120, state.energy + ticks); state.energyAt += ticks * 240000; }
  return state;
}
export function applyGameAction(original: GameState, input: Record<string, unknown>, random: () => number) {
  const state = regenerateEnergy(structuredClone(original));
  let message = "Progress saved.";
  let pulls: PullResult[] | undefined;
  const id = typeof input.id === "string" ? input.id : "";
  switch (input.action) {
    case "init": break;
    case "pull": {
      const count = input.count === 10 ? 10 : input.count === 1 ? 1 : 0;
      if (!count) throw new Error("Choose a single pull or a ten-pull.");
      if (state.gems < count * 160) throw new Error("Not enough gems. Clear stages or claim missions to earn more.");
      state.gems -= count * 160;
      pulls = [];
      for (let i = 0; i < count; i++) {
        const guaranteed = state.pity >= 49;
        const roll = random();
        // Bands come from PULL_RATES, which the rates dialog also renders, so
        // the odds on screen are always the odds being rolled.
        const urBand = PULL_RATES.UR;
        const ssrBand = urBand + PULL_RATES.SSR;
        const srBand = ssrBand + PULL_RATES.SR;
        const rarity = roll < urBand ? "UR" : guaranteed || roll < ssrBand ? "SSR" : roll < srBand ? "SR" : "R";
        const pool = pullPool(rarity);
        const pick = rarity === "SSR" && random() < SSR_FEATURED_SHARE
          ? characterById(ssrFeaturedId)
          : pool[Math.floor(random() * pool.length)];
        const owned = state.roster.find(c => c.id === pick.id);
        if (owned) { owned.duplicates++; state.credits += 100; }
        else state.roster.push({ id: pick.id, level: 1, potential: 0, duplicates: 0 });
        state.pity = rarity === "SSR" || rarity === "UR" ? 0 : state.pity + 1;
        state.totalPulls++;
        pulls.push({ id: pick.id, rarity: pick.rarity, duplicate: !!owned, guaranteed });
        state.pullHistory.unshift({ id: pick.id, rarity: pick.rarity, date: new Date().toISOString() });
      }
      state.pullHistory = state.pullHistory.slice(0, 100);
      message = `${count} new connection${count > 1 ? "s" : ""} established!`;
      break;
    }
    case "upgrade": {
      const owned = state.roster.find(c => c.id === id);
      if (!owned) throw new Error("Recruit this character first.");
      if (owned.level >= 50) throw new Error("Maximum level reached.");
      const cost = owned.level * 200;
      if (state.credits < cost) throw new Error("Not enough credits for this upgrade.");
      state.credits -= cost;
      owned.level++;
      message = `${characterById(id).name} reached level ${owned.level}!`;
      break;
    }
    case "potential": {
      const owned = state.roster.find(c => c.id === id);
      if (!owned) throw new Error("Recruit this character first.");
      if (owned.potential >= 5) throw new Error("Potential is already at its maximum.");
      if (owned.duplicates < 1) throw new Error("Recruit a duplicate to unlock the next potential.");
      owned.duplicates--;
      owned.potential++;
      message = `Potential ${owned.potential} unlocked. All stats increased by 5%!`;
      break;
    }
    case "equip": {
      if (state.battle?.status === "active") throw new Error("Your squad cannot change during a battle.");
      if (!state.roster.some(c => c.id === id)) throw new Error("This character is not in your roster.");
      if (state.squad.includes(id)) {
        if (state.squad.length === 1) throw new Error("Keep at least one character in your squad.");
        state.squad = state.squad.filter(c => c !== id);
        message = "Character removed from the active squad.";
      } else {
        if (state.squad.length >= 4) throw new Error("Your squad is full. Remove a member before adding another.");
        state.squad.push(id);
        message = `${characterById(id).name} joined your squad.`;
      }
      break;
    }
    case "daily": {
      const today = new Date().toISOString().slice(0, 10);
      if (state.lastDaily === today) throw new Error("Today's gift has been claimed. A new gift arrives at 00:00 UTC.");
      state.lastDaily = today;
      state.gems += 160;
      state.credits += 1000;
      state.energy = Math.min(120, state.energy + 30);
      message = "Welcome back! +160 gems, +1,000 credits, and +30 energy.";
      break;
    }
    case "claim": {
      const mission = missions.find(m => m.id === id);
      if (!mission) throw new Error("Mission not found.");
      if (state.claimed.includes(id)) throw new Error("This reward has already been claimed.");
      if (missionProgress(state, mission.kind) < mission.goal) throw new Error("Complete the mission objective first.");
      state.gems += mission.gems;
      state.credits += mission.credits;
      state.claimed.push(id);
      message = `Mission complete! +${mission.gems} gems and +${mission.credits.toLocaleString()} credits.`;
      break;
    }
    case "buy": {
      if (id === "energy") {
        if (state.energy >= 120) throw new Error("Your energy is already full.");
        if (state.gems < 100) throw new Error("You need 100 gems.");
        state.gems -= 100;
        state.energy = Math.min(120, state.energy + 60);
        message = "Energy restored by up to 60 points.";
      } else if (id === "credits") {
        if (state.gems < 160) throw new Error("You need 160 gems.");
        state.gems -= 160;
        state.credits += 5000;
        message = "+5,000 credits added to your treasury.";
      } else throw new Error("Item not found.");
      break;
    }
    case "startBattle": {
      const stage = stageById(id);
      if (!stage || stages.indexOf(stage) > state.cleared.length) throw new Error("Complete the previous stage to unlock this encounter.");
      if (state.battle?.status === "active") {
        if (state.battle.stageId === id) return { state, message: "Battle resumed.", pulls };
        throw new Error("Finish or retreat from your current battle first.");
      }
      const cost = stage.boss ? 12 : 8;
      if (state.energy < cost) throw new Error("Not enough energy. Energy regenerates every four minutes, or visit the exchange.");
      state.energy -= cost;
      const wave = stages.indexOf(stage) + 1;
      const allies: Combatant[] = state.squad.map(cid => {
        const owned = state.roster.find(c => c.id === cid)!;
        const c = characterById(cid); const s = stats(owned);
        return { id: cid, name: c.name, hp: s.hp, maxHp: s.hp, energy: 35, attack: s.attack, defense: s.defense };
      });
      const enemies: Combatant[] = stage.enemies.map((e, index) => {
        const hp = enemyHp(wave, !!e.boss, id);
        return {
          id: `${e.sprite}-${index}`, name: e.name, hp, maxHp: hp, energy: 0,
          level: enemyLevel(wave), attack: enemyAttack(wave), defense: enemyDefense(wave), boss: e.boss,
        };
      });
      state.battle = { stageId: id, allies, enemies, active: 0, turn: 1, status: "active", log: [`${stage.title} — the council is ready. Select an enemy and issue a command.`] };
      message = "Operation started.";
      break;
    }
    case "act": {
      const b = state.battle;
      if (!b || b.status !== "active") throw new Error("There is no active battle.");
      const command = input.command;
      if (!["attack", "skill", "guard", "ultimate"].includes(String(command))) throw new Error("Unknown battle command.");
      const actor = b.allies[b.active];
      if (!actor || actor.hp <= 0) throw new Error("This character cannot act.");
      const targetIndex = typeof input.target === "number" ? input.target : 0;
      const target = b.enemies[targetIndex];
      if (!target || (target.hp <= 0 && command !== "guard")) throw new Error("Select a living enemy.");
      actor.guard = false;
      b.lastHit = undefined;
      const c = characterById(actor.id);
      const owned = state.roster.find(o => o.id === actor.id)!;
      if (command === "ultimate" && actor.energy < 100) throw new Error("Build 100 energy to use an ultimate.");
      if (command === "skill" && actor.energy < 20) throw new Error("Skills require 20 energy. Use Attack to recharge.");
      if (command === "ultimate") actor.energy = 0;
      else if (command === "skill") actor.energy -= 20;
      else actor.energy = Math.min(100, actor.energy + 35);
      const living = () => b.enemies.filter(e => e.hp > 0);
      const strike = (enemy: Combatant, mult: number, options: { ignoreDefense?: boolean; critical?: boolean } = {}) => {
        const scale = enemy.maxHp > 10000 ? (b.stageId === "5-5" ? 2500 : 1000) : 1;
        // Ninette's audit: an open line item on a target pays the whole squad
        // 20% more until somebody collects it.
        const audited = enemy.audited ? 1.2 : 1;
        const raw = actor.attack * mult * audited * (options.critical ? 1.5 : 1) * (owned.potential >= 3 ? 1.1 : 1);
        const defense = options.ignoreDefense ? 0 : enemy.defense;
        const damage = Math.max(1, Math.round((raw - defense) * scale));
        enemy.hp = Math.max(0, enemy.hp - damage);
        b.lastHit = { target: enemy.id, amount: damage, critical: !!options.critical };
        return damage;
      };
      const strikeAll = (mult: number, options: { ignoreDefense?: boolean; critical?: boolean } = {}, variance = 0) => {
        let total = 0;
        for (const enemy of living()) total += strike(enemy, mult - (variance ? random() * variance : 0), options);
        return total;
      };
      const mendSquad = (amount: number, note: string, shieldOverflow = false) => {
        let healed = 0, shielded = 0;
        b.allies.filter(a => a.hp > 0).forEach(a => {
          const before = a.hp;
          a.hp = Math.min(a.maxHp, a.hp + amount);
          healed += a.hp - before;
          // Sanctify: a healed ally that is already at full keeps the surplus
          // as a shield instead of wasting it.
          if (shieldOverflow && a.hp === a.maxHp && amount > a.hp - before) {
            const surplus = Math.round((amount - (a.hp - before)) * .6);
            if (surplus > 0) { a.shield = Math.min(Math.round(a.maxHp * .6), (a.shield ?? 0) + surplus); shielded += surplus; }
          }
        });
        b.log.unshift(`${actor.name}: ${note} → the squad recovers ${healed.toLocaleString()} HP${shielded ? ` and ${shielded.toLocaleString()} of it is sanctified into shields` : ""}.`);
      };
      // Every point of damage the squad lands, tracked for siphons and audits.
      let dealt = 0;
      const strikeCounted = (enemy: Combatant, mult: number, options: { ignoreDefense?: boolean; critical?: boolean } = {}) => {
        const damage = strike(enemy, mult, options);
        dealt += damage;
        return damage;
      };
      const label = command === "ultimate" ? c.ultimate : command === "skill" ? c.skill : "Attack";
      if (command === "guard") {
        actor.guard = true;
        actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(actor.maxHp * .08));
        if (c.mechanic === "detention") {
          b.allies.filter(a => a.hp > 0).forEach(a => { a.shield = Math.min(Math.round(a.maxHp * .5), (a.shield ?? 0) + Math.round(actor.defense * 1.2)); });
          b.log.unshift(`${actor.name} holds the line — the whole squad gains his guard, and 35 energy.`);
        } else {
          b.log.unshift(`${actor.name} guards, restores health, and gains 35 energy.`);
        }
      } else if (c.mechanic === "chaos") {
        // Penelope. Nothing about her is settled in advance, including how
        // useful she is. Every single turn is a different bad idea, and the
        // kitchen is not insured.
        if (command === "attack") {
          // The swing is genuinely unknown until it lands: anything from a
          // fumbled handle to a one-in-a-lifetime sear.
          const swing = .45 + random() * 1.65;
          const flavors = [
            "pan-flops the handle end",
            "loses her grip mid-spin",
            "delivers a textbook sear",
            "swings the wrong pan entirely",
            "absolutely launches it",
            "goes for the dramatic overhead",
            "closes her eyes and hopes",
            "hits it with the lid instead",
            "spins first, aims later",
            "swings with her eyes shut and her heart open",
            "does something the culinary club will be hearing about",
            "attempts a technique she saw once, badly",
          ];
          const damage = strike(target, swing, { critical: random() < .22 });
          b.log.unshift(`Penelope ${flavors[Math.floor(random() * flavors.length)]} → ${target.name} −${damage.toLocaleString()} HP`);
          // Sometimes the pan comes off the wall, off the floor, off the
          // chandelier - and lands on somebody else on the way back.
          if (random() < .22) {
            const others = living().filter(e => e !== target);
            if (others.length) {
              const ricochet = others[Math.floor(random() * others.length)];
              const extra = strike(ricochet, .6);
              b.log.unshift(`...and the pan ricochets off the ceiling into ${ricochet.name} for ${extra.toLocaleString()} more.`);
            }
          }
          // Extreme clumsiness tax: she clips herself. It is not much, and
          // honestly it is the least the squad expected.
          if (random() < .12) {
            const ow = Math.max(1, Math.round(actor.attack * .05));
            actor.hp = Math.max(1, actor.hp - ow);   // never actually finishes her off
            b.log.unshift(`Penelope clips her own shin on the follow-through for ${ow} damage. She is fine. She is always fine.`);
          }
        } else if (command === "skill") {
          // Every enemy gets a different amount, because she is measuring
          // with a wooden spoon and vibes.
          const total = strikeAll(1.5, {}, 1.1);
          b.log.unshift(`Penelope: ${label} → she fed every one of them a different portion: ${total.toLocaleString()} total damage.`);
          const ladle = random();
          if (ladle < .25) {
            // A pot lid, deployed as a shield. Nobody asked. It works.
            b.allies.filter(a => a.hp > 0).forEach(a => { a.shield = Math.min(Math.round(a.maxHp * .5), (a.shield ?? 0) + Math.round(actor.defense * 2)); });
            b.log.unshift(`${label}: she puts the LID on it - the squad is shielded and mildly embarrassed.`);
          } else {
            mendSquad(Math.round(actor.attack * (.5 + random() * 1.4)), "somebody ate it");
          }
        } else {
          // The ultimate. Five outcomes, one of which is good on purpose.
          const roll = random();
          if (roll < .3) {
            const total = strikeAll(3.2, { critical: true });
            b.log.unshift(`Penelope: ${label} — THE WHOLE STOVE GOES UP! ${total.toLocaleString()} total damage.`);
          } else if (roll < .55) {
            b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = a.maxHp; });
            b.log.unshift(`Penelope: ${label} — she catered the entire fight. The squad is fully restored and nobody asked how.`);
          } else if (roll < .8) {
            // The pan leaves the arena and comes back on its own schedule.
            const total = strikeAll(4.5, { critical: true }, 2.5);
            b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * .5)); });
            b.log.unshift(`Penelope: ${label} — THE PAN COMES BACK ON ITS OWN! ${total.toLocaleString()} damage, and the squad recovers.`);
          } else if (roll < .93) {
            // She panics, which reads as inspiration. Everyone on the squad
            // gets a full charge out of sheer secondhand adrenaline.
            const total = strikeAll(1.8);
            b.allies.filter(a => a.hp > 0).forEach(a => { a.energy = 100; });
            b.log.unshift(`Penelope: ${label} — SHE SCREAMS AND SWINGS AT EVERYTHING. ${total.toLocaleString()} damage, and the entire squad is fully charged out of pure adrenaline.`);
          } else {
            // The jackpot. Perfect timing, perfect heat, perfect pan.
            const total = strikeAll(4, { critical: true, ignoreDefense: true });
            b.allies.filter(a => a.hp > 0).forEach(a => {
              a.hp = a.maxHp;
              a.shield = Math.min(Math.round(a.maxHp * .6), (a.shield ?? 0) + Math.round(a.maxHp * .3));
              a.energy = Math.max(a.energy, 80);
            });
            b.streak = 0;
            b.log.unshift(`Penelope: ${label} — A PERFECT SOUFFLÉ. ${total.toLocaleString()} damage through all armor, the squad is fully restored, shielded, and energised. Nobody will ever be able to explain this.`);
          }
        }
      } else if (c.mechanic === "rateup") {
        // Ynna. The pity counter, weaponised: certainty builds while she goes
        // without a crit, and resets the moment one lands.
        const streak = b.streak ?? 0;
        const critChance = Math.min(.75, .14 + streak * .12);
        if (command === "ultimate") {
          const damage = strikeCounted(target, 3.6, { critical: true });
          b.streak = 0;
          if (target.hp === 0) actor.energy = Math.min(100, actor.energy + 20);
          b.log.unshift(`Ynna: ${label} → the guaranteed pull lands! ${target.name} −${damage.toLocaleString()} HP${target.hp === 0 ? ", and the refund covers her next one" : ""}.`);
        } else {
          const critical = random() < critChance;
          const damage = strikeCounted(target, command === "skill" ? 1.9 : 1.12, { critical });
          b.streak = critical ? 0 : streak + 1;
          if (command === "skill") actor.energy = Math.min(100, actor.energy + 15);
          b.log.unshift(`Ynna: ${label} → ${target.name} −${damage.toLocaleString()} HP${critical ? " · CRITICAL! Rate-up satisfied, the counter resets" : ` · ${Math.round(critChance * 100)}% rate-up and climbing`}.`);
        }
      } else if (c.mechanic === "sanctify") {
        // Solari. Nothing is wasted on the holy ledger.
        if (command === "ultimate") {
          const fallen = b.allies.find(a => a.hp <= 0);
          if (fallen) {
            fallen.hp = Math.round(fallen.maxHp * .5);
            fallen.shield = Math.round(fallen.maxHp * .25);
            b.log.unshift(`Solari: ${label} — ${fallen.name} is audited back onto the payroll at half strength!`);
          } else {
            b.log.unshift(`Solari: ${label} — no one has fallen, so the miracle is spent on the living.`);
          }
          mendSquad(Math.round(actor.attack * 2), "fiscal purity", true);
        } else if (command === "skill") {
          mendSquad(Math.round(actor.attack * 1.5), label, true);
        } else {
          const damage = strikeCounted(target, 1.15);
          const shield = Math.round(damage * .35);
          actor.shield = (actor.shield ?? 0) + shield;
          b.log.unshift(`Solari: ${label} → ${target.name} −${damage.toLocaleString()} HP, and ${shield.toLocaleString()} is set aside as a shield.`);
        }
      } else if (c.mechanic === "detention") {
        // Escanooor. His guard covers the room, not just himself.
        if (command === "ultimate") {
          const damage = strikeCounted(target, 3.2, { critical: true });
          target.stunned = true;
          b.log.unshift(`Escanooor: ${label} → ${target.name} −${damage.toLocaleString()} HP and detained. It will not act next turn.`);
        } else if (command === "skill") {
          const damage = strikeCounted(target, 2.1);
          b.allies.filter(a => a.hp > 0).forEach(a => { a.shield = Math.min(Math.round(a.maxHp * .5), (a.shield ?? 0) + Math.round(actor.defense * 1.4)); });
          const mark = target.audited ? " The mark on it pays out." : "";
          b.log.unshift(`Escanooor: ${label} → ${target.name} −${damage.toLocaleString()} HP. The squad is covered by his guard.${mark}`);
          if (target.audited) {                       // he collects open marks too
            target.hp = Math.max(0, target.hp - Math.round(actor.attack * .8));
            target.audited = false;
          }
        } else {
          const damage = strikeCounted(target, 1.15, { ignoreDefense: random() < .3 });
          b.log.unshift(`Escanooor: ${label} → ${target.name} −${damage.toLocaleString()} HP.`);
        }
      } else if (c.mechanic === "audit") {
        // Ninette. She does not out-damage anyone; she finds the number that
        // was always there, and everyone else collects it.
        if (command === "ultimate") {
          const audited = b.enemies.filter(e => e.audited && e.hp > 0);
          let total = 0;
          for (const enemy of audited) {
            total += strikeCounted(enemy, 3, { critical: true });
            enemy.audited = false;
          }
          b.allies.filter(a => a.hp > 0).forEach(a => { a.energy = Math.min(100, a.energy + 25); });
          b.log.unshift(total
            ? `Ninette: ${label} — every audited line item pays out. ${total.toLocaleString()} total damage and the squad is refunded 25 energy each.`
            : `Ninette: ${label} — the books were already clean. Nothing to collect, but the squad is refunded 25 energy each.`);
          mendSquad(Math.round(actor.attack * 1.2), "the ledger balances", false);
        } else if (command === "skill") {
          mendSquad(Math.round(actor.attack * 1.6), label, false);
          const audited = b.enemies.filter(e => e.audited && e.hp > 0);
          let total = 0;
          for (const enemy of audited) { total += strikeCounted(enemy, 1.2); enemy.audited = false; }
          if (total) b.log.unshift(`Ninette: ${audited.length} audited target${audited.length > 1 ? "s" : ""} pay out ${total.toLocaleString()} more, and the line items close.`);
        } else {
          const damage = strikeCounted(target, .9);
          target.audited = true;
          b.log.unshift(`Ninette: ${label} → ${target.name} −${damage.toLocaleString()} HP and marked. Every payout the squad lands on it from now on collects more.`);
        }
      } else if (c.mechanic === "takeover") {
        // Director Vane. He does not generate anything; he acquires it.
        if (command === "ultimate") {
          const total = b.enemies.filter(e => e.hp > 0).reduce((sum, e) => sum + strikeCounted(e, 2.3, { ignoreDefense: true }), 0);
          const skim = Math.round(total * .25);
          state.credits += skim;
          b.log.unshift(`Director Vane: ${label} — every hostile is acquired for ${total.toLocaleString()} total damage. The proceeds bank ${skim.toLocaleString()} credits.`);
        } else if (command === "skill") {
          const damage = strikeCounted(target, 1.5);
          const stolen = Math.min(target.energy, 30);
          target.energy -= stolen;
          actor.energy = Math.min(100, actor.energy + stolen);
          b.log.unshift(`Director Vane: ${label} → ${target.name} −${damage.toLocaleString()} HP. He acquires ${stolen} of its charge.`);
        } else {
          const damage = strikeCounted(target, 1.05);
          const rev = Math.round(damage * .06);
          state.credits += rev;
          b.log.unshift(`Director Vane: ${label} → ${target.name} −${damage.toLocaleString()} HP, billed as ${rev.toLocaleString()} credits.`);
        }
      } else if (c.mechanic === "siphon") {
        // The Mysterious Sorcerer. His damage is a loan; the squad is the
        // beneficiary, and he keeps the interest.
        const rate = command === "ultimate" ? .45 : command === "skill" ? .3 : .18;
        if (command === "ultimate") {
          const total = b.enemies.filter(e => e.hp > 0).reduce((sum, e) => sum + strikeCounted(e, 2.4), 0);
          b.log.unshift(`Sorcerer: ${label} → all debts come due: ${total.toLocaleString()} total damage.`);
        } else if (command === "skill") {
          const total = strikeCounted(target, 1.7);
          b.log.unshift(`Sorcerer: ${label} → ${target.name} −${total.toLocaleString()} HP, interest compounding.`);
        } else {
          const damage = strikeCounted(target, 1.1);
          b.log.unshift(`Sorcerer: ${label} → ${target.name} −${damage.toLocaleString()} HP.`);
        }
        const interest = Math.round(dealt * rate);
        mendSquad(interest, "the ledger pays out", false);
      } else if (c.mechanic === "pierce") {
        // Ruta. Her reach is the mechanic: nothing standing near her target is spared.
        if (command === "skill") {
          const first = strike(target, 1.5, { critical: random() < .2 });
          const second = target.hp > 0 ? strike(target, 1.1) : 0;
          b.log.unshift(`Ruta: ${label} → ${target.name} −${(first + second).toLocaleString()} HP across two thrusts.`);
        } else if (command === "ultimate") {
          const total = strikeAll(2.6, { ignoreDefense: true });
          b.log.unshift(`Ruta: ${label} — the line is skewered for ${total.toLocaleString()} total damage, armor ignored.`);
        } else {
          const primary = strike(target, 1, { critical: random() < .16 });
          let splashTotal = 0;
          for (const enemy of living()) if (enemy !== target) splashTotal += strike(enemy, .4);
          // Her reach occasionally surprises even her: the thrust keeps going
          // straight down the line and skewers whoever was standing behind.
          if (random() < .18) {
            let chain = 0;
            for (const enemy of living()) chain += strike(enemy, .7);
            b.log.unshift(`Ruta: the lance keeps going - nobody told it to stop. ${chain.toLocaleString()} more to everything down the line.`);
          }
          b.log.unshift(`Ruta: ${label} → ${target.name} −${primary.toLocaleString()} HP${splashTotal ? `, reach catches the rest for ${splashTotal.toLocaleString()}` : ""}.`);
        }
      } else if (c.mechanic === "drain") {
        // Purp. He takes from everything on the field and routes a share back to the squad.
        if (command === "attack") {
          const damage = strike(target, 1, { critical: random() < .16 });
          const share = Math.round(damage * .12);
          b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + share); });
          b.log.unshift(`Purp: ${label} → ${target.name} −${damage.toLocaleString()} HP, siphons ${share.toLocaleString()} back to the squad.`);
          // The grimoire runs ahead of him sometimes: it keeps drinking after
          // the spell is over and hands the surplus to whoever is nearest.
          if (random() < .18) {
            const leak = strikeAll(.55);
            const surplus = Math.round(leak * .35);
            b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + surplus); });
            b.log.unshift(`Purp: the grimoire will not close. It leaks arcane runoff into everything for ${leak.toLocaleString()} damage and hands ${surplus.toLocaleString()} back. He apologises to nobody.`);
          }
        } else {
          const total = strikeAll(command === "ultimate" ? 2.4 : 1.35);
          const share = Math.round(total * (command === "ultimate" ? .5 : .3));
          b.log.unshift(`Purp: ${label} → all hostiles for ${total.toLocaleString()} total damage.`);
          mendSquad(share, "packets rerouted");
        }
      } else if (c.mechanic === "riposte") {
        // Edgelord69. Armor means nothing to him, and bosses least of all.
        if (command === "skill") {
          actor.energy = Math.min(100, actor.energy + 30);
          const damage = strike(target, 1.8, { ignoreDefense: true, critical: random() < .25 });
          b.log.unshift(`Edgelord69: ${label} → ${target.name} −${damage.toLocaleString()} HP, armor ignored. He keeps his stance.`);
        } else if (command === "ultimate") {
          const overkill = target.boss ? 1.6 : 1;
          const damage = strike(target, 5 * overkill, { ignoreDefense: true, critical: true });
          b.log.unshift(`Edgelord69: ${label} → ${target.name} −${damage.toLocaleString()} HP. The plastic sword is gone for good.`);
        } else {
          const damage = strike(target, 1.05, { ignoreDefense: random() < .5, critical: random() < .2 });
          b.log.unshift(`Edgelord69: ${label} → ${target.name} −${damage.toLocaleString()} HP.`);
          // He talks during the swing. Occasionally the talking is the attack.
          if (random() < .18) {
            const segue = target.hp > 0 ? strike(target, .8, { ignoreDefense: true }) : 0;
            actor.energy = Math.min(100, actor.energy + 15);
            b.log.unshift(`Edgelord69: "...and THAT is why they call me—" he is still cutting. ${segue.toLocaleString()} more, armor ignored, and he gets 15 energy back for the monologue.`);
          }
        }
      } else if ((c.role === "Support" || c.role === "Healer") && command !== "attack") {
        mendSquad(Math.round(actor.attack * (command === "ultimate" ? 3 : 1.6)), label);
      } else {
        const critical = random() < .16;
        const power = command === "ultimate" ? 3.4 : command === "skill" ? 1.65 : 1;
        const hits = command === "ultimate" || (c.role === "Caster" && command === "skill") ? living() : [target];
        let total = 0;
        for (const enemy of hits) total += strike(enemy, power, { critical });
        b.log.unshift(`${actor.name}: ${label} → ${hits.length > 1 ? `all hostiles for ${total.toLocaleString()}` : `${target.name} −${total.toLocaleString()} HP`}${critical ? " · CRITICAL!" : ""}`);
      }
      if (b.enemies.every(e => e.hp === 0)) { b.status = "victory"; b.log.unshift("OPERATION COMPLETE! The council stands together."); }
      else {
        const next = b.allies.findIndex((a, i) => i > b.active && a.hp > 0);
        if (next >= 0) b.active = next;
        else {
          for (const enemy of b.enemies.filter(e => e.hp > 0)) {
            if (enemy.stunned) {
              enemy.stunned = false;
              b.log.unshift(`${enemy.name} is still in detention and loses its turn.`);
              continue;
            }
            const living = b.allies.filter(a => a.hp > 0);
            if (!living.length) break;
            const victim = living[Math.floor(random() * living.length)];
            let damage = Math.max(1, Math.round((enemy.attack - victim.defense * .35) * (victim.guard ? .35 : 1)));
            let absorbed = 0;
            if (victim.shield) {                       // Sanctify shields eat damage first
              absorbed = Math.min(victim.shield, damage);
              victim.shield -= absorbed;
              damage -= absorbed;
              if (victim.shield <= 0) victim.shield = undefined;
            }
            victim.hp = Math.max(0, victim.hp - damage);
            victim.energy = Math.min(100, victim.energy + 12);
            b.log.unshift(`${enemy.name}: ${moveFor(enemy.sprite ?? "", random)} → ${victim.name} −${damage.toLocaleString()} HP${absorbed ? ` (${absorbed.toLocaleString()} absorbed by a shield)` : victim.guard ? " (guarded)" : ""}.`);
          }
          b.turn++;
          b.active = b.allies.findIndex(a => a.hp > 0);
          if (b.active < 0) { b.status = "defeat"; b.log.unshift("The council retreats. Upgrade your squad and try again."); }
        }
      }
      b.log = b.log.slice(0, 25);
      message = b.status === "victory" ? "Operation complete!" : "Command executed.";
      break;
    }
    case "finishStage": {
      const b = state.battle;
      if (!b || b.status !== "victory") throw new Error("Win the battle before collecting rewards.");
      const first = !state.cleared.includes(b.stageId);
      if (first) {
        state.cleared.push(b.stageId);
        state.gems += 200;
        state.credits += 1500;
        const recruit = b.stageId === "1-4" ? "penelope" : b.stageId === "2-2" ? "purp" : b.stageId === "3-2" ? "solari" : b.stageId === "3-5" ? "ruta" : null;
        if (recruit && !state.roster.some(o => o.id === recruit)) state.roster.push({ id: recruit, level: 5, potential: 0, duplicates: 0 });
      } else state.credits += 300;
      state.battle = null;
      message = first ? "First clear! +200 gems and +1,500 credits. Next stage unlocked." : "Stage cleared! +300 credits.";
      break;
    }
    case "retreat": state.battle = null; message = "Returned to the campaign. Spent energy is not refunded."; break;
    default: throw new Error("Unknown game action.");
  }
  return { state, message, pulls };
}
export { initialState };
