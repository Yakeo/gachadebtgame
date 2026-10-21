"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { initialState, type GameState, type Player, type PullResult } from "@/lib/game-data";
import type { MaintenanceInfo } from "@/lib/maintenance";
export type GameResult = { state: GameState; player: Player; message: string; pulls?: PullResult[] };
export type Action = (action: string, args?: Record<string, unknown>, quiet?: boolean) => Promise<GameResult | null>;
type GameContextType = { state: GameState; player: Player | null; busy: boolean; loading: boolean; error: boolean; googleEnabled: boolean; maintenance: MaintenanceInfo | null; action: Action; notify: (text: string, type?: "success" | "error") => void; toast: { text: string; type: "success" | "error" } | null; dismissToast: () => void; setAccount: (player: Player, state: GameState) => void; clearSession: () => void; setGoogleEnabled: (enabled: boolean) => void; sound: boolean; setSound: (sound: boolean) => void; reducedMotion: boolean; setReducedMotion: (value: boolean) => void; };
const Context = createContext<GameContextType | null>(null);
export function useGame() { const value = useContext(Context); if (!value) throw new Error("Game context missing"); return value; }
export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const [player, setPlayer] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [sound, setSoundState] = useState(false);
  const [reducedMotion, setReducedState] = useState(false);
  // Non-null only while the doors are shut. Set by the poll below, which is
  // what evicts a player who was mid-battle when a patch went out.
  const [maintenance, setMaintenance] = useState<MaintenanceInfo | null>(null);
  const mutex = useRef(false);
  const booted = useRef(false);
  const notify = useCallback((text: string, type: "success" | "error" = "success") => setToast({ text, type }), []);
  const setAccount = useCallback((p: Player, s: GameState) => { setPlayer(p); setState(s); setError(false); setLoading(false); }, []);
  const clearSession = useCallback(() => { setPlayer(null); setState(initialState()); setError(false); setLoading(false); }, []);
  const action: Action = useCallback(async (actionName, args = {}, quiet = false) => {
    if (mutex.current) return null;
    mutex.current = true; setBusy(true);
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, ...args }) });
      const result = await response.json();
      if (result?.maintenance) { const status = await fetch("/api/status", { cache: "no-store" }).then(r => r.json()).catch(() => null); if (status?.active) setMaintenance(status); }
      if (!response.ok) throw new Error(result.error || "The operation could not be completed.");
      setAccount(result.player, result.state);
      if (!quiet && result.message) notify(result.message);
      return result as GameResult;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Connection lost. Please try again.", "error");
      if (actionName === "init") setError(true);
      return null;
    } finally { mutex.current = false; setBusy(false); }
  }, [notify, setAccount]);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    try { setSoundState(localStorage.getItem("gd-sound") === "true"); setReducedState(localStorage.getItem("gd-motion") === "true"); } catch {}
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5500); return () => clearTimeout(timer); }, [toast]);
  /**
   * The door check.
   *
   * A player with the game already open must be evicted, not left to finish the
   * battle they are in while the database is being patched. Every 15 seconds -
   * and immediately whenever the tab comes back into focus - the client asks
   * /api/status. A maintenance answer replaces the whole screen with Penelope.
   * Once maintenance is on it is not cleared by a later poll: reopening the game
   * means a reload, which is the point of a restart.
   */
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) return;
        const status = await response.json() as MaintenanceInfo;
        if (!stop && status.active) setMaintenance(status);
      } catch { /* offline: keep playing, the action endpoint still refuses */ }
    };
    void check();
    const timer = setInterval(check, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { stop = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", reducedMotion); }, [reducedMotion]);
  const setSound = (v: boolean) => { setSoundState(v); try { localStorage.setItem("gd-sound", String(v)); } catch {} };
  const setReducedMotion = (v: boolean) => { setReducedState(v); try { localStorage.setItem("gd-motion", String(v)); } catch {} };
  useEffect(() => {
    if (!sound) return;
    let context: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let note = 0;
    const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
    const play = () => {
      if (!context || context.state !== "running") return;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = notes[note++ % notes.length];
      gain.gain.setValueAtTime(0, context.currentTime); gain.gain.linearRampToValueAtTime(.022, context.currentTime + .12); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + 1.7);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 1.8);
    };
    const start = () => { if (context) { void context.resume(); return; } try { context = new AudioContext(); void context.resume(); play(); timer = setInterval(play, 780); } catch {} };
    start(); document.addEventListener("pointerdown", start);
    return () => { document.removeEventListener("pointerdown", start); if (timer) clearInterval(timer); void context?.close(); };
  }, [sound]);
  return <Context.Provider value={{ state, player, busy, loading, error, googleEnabled, maintenance, action, notify, toast, dismissToast: () => setToast(null), setAccount, clearSession, setGoogleEnabled, sound, setSound, reducedMotion, setReducedMotion }}>{children}{toast && <div className={`toast ${toast.type}`} role="status"><span className="toast-icon">{toast.type === "success" ? "✓" : "!"}</span><p>{toast.text}</p><button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}</Context.Provider>;
}
