"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Crown, FastForward, Flag, History, Pause, Radio, Shield, Sparkles, Star, Swords, Target, WandSparkles, Zap } from "lucide-react";
import { characterById, type Battle } from "@/lib/game-data";
import { battlefieldFor, type Stage } from "@/lib/campaign";
import { useGame } from "./game-context";
import { Avatar, Battlefield, Chibi, Credit, Gem, Modal, ProgressBar, Spinner } from "./ui";

type Pose = "idle" | "enter" | "attack" | "skill" | "guard" | "ultimate" | "hit" | "counter" | "down" | "victory";
const oneShots = new Set(["attack", "skill", "guard", "ultimate", "hit", "counter", "enter"]);

function CombatSprite({ id, label, pose, side }: { id: string; label?: string; pose: Pose; side: "ally" | "enemy" }) {
  return <div className={`sprite-stage pose-${pose} side-${side}`} data-character={id} data-anim={pose}>
    <div className="sprite-fx" aria-hidden="true"><i /><i /><i /></div>
    <div className="sprite-rig"><Chibi id={id} label={label} className="sprite-art" /></div>
  </div>;
}

export function BattleScreen({ battle, stage, onStory, onRetreat }: { battle: Battle; stage: Stage; onStory: () => void; onRetreat: () => void }) {
  const { state, action, busy } = useGame();
  const [target, setTarget] = useState(() => Math.max(0, battle.enemies.findIndex(enemy => enemy.hp > 0)));
  const [auto, setAuto] = useState(false);
  const [retreat, setRetreat] = useState(false);
  const [impact, setImpact] = useState(false);
  const [log, setLog] = useState(false);
  const [poses, setPoses] = useState<Record<string, Pose>>({});
  const active = battle.allies[Math.max(0, battle.active)];
  const c = characterById(active.id);
  const poseFor = (id: string, hp: number): Pose => hp <= 0 ? "down" : poses[id] || "idle";

  const acting = useRef(false);
  useEffect(() => {
    acting.current = false;
    const opening: Record<string, Pose> = {};
    battle.allies.forEach(ally => { opening[ally.id] = ally.hp > 0 ? "enter" : "down"; });
    battle.enemies.forEach(enemy => { opening[enemy.id] = enemy.hp > 0 ? "enter" : "down"; });
    setPoses(opening);
    const timer = setTimeout(() => { if (!acting.current) setPoses(current => Object.fromEntries(Object.entries(current).map(([id, pose]) => [id, pose === "enter" ? "idle" : pose])) as Record<string, Pose>); }, 720);
    return () => clearTimeout(timer);
    // Entrance plays once per operation, not after every resolved action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.stageId]);

  useEffect(() => { if (battle.enemies[target]?.hp <= 0) { const living = battle.enemies.findIndex(enemy => enemy.hp > 0); if (living >= 0) setTarget(living); } }, [battle.enemies, target]);
  useEffect(() => { if (!impact) return; const timer = setTimeout(() => setImpact(false), 900); return () => clearTimeout(timer); }, [impact]);
  useEffect(() => {
    if (!Object.values(poses).some(pose => oneShots.has(pose))) return;
    const timer = setTimeout(() => setPoses(current => {
      if (!Object.values(current).some(pose => oneShots.has(pose))) return current;
      return Object.fromEntries(Object.entries(current).map(([id, pose]) => [id, oneShots.has(pose) ? "idle" : pose])) as Record<string, Pose>;
    }), 780);
    return () => clearTimeout(timer);
  }, [poses]);

  const command = useCallback(async (cmd: string) => {
    if (busy || battle.status !== "active") return;
    acting.current = true;
    const pose = (cmd === "attack" || cmd === "skill" || cmd === "guard" || cmd === "ultimate" ? cmd : "attack") as Pose;
    setPoses(current => ({ ...current, [active.id]: pose }));
    const result = await action("act", { command: cmd, target }, true);
    const nextBattle = result?.state.battle;
    if (!nextBattle) return;
    const next: Record<string, Pose> = {};
    nextBattle.allies.forEach(ally => { next[ally.id] = ally.hp <= 0 ? "down" : ally.id === active.id ? pose : "idle"; });
    nextBattle.enemies.forEach(enemy => { next[enemy.id] = enemy.hp <= 0 ? "down" : nextBattle.lastHit?.target === enemy.id ? "hit" : "counter"; });
    if (nextBattle.status === "victory") nextBattle.allies.forEach(ally => { if (ally.hp > 0) next[ally.id] = "victory"; });
    setPoses(next);
    setImpact(true);
  }, [action, active.id, battle.status, busy, target]);

  useEffect(() => {
    if (!auto || busy || battle.status !== "active" || retreat || log) return;
    const timer = setTimeout(() => {
      const healing = ["Support", "Healer"].includes(c.role) && battle.allies.some(ally => ally.hp > 0 && ally.hp < ally.maxHp * .65);
      void command(active.energy >= 100 ? "ultimate" : active.energy >= 20 && healing ? "skill" : "attack");
    }, 1100);
    return () => clearTimeout(timer);
  }, [active.energy, auto, battle, busy, c.role, command, log, retreat]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input,select") || retreat || log) return;
      const key = Number(event.key);
      if (key >= 1 && key <= 4) { event.preventDefault(); void command(["attack", "skill", "guard", "ultimate"][key - 1]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [command, log, retreat]);

  const firstClear = !state.cleared.includes(stage.id);
  return <section className={`battle-screen ${impact ? "has-impact" : ""}`}>
    <div className="battle-header"><div><span className="battle-operation">OPERATION {stage.id}</span><h1>{stage.title}</h1></div><div className="battle-turn"><span>TURN</span><strong>{String(battle.turn).padStart(2, "0")}</strong></div><div className="battle-header-actions"><button className={auto ? "active" : ""} onClick={() => setAuto(!auto)} disabled={battle.status !== "active"}>{auto ? <Pause size={15} /> : <FastForward size={15} />} AUTO {auto ? "ON" : "OFF"}</button><button onClick={() => setLog(true)}><History size={16} />LOG</button><button onClick={() => setRetreat(true)} disabled={busy}><Flag size={16} />RETREAT</button></div></div>
    <div className={`battle-arena chapter-${stage.chapter}`}><Battlefield src={battlefieldFor(stage.chapter)} alt={`The battlefield at ${stage.location.toLowerCase()}`} /><div className="arena-shade" /><div className="arena-grid" /><div className="arena-topline"><span><Radio size={12} /> TACTICAL LINK ESTABLISHED</span><span>{battle.enemies.filter(enemy => enemy.hp > 0).length} HOSTILES REMAINING</span></div><div className="battle-versus" aria-hidden="true">VS<span>COUNCIL / CORPORATE</span></div>
      <div className="combat-teams">
        <div className="combat-units enemy-team">{battle.enemies.map((enemy, index) => <button key={enemy.id} className={`combat-unit enemy-unit ${target === index ? "targeted" : ""} ${enemy.hp <= 0 ? "defeated" : ""}`} disabled={enemy.hp <= 0 || busy || battle.status !== "active"} onClick={() => setTarget(index)} aria-label={`Target ${enemy.name}, ${enemy.hp.toLocaleString()} HP`}><div className="combat-unit-label">{enemy.boss && <Crown size={12} />}<span>{enemy.name}{enemy.level ? <b className="enemy-level">LV {enemy.level}</b> : null}</span><ProgressBar value={enemy.hp} max={enemy.maxHp} className="enemy-health" /><small>{enemy.hp.toLocaleString()} / {enemy.maxHp.toLocaleString()}</small></div><div className={`combat-unit-art ${enemy.boss ? "is-boss" : ""}`}><div className="unit-ground" /><CombatSprite id={enemy.sprite ?? stage.enemies[index].sprite} label={enemy.name} pose={poseFor(enemy.id, enemy.hp)} side="enemy" />{target === index && enemy.hp > 0 && <span className="target-reticle"><Target size={26} /></span>}{impact && battle.lastHit?.target === enemy.id && <span className={`floating-damage ${battle.lastHit.critical ? "critical" : ""}`}>{battle.lastHit.critical && <small>CRITICAL!</small>}{battle.lastHit.amount.toLocaleString()}</span>}</div>{target === index && enemy.hp > 0 && <span className="target-label">TARGET</span>}</button>)}</div>
        <div className="combat-units ally-team">{battle.allies.map((ally, index) => <div key={ally.id} className={`combat-unit ally-unit ${battle.active === index ? "current" : ""} ${ally.hp <= 0 ? "defeated" : ""}`}><div className="ally-ready-label">{ally.hp <= 0 ? "DOWN" : poseFor(ally.id, ally.hp) !== "idle" ? "ACTING" : battle.active === index ? "YOUR TURN" : "READY"}</div><div className="combat-unit-art"><div className="unit-ground" /><CombatSprite id={ally.id} pose={poseFor(ally.id, ally.hp)} side="ally" /></div><strong className="ally-name">{ally.name}</strong>{ally.guard && <span className="guard-indicator"><Shield size={13} />GUARD</span>}</div>)}</div>
      </div>
      <div className="arena-bottom-line"><span>{stage.location}</span><span>SELECT AN ENEMY. MAKE YOUR MOVE.</span></div>
    </div>
    <div className="battle-dashboard"><div className="ally-hud">{battle.allies.map((ally, index) => <div key={ally.id} className={`ally-hud-card ${battle.active === index ? "active" : ""} ${ally.hp <= 0 ? "down" : ""}`}><Avatar id={ally.id} /><div><strong>{ally.name}{battle.active === index && <span>ACT</span>}</strong><div className="hud-hp"><small>HP</small><span>{ally.hp.toLocaleString()}<b>/{ally.maxHp.toLocaleString()}</b></span></div><ProgressBar value={ally.hp} max={ally.maxHp} /><div className="hud-energy"><Zap size={10} /><ProgressBar value={ally.energy} /><small>{ally.energy}%</small></div></div></div>)}</div>
      <div className="command-center"><div className="current-actor"><span className="eyebrow">{busy ? "RESOLVING COMMAND" : "YOUR MOVE"}</span><strong>{active.name}<span>’s turn.</span></strong><small>{auto ? "Auto-combat is active." : "Choose wisely. Or dramatically."}</small></div><div className="combat-commands"><button className="command attack" disabled={busy || battle.status !== "active"} onClick={() => command("attack")}><span className="command-key">1</span><Swords size={24} /><div><strong>Attack</strong><small>+35 ENERGY</small></div><span className="command-arrow">↗</span></button><button className="command skill" disabled={busy || battle.status !== "active" || active.energy < 20} onClick={() => command("skill")} title={c.skill}><span className="command-key">2</span><WandSparkles size={24} /><div><strong>Skill</strong><small>20 ENERGY</small></div><span className="command-arrow">↗</span></button><button className="command guard" disabled={busy || battle.status !== "active"} onClick={() => command("guard")}><span className="command-key">3</span><Shield size={24} /><div><strong>Guard</strong><small>HEAL + DEFEND</small></div><span className="command-arrow">↗</span></button><button className="command ultimate" disabled={busy || battle.status !== "active" || active.energy < 100} onClick={() => command("ultimate")} title={c.ultimate}><span className="command-key">4</span><Sparkles size={24} /><div><strong>Ultimate</strong><small>{active.energy < 100 ? `${active.energy} / 100 ENERGY` : "READY TO UNLEASH"}</small></div><span className="command-arrow">↗</span></button></div></div>
      <div className="battle-log-line"><span>{busy ? <Spinner /> : <ChevronRight size={15} />}</span><p aria-live="polite">{battle.log[0]}</p><button onClick={() => setLog(true)}>Full combat log <History size={13} /></button></div>
    </div>
    {battle.status !== "active" && <div className="battle-result-overlay"><div className={`battle-result ${battle.status}`}><span className="eyebrow">{battle.status === "victory" ? "COUNCIL OPERATIONS / SUCCESS" : "COUNCIL OPERATIONS / REGROUP"}</span><div className="victory-stars">{battle.status === "victory" ? [0, 1, 2].map(i => <Star key={i} size={35} fill="currentColor" style={{ animationDelay: `${i * 180}ms` }} />) : <Shield size={55} />}</div><h2>{battle.status === "victory" ? <>Operation<br /><span>complete.</span></> : <>Not the<br /><span>last chapter.</span></>}</h2><p>{battle.status === "victory" ? "A little teamwork. A very big difference." : "A tactical retreat isn't the end. Upgrade your squad, then try again."}</p>{battle.status === "victory" && <div className="victory-rewards">{firstClear && <span><Gem size={22} /><strong>200</strong><small>GEMS</small></span>}<span><Credit size={23} /><strong>{firstClear ? "1,500" : "300"}</strong><small>CREDITS</small></span><span><Flag size={22} /><strong>{battle.turn}</strong><small>TURNS</small></span></div>}<button className="primary-button full-width" onClick={battle.status === "victory" ? onStory : onRetreat}>{battle.status === "victory" ? <><BookOpen size={18} />Continue the story <ArrowRight size={18} /></> : <><ArrowLeft size={17} />Return to the campaign</>}</button><small className="battle-result-note">{battle.status === "victory" ? "Complete the after-battle story to collect your rewards." : "Your characters recover fully between operations."}</small></div></div>}
    {retreat && <Modal title="Live to fight another day?" eyebrow="TACTICAL RETREAT" onClose={() => setRetreat(false)}><p className="modal-description">Leave this operation and return to the campaign? Energy already spent won’t be refunded. You can upgrade your squad and try again.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setRetreat(false)}>Keep fighting</button><button className="primary-button" onClick={onRetreat} disabled={busy}><Flag size={16} />Retreat</button></div></Modal>}
    {log && <Modal title="Every move matters." eyebrow="COMBAT LOG / LAST 25 ACTIONS" onClose={() => setLog(false)}><div className="combat-log">{battle.log.map((entry, index) => <p key={index}><span>{String(battle.log.length - index).padStart(2, "0")}</span>{entry}</p>)}</div></Modal>}
  </section>;
}
