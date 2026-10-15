import type { Character } from "./game-data";
export const BATTLE_COMMANDS = ["attack", "skill", "guard", "ultimate"] as const;
export type BattleCommand = typeof BATTLE_COMMANDS[number];

export function commandDetails(c: Character, command: BattleCommand) {
  const cost = command === "skill" ? 20 : command === "ultimate" ? 100 : 0;
  const name = command === "skill" ? c.skill : command === "ultimate" ? c.ultimate : command === "attack" ? "Attack" : "Guard";
  const description = command === "skill" ? c.skillNote : command === "ultimate" ? c.ultimateNote : command === "attack"
    ? `Strike with ${c.weapon}. Restore 35 energy, up to 100. Character-specific attack effects still apply.`
    : `Restore 8% of your maximum HP and reduce incoming damage by 65% until your next action. Restore 35 energy, up to 100.${c.mechanic === "detention" ? " Also shield living squad members." : ""}`;
  let target = "Selected enemy";
  if (command === "guard") target = c.mechanic === "detention" ? "Self + squad shields" : "Self";
  else if (command !== "attack") {
    if (c.mechanic === "chaos") target = "Variable — chaos outcome";
    else if (c.mechanic === "audit") target = command === "ultimate" ? "Audited enemies + squad" : "Selected enemy + squad";
    else if (c.mechanic === "detention") target = command === "ultimate" ? "Selected enemy" : "Selected enemy + squad shields";
    else if (c.mechanic === "riposte" || c.mechanic === "rateup") target = "Selected enemy";
    else if (c.mechanic === "sanctify") target = "Squad";
    else if (c.mechanic === "siphon") target = command === "ultimate" ? "All enemies + living allies" : "Selected enemy + living allies";
    else if (c.mechanic === "takeover" || c.mechanic === "pierce") target = command === "ultimate" ? "All enemies" : "Selected enemy";
    else if (c.mechanic === "drain") target = "All enemies + living allies";
    else if (["Support", "Healer"].includes(c.role)) target = "Living allies";
    else if (command === "ultimate" || c.role === "Caster") target = "All enemies";
  }
  return { name, description, cost, target };
}
