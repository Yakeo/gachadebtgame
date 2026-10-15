"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ArrowRight, Shield, Sparkles, Swords, WandSparkles, Zap } from "lucide-react";
import type { Character, Combatant } from "@/lib/game-data";
import { BATTLE_COMMANDS, commandDetails, type BattleCommand } from "@/lib/battle-commands";
import { Chibi } from "./ui";

const icons = { attack: Swords, skill: WandSparkles, guard: Shield, ultimate: Sparkles };
export function BattleCommandPanel({ character, actor, targetName, locked, onInspect, onActivate }: {
  character: Character; actor: Combatant; targetName: string;
  locked: boolean; onInspect: () => void; onActivate: (command: BattleCommand) => void;
}) {
  const [selected, setSelected] = useState<BattleCommand>("skill");
  const details = commandDetails(character, selected);
  const insufficient = actor.energy < details.cost;
  const inspect = useCallback((command: BattleCommand) => {
    if (locked) return;
    onInspect();
    setSelected(command);
  }, [locked, onInspect]);
  const activate = useCallback(() => {
    if (!locked && !insufficient) onActivate(selected);
  }, [locked, insufficient, onActivate, selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (locked || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        (event.target as HTMLElement).closest("input,select,textarea,[contenteditable=true]")) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < BATTLE_COMMANDS.length && Number.isInteger(index)) {
        event.preventDefault(); inspect(BATTLE_COMMANDS[index]);
      } else if (event.key === "Enter" && !(event.target as HTMLElement).closest("button,a")) {
        event.preventDefault(); activate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activate, inspect, locked]);

  return <section className="battle-command-panel" style={{ "--operator-color": character.color } as CSSProperties} aria-label="Command inspection">
    <div className="operator-brief"><div className="operator-model"><Chibi id={actor.id} /></div><div><span className="eyebrow">ACTIVE OPERATOR</span><strong>{actor.name}</strong><small>{character.element} / {character.role}</small><span className="operator-energy"><Zap size={12} />{actor.energy} / 100 ENERGY</span></div></div>
    <div className="command-inspection">
      <div className="command-selector" role="group" aria-label="Inspect a command before activating">
        {BATTLE_COMMANDS.map((command, index) => {
          const Icon = icons[command]; const info = commandDetails(character, command);
          return <button key={command} className={`inspect-command ${command} ${selected === command ? "selected" : ""}`} aria-pressed={selected === command} aria-controls={`command-detail-${actor.id}`} disabled={locked} onClick={() => inspect(command)}><span>{index + 1}</span><Icon size={18} /><strong>{command.charAt(0).toUpperCase() + command.slice(1)}</strong><small>{info.cost ? `${info.cost} EN` : "+35 EN"}</small></button>;
        })}
      </div>
      <div className="command-detail" id={`command-detail-${actor.id}`} aria-live="polite"><div className="command-detail-heading"><span>{selected.toUpperCase()} / {details.cost ? `${details.cost} ENERGY` : "+35 ENERGY"}</span><strong>{details.name}</strong></div><p>{details.description}</p><div className="command-target"><Shield size={12} /><span>{details.target}{details.target.includes("Selected enemy") ? ` · ${targetName}` : ""}</span></div></div>
    </div>
    <div className="command-activation"><span className={`command-readiness ${insufficient ? "charging" : "ready"}`}>{insufficient ? `NEED ${details.cost - actor.energy} MORE ENERGY` : locked ? "RESOLVING" : "READY"}</span><button className={`activate-command ${selected}`} disabled={locked || insufficient} onClick={activate}>Activate {selected}<ArrowRight size={19} /></button><small>1–4 inspect · Enter activates<br />Selecting does not spend your turn.</small></div>
  </section>;
}
