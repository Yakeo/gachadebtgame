"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Clock3, Flame, Heart, ShieldCheck, Sparkles, Utensils } from "lucide-react";
import type { MaintenanceInfo } from "@/lib/maintenance";

/**
 * The maintenance door, staffed by Penelope.
 *
 * Two jobs, deliberately in this order:
 *
 * 1. Kick whoever is in the middle of a battle out of it. The page gate does
 *    that on load, and the in-game poll (game-context) does it for a tab that
 *    was already open - so this screen can arrive over live gameplay. The first
 *    thing it does is a jumpscare: Penelope's shocked face slams into the
 *    viewport with the screen shaking, then settles into the notice.
 * 2. Explain what is being patched, in the same voice as the rest of the game,
 *    and be obviously dismissible. A jumpscare that traps someone is a bug, so
 *    the notice underneath is quiet, readable and has no timer.
 *
 * Reduced Motion is respected: no shake, no strobe, no noise burst - the face
 * still appears (it is the point) but instantly and without animation.
 */
const JUMPSCARE_MS = 1500;

export function MaintenanceScreen({ info, onRetry }: { info: MaintenanceInfo; onRetry?: () => void }) {
  const [phase, setPhase] = useState<"scare" | "notice">("scare");
  const [scared, setScared] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const shake = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** A short, silly shriek. Synthesised so it ships with no audio asset. */
  const scream = useCallback(() => {
    if (shake) return;
    try {
      audio.current ??= new AudioContext();
      const context = audio.current;
      void context.resume();
      const now = context.currentTime;
      // Two detuned saws falling a fourth: close enough to a pan dropping.
      for (const [index, start] of [880, 1245].entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = index === 0 ? "sawtooth" : "square";
        oscillator.frequency.setValueAtTime(start, now);
        oscillator.frequency.exponentialRampToValueAtTime(start * 0.42, now + 0.45);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
      }
    } catch { /* browsers that refuse audio just get the visual scare */ }
  }, [shake]);

  useEffect(() => {
    scream();
    const timer = setTimeout(() => setPhase("notice"), shake ? 250 : JUMPSCARE_MS);
    return () => clearTimeout(timer);
  }, [scream, shake]);

  useEffect(() => () => { void audio.current?.close(); }, []);

  const scareAgain = () => {
    setScared(false);
    setPhase("scare");
    scream();
    setTimeout(() => setPhase("notice"), shake ? 250 : JUMPSCARE_MS);
  };

  if (phase === "scare") {
    return <div className={`penelope-scare ${shake ? "calm" : ""}`} role="alertdialog" aria-modal="true"
      aria-label="Penelope is screaming about the patch notes" onClick={() => setPhase("notice")}>
      <div className="penelope-scare-flash" aria-hidden="true" />
      <div className="penelope-scare-face">
        <img src="/images/faces/penelope-shocked.png" alt="Penelope, screaming" draggable={false} />
        <span className="penelope-scare-word">PAN!</span>
      </div>
      <div className="penelope-scare-foot">
        <strong>THE KITCHEN IS UNDER MAINTENANCE</strong>
        <span>tap anywhere to stop screaming</span>
      </div>
      {/* Without JavaScript the jumpscare would never hand over to the notice,
          so script-less visitors get the short version instead. */}
      <noscript>
        <style>{`.penelope-scare{display:none}`}</style>
        <div className="maintenance-noscript">
          <h1>UNDER MAINTENANCE · PATCH {info.patch}</h1>
          <p>{info.message}</p>
          <p>{info.eta}</p>
          <ul>{info.notes.map(note => <li key={note.title}><strong>{note.title}</strong> — {note.body}</li>)}</ul>
        </div>
      </noscript>
    </div>;
  }

  return <div className="maintenance-screen">
    <div className="maintenance-stripes" aria-hidden="true" />
    <div className="maintenance-shell">
      <header className="maintenance-head">
        <span className="maintenance-tape"><AlertTriangle size={12} /> COUNCIL EMERGENCY BROADCAST · MAINTENANCE</span>
        <span className="maintenance-patch">PATCH {info.patch} · {info.name}</span>
      </header>

      <div className="maintenance-hero">
        <div className="maintenance-star">
          <img src="/images/keyart-penelope.webp" alt="Penelope, holding a frying pan" draggable={false} />
          <span className="maintenance-star-tag"><Flame size={11} /> ON DUTY</span>
        </div>
        <div className="maintenance-copy">
          <p className="maintenance-kicker"><Sparkles size={13} /> THE SUPREME PAN REQUESTS A MOMENT</p>
          <h1>{info.headline}</h1>
          <p className="maintenance-message">{info.message}</p>
          <blockquote className="maintenance-quote">“{info.star.line}” <cite>— {info.star.name}, holding the door</cite></blockquote>
          <div className="maintenance-eta"><Clock3 size={14} />{info.eta}</div>
          <div className="maintenance-actions">
            <button className="primary-button" onClick={() => { setScared(true); scareAgain(); }}>
              <Utensils size={16} />{scared ? "Penelope is still here" : "Check the door again"}
            </button>
            <button className="secondary-button" onClick={onRetry ?? (() => window.location.reload())}>
              Reload the page <ArrowRight size={15} />
            </button>
          </div>
          <p className="maintenance-safe"><ShieldCheck size={13} />Your save is untouched: levels, potential, pity and pull history all survive the smoke.</p>
        </div>
      </div>

      <div className="maintenance-notes">
        <h2><Heart size={15} /> What is actually being patched</h2>
        <ol>
          {info.notes.map(note => <li key={note.title}>
            <Check size={14} />
            <div><strong>{note.title}</strong><p>{note.body}</p></div>
          </li>)}
        </ol>
      </div>

      <footer className="maintenance-foot">
        <span>GACHA DEBT · PREVIEW 0.1 → {info.patch}</span>
        <span>NO GEMS WERE HARMED · THE KITCHEN WAS ALREADY ON FIRE</span>
      </footer>
    </div>
  </div>;
}
