"use client";
import { useState } from "react";
import { ArrowRight, Check, Gift, Sparkles } from "lucide-react";
import { characterById, starterUrPool } from "@/lib/game-data";
import { useGame } from "./game-context";
import { Chibi, Modal } from "./ui";

export function StarterUrDialog({ onClose, onViewRoster }: { onClose: () => void; onViewRoster: () => void }) {
  const { state, busy, action } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const choices = starterUrPool();
  const pick = choices.find(c => c.id === selected);
  const owned = state.roster.some(c => c.id === selected);
  const claimed = state.starterUrClaimed ? characterById(state.starterUrClaimed) : null;
  return <Modal title={claimed ? "Welcome to the council!" : "Choose your free UR"} eyebrow="WELCOME GIFT · ONCE PER SAVE" className="starter-ur-modal" onClose={onClose}>
    {claimed ? <div className="starter-ur-success"><Check size={32} /><h3>{claimed.name} is yours.</h3><p>Your choice is saved. You can add them to your squad from Characters.</p><button className="primary-button full-width" onClick={onViewRoster}>View characters <ArrowRight size={18} /></button></div> : <>
      <p className="modal-description">One UR of your choice, completely free. Preview each character below, then confirm. Closing this window saves the gift for later.</p>
      <fieldset className="starter-ur-options" disabled={busy || Boolean(state.battle)}><legend>Select one UR character</legend>{choices.map(c => <label key={c.id} className={`starter-ur-option ${selected === c.id ? "selected" : ""}`}>
        <input type="radio" name="starter-ur" value={c.id} checked={selected === c.id} onChange={() => setSelected(c.id)} />
        <span className="starter-ur-art" aria-hidden="true">{c.keyart ? <img src={c.keyart} alt="" /> : <Chibi id={c.id} />}</span>
        <span className="starter-ur-rarity">UR</span><strong>{c.name}</strong><small>{c.element} / {c.role}</small><span className="starter-ur-title">{c.title}</span>
      </label>)}</fieldset>
      {pick && <div className="starter-ur-preview" aria-live="polite"><strong><Sparkles size={16} />{pick.name} · {pick.weapon}</strong><p>{pick.description}</p><p><b>{pick.skill}:</b> {pick.skillNote}</p><p><b>{pick.ultimate}:</b> {pick.ultimateNote}</p>{owned && <p className="starter-ur-duplicate">Already recruited: choosing them gives 1 duplicate token and 100 credits instead.</p>}</div>}
      <p className="starter-ur-note"><Gift size={16} />Costs 0 gems. Does not use or reset pity. Your confirmed choice is permanent.</p>
      <button className="primary-button full-width starter-ur-confirm" disabled={!pick || busy || Boolean(state.battle)} onClick={async () => { if (pick) await action("starterUr", { id: pick.id }); }}>{busy ? "Saving your choice…" : pick ? `Confirm free UR · ${pick.name}` : "Select a UR to continue"}</button>
      {state.battle && <p className="starter-ur-note">Finish or retreat from your battle before claiming.</p>}
    </>}
  </Modal>;
}
