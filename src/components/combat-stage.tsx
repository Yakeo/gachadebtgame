"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Crown, FastForward, Flag, History, Pause, Radio, Shield, Sparkles, Star, Swords, Target, WandSparkles, Zap } from "lucide-react";
import { characterById, characters, type Battle } from "@/lib/game-data";
import { campaignCredits } from "@/lib/campaign-balance";
import { battlefieldFor, stages, type Stage } from "@/lib/campaign";
import { InitiativeStrip } from "./initiative-strip";
import { BattleCommandPanel } from "./battle-command-panel";
import { useGame } from "./game-context";
import { Avatar, Battlefield, Chibi, Credit, Gem, Modal, ProgressBar, Spinner } from "./ui";

type Pose = "idle" | "enter" | "attack" | "skill" | "guard" | "ultimate" | "hit" | "counter" | "down" | "victory";
const oneShots = new Set(["attack", "skill", "guard", "ultimate", "hit", "counter", "enter"]);
/**
 * How long a one-shot pose is held before the rig returns to idle.
 *
 * Every choreography animation in combat.css has to finish inside this window
 * or it gets cut off mid-swing, so the number lives here as the single source
 * of truth and tests/ssr-attacks.test.ts reads it back.
 *
 * The longest one-shot in the stylesheet is the slime pounce at 1.2s, which is
 * what sets the ceiling. Raising it bought the whole move set 40% more time:
 * a 0.7s attack is now a full second, and the enemies' answer is a leap you can
 * follow from the wind-up to the landing.
 */
export const POSE_HOLD_MS = 1200;

/**
 * The pause between a blow landing and the enemies answering it.
 *
 * Long enough for the struck creature's own flinch to finish - the beat exists
 * to separate the two moments, so cutting short the reaction it is separating
 * defeats the point. The slime squash is the shortest reaction at 0.75s.
 *
 * The engine resolves the whole exchange in one response - the struck enemy
 * reacts and the surviving enemies retaliate in the same payload. Drawn in the
 * same frame, that reads as one blurry event, which is why the animations were
 * easy to miss. Holding the hit for a beat and then letting the enemies pounce
 * gives the two moments their own space.
 */
export const IMPACT_BEAT_MS = 800;

/**
 * How long the enemies' answer stays on screen before the player can act again.
 *
 * Input used to come back the instant the counter pose was set, so the next
 * command - or auto-battle's next tick - replaced the pose mid-leap and the
 * answer was gone before it landed. Holding the beat for the length of the
 * pounce lets it finish. Matches `slime-pounce` in combat.css.
 */
export const COUNTER_HOLD_MS = 1200;

/**
 * When the fighter reaches the enemy, measured from the command.
 *
 * Every attack now carries the fighter across the arena: they close in, land
 * the blow on contact and double back home. The blow is revealed on contact -
 * the hit pose, the impact flash and the damage number all wait for the dash's
 * contact frame (42% of every advance animation in combat.css, ~440ms in), so
 * the enemy visibly reacts the moment the attacker arrives. A reply that comes
 * back slower than the dash shows as it arrives; the fighter just holds at the
 * enemy a beat longer.
 */
export const CONTACT_MS = 440;

/** Enemies drawn as pixel art, which deform as one piece when they move. */
const SLIME_IDS = new Set(["slime-blue", "slime-red", "slime-gold", "slime-cactus", "kingslime"]);

/**
 * Whether a command's animation should carry the fighter to the enemy.
 *
 * The basic attack always does. Skills and ultimates do when the move lands on
 * a foe - restorative kits (Solari's reconciliation, the healers' "Restore the
 * living squad") stay with their squad instead of charging across the field to
 * pat the enemy on the head.
 */
const SUPPORT_NOTE = /restore|revive|sanctif/i;
const hitsFoes = (note: string) => !SUPPORT_NOTE.test(note);

