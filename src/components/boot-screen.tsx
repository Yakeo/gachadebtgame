"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { useGame } from "./game-context";
import { Logo, Spinner } from "./ui";
import type { Player } from "@/lib/game-data";

const cards = [
  { kicker: "PLEASE READ", title: "A work of fiction.", body: "The academy, GachaCorp, and every student in this story are original. Any resemblance to real people or companies is a coincidence." },
  { kicker: "PHOTOSENSITIVITY", title: "This story sparkles.", body: "Recruitment and combat include flashes and motion. Reduced Motion is waiting in Settings if you need a calmer screen." },
  { kicker: "A FAIR LEDGER", title: "No real money. Ever.", body: "Gems, credits, and pulls are fictional. This game will never ask you to pay." },
  { kicker: "DEVELOPED BY", title: "The Council Desk.", body: "Story, systems, and one very expensive mistake. A student-council production." },
  { kicker: "CHARACTER ART", title: "Your designs are coming.", body: "The figures on screen are temporary studies. Original character art, including its animations, will take their place." },
];

export function LoadingScreen({ onComplete }: { onComplete: (next: "title" | "login" | "game") => void }) {
  const { reducedMotion, setAccount, setGoogleEnabled, notify } = useGame();
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const nextPhase = useRef<"title" | "login" | "game">("title");
  const done = useRef(false);
  const card = cards[Math.min(step, cards.length - 1)];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    const signedIn = params.get("signedIn");
    if (authError || signedIn) window.history.replaceState({}, "", "/");
    if (authError) {
      nextPhase.current = "login";
      notify(authError === "google-not-configured" ? "Google sign-in needs server credentials. Email accounts are available now." : authError === "email-exists" ? "This email already has an account. Sign in with your password first, then connect Google." : "Google sign-in was interrupted. Please try again.", "error");
    }
    let stop = false;
    (async () => {
      for (let i = 0; i < 40 && !stop; i++) {
        try {
          const [health, session, auth] = await Promise.all([
            fetch("/api/health", { cache: "no-store" }),
            fetch("/api/game", { cache: "no-store" }),
            fetch("/api/auth", { cache: "no-store" }),
          ]);
          if (health.ok && session.ok) {
            const save = await session.json() as { player: Player | null; state: import("@/lib/game-data").GameState | null };
            const flags = await auth.json().catch(() => ({ googleEnabled: false }));
            setGoogleEnabled(!!flags.googleEnabled);
            if (save.player && save.state) setAccount(save.player, save.state);
            if (signedIn && save.player) nextPhase.current = "game";
            setServerReady(true);
            return;
          }
        } catch { /* keep waiting for the server */ }
        await new Promise(resolve => setTimeout(resolve, 700));
      }
      if (!stop) setServerError(true);
    })();
    return () => { stop = true; };
  }, [attempt, notify, setAccount, setGoogleEnabled]);

  useEffect(() => {
    if (serverError || done.current) return;
    setShown(true);
    const hold = reducedMotion ? 280 : 1450;
    const fade = reducedMotion ? 40 : 560;
    const hide = setTimeout(() => setShown(false), hold);
    const advance = setTimeout(() => {
      if (done.current) return;
      if (serverReady && step >= cards.length - 1) {
        done.current = true;
        onComplete(nextPhase.current);
        return;
      }
      setStep(current => current >= cards.length - 1 ? current : current + 1);
      if (!serverReady && step >= cards.length - 1) setShown(true);
    }, hold + fade);
    return () => { clearTimeout(hide); clearTimeout(advance); };
  }, [step, serverReady, serverError, reducedMotion, onComplete, attempt]);

  return <section className="boot-screen loading-screen" aria-busy={!serverReady} aria-label="Loading Gacha Debt">
    <img src="/images/academy.jpg" alt="" className="boot-bg" />
    <div className="boot-shade" />
    <div className="boot-frame"><span /><span /><span /><span /></div>
    <div className="loading-brand"><Logo /><span>PREVIEW 0.1</span></div>
    <div key={`${step}-${shown}`} className={`loading-card ${shown ? "is-shown" : "is-hidden"}`} role="status" aria-live="polite">
      <span>{card.kicker}</span>
      <h1>{card.title}</h1>
      <p>{card.body}</p>
    </div>
    <div className="loading-footer">
      <div className="loading-dots" aria-hidden="true">{cards.map((_, i) => <i key={i} className={i === step ? "active" : i < step ? "done" : ""} />)}</div>
      <strong>{serverError ? "SERVER · NO ANSWER" : serverReady ? "SERVER · READY" : "SERVER · BOOTING"}</strong>
      {serverError ? <button onClick={() => { done.current = false; setServerError(false); setServerReady(false); setAttempt(n => n + 1); }}>Try the connection again</button> : <span>{serverReady && step >= 3 ? "Opening the title…" : "Please wait for the council server."}</span>}
    </div>
  </section>;
}

