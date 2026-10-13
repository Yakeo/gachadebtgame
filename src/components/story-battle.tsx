"use client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Crown, FastForward, Flag, Heart, History, LogOut, Pause, Play, Radio, Shield, SkipForward, Sparkles, Star, Swords, Target, WandSparkles, X, Zap } from "lucide-react";
import { characterById, type Battle } from "@/lib/game-data";
import { type Stage } from "@/lib/campaign";
import { useGame } from "./game-context";
import { Avatar, Chibi, Credit, Gem, Modal, ProgressBar, Spinner } from "./ui";
const speakerIds: Record<string, string> = { Ynna: "ynna", Ninette: "ninette", Edgelord69: "edgelord", Purp: "purp", "Mysterious Sorcerer": "purp", Solari: "solari", Escanooor: "escanooor", "Director Vane": "escanooor", "Server Core": "sentry", "Cursed Cat Mob": "cat", Penelope: "penelope", Ruta: "ruta" };
export function StoryScreen({ stage, phase, onComplete, onBack, busy, archive = false }: { stage: Stage; phase: "pre" | "post"; onComplete: () => void; onBack: () => void; busy: boolean; archive?: boolean }) {
  const { reducedMotion } = useGame();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(0);
  const [auto, setAuto] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const dialogue = useMemo(() => [...stage[phase], ...(choice ? [{ speaker: "Purp", text: choice === stage.choices?.[0] ? "A party invitation? You have excellent taste. But first, show me your resolve!" : "Bold words! Let's see if your tactics can back them up. En garde!" }] : [])], [stage, phase, choice]);
  const line = dialogue[Math.min(index, dialogue.length - 1)];
  const speakerId = speakerIds[line.speaker];
  const color = speakerId ? characterById(speakerId).color : "#468cd4";
  const isChoice = phase === "pre" && !!stage.choices && index === stage.pre.length - 1 && !choice;
  const next = useCallback(() => {
    if (busy || logOpen) return;
    if (visible < line.text.length) { setVisible(line.text.length); return; }
    if (isChoice) return;
    if (index < dialogue.length - 1) setIndex(i => i + 1);
    else onComplete();
  }, [busy, logOpen, visible, line.text.length, isChoice, index, dialogue.length, onComplete]);
  useEffect(() => { setIndex(0); setChoice(null); }, [stage.id, phase]);
  useEffect(() => {
    setVisible(reducedMotion ? line.text.length : 0);
    if (reducedMotion) return;
    const timer = setInterval(() => setVisible(n => Math.min(line.text.length, n + 3)), 16);
    return () => clearInterval(timer);
  }, [index, line.text, reducedMotion]);
  useEffect(() => { if (!auto || visible < line.text.length || isChoice || logOpen || busy) return; const timer = setTimeout(next, Math.max(1800, line.text.length * 25)); return () => clearTimeout(timer); }, [auto, visible, line.text.length, isChoice, logOpen, busy, next]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (["Space", "Enter", "ArrowRight"].includes(e.code) && !(e.target as HTMLElement).closest("button,input,a,select")) { e.preventDefault(); next(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [next]);
  return <section className={`story-screen chapter-${stage.chapter}`} style={{ "--speaker-color": color } as CSSProperties}><img className="story-background" src={stage.chapter === 1 ? "/images/council-keyart.jpg" : "/images/academy.jpg"} alt="" /><div className="story-shade" /><div className="story-topbar"><button onClick={onBack} disabled={busy}><ArrowLeft size={17} />{archive ? "Archives" : "Back"}</button><div><span>{archive ? "STORY ARCHIVE" : phase === "pre" ? "BEFORE THE OPERATION" : "AFTER THE OPERATION"}</span><strong>{stage.id} <b>/</b> {stage.title}</strong></div><span className="story-location">{stage.location}</span></div><div className="story-episode-marker"><span>CHAPTER</span><strong>0{stage.chapter}</strong><span>STORY {phase === "pre" ? "A" : "B"}</span></div>{speakerId && stage.chapter !== 1 && <div key={speakerId} className="story-character"><div className="story-character-glow" /><Chibi id={speakerId} /></div>}{phase === "post" && stage.id === "5-5" && index === dialogue.length - 1 && <div className="ending-title"><span>THE LEDGER IS BALANCED.</span><h1>To a new beginning.</h1><Heart size={30} /></div>}
    <div className="story-dialogue-wrap"><div className="story-nameplate"><span>{line.speaker}</span><small>{speakerId ? characterById(speakerId).title.toUpperCase() : "GACHA DEBT / STORY"}</small></div><div className="story-dialogue-box" onClick={next} role="button" tabIndex={0} aria-label="Advance dialogue"><p aria-label={line.text}>{line.text.slice(0, visible)}{visible < line.text.length && <span className="type-cursor" />}</p>{!isChoice && <button className="dialogue-next" onClick={e => { e.stopPropagation(); next(); }} disabled={busy} aria-label={index === dialogue.length - 1 ? "Complete story scene" : "Next dialogue"}>{busy ? <Spinner /> : <ChevronRight size={24} />}</button>}{isChoice && visible >= line.text.length && <div className="story-choices">{stage.choices!.map(c => <button key={c} onClick={e => { e.stopPropagation(); setChoice(c); setIndex(index + 1); }}><span>YOUR CHOICE</span>{c}<ArrowRight size={17} /></button>)}</div>}</div><div className="story-bottom-controls"><span className="dialogue-count">{String(index + 1).padStart(2, "0")} <b>/</b> {String(dialogue.length).padStart(2, "0")}<ProgressBar value={index + 1} max={dialogue.length} /></span><span className="story-hint">{isChoice ? "SOME CONNECTIONS BEGIN WITH A CHOICE." : "CLICK OR PRESS SPACE TO CONTINUE"}</span><div><button onClick={() => setLogOpen(true)}><History size={14} /> Log</button><button className={auto ? "active" : ""} onClick={() => setAuto(!auto)}>{auto ? <Pause size={14} /> : <Play size={14} />} Auto</button><button disabled={busy} onClick={onComplete}><SkipForward size={15} />{archive ? "Close" : "Skip"}</button></div></div></div>
    {logOpen && <Modal title="A moment, remembered." eyebrow="DIALOGUE LOG" onClose={() => setLogOpen(false)} className="dialogue-log-modal"><div className="dialogue-log">{dialogue.slice(0, index + 1).map((l, i) => <div key={i}><strong>{l.speaker}</strong><p>{l.text}</p></div>)}</div></Modal>}
  </section>;
}

export { BattleScreen } from "./combat-stage";
