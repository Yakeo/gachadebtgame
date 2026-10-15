"use client";

import { useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { stats } from "@/lib/game-data";
import { affordableLevels, MAX_CHARACTER_LEVEL, upgradeCost } from "@/lib/leveling";
import { useGame } from "./game-context";
import { Credit, ProgressBar } from "./ui";

/** Key this by character ID so switching recruits resets the selection. */
export function LevelUpgrade({ id, onUpgraded }: { id: string; onUpgraded: () => void }) {
  const { state, action, busy } = useGame();
  const [selection, setSelection] = useState(1);
  const owned = state.roster.find(c => c.id === id);
  const level = owned?.level ?? 1;
  const maxCount = owned ? affordableLevels(level, state.credits) : 0;
  // Clamp immediately when credits or level change, without waiting for an effect.
  const count = maxCount > 0 ? Math.min(selection, maxCount) : 0;
  const target = level + count;
  const cost = count ? upgradeCost(level, count) : 0;
  const currentStats = owned ? stats(owned) : null;
  const nextStats = owned ? stats({ ...owned, level: target }) : null;
  const disabled = busy || maxCount === 0;
  const atCap = level >= MAX_CHARACTER_LEVEL;

  async function confirm() {
    if (disabled) return;
    const result = await action("upgrade", { id, levels: count });
    if (result) { setSelection(1); onUpgraded(); }
  }

  return <section className="level-upgrade" aria-label="Character level upgrade">
    <div className="level-section">
      <div><span className="detail-label">CHARACTER LEVEL</span><strong>{String(level).padStart(2, "0")}<small> / {MAX_CHARACTER_LEVEL}</small></strong></div>
      {count > 0 && <span className="level-target"><ArrowRight size={15} /> LV. {target}</span>}
    </div>
    <ProgressBar value={level} max={MAX_CHARACTER_LEVEL} />
    <div className="level-slider-heading"><label htmlFor={`level-count-${id}`}>LEVELS TO ADD</label><output htmlFor={`level-count-${id}`}>+{count}</output></div>
    <div className="level-slider-controls">
      <button aria-label="Add one fewer level" disabled={disabled || count <= 1} onClick={() => setSelection(count - 1)}><Minus size={16} /></button>
      <input id={`level-count-${id}`} type="range" min={1} max={Math.max(1, maxCount)} step={1} value={Math.max(1, count)} disabled={disabled} onChange={e => setSelection(Number(e.target.value))} aria-valuetext={count ? `${count} levels, target level ${target}, ${cost.toLocaleString()} credits` : "No affordable upgrades"} />
      <button aria-label="Add one more level" disabled={disabled || count >= maxCount} onClick={() => setSelection(count + 1)}><Plus size={16} /></button>
      <button className="level-max" disabled={disabled} onClick={() => setSelection(maxCount)}>MAX</button>
    </div>
    <p className="level-budget">{!owned ? "Recruit this character to level them up." : atCap ? "Maximum level reached." : maxCount === 0 ? `Need ${(level * 200).toLocaleString()} credits for the next level.` : `Up to ${maxCount} levels affordable. Drag the slider or use the arrow keys.`}</p>
    {count > 0 && currentStats && nextStats && <div className="level-stat-preview" aria-label="Stat gains"><span>HP <b>+{nextStats.hp - currentStats.hp}</b></span><span>ATK <b>+{nextStats.attack - currentStats.attack}</b></span><span>DEF <b>+{nextStats.defense - currentStats.defense}</b></span><span>SPD <b>+{nextStats.speed - currentStats.speed}</b></span></div>}
    <div className="level-cost"><span><Credit size={13} />{state.credits.toLocaleString()} available</span><strong><Credit size={14} />{cost.toLocaleString()} total</strong></div>
    <button className="small-primary full-width" disabled={disabled} onClick={confirm}>{atCap ? "MAX LEVEL" : `Level up${count ? ` ×${count}` : ""}`}<ArrowRight size={16} /></button>
  </section>;
}