export function TitleScreen({ onStart }: { onStart: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onStart(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);
  return <section className="boot-screen title-screen">
    <img src="/images/council-keyart.jpg" alt="" className="boot-bg title-bg" />
    <div className="title-shade" />
    <div className="title-copy">
      <span>A VISUAL NOVEL · A TURN-BASED DEBT</span>
      <Logo />
      <p>One pull. All the problems.</p>
    </div>
    <button className="title-start" onClick={onStart} autoFocus>Tap anywhere to start<span>PRESS ENTER</span></button>
  </section>;
}

export function LoginScreen({ onEnter }: { onEnter: () => void }) {
  const { player, googleEnabled, setAccount, clearSession, action, notify, busy } = useGame();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, name: form.get("name"), email: form.get("email"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      setAccount(result.player, result.state);
      notify(mode === "register" ? "Account created. Your story is saved." : `Welcome back, ${result.player.name}.`);
      onEnter();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); } finally { setPending(false); }
  }
  async function guest() {
    const result = await action("init", {}, true);
    if (result) { notify("Guest session started. Register before you leave if you want to keep it."); onEnter(); }
  }
  async function switchAccount() {
    setPending(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      if (!response.ok) throw new Error("Could not sign out.");
      clearSession();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not switch accounts."); } finally { setPending(false); }
  }
  return <section className="boot-screen login-screen">
    <img src="/images/council-keyart.jpg" alt="" className="boot-bg" />
    <div className="login-shade" />
    <div className="login-panel">
      <span className="eyebrow">COUNCIL ID REQUIRED</span>
      <h1>Sign in before the story starts.</h1>
      <p>Your squad, pulls, and campaign stay with your account. The game will not open until you choose how to enter.</p>
      {player && <div className="returning-account"><div><strong>Welcome back, {player.name}.</strong><span>{player.guest ? "Guest session on this browser" : player.email}</span></div><button className="primary-button" onClick={onEnter} disabled={pending || busy}>Continue <ArrowRight size={16} /></button></div>}
      <div className="segmented-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button></div>
      <form onSubmit={submit} className="auth-form">{mode === "register" && <label>What should we call you?<input name="name" placeholder="Your council name" minLength={2} maxLength={24} required autoComplete="nickname" /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" required autoComplete="email" autoFocus={!player} /></label><label>Password<span className="password-field"><input name="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" required minLength={8} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full-width" disabled={pending || busy}>{pending ? <Spinner /> : <LogIn size={17} />}{mode === "login" ? "Sign in and enter" : "Create account and enter"}<ArrowRight size={17} /></button></form>
      <div className="or-divider"><span>OR</span></div>
      <button className="google-button" disabled={!googleEnabled || pending} onClick={() => { window.location.href = "/api/auth/google"; }}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.8h3.5c2-1.8 2.7-4.5 2.7-7.9Z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.8-2.6l-3.5-2.7c-1 .6-2.1 1-3.3 1-2.6 0-4.8-1.8-5.6-4.1H2.8v2.8A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.6a6 6 0 0 1 0-3.2V7.6H2.8a10 10 0 0 0 0 8.8Z"/><path fill="#EA4335" d="M12 6.3c1.5 0 2.8.5 3.8 1.5L19 4.7A10 10 0 0 0 2.8 7.6l3.6 2.8C7.2 8.1 9.4 6.3 12 6.3Z"/></svg>Continue with Google</button>
      {!googleEnabled && <p className="auth-footnote">Google sign-in is waiting for server credentials. Email sign-in is ready.</p>}
      {player && <button className="text-link" onClick={switchAccount} disabled={pending}>Use a different account</button>}
      <button className="text-link guest-link" onClick={guest} disabled={pending || busy}>Just looking? Play as guest</button>
      <p className="privacy-note"><ShieldCheck size={13} /> Guest progress stays on this browser until you register.</p>
    </div>
  </section>;
}
