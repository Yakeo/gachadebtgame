"use client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Crown, FastForward, Flag, Heart, History, LogOut, Pause, Play, Radio, Shield, SkipForward, Sparkles, Star, Swords, Target, WandSparkles, X, Zap } from "lucide-react";
import { characterById, type Battle } from "@/lib/game-data";
import { battlefieldFor, type Stage } from "@/lib/campaign";
import { portraitFor, portraitUrl, speakerName } from "@/lib/expressions";
import { useGame } from "./game-context";
import { Avatar, Battlefield, Credit, Gem, Modal, ProgressBar, Spinner } from "./ui";
export function StoryScreen({ stage, phase, onComplete, onBack, busy, archive = false }: { stage: Stage; phase: "pre" | "post"; onComplete: () => void; onBack: () => void; busy: boolean; archive?: boolean }) {
  const { reducedMotion } = useGame();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(0);
  const [auto, setAuto] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const dialogue = useMemo(() => [...stage[phase], ...(choice ? [{ speaker: "Purp", text: choice === stage.choices?.[0] ? "A party invitation? You have excellent taste. But first, show me your resolve!" : "Bold words! Let's see if your tactics can back them up. En garde!" }] : [])], [stage, phase, choice]);
  const line = dialogue[Math.min(index, dialogue.length - 1)];
  const { id: speakerId, mood } = portraitFor(line.speaker, line.text);
  const color = speakerId ? characterById(speakerId).color : "#468cd4";

  // A conversation reads better with both people on stage. Each character is
  // pinned to one side for the whole scene, in order of first appearance, so
  // nobody teleports across the screen when the speaker alternates.
  const cast = useMemo(() => {
    const order: string[] = [];
    for (const entry of dialogue) {
      const id = portraitFor(entry.speaker, entry.text).id;
      if (id && !order.includes(id)) order.push(id);
    }
    return order;
  }, [dialogue]);

  // Whoever spoke last before this line is the person being addressed, so they
  // stay on stage as the listener.
  const partnerId = (() => {
    for (let i = Math.min(index, dialogue.length - 1) - 1; i >= 0; i--) {
      const id = portraitFor(dialogue[i].speaker, dialogue[i].text).id;
      if (id && id !== speakerId) return id;
    }
    return null;
  })();

  const sideOf = (id: string | null) =>
    id && cast.indexOf(id) % 2 === 0 ? "left" : "right";
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
  return <section className={`story-screen chapter-${stage.chapter}`} style={{ "--speaker-color": color } as CSSProperties}><Battlefield className="story-background" src={stage.chapter === 1 ? "/images/council-keyart.jpg" : battlefieldFor(stage.chapter)} alt="" /><div className="story-shade" /><div className="story-topbar"><button onClick={onBack} disabled={busy}><ArrowLeft size={17} />{archive ? "Archives" : "Back"}</button><div><span>{archive ? "STORY ARCHIVE" : phase === "pre" ? "BEFORE THE OPERATION" : "AFTER THE OPERATION"}</span><strong>{stage.id} <b>/</b> {stage.title}</strong></div><span className="story-location">{stage.location}</span></div><div className="story-episode-marker"><span>CHAPTER</span><strong>0{stage.chapter}</strong><span>STORY {phase === "pre" ? "A" : "B"}</span></div>{partnerId && partnerId !== speakerId && <div key={`partner-${partnerId}`} className={`story-portrait side-${sideOf(speakerId) === "left" ? "right" : "left"} is-listener`} aria-hidden="true"><span className="story-portrait-glow" style={{ "--character-color": characterById(partnerId).color } as CSSProperties} /><img src={portraitUrl(partnerId, "calm")} alt="" draggable={false} /></div>}{speakerId && <div key={`${speakerId}-${mood}`} className={`story-portrait side-${sideOf(speakerId)} mood-${mood}`} aria-hidden="true"><span className="story-portrait-glow" style={{ "--character-color": color } as CSSProperties} /><img src={portraitUrl(speakerId, mood)} alt="" draggable={false} /></div>}{phase === "post" && stage.id === "5-5" && index === dialogue.length - 1 && <div className="ending-title"><span>THE LEDGER IS BALANCED.</span><h1>To a new beginning.</h1><Heart size={30} /></div>}
    <div className="story-dialogue-wrap"><div className="story-nameplate"><span>{speakerName(line.speaker)}</span><small>{speakerId ? characterById(speakerId).title.toUpperCase() : "GACHA DEBT / STORY"}</small></div><div className="story-dialogue-box" onClick={next} role="button" tabIndex={0} aria-label="Advance dialogue"><p aria-label={line.text}>{line.text.slice(0, visible)}{visible < line.text.length && <span className="type-cursor" />}</p>{!isChoice && <button className="dialogue-next" onClick={e => { e.stopPropagation(); next(); }} disabled={busy} aria-label={index === dialogue.length - 1 ? "Complete story scene" : "Next dialogue"}>{busy ? <Spinner /> : <ChevronRight size={24} />}</button>}{isChoice && visible >= line.text.length && <div className="story-choices">{stage.choices!.map(c => <button key={c} onClick={e => { e.stopPropagation(); setChoice(c); setIndex(index + 1); }}><span>YOUR CHOICE</span>{c}<ArrowRight size={17} /></button>)}</div>}</div><div className="story-bottom-controls"><span className="dialogue-count">{String(index + 1).padStart(2, "0")} <b>/</b> {String(dialogue.length).padStart(2, "0")}<ProgressBar value={index + 1} max={dialogue.length} /></span><span className="story-hint">{isChoice ? "SOME CONNECTIONS BEGIN WITH A CHOICE." : "CLICK OR PRESS SPACE TO CONTINUE"}</span><div><button onClick={() => setLogOpen(true)}><History size={14} /> Log</button><button className={auto ? "active" : ""} onClick={() => setAuto(!auto)}>{auto ? <Pause size={14} /> : <Play size={14} />} Auto</button><button disabled={busy} onClick={onComplete}><SkipForward size={15} />{archive ? "Close" : "Skip"}</button></div></div></div>
    {logOpen && <Modal title="A moment, remembered." eyebrow="DIALOGUE LOG" onClose={() => setLogOpen(false)} className="dialogue-log-modal"><div className="dialogue-log">{dialogue.slice(0, index + 1).map((l, i) => <div key={i}><strong>{l.speaker}</strong><p>{l.text}</p></div>)}</div></Modal>}
  </section>;
}

export { BattleScreen } from "./combat-stage";
