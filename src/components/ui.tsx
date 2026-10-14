"use client";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { X, Diamond, Coins, LoaderCircle, Sparkles } from "lucide-react";
import { characters, characterById } from "@/lib/game-data";
export function Gem({ size = 17 }: { size?: number }) { return <Diamond size={size} className="gem-icon" fill="currentColor" strokeWidth={1.3} />; }
export function Credit({ size = 17 }: { size?: number }) { return <Coins size={size} className="credit-icon" />; }
export function Spinner() { return <LoaderCircle size={17} className="spin" />; }
/**
 * A full-bleed location image. Every chapter has its own arena art; if one is
 * ever missing the academy courtyard stands in rather than a broken image
 * icon, which is what this game looked like for far too long.
 */
export function Battlefield({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} className={className} onError={event => {
    const image = event.currentTarget;
    if (image.dataset.fallenBack) return;
    image.dataset.fallenBack = "1";
    image.src = "/images/academy.jpg";
  }} />;
}
export function ProgressBar({ value, max = 100, className = "" }: { value: number; max?: number; className?: string }) { return <div className={`progress-track ${className}`}><span style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} /></div>; }
export function Logo() { return <div className="brand" aria-label="Gacha Debt"><svg viewBox="0 0 56 58" aria-hidden="true"><path d="M25 2 52 16 43 47 16 57 2 31Z" fill="#2088ee"/><path d="m30 9-17 24h13l-5 15 24-27H30l7-12Z" fill="white"/><path d="M9 10 4 23M49 48l-9 5" stroke="#72c4ff" strokeWidth="3"/></svg><div><strong>GACHA<span>DEBT</span></strong><small>ONE PULL. ALL THE PROBLEMS.</small></div></div>; }
export function Avatar({ id, className = "", label }: { id: string; className?: string; label?: string }) { const c = characterById(id); return <div className={`avatar ${className}`} style={{ "--character-color": c?.color || "#718dc0" } as CSSProperties}><Chibi id={id} label={label} /></div>; }
export const bestiary: Record<string, string> = {
  "slime-blue": "Blue Slime", "slime-red": "Red Slime", "slime-gold": "Gold Slime", "slime-cactus": "Cactus Slime",
  kingslime: "Crowned Slime", prime: "Clockwork Sentry Prime", terminal: "GachaCorp Server Terminal",
  enforcer: "Corporate Enforcer", vane: "Director Vane",
  shroom: "Spun Shroom", bluecap: "Blue Cap Shroom", reroom: "Reroom", fragment: "Corrupted Core Fragment",
};
export function Chibi({ id, className = "", label }: { id: string; className?: string; label?: string }) {
  const known = !!characters.some(c => c.id === id);
  const c = known ? characterById(id) : characterById("sentry");
  // Shipped pixel art wins over the placeholder drawing. Every surface that
  // shows a character (battle rig, story speaker, roster card, pull result,
  // avatar) goes through this component, so one branch covers them all.
  // Characters without art keep the inline SVG below.
  const art = known ? c.splash : undefined;
  // Rendered as the sized element itself (class "chibi"), so every existing
  // width/height rule applies exactly as it did to the SVG; object-fit keeps
  // the figure from ever being stretched or cropped.
  if (art) return <img className={`chibi ${className}`} src={art} alt={label ?? c.name} draggable={false} decoding="async" />;
  const eye = c.color;
  const monster = ["shroom", "bluecap", "reroom"].includes(id);
  if (monster) return <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label={c.name}><ellipse cx="80" cy="181" rx="44" ry="9" fill="#122948" opacity=".15"/><path d="M56 112Q40 180 68 180h24q28 0 12-68" fill="#fff0d8" stroke="#34435c" strokeWidth="3"/><path d="M23 111C17 48 136 30 139 109Q129 142 23 111Z" fill={c.color} stroke="#34435c" strokeWidth="3"/><ellipse cx="54" cy="85" rx="13" ry="10" fill="white" opacity=".8"/><ellipse cx="106" cy="81" rx="16" ry="12" fill="white" opacity=".8"/><path d="m70 164 10 5 10-5" fill="none" stroke="#34435c" strokeWidth="3"/><ellipse cx="65" cy="148" rx="6" ry="10" fill="#34435c"/><ellipse cx="96" cy="148" rx="6" ry="10" fill="#34435c"/><circle cx="64" cy="145" r="2" fill="white"/><circle cx="95" cy="145" r="2" fill="white"/></svg>;
  const slime = (colors: Record<string, string>) => <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label={c.name}>
    <ellipse cx="80" cy="182" rx="50" ry="9" fill="#0c1a2c" opacity=".22"/>
    <path d="M20 160V96q0-62 60-62t60 62v64q0 6-6 6H26q-6 0-6-6Z" fill={colors.edge}/>
    <path d="M27 158V96q0-54 53-54t53 54v62q0 3-3 3H30q-3 0-3-3Z" fill={colors.body}/>
    <path d="M42 58q12-12 26-14l-8 14q-10 2-18 0Z" fill={colors.light} opacity=".8"/>
    <path d="M128 72v30l-8 3V74q4-4 8-2Z" fill={colors.light} opacity=".5"/>
    <rect x="44" y="140" width="72" height="10" rx="5" fill={colors.edge} opacity=".75"/>
  </svg>;
  if (id === "slime-blue") return slime({ body: "#79b3ef", edge: "#4a86d8", light: "#b6d7ff" });
  if (id === "slime-red") return slime({ body: "#b8474d", edge: "#8c2d34", light: "#e5848a" });
  if (id === "slime-gold") return slime({ body: "#c99f28", edge: "#e3c44a", light: "#f2dd80" });
  if (id === "slime-cactus") return <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label={c.name}>
    <ellipse cx="80" cy="182" rx="50" ry="9" fill="#0c1a2c" opacity=".22"/>
    <g transform="rotate(14 116 40)"><rect x="104" y="46" width="30" height="16" rx="2" fill="#a9793f"/><rect x="100" y="40" width="38" height="9" rx="2" fill="#7d5527"/><path d="M110 40q-4-26 8-34 14 6 8 34Z" fill="#5f9a4c"/><path d="M118 30q-16-8-20 4 12 8 20-4Z" fill="#6fae5a"/><path d="M118 26q16-8 20 4-12 8-20-4Z" fill="#6fae5a"/><path d="M113 16h3M124 12h3M110 24h3M127 22h3" stroke="#41573a" strokeWidth="2.4"/></g>
    <path d="M20 160V96q0-62 60-62t60 62v64q0 6-6 6H26q-6 0-6-6Z" fill="#8c2d34"/>
    <path d="M27 158V96q0-54 53-54t53 54v62q0 3-3 3H30q-3 0-3-3Z" fill="#b8474d"/>
    <path d="M42 58q12-12 26-14l-8 14q-10 2-18 0Z" fill="#e5848a" opacity=".8"/>
    <path d="M128 72v30l-8 3V74q4-4 8-2Z" fill="#e5848a" opacity=".5"/>
    <rect x="44" y="140" width="72" height="10" rx="5" fill="#8c2d34" opacity=".8"/>
  </svg>;
  if (id === "fragment") return <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label={c.name}>
    <ellipse cx="80" cy="186" rx="38" ry="8" fill="#0c1a2c" opacity=".2"/>
    <path d="M80 8 46 74l14 78 40 0 14-78Z" fill="#3a2c62" stroke="#1c1436" strokeWidth="3"/>
    <path d="M80 8 60 74l20 78 20-78Z" fill="#5b46a0" opacity=".85"/>
    <path d="M66 74h28l-6 44H72Z" fill="#8d76e6" opacity=".6"/>
    <path d="M52 92l-16 22 12 30 12-24m48-28 16 22-12 30-12-24" fill="none" stroke="#6f57c4" strokeWidth="7" strokeLinecap="round"/>
    <circle cx="80" cy="52" r="7" fill="#c9b6ff"/><circle cx="80" cy="52" r="3" fill="#fff"/>
  </svg>;
  if (id === "kingslime") return <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label={c.name}>
    <ellipse cx="80" cy="186" rx="56" ry="10" fill="#0c1a2c" opacity=".26"/>
    <path d="M14 166V90q0-70 66-70t66 70v76q0 6-6 6H20q-6 0-6-6Z" fill="#5c3d94"/>
    <path d="M22 164V90q0-62 58-62t58 62v74q0 3-3 3H25q-3 0-3-3Z" fill="#6d4aa8"/>
    <path d="M36 48q14-14 30-16l-9 16q-12 2-21 0Z" fill="#a583d8" opacity=".85"/>
    <path d="M132 66v34l-9 3V68q5-4 9-2Z" fill="#a583d8" opacity=".55"/>
    <circle cx="52" cy="122" r="15" fill="#c0a2e0" opacity=".45"/><circle cx="104" cy="104" r="9" fill="#c0a2e0" opacity=".4"/><circle cx="96" cy="86" r="5" fill="#c0a2e0" opacity=".45"/>
    <ellipse cx="48" cy="140" rx="17" ry="19" fill="#a06fbb"/><path d="M36 136q6-8 12 0" stroke="#7d4f92" strokeWidth="2.4" fill="none"/>
    <rect x="30" y="150" width="94" height="11" rx="5" fill="#4b3178" opacity=".9"/>
    <g transform="rotate(12 118 34)"><path d="M96 54q4-34 22-44 20 12 24 46-22-12-46-2Z" fill="#c9975c" stroke="#8a5f33" strokeWidth="3"/><path d="m100 46 8-22 6 20m10-22 8 22" stroke="#8a5f33" strokeWidth="2.6" fill="none"/><circle cx="104" cy="20" r="4" fill="#e0b57c"/><circle cx="120" cy="12" r="4" fill="#e0b57c"/><circle cx="134" cy="26" r="4" fill="#e0b57c"/></g>
  </svg>;
  if (id === "sentry") return <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label="Clockwork sentry"><ellipse cx="80" cy="185" rx="49" ry="8" fill="#122948" opacity=".18"/><path d="m44 83-20 51 21 8m70-59 20 51-20 8" fill="#71869e" stroke="#28344c" strokeWidth="6"/><path d="m56 155-7 27h21l9-27m22 0 9 27H90l-9-27" fill="#4a5871"/><path d="m40 90 40-22 42 22-9 67-33 15-35-15Z" fill="#a6bfd6" stroke="#304157" strokeWidth="4"/><circle cx="80" cy="119" r="25" fill="#304157"/><circle cx="80" cy="119" r="16" fill="#4bc2f5"/><circle cx="80" cy="119" r="7" fill="white"/><path d="M50 67V42l30-15 29 15v27L80 80Z" fill="#a6bfd6" stroke="#304157" strokeWidth="4"/><path d="M61 51h38v12H61Z" fill="#253247"/><path d="M67 57h8m11 0h8" stroke="#50d6ff" strokeWidth="5"/><path d="M80 26V12m-6 0h12" stroke="#637d98" strokeWidth="4"/></svg>;
  if (id === "cat") return <svg viewBox="0 0 160 200" className={`chibi ${className}`} aria-label="Clockwork cat"><ellipse cx="80" cy="181" rx="42" ry="8" fill="#122948" opacity=".18"/><path d="M109 154q45-43 18-52" fill="none" stroke="#4e446c" strokeWidth="13" strokeLinecap="round"/><path d="M57 107q-30 71 11 72h28q33-4 8-72" fill="#4e446c"/><path d="m48 86-4-49 31 27 32-23 8 47q-2 39-32 40T48 86" fill="#635780" stroke="#2d2949" strokeWidth="3"/><ellipse cx="68" cy="94" rx="5" ry="10" fill="#a8e7f9"/><ellipse cx="96" cy="94" rx="5" ry="10" fill="#a8e7f9"/><path d="m75 108 7 6 7-6" fill="#eaaac9"/><path d="m49 63 21-47 35 45 15 9H34Z" fill="#2c2946"/><path d="m60 51 36-2 7 11-49 2Z" fill="#aa8ce2"/><circle cx="83" cy="150" r="17" fill="#ddc395" stroke="#2c2946" strokeWidth="3"/><path d="M83 138v12l8 5" fill="none" stroke="#504662" strokeWidth="3"/></svg>;
  if (id === "penelope") return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label="Penelope with her cast-iron frying pan">
    <ellipse cx="80" cy="200" rx="40" ry="7" fill="#2a0f27" opacity=".28"/>
    <g opacity=".55"><ellipse cx="80" cy="82" rx="62" ry="52" fill="none" stroke="#ff7ad1" strokeWidth="2.5"/><ellipse cx="80" cy="82" rx="40" ry="66" fill="none" stroke="#ff9ada" strokeWidth="1.6"/><path d="M18 82h124M80 16v132" stroke="#ffaee4" strokeWidth="1.3"/><circle cx="80" cy="82" r="7" fill="#ff5fc0"/></g>
    <path d="M30 196q50 10 100 0" stroke="#3b2436" strokeWidth="3" fill="none"/>
    <path d="m62 128 8 34h9l3-31 3 31h9l8-34Z" fill="#1d1d24"/><path d="m64 158-11 8h22l6-6 6 6h22l-12-8" fill="#2b2b33"/><path d="M64 166h11l-2 16H62Zm22 0h11l2 16H88Z" fill="#2b2b33"/>
    <path d="M56 112q24-12 48 0l6 26q-30 12-60 0Z" fill="#fdfdfd" stroke="#c9ccd6" strokeWidth="2"/>
    <path d="m56 116 24 34 24-34-24 12Z" fill="#f2f3f8"/><path d="m80 130-5 8 5 20 6-20Z" fill="#ff6ec4"/>
    <rect x="52" y="108" width="56" height="9" rx="3" fill="#191921"/><rect x="74" y="107" width="12" height="11" rx="2" fill="#c9ccd6"/>
    <path d="M52 116 26 74m82 40 22-40" stroke="#ffe3d6" strokeWidth="9" strokeLinecap="round"/>
    <circle cx="24" cy="70" r="7" fill="#ffe3d6"/><circle cx="134" cy="70" r="7" fill="#ffe3d6"/>
    <ellipse cx="80" cy="72" rx="42" ry="42" fill="#e9eef2" stroke="#b9c2cc" strokeWidth="2"/>
    <ellipse cx="80" cy="80" rx="33" ry="31" fill="#ffe8dc"/>
    <path d="M42 72q-6-42 38-41 40-1 40 40l-14-16-8 14-14-18-12 16-10-14-14 22Z" fill="#eef2f6" stroke="#c3ccd5" strokeWidth="1.6"/>
    <ellipse cx="67" cy="81" rx="7" ry="10" fill="#8a5cf0"/><ellipse cx="95" cy="81" rx="7" ry="10" fill="#8a5cf0"/>
    <ellipse cx="68" cy="83" rx="3.2" ry="5.6" fill="#2a1f45"/><ellipse cx="94" cy="83" rx="3.2" ry="5.6" fill="#2a1f45"/><circle cx="65" cy="77" r="3.2" fill="#fff"/><circle cx="91" cy="77" r="3.2" fill="#fff"/>
    <path d="m58 70 16 2m14 0 16-2" stroke="#5d6472" strokeWidth="3" strokeLinecap="round"/>
    <ellipse cx="56" cy="94" rx="7" ry="3" fill="#ffa8cd" opacity=".7"/><ellipse cx="106" cy="94" rx="7" ry="3" fill="#ffa8cd" opacity=".7"/>
    <path d="M69 99q11 11 22 0" fill="none" stroke="#c8547f" strokeWidth="3" strokeLinecap="round"/>
    <path d="M70 112q10 4 20 0" fill="none" stroke="#dfe3ea" strokeWidth="5" strokeLinecap="round"/>
    <g><ellipse cx="80" cy="34" rx="52" ry="20" fill="#232329" stroke="#111116" strokeWidth="3"/><ellipse cx="80" cy="30" rx="52" ry="20" fill="#2f2f38"/><ellipse cx="80" cy="30" rx="42" ry="14" fill="#3a3a44"/><path d="M80 30v-52" stroke="#4c4c58" strokeWidth="11" strokeLinecap="round"/><path d="M80 -22v-8" stroke="#3a3a44" strokeWidth="12" strokeLinecap="round"/></g>
    <path d="m118 60 26-30" stroke="#ff8fd6" strokeWidth="3" strokeDasharray="5 5"/>
  </svg>;
  if (id === "ruta") return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label="Ruta with her long lance">
    <ellipse cx="80" cy="201" rx="40" ry="7" fill="#2b0f10" opacity=".3"/>
    <g transform="rotate(-34 80 110)"><path d="M-8 150h176" stroke="#8a5a3b" strokeWidth="6" strokeLinecap="round"/><path d="M-8 150h176" stroke="#a97048" strokeWidth="3" strokeLinecap="round"/><path d="m150 150 20-7-6 7 6 7Z" fill="#d8dde3"/></g>
    <path d="m58 118 6 40h13l3-36 4 36h13l6-40Z" fill="#2c2c33"/><path d="m60 156-10 9h20l6-7 7 7h20l-11-9" fill="#3a3a42"/>
    <path d="M62 174h12l-3 20H58Zm24 0h12l4 20H90Z" fill="#7a5236"/><path d="M62 176h12M86 176h12M64 184h11M88 184h11" stroke="#5e3f28" strokeWidth="2"/>
    <path d="M54 104q26-13 52 0l8 20q-34 13-68 0Z" fill="#b7342f" stroke="#7d221f" strokeWidth="2"/>
    <path d="m54 108 26 36 26-36-26 13Z" fill="#c4403a"/>
    <path d="M56 92q24-11 48 0l4 14q-28 11-56 0Z" fill="#4a4a52"/><path d="M46 96q34 14 68 0l-4 12q-30 11-60 0Z" fill="#3c3c44"/>
    <path d="m70 108q10 26 2 52m20-52q-8 28-4 52" stroke="#8d8d97" strokeWidth="7" fill="none"/>
    <path d="M54 104 24 84m82 20 28-20" stroke="#ffe3d6" strokeWidth="9" strokeLinecap="round"/>
    <circle cx="22" cy="82" r="7" fill="#ffe3d6"/><circle cx="138" cy="82" r="7" fill="#ffe3d6"/>
    <ellipse cx="80" cy="70" rx="41" ry="41" fill="#8a5a3b" stroke="#6b4429" strokeWidth="2"/>
    <ellipse cx="80" cy="78" rx="32" ry="30" fill="#ffe8dc"/>
    <path d="M44 68q-4-40 36-39 38-1 38 38l-16-14-4 14-12-18-10 16-10-14-16 22Z" fill="#8a5a3b" stroke="#6b4429" strokeWidth="1.6"/>
    <path d="M112 62q26-2 22 18-4 18-24 12 12-14 2-30" fill="#8a5a3b" stroke="#6b4429" strokeWidth="1.6"/>
    <ellipse cx="67" cy="79" rx="7" ry="10" fill="#d84040"/><ellipse cx="94" cy="79" rx="7" ry="10" fill="#d84040"/>
    <ellipse cx="68" cy="81" rx="3.2" ry="5.6" fill="#3a1414"/><ellipse cx="93" cy="81" rx="3.2" ry="5.6" fill="#3a1414"/><circle cx="64" cy="75" r="3" fill="#fff"/><circle cx="90" cy="75" r="3" fill="#fff"/>
    <path d="m58 68 16 1m14 0 16-1" stroke="#4a2d1c" strokeWidth="3.4" strokeLinecap="round"/>
    <ellipse cx="57" cy="92" rx="6" ry="2.6" fill="#f3a09a" opacity=".55"/><ellipse cx="105" cy="92" rx="6" ry="2.6" fill="#f3a09a" opacity=".55"/>
    <path d="M74 100h12" stroke="#b0685c" strokeWidth="2.6" strokeLinecap="round"/>
  </svg>;
  if (id === "prime") return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label="Clockwork Sentry Prime">
    <ellipse cx="80" cy="200" rx="52" ry="9" fill="#0c1a2c" opacity=".26"/>
    <g opacity=".5"><circle cx="80" cy="96" r="74" fill="none" stroke="#9fd8f5" strokeWidth="1.6" strokeDasharray="7 7"/><circle cx="80" cy="96" r="58" fill="none" stroke="#9fd8f5" strokeWidth="1"/></g>
    <path d="m34 118-22 40 20 10m94-50 22 40-20 10" fill="#5e7c96" stroke="#22344a" strokeWidth="5"/>
    <path d="m44 168-6 26h20l8-26m22 0 8 26h20l-6-26" fill="#3c4b60"/>
    <path d="m34 96 46-26 46 26-10 76-36 16-36-16Z" fill="#9db6cc" stroke="#26394f" strokeWidth="4"/>
    <path d="m40 100 40-22 40 22-8 66-32 14-32-14Z" fill="#b4cbe0"/>
    <circle cx="80" cy="126" r="30" fill="#26394f"/><circle cx="80" cy="126" r="20" fill="#e2544f"/><circle cx="80" cy="126" r="10" fill="#ffd9c9"/><circle cx="80" cy="126" r="4" fill="#fff"/>
    <path d="M80 96v-24m-14 24-10-16m38 16 10-16" stroke="#5b728e" strokeWidth="4"/>
    <path d="M48 74V40l32-16 32 16v30L80 84Z" fill="#9db6cc" stroke="#26394f" strokeWidth="4"/>
    <path d="M58 58h44v14H58Z" fill="#1d2c3f"/><path d="m64 65 10-4 2 6-10 4Zm22 0 10-4 2 6-10 4Z" fill="#ff6b62"/>
    <path d="M80 24V8m-9 0h18" stroke="#637d98" strokeWidth="4"/><circle cx="80" cy="6" r="5" fill="#e2544f"/>
  </svg>;
  if (id === "terminal") return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label="GachaCorp Server Terminal">
    <ellipse cx="80" cy="202" rx="54" ry="9" fill="#0c1a2c" opacity=".28"/>
    <g opacity=".45"><circle cx="80" cy="92" r="72" fill="none" stroke="#ff7a6b" strokeWidth="1.4" strokeDasharray="6 8"/></g>
    <path d="M36 30h88v150q0 14-14 14H50q-14 0-14-14Z" fill="#2c3a4e" stroke="#16202f" strokeWidth="4"/>
    <path d="M44 38h72v138H44Z" fill="#384a61"/>
    <path d="M50 46h60v10H50Zm0 16h60v10H50Zm0 16h60v10H50Z" fill="#1e2c3d" opacity=".8"/>
    <path d="M54 50h20v2H54Zm0 16h34v2H54Zm0 16h14v2H54Z" stroke="#5cf0c8" strokeWidth="2.4"/>
    <ellipse cx="80" cy="128" rx="31" ry="31" fill="#16202f"/>
    <ellipse cx="80" cy="128" rx="23" ry="23" fill="#e03a34"/>
    <ellipse cx="80" cy="128" rx="11" ry="11" fill="#ffd7cd"/><ellipse cx="80" cy="128" rx="4.5" ry="4.5" fill="#7a1613"/>
    <path d="M80 97V84m0 88v-13" stroke="#e03a34" strokeWidth="4"/>
    <path d="M36 58q-22 30-6 62m94-62q22 30 6 62" stroke="#e03a34" strokeWidth="4" fill="none" opacity=".7"/>
    <path d="M50 184h60v10H50Z" fill="#16202f"/><circle cx="62" cy="189" r="3" fill="#5cf0c8"/><circle cx="74" cy="189" r="3" fill="#e2544f"/>
  </svg>;
  if (id === "enforcer") return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label="Corporate Enforcer">
    <ellipse cx="80" cy="200" rx="46" ry="9" fill="#0c1a2c" opacity=".26"/>
    <path d="M40 128 16 190l24-4 10-52m66 52 24 4-24-62-10 52" fill="#4a5568" stroke="#242e3d" strokeWidth="3.5"/>
    <path d="m58 172 2 22h13l4-20 5 20h13l2-22Z" fill="#2a3444"/><path d="m60 192-9 8h24v-8m12 0v8h24l-9-8" fill="#2a3444"/>
    <path d="M48 122q32-16 64 0l6 54q-38 14-76 0Z" fill="#57657c" stroke="#242e3d" strokeWidth="3.5"/>
    <path d="M56 126 44 158l12 8 14-34m34 26-12 8-14-34 12-6" fill="#48566b" stroke="#242e3d" strokeWidth="3"/>
    <path d="m64 128 16 40 16-40-16 8Z" fill="#c9d4e2"/><path d="m80 138-5 8 5 22 6-22Z" fill="#e2544f"/>
    <rect x="54" y="118" width="52" height="10" rx="3" fill="#1d2735"/><rect x="72" y="116" width="16" height="14" rx="3" fill="#e2544f"/>
    <path d="M50 124 30 96m80 28 20-28" stroke="#8494a8" strokeWidth="11" strokeLinecap="round"/>
    <circle cx="28" cy="92" r="10" fill="#39465a" stroke="#242e3d" strokeWidth="3"/><circle cx="132" cy="92" r="10" fill="#39465a" stroke="#242e3d" strokeWidth="3"/>
    <ellipse cx="80" cy="80" rx="38" ry="40" fill="#7d8ba0" stroke="#3a4759" strokeWidth="3.5"/>
    <path d="M46 74q0-38 34-38t34 38l-14-12-6 14-14-20-14 20-6-14Z" fill="#8b99ae"/>
    <path d="M54 78h52v22H54Z" fill="#141d2a"/><path d="m60 86 14-4 3 8-14 4Zm26 0 14-4 3 8-14 4Z" fill="#ff5b52"/>
    <path d="M64 106h32" stroke="#141d2a" strokeWidth="5"/>
  </svg>;
  if (id === "vane") return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label="Director Vane">
    <ellipse cx="80" cy="202" rx="50" ry="9" fill="#0c1a2c" opacity=".3"/>
    <g opacity=".55"><path d="M80 18 148 56v72L80 166 12 128V56Z" fill="none" stroke="#c9a04a" strokeWidth="1.8"/></g>
    <path d="M34 130 12 194l22-6 10-54m62 56 22 6-22-64-10 54" fill="#5c4a2e" stroke="#2e2416" strokeWidth="4"/>
    <path d="m56 176 2 20h14l4-18 5 18h14l2-20Z" fill="#2e2416"/><path d="m58 194-9 8h25v-8m12 0v8h25l-9-8" fill="#2e2416"/>
    <path d="M44 124q36-18 72 0l8 58q-44 16-88 0Z" fill="#7a6236" stroke="#2e2416" strokeWidth="4"/>
    <path d="M52 128 40 164l14 8 16-38m34 30-14 8-16-38 14-6" fill="#63502c" stroke="#2e2416" strokeWidth="3.5"/>
    <path d="m62 130 18 42 18-42-18 9Z" fill="#e8dcbb"/><path d="m80 141-6 9 6 22 7-22Z" fill="#c99a3c"/>
    <path d="M46 56 80 40l34 16-6 44q-28 12-56 0Z" fill="#8a7342" stroke="#2e2416" strokeWidth="4"/>
    <path d="M56 60 46 92l12 8 12-34m24 30 12 8 12-34-12-8" fill="#6f5c33" stroke="#2e2416" strokeWidth="3.5"/>
    <path d="M80 40V18m-11 0h22" stroke="#c9a04a" strokeWidth="5"/><circle cx="80" cy="14" r="6" fill="#e8dcbb" stroke="#c9a04a" strokeWidth="3"/>
    <ellipse cx="80" cy="84" rx="30" ry="26" fill="#6b5a33" stroke="#2e2416" strokeWidth="3.5"/>
    <path d="M54 80h52v20H54Z" fill="#141d2a"/><path d="m60 88 15-4 3 8-15 4Zm25 0 15-4 3 8-15 4Z" fill="#ffb03a"/>
    <path d="M74 106h12" stroke="#141d2a" strokeWidth="5"/>
  </svg>;
  const longHair = ["ynna", "angelina", "solari"].includes(id);
  const outfit = id === "purp" ? "#3d2c5c" : id === "edgelord" ? "#6d5a41" : id === "solari" ? "#fff9e3" : "#304463";
  const outfitTrim = id === "purp" ? "#8a5cd6" : id === "edgelord" ? "#4a4133" : "#29324b";
  return <svg viewBox="0 0 160 210" className={`chibi ${className}`} aria-label={label ?? c.name}>
    <ellipse cx="80" cy="198" rx="42" ry="8" fill="#13243b" opacity=".17"/>
    {longHair && <path d="M38 65q-10 65-9 109l32-15 34 4 36 17q-5-80-13-110" fill={c.hair} stroke="#505477" strokeWidth="2.5"/>}
    {["purp", "edgelord", "solari"].includes(id) && <path d="M45 119 23 186l57-17 59 17-23-67Z" fill={id === "solari" ? "#fffcdf" : "#393149"} stroke={id === "purp" ? "#e8bd57" : c.color} strokeWidth="4"/>}
    <path d="m59 164 2 30h14l5-27 6 27h15l-1-30Z" fill="#283048"/><path d="m61 191-9 8h24v-8m11 0v8h25l-12-8" fill="#283048"/>
    <path d="M52 119q28-16 55 0l10 52q-36 15-75 0Z" fill={id === "solari" ? "#fff9e3" : "#304463"} stroke="#29324b" strokeWidth="2.5"/>
    <path d="m58 116 22 39 22-39-22 11Z" fill="#f5f7ff"/><path d="m80 128-6 9 6 22 7-22Z" fill={c.color}/>
    <path d="M52 122 32 154l12 8 20-30m42-10 21 31-14 9-15-30" fill={outfit} stroke={outfitTrim} strokeWidth="2.5"/>
    <circle cx="38" cy="160" r="9" fill="#ffe2d3"/><circle cx="121" cy="160" r="9" fill="#ffe2d3"/>
    <ellipse cx="80" cy="77" rx="44" ry="46" fill={c.hair} stroke="#41425e" strokeWidth="2.5"/>
    <ellipse cx="80" cy="84" rx="36" ry="34" fill="#ffe8dc"/>
    <path d="M40 77q-3-47 37-46 42-2 46 42l-18-14-5 17-13-23-10 21-8-16-18 23Z" fill={c.hair} stroke="#505477" strokeWidth="1.8"/>
    <ellipse cx="66" cy="85" rx="7.5" ry="11" fill={eye}/><ellipse cx="96" cy="85" rx="7.5" ry="11" fill={eye}/>
    <ellipse cx="67" cy="87" rx="3.4" ry="6" fill="#283248"/><ellipse cx="95" cy="87" rx="3.4" ry="6" fill="#283248"/><circle cx="64" cy="81" r="3.5" fill="white"/><circle cx="93" cy="81" r="3.5" fill="white"/>
    <path d="m57 75 16 1m15 0 16-1" stroke="#343346" strokeWidth="3" strokeLinecap="round"/>
    <ellipse cx="55" cy="98" rx="7" ry="3" fill="#f3a6ad" opacity=".6"/><ellipse cx="107" cy="98" rx="7" ry="3" fill="#f3a6ad" opacity=".6"/>
    <path d="M75 105q6 5 12-1" fill="none" stroke="#aa6471" strokeWidth="2" strokeLinecap="round"/>
    {id === "ynna" && <><path d="m119 48 20-7-7 21-15-8-13 6 4-18Z" fill="#3798ed"/><rect x="112" y="144" width="18" height="28" rx="3" transform="rotate(-13 120 158)" fill="#a9d7fa" stroke="#304463" strokeWidth="2"/><circle cx="120" cy="149" r="2" fill="#304463"/></>}
    {id === "purp" && <><circle cx="65" cy="85" r="13" fill="none" stroke="#c8a14b" strokeWidth="2"/><circle cx="96" cy="85" r="13" fill="none" stroke="#c8a14b" strokeWidth="2"/><path d="M78 84h5" stroke="#c8a14b" strokeWidth="2"/><path d="m106 143 21-6 16 10-8 30-18-6-17 2Z" fill="#a888dc" stroke="#e7c963" strokeWidth="3"/></>}
    {id === "edgelord" && <><path d="m111 169 36-73" stroke="#c5d8ef" strokeWidth="7"/><path d="m119 150 17 7" stroke="#9b88c7" strokeWidth="5"/><path d="M42 119q22 30 65 4l-7 18q-34 3-58-7" fill="#8f83bc"/></>}
    {id === "solari" && <><path d="M81 100q-18-7-23 4 10 13 23 0 14 13 24 0-5-11-24-4" fill="#847053"/><path d="M133 90v104" stroke="#d7b55e" strokeWidth="6"/><circle cx="133" cy="84" r="14" fill="none" stroke="#e8cd79" strokeWidth="5"/><path d="M125 84h16m-8-8v16" stroke="#e8cd79" strokeWidth="4"/></>}
    {id === "ninette" && <path d="m24 151 21-9 17 34-20 10Z" fill="#81d2d7" stroke="#33455b" strokeWidth="3"/>}
  </svg>;
}
export function Modal({ title, eyebrow, onClose, children, className = "" }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null); const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href], select, [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("keydown", handle); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="modal-top"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={23} /></button></div>{children}</div></div>;
}
export function EmptyState({ children }: { children: ReactNode }) { return <div className="empty-state"><Sparkles size={35} /><p>{children}</p></div>; }