function CombatSprite({ id, label, pose, side }: { id: string; label?: string; pose: Pose; side: "ally" | "enemy" }) {
  // The character's own colour drives their attack effects, so Penelope's
  // impact reads pink and Escanooor's reads ember orange. Enemies keep the
  // stylesheet default: their ids are sprite names, not members of the cast.
  const known = side === "ally" && characters.some(character => character.id === id);
  return <div className={`sprite-stage pose-${pose} side-${side}`} data-character={id}
    data-enemy={SLIME_IDS.has(id) ? "slime" : undefined} data-anim={pose}
    style={known ? { "--character-color": characterById(id).color } as CSSProperties : undefined}>
    <div className="sprite-fx" aria-hidden="true"><i /><i /><i /><i /><i /></div>
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
  // The colour of whoever just swung. The engine reports what a blow landed
  // on, not who threw it, so the client tracks the attacker itself and hands
  // their colour down to the target's impact effect.
  const [impactColor, setImpactColor] = useState<string | null>(null);
  // True while the enemies are answering, so a second command cannot be issued
  // over the top of the retaliation.
  const [beat, setBeat] = useState(false);
  const active = battle.allies[Math.max(0, battle.active)];
  const c = characterById(active.id);
  const poseFor = (id: string, hp: number): Pose => hp <= 0 ? "down" : poses[id] || "idle";

  const acting = useRef(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    acting.current = false;
    const opening: Record<string, Pose> = {};
    battle.allies.forEach(ally => { opening[ally.id] = ally.hp > 0 ? "enter" : "down"; });
    battle.enemies.forEach(enemy => { opening[enemy.id] = enemy.hp > 0 ? "enter" : "down"; });
    battle.enemyActions?.forEach(move => {
      if (!move.skipped) opening[move.actor] = "counter";
      if (move.target && battle.allies.find(a => a.id === move.target)?.hp) opening[move.target] = "hit";
    });
    setPoses(opening);
    const timer = setTimeout(() => { if (!acting.current) setPoses(current => Object.fromEntries(Object.entries(current).map(([id, pose]) => [id, pose === "enter" ? "idle" : pose])) as Record<string, Pose>); }, 1000);
    return () => clearTimeout(timer);
    // Entrance plays once per operation, not after every resolved action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.stageId]);

  useEffect(() => { if (battle.enemies[target]?.hp <= 0) { const living = battle.enemies.findIndex(enemy => enemy.hp > 0); if (living >= 0) setTarget(living); } }, [battle.enemies, target]);
  useEffect(() => { if (!impact) return; const timer = setTimeout(() => setImpact(false), 1500); return () => clearTimeout(timer); }, [impact]);
  useEffect(() => {
    if (!Object.values(poses).some(pose => oneShots.has(pose))) return;
    const timer = setTimeout(() => setPoses(current => {
      if (!Object.values(current).some(pose => oneShots.has(pose))) return current;
      return Object.fromEntries(Object.entries(current).map(([id, pose]) => [id, oneShots.has(pose) ? "idle" : pose])) as Record<string, Pose>;
    }), POSE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [poses]);

  const command = useCallback(async (cmd: string) => {
    if (busy || beat || battle.status !== "active") return;
    acting.current = true;
    const pose = (cmd === "attack" || cmd === "skill" || cmd === "guard" || cmd === "ultimate" ? cmd : "attack") as Pose;
    // Every blow aimed at the enemy carries the fighter there first: measure
    // the distance to the chosen foe and let the advance animation cross it.
    const note = cmd === "skill" ? c.skillNote : c.ultimateNote;
    const strike = cmd === "attack" || ((cmd === "skill" || cmd === "ultimate") && hitsFoes(note));
    if (strike) {
      const unit = arenaRef.current?.querySelector<HTMLElement>(`[data-unit="${active.id}"]`);
      const art = unit?.querySelector(".sprite-stage");
      const prey = arenaRef.current?.querySelector<HTMLElement>(`[data-unit="${battle.enemies[target].id}"]`)?.querySelector(".sprite-stage");
      if (unit && art && prey) {
        const a = art.getBoundingClientRect();
        const t = prey.getBoundingClientRect();
        // Land on the enemy's near side, so the two sprites overlap at contact
        // with the attacker in front, feet on the same line.
        const fromRight = a.left >= t.left + t.width / 2;
        const landX = t.left + t.width * (fromRight ? 0.72 : 0.28);
        unit.style.setProperty("--dash-x", `${Math.round(landX - (a.left + a.width / 2))}px`);
        unit.style.setProperty("--dash-y", `${Math.round(t.bottom - a.bottom)}px`);
        unit.classList.add("is-dashing");
        setTimeout(() => unit.classList.remove("is-dashing"), POSE_HOLD_MS);
      }
    }
    setImpactColor(c.color);
    setPoses(current => ({ ...current, [active.id]: pose }));
    const startedAt = performance.now();
    const result = await action("act", { command: cmd, target }, true);
    const nextBattle = result?.state.battle;
    if (!nextBattle) return;

    // Beat one: the blow. Only the enemy that was actually struck reacts, and
    // any ally whose HP dropped was hit by the retaliation. Marking everyone
    // else as "counter" is what made a whole row of enemies flinch at once.
    const hurt = (id: string) => {
      const before = battle.allies.find(ally => ally.id === id)?.hp ?? 0;
      return (nextBattle.allies.find(ally => ally.id === id)?.hp ?? 0) < before;
    };
    const next: Record<string, Pose> = {};
    nextBattle.allies.forEach(ally => {
      next[ally.id] = ally.hp <= 0 ? "down" : ally.id === active.id ? pose : hurt(ally.id) ? "hit" : "idle";
    });
    nextBattle.enemies.forEach(enemy => {
      next[enemy.id] = enemy.hp <= 0 ? "down" : nextBattle.lastHit?.target === enemy.id ? "hit" : "idle";
    });
    if (nextBattle.status === "victory") nextBattle.allies.forEach(ally => { if (ally.hp > 0) next[ally.id] = "victory"; });
    // Reveal the blow on contact rather than on reply: the hit pose, impact
    // flash and damage number land exactly when the fighter reaches the enemy.
    if (strike) {
      const elapsed = performance.now() - startedAt;
      if (elapsed < CONTACT_MS) await new Promise(resolve => setTimeout(resolve, CONTACT_MS - elapsed));
    }
    setPoses(next);
    setImpact(true);

    // Enemy slots can occur between any two allies, not only at a round boundary.
    const enemyMoves = (nextBattle.enemyActions ?? []).filter(move => !move.skipped);
    setBeat(true);
    if (!enemyMoves.length) {
      await new Promise(resolve => setTimeout(resolve, POSE_HOLD_MS));
      setImpact(false);
      setBeat(false);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, IMPACT_BEAT_MS));
    setImpact(false);
    for (const move of enemyMoves) {
      setPoses(current => {
        const answering: Record<string, Pose> = Object.fromEntries(Object.entries(current).map(([id, pose]) => [id, pose === "down" ? "down" : "idle"]));
        answering[move.actor] = "counter";
        if (move.target) answering[move.target] = nextBattle.allies.find(a => a.id === move.target)!.hp > 0 ? "hit" : "down";
        return answering;
      });
      await new Promise(resolve => setTimeout(resolve, COUNTER_HOLD_MS));
    }
    setBeat(false);
  }, [action, active.id, battle.allies, battle.enemies, battle.status, battle.turn, beat, busy, target, c.color]);

  useEffect(() => {
    if (!auto || busy || beat || battle.status !== "active" || retreat || log) return;
    const timer = setTimeout(() => {
      const healing = ["Support", "Healer"].includes(c.role) && battle.allies.some(ally => ally.hp > 0 && ally.hp < ally.maxHp * .65);
      void command(active.energy >= 100 ? "ultimate" : active.energy >= 20 && healing ? "skill" : "attack");
      // Short on purpose: the beat already holds input for the length of the
      // animation, so this is only the breath between actions. A long timer
      // here would stack on top of that hold and crawl.
    }, 400);
    return () => clearTimeout(timer);
  }, [active.energy, auto, battle, beat, busy, c.role, command, log, retreat]);


  const firstClear = !state.cleared.includes(stage.id);
  return <section className={`battle-screen ${impact ? "has-impact" : ""}`} style={{ "--impact-color": impactColor } as CSSProperties}>
    <div className="battle-header"><div><span className="battle-operation">OPERATION {stage.id}</span><h1>{stage.title}</h1></div><div className="battle-turn"><span>ROUND</span><strong>{String(battle.turn).padStart(2, "0")}</strong></div><div className="battle-header-actions"><button className={auto ? "active" : ""} onClick={() => setAuto(!auto)} disabled={battle.status !== "active"}>{auto ? <Pause size={15} /> : <FastForward size={15} />} AUTO {auto ? "ON" : "OFF"}</button><button onClick={() => setLog(true)}><History size={16} />LOG</button><button onClick={() => setRetreat(true)} disabled={busy}><Flag size={16} />RETREAT</button></div></div>
    <InitiativeStrip battle={battle} />
    <div className={`battle-arena chapter-${stage.chapter}`}><Battlefield key={stage.chapter} src={battlefieldFor(stage.chapter)} alt={`The battlefield at ${stage.location.toLowerCase()}`} /><div className="arena-shade" /><div className="arena-grid" /><div className="arena-topline"><span><Radio size={12} /> TACTICAL LINK ESTABLISHED</span><span>{battle.enemies.filter(enemy => enemy.hp > 0).length} HOSTILES REMAINING</span></div><div className="battle-versus" aria-hidden="true">VS<span>COUNCIL / CORPORATE</span></div>
      <div className="combat-teams" ref={arenaRef}>
        <div className="combat-units enemy-team">{battle.enemies.map((enemy, index) => <button key={enemy.id} data-unit={enemy.id} data-hit={impact && battle.lastHit?.target === enemy.id ? "on" : undefined} className={`combat-unit enemy-unit ${target === index ? "targeted" : ""} ${enemy.hp <= 0 ? "defeated" : ""}`} disabled={enemy.hp <= 0 || busy || beat || battle.status !== "active"} onClick={() => setTarget(index)} aria-label={`Target ${enemy.name}, ${enemy.hp.toLocaleString()} HP`}><div className="combat-unit-label">{enemy.boss && <Crown size={12} />}<span>{enemy.name}{enemy.level ? <b className="enemy-level">LV {enemy.level}</b> : null}</span><ProgressBar value={enemy.hp} max={enemy.maxHp} className="enemy-health" /><small>{enemy.hp.toLocaleString()} / {enemy.maxHp.toLocaleString()}</small></div><div className={`combat-unit-art ${enemy.boss ? "is-boss" : ""}`}><div className="unit-ground" /><CombatSprite id={enemy.sprite ?? stage.enemies[index].sprite} label={enemy.name} pose={poseFor(enemy.id, enemy.hp)} side="enemy" />{target === index && enemy.hp > 0 && <span className="target-reticle"><Target size={26} /></span>}{impact && battle.lastHit?.target === enemy.id && <span className={`floating-damage ${battle.lastHit.critical ? "critical" : ""}`}>{battle.lastHit.critical && <small>CRITICAL!</small>}{battle.lastHit.amount.toLocaleString()}</span>}</div>{target === index && enemy.hp > 0 && <span className="target-label">TARGET</span>}</button>)}</div>
        <div className="combat-units ally-team">{battle.allies.map((ally, index) => <div key={ally.id} data-unit={ally.id} className={`combat-unit ally-unit ${battle.active === index ? "current" : ""} ${ally.hp <= 0 ? "defeated" : ""}`}><div className="ally-ready-label">{ally.hp <= 0 ? "DOWN" : poseFor(ally.id, ally.hp) !== "idle" ? "ACTING" : battle.active === index ? "YOUR TURN" : "READY"}</div><div className="combat-unit-art"><div className="unit-ground" /><CombatSprite id={ally.id} pose={poseFor(ally.id, ally.hp)} side="ally" /></div><strong className="ally-name">{ally.name}</strong>{ally.guard && <span className="guard-indicator"><Shield size={13} />GUARD</span>}</div>)}</div>
      </div>
      <div className="arena-bottom-line"><span>{stage.location}</span><span>SELECT AN ENEMY. MAKE YOUR MOVE.</span></div>
    </div>
    <div className="battle-dashboard"><div className="enemy-hud">{battle.enemies.map((enemy, index) => <button key={enemy.id} className={`enemy-hud-card ${target === index ? "targeted" : ""} ${enemy.hp <= 0 ? "defeated" : ""}`} disabled={enemy.hp <= 0 || busy || beat || battle.status !== "active"} onClick={() => setTarget(index)} aria-label={`Target ${enemy.name}, ${enemy.hp.toLocaleString()} HP`}><Chibi id={enemy.sprite ?? stage.enemies[index].sprite} className="enemy-hud-art" label={enemy.name} /><div><strong>{enemy.boss && <Crown size={13} />}{enemy.name}{enemy.level ? <b className="enemy-level">LV {enemy.level}</b> : null}</strong><div className="hud-hp"><small>HP</small><span>{enemy.hp.toLocaleString()}<b>/{enemy.maxHp.toLocaleString()}</b></span></div><ProgressBar value={enemy.hp} max={enemy.maxHp} className="enemy-health" />{target === index && enemy.hp > 0 && <span className="enemy-hud-target">TARGET</span>}</div></button>)}</div><div className="ally-hud">{battle.allies.map((ally, index) => <div key={ally.id} className={`ally-hud-card ${battle.active === index ? "active" : ""} ${ally.hp <= 0 ? "down" : ""}`}><Avatar id={ally.id} /><div><strong>{ally.name}{battle.active === index && <span>ACT</span>}</strong><div className="hud-hp"><small>HP</small><span>{ally.hp.toLocaleString()}<b>/{ally.maxHp.toLocaleString()}</b></span></div><ProgressBar value={ally.hp} max={ally.maxHp} /><div className="hud-energy"><Zap size={10} /><ProgressBar value={ally.energy} /><small>{ally.energy}%</small></div></div></div>)}</div>
      <BattleCommandPanel key={`${battle.stageId}-${battle.turn}-${active.id}`} character={c} actor={active} targetName={battle.enemies[target]?.name ?? "Choose a target"} locked={busy || beat || battle.status !== "active" || retreat || log} onInspect={() => setAuto(false)} onActivate={cmd => { setAuto(false); void command(cmd); }} />
      <div className="battle-log-line"><span>{busy ? <Spinner /> : <ChevronRight size={15} />}</span><p aria-live="polite">{battle.log[0]}</p><button onClick={() => setLog(true)}>Full combat log <History size={13} /></button></div>
    </div>
    {battle.status !== "active" && <div className="battle-result-overlay"><div className={`battle-result ${battle.status}`}><span className="eyebrow">{battle.status === "victory" ? "COUNCIL OPERATIONS / SUCCESS" : "COUNCIL OPERATIONS / REGROUP"}</span><div className="victory-stars">{battle.status === "victory" ? [0, 1, 2].map(i => <Star key={i} size={35} fill="currentColor" style={{ animationDelay: `${i * 180}ms` }} />) : <Shield size={55} />}</div><h2>{battle.status === "victory" ? <>Operation<br /><span>complete.</span></> : <>Not the<br /><span>last chapter.</span></>}</h2><p>{battle.status === "victory" ? "A little teamwork. A very big difference." : "A tactical retreat isn't the end. Upgrade your squad, then try again."}</p>{battle.status === "victory" && <div className="victory-rewards">{firstClear && <span><Gem size={22} /><strong>200</strong><small>GEMS</small></span>}<span><Credit size={23} /><strong>{campaignCredits(stages.findIndex(s => s.id === battle.stageId) + 1, firstClear).toLocaleString()}</strong><small>CREDITS</small></span><span><Flag size={22} /><strong>{battle.turn}</strong><small>TURNS</small></span></div>}<button className="primary-button full-width" onClick={battle.status === "victory" ? onStory : onRetreat}>{battle.status === "victory" ? <><BookOpen size={18} />Continue the story <ArrowRight size={18} /></> : <><ArrowLeft size={17} />Return to the campaign</>}</button><small className="battle-result-note">{battle.status === "victory" ? "Complete the after-battle story to collect your rewards." : "Your characters recover fully between operations."}</small></div></div>}
    {retreat && <Modal title="Live to fight another day?" eyebrow="TACTICAL RETREAT" onClose={() => setRetreat(false)}><p className="modal-description">Leave this operation and return to the campaign? Energy already spent won’t be refunded. You can upgrade your squad and try again.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setRetreat(false)}>Keep fighting</button><button className="primary-button" onClick={onRetreat} disabled={busy}><Flag size={16} />Retreat</button></div></Modal>}
    {log && <Modal title="Every move matters." eyebrow="COMBAT LOG / LAST 25 ACTIONS" onClose={() => setLog(false)}><div className="combat-log">{battle.log.map((entry, index) => <p key={index}><span>{String(battle.log.length - index).padStart(2, "0")}</span>{entry}</p>)}</div></Modal>}
  </section>;
}
