"use client";
import { useEffect, useRef } from "react";
import type { Battle } from "@/lib/game-data";

export function InitiativeStrip({ battle }: { battle: Battle }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const node = list.current;
    const current = node?.querySelector<HTMLElement>("[aria-current=step]");
    if (node && current) node.scrollLeft = current.offsetLeft - (node.clientWidth - current.offsetWidth) / 2;
  }, [battle.turn, battle.initiativeIndex, battle.status]);
  if (!battle.initiative?.length) return null;
  return <section className="initiative-strip" aria-label="Round initiative order"><div className="initiative-caption"><strong>ROUND {battle.turn}</strong><span>Speed + D20</span></div><ol ref={list}>{battle.initiative.map((entry, index) => {
    const unit = (entry.side === "ally" ? battle.allies : battle.enemies).find(u => u.id === entry.id);
    if (!unit) return null;
    const spent = index < (battle.initiativeIndex ?? 0) || unit.hp <= 0;
    const turnsAway = battle.initiative!.slice(battle.initiativeIndex ?? 0, index).filter(slot =>
      (slot.side === "ally" ? battle.allies : battle.enemies).some(u => u.id === slot.id && u.hp > 0)).length;
    const current = !spent && index === (battle.initiativeIndex ?? 0) && battle.status === "active";
    return <li key={`${entry.side}-${entry.id}`} className={`${entry.side} ${spent ? "spent" : ""} ${current ? "current" : ""}`} aria-current={current ? "step" : undefined}><b title={`Turn ${index + 1}`}>{index + 1}</b><div><strong>{unit.name}</strong><span>{unit.hp <= 0 ? "DOWN" : spent ? "ACTED" : current ? "ACT NOW" : `IN ${turnsAway} TURN${turnsAway === 1 ? "" : "S"}`} · SPD {unit.speed ?? 100} · {entry.roll === undefined ? "LEGACY" : `D20 ${entry.roll}`} · INIT {entry.score}</span></div></li>;
  })}</ol></section>;
}
