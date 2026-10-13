import { characterById, characters, initialState, missionProgress, missions, ssrFeaturedId, stats, type Battle, type Combatant, type GameState, type PullResult } from "./game-data";
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
        const rarity = roll < .001 ? "UR" : guaranteed || roll < .021 ? "SSR" : roll < .221 ? "SR" : "R";
        const pool = characters.filter(c => c.rarity === rarity && (rarity !== "SSR" || c.id !== ssrFeaturedId));
        const pick = rarity === "SSR" && random() < .5 ? characterById(ssrFeaturedId) : pool[Math.floor(random() * pool.length)];
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
        const raw = actor.attack * mult * (options.critical ? 1.5 : 1) * (owned.potential >= 3 ? 1.1 : 1);
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
      const mendSquad = (amount: number, note: string) => {
        b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + amount); });
        b.log.unshift(`${actor.name}: ${note} → the squad recovers ${amount.toLocaleString()} HP.`);
      };
      const label = command === "ultimate" ? c.ultimate : command === "skill" ? c.skill : "Attack";
      if (command === "guard") {
        actor.guard = true;
        actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(actor.maxHp * .08));
        b.log.unshift(`${actor.name} guards, restores health, and gains 35 energy.`);
      } else if (c.mechanic === "chaos") {
        // Penelope. Nothing about her is settled in advance, including how useful she is.
        if (command === "attack") {
          const swing = .55 + random() * 1.45;
          const flavors = ["pan-flops the handle end", "loses her grip mid-spin", "delivers a perfect sear", "swings the wrong pan", "absolutely launches it"];
          const damage = strike(target, swing, { critical: random() < .22 });
          b.log.unshift(`Penelope ${flavors[Math.floor(random() * flavors.length)]} → ${target.name} −${damage.toLocaleString()} HP`);
        } else if (command === "skill") {
          const total = strikeAll(1.5, {}, 1.1);
          b.log.unshift(`Penelope: ${label} → ${living().length + 1} targets for ${total.toLocaleString()} total damage.`);
          mendSquad(Math.round(actor.attack * (.5 + random() * 1.4)), "somebody ate it");
        } else {
          const roll = random();
          if (roll < .4) {
            const total = strikeAll(3.2, { critical: true });
            b.log.unshift(`Penelope: ${label} — THE WHOLE STOVE GOES UP! ${total.toLocaleString()} total damage.`);
          } else if (roll < .75) {
            b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = a.maxHp; });
            b.log.unshift(`Penelope: ${label} — she catered the whole fight. The squad is fully restored!`);
          } else {
            const total = strikeAll(4.5, { critical: true }, 2.5);
            b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * .5)); });
            b.log.unshift(`Penelope: ${label} — EVERYTHING AT ONCE! ${total.toLocaleString()} damage and the squad recovers!`);
          }
        }
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
          b.log.unshift(`Ruta: ${label} → ${target.name} −${primary.toLocaleString()} HP${splashTotal ? `, reach catches the rest for ${splashTotal.toLocaleString()}` : ""}.`);
        }
      } else if (c.mechanic === "drain") {
        // Purp. He takes from everything on the field and routes a share back to the squad.
        if (command === "attack") {
          const damage = strike(target, 1, { critical: random() < .16 });
          const share = Math.round(damage * .12);
          b.allies.filter(a => a.hp > 0).forEach(a => { a.hp = Math.min(a.maxHp, a.hp + share); });
          b.log.unshift(`Purp: ${label} → ${target.name} −${damage.toLocaleString()} HP, siphons ${share.toLocaleString()} back to the squad.`);
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
            const living = b.allies.filter(a => a.hp > 0);
            if (!living.length) break;
            const victim = living[Math.floor(random() * living.length)];
            const damage = Math.max(1, Math.round((enemy.attack - victim.defense * .35) * (victim.guard ? .35 : 1)));
            victim.hp = Math.max(0, victim.hp - damage);
            victim.energy = Math.min(100, victim.energy + 12);
            b.log.unshift(`${enemy.name}: ${moveFor(enemy.sprite ?? "", random)} → ${victim.name} −${damage.toLocaleString()} HP${victim.guard ? " (guarded)" : ""}.`);
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
