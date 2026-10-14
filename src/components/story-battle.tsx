"use client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Crown, FastForward, Flag, Heart, History, LogOut, Pause, Play, Radio, Shield, SkipForward, Sparkles, Star, Swords, Target, WandSparkles, X, Zap } from "lucide-react";
import type { Battle } from "@/lib/game-data";
import { battlefieldFor, stageScript, type Flags, type LineEntry, type ScriptLine, type Stage } from "@/lib/campaign";
import { portraitFor, portraitUrl, speakerName, speakerProfile } from "@/lib/expressions";
import { useGame } from "./game-context";
import { Avatar, Battlefield, Credit, Gem, Modal, ProgressBar, Spinner } from "./ui";
export function StoryScreen({ stage, phase, onComplete, onBack, busy, archive = false }: { stage: Stage; phase: "pre" | "post"; onComplete: () => void; onBack: () => void; busy: boolean; archive?: boolean }) {
  const { reducedMotion, state, action } = useGame();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(0);
  const [auto, setAuto] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  // Picks made during this sitting, so the reply appears the moment you choose
  // rather than waiting for the save to come back.
  const [picked, setPicked] = useState<Flags>({});

  // What you picked in earlier scenes is what this scene reads, so the branch
  // survives a page reload and carries into the archive.
  const flags = useMemo<Flags>(() => ({ ...(state.choices ?? {}), ...picked }), [state.choices, picked]);
  const entries = useMemo(() => stageScript(stage, phase, flags, flags), [stage, phase, flags]);

  const current = entries[Math.min(index, entries.length - 1)];
  const isChoice = current?.kind === "choice";
  const choice = isChoice ? current : null;
  const answered = choice ? flags[choice.id] : undefined;

  // While a choice is on screen the portraits should hold whoever was speaking,
  // rather than blanking the stage at the moment of decision.
  const line = useMemo(() => {
    if (!isChoice) return current as LineEntry;
    for (let i = index - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.kind === "line") return entry;
    }
    return { speaker: "Narrator", text: "" } as ScriptLine;
  }, [current, entries, index, isChoice]);

  const { id: speakerId, mood } = portraitFor(line.speaker, line.text ?? "");
  const color = speakerId ? speakerProfile(speakerId).color : "#468cd4";

  // A conversation reads better with both people on stage. Each character is
  // pinned to one side for the whole scene, in order of first appearance, so
  // nobody teleports across the screen when the speaker alternates.
  const cast = useMemo(() => {
    const order: string[] = [];
    for (const entry of entries) {
      if (entry.kind !== "line") continue;
      const id = portraitFor(entry.speaker, entry.text).id;
      if (id && !order.includes(id)) order.push(id);
    }
    return order;
  }, [entries]);

  // Whoever spoke last before this line is the person being addressed, so they
  // stay on stage as the listener.
  const partnerId = (() => {
    for (let i = Math.min(index, entries.length - 1) - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.kind !== "line") continue;
      const id = portraitFor(entry.speaker, entry.text).id;
      if (id && id !== speakerId) return id;
    }
    return null;
  })();

  const sideOf = (id: string | null) =>
    id && cast.indexOf(id) % 2 === 0 ? "left" : "right";

  const text = isChoice ? choice!.prompt : line.text;
  const last = index >= entries.length - 1;

  const next = useCallback(() => {
    if (busy || logOpen) return;
    // A decision has to be made before the scene can continue.
    if (isChoice && !answered) return;
    if (!isChoice && visible < text.length) { setVisible(text.length); return; }
    if (!last) setIndex(i => i + 1);
    else onComplete();
  }, [busy, logOpen, isChoice, answered, visible, text.length, last, onComplete]);

  const pick = useCallback((optionId: string) => {
    if (!choice) return;
    setPicked(p => ({ ...p, [choice.id]: optionId }));
    // The archive is a reading room, not a place to rewrite your save.
    if (!archive) action("choose", { id: choice.id, option: optionId }, true);
    setIndex(i => i + 1);
  }, [choice, archive, action]);

  useEffect(() => { setIndex(0); setPicked({}); }, [stage.id, phase]);
  useEffect(() => {
    setVisible(reducedMotion || isChoice ? text.length : 0);
    if (reducedMotion || isChoice) return;
    const timer = setInterval(() => setVisible(n => Math.min(text.length, n + 3)), 16);
    return () => clearInterval(timer);
  }, [index, text, reducedMotion, isChoice]);
  useEffect(() => { if (!auto || visible < text.length || isChoice || logOpen || busy) return; const timer = setTimeout(next, Math.max(1800, text.length * 25)); return () => clearTimeout(timer); }, [auto, visible, text.length, isChoice, logOpen, busy, next]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (["Space", "Enter", "ArrowRight"].includes(e.code) && !(e.target as HTMLElement).closest("button,input,a,select")) { e.preventDefault(); next(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [next]);

  const spoken = entries.filter((e): e is LineEntry => e.kind === "line");

  return <section className={`story-screen chapter-${stage.chapter}`} style={{ "--speaker-color": color } as CSSProperties}><Battlefield className="story-background" src={stage.chapter === 1 ? "/images/council-keyart.jpg" : battlefieldFor(stage.chapter)} alt="" /><div className="story-shade" /><div className="story-topbar"><button onClick={onBack} disabled={busy}><ArrowLeft size={17} />{archive ? "Archives" : "Back"}</button><div><span>{archive ? "STORY ARCHIVE" : phase === "pre" ? "BEFORE THE OPERATION" : "AFTER THE OPERATION"}</span><strong>{stage.id} <b>/</b> {stage.title}</strong></div><span className="story-location">{stage.location}</span></div><div className="story-episode-marker"><span>CHAPTER</span><strong>0{stage.chapter}</strong><span>STORY {phase === "pre" ? "A" : "B"}</span></div>{partnerId && partnerId !== speakerId && <div key={`partner-${partnerId}`} className={`story-portrait side-${sideOf(speakerId) === "left" ? "right" : "left"} is-listener`} aria-hidden="true"><span className="story-portrait-glow" style={{ "--character-color": speakerProfile(partnerId).color } as CSSProperties} /><img src={portraitUrl(partnerId, "calm")} alt="" draggable={false} /></div>}{speakerId && <div key={`${speakerId}-${mood}`} className={`story-portrait side-${sideOf(speakerId)} mood-${mood}`} aria-hidden="true"><span className="story-portrait-glow" style={{ "--character-color": color } as CSSProperties} /><img src={portraitUrl(speakerId, mood)} alt="" draggable={false} /></div>}{phase === "post" && stage.id === "5-5" && index === entries.length - 1 && <div className="ending-title"><span>THE LEDGER IS BALANCED.</span><h1>To a new beginning.</h1><Heart size={30} /></div>}
    <div className="story-dialogue-wrap"><div className="story-nameplate"><span>{isChoice ? "DECISION" : speakerName(line.speaker)}</span><small>{isChoice ? "THIS ONE IS YOURS" : speakerId ? speakerProfile(speakerId).title.toUpperCase() : "GACHA DEBT / STORY"}</small></div><div className={`story-dialogue-box${isChoice ? " at-choice" : ""}`} onClick={next} role="button" tabIndex={0} aria-label="Advance dialogue"><p aria-label={text}>{text.slice(0, visible)}{!isChoice && visible < text.length && <span className="type-cursor" />}</p>{!isChoice && <button className="dialogue-next" onClick={e => { e.stopPropagation(); next(); }} disabled={busy} aria-label={last ? "Complete story scene" : "Next dialogue"}>{busy ? <Spinner /> : <ChevronRight size={24} />}</button>}{isChoice && <div className="story-choices">{choice!.options.map(option => <button key={option.id} className={answered === option.id ? "picked" : ""} disabled={!!answered && !archive} onClick={e => { e.stopPropagation(); pick(option.id); }}><span>YOUR CHOICE</span>{option.label}<ArrowRight size={17} /></button>)}</div>}</div><div className="story-bottom-controls"><span className="dialogue-count">{String(index + 1).padStart(2, "0")} <b>/</b> {String(entries.length).padStart(2, "0")}<ProgressBar value={index + 1} max={entries.length} /></span><span className="story-hint">{isChoice ? "EVERY CHOICE IS REMEMBERED." : "CLICK OR PRESS SPACE TO CONTINUE"}</span><div><button onClick={() => setLogOpen(true)}><History size={14} /> Log</button><button className={auto ? "active" : ""} onClick={() => setAuto(!auto)}>{auto ? <Pause size={14} /> : <Play size={14} />} Auto</button><button disabled={busy} onClick={onComplete}><SkipForward size={15} />{archive ? "Close" : "Skip"}</button></div></div></div>
    {logOpen && <Modal title="A moment, remembered." eyebrow="DIALOGUE LOG" onClose={() => setLogOpen(false)} className="dialogue-log-modal"><div className="dialogue-log">{spoken.slice(0, index + 1).map((l, i) => <div key={i}><strong>{speakerName(l.speaker)}</strong><p>{l.text}</p></div>)}</div></Modal>}
  </section>;
}

export { BattleScreen } from "./combat-stage";
