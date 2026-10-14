import { characters } from "./game-data";
import { portraitHashes } from "./portrait-manifest";
// Character portraits and the moods behind them.
//
// Every speaking character in the campaign has six illustrated expressions.
// Which one is shown is decided from the line itself, so a line that reads
// like a tantrum shows the angry face without anyone hand-tagging 250 lines of
// dialogue. A writer who wants a specific face can force it with the
// `Speaker:mood|text` syntax in campaign.ts.

export const MOODS = ["calm", "happy", "angry", "shocked", "sad", "smug"] as const;
export type Mood = (typeof MOODS)[number];
export const DEFAULT_MOOD: Mood = "calm";

/** Who is speaking, with the portrait each name draws. */
export const speakerIds: Record<string, string> = {
  Ynna: "ynna",
  Ninette: "ninette",
  Purp: "purp",
  Edgelord69: "edgelord",
  Solari: "solari",
  Penelope: "penelope",
  Escanooor: "escanooor",
  Ruta: "ruta",
  "Director Vane": "vane",
  "Mysterious Sorcerer": "sorcerer",
  Alvida: "alvida",
  // A Vane-series enforcement unit, so it shares the Director's face rather
  // than getting a portrait of its own.
  "Enforcer Vane-02": "vane",
};

/**
 * Speakers who are in the story but are not recruitable.
 *
 * `characterById` falls back to the last playable character, which would put
 * the wrong name and colour on a story-only speaker's nameplate, so the story
 * screen resolves its colours through `speakerProfile` instead.
 */
export const storyCast: Record<string, { name: string; title: string; color: string }> = {
  alvida: { name: "Alvida", title: "Disciplinary Committee", color: "#c2703f" },
};

/** Display details for any speaker id, playable or story-only. */
export function speakerProfile(id: string): { name: string; title: string; color: string } {
  const playable = characters.find(c => c.id === id);
  if (playable) return { name: playable.name, title: playable.title, color: playable.color };
  return storyCast[id] ?? { name: id, title: "Gacha Debt", color: "#468cd4" };
}

/** Narrators, machines and monsters speak from off-screen. */
export const offscreenSpeakers = new Set([
  "Narrator", "System", "System Voice", "P.A. Announcement", "Automated P.A. System",
  "P.A. Automated Voice", "Server Core", "Cursed Cat Mob", "Spun Shroom",
]);

/**
 * The six expressions exist for the speaking cast; these two appear on stage
 * but never got an expression sheet of their own.
 */
export const portraitCharacters = Object.values(speakerIds);

// Keyword signals. Each one is a real lexical hint, not punctuation - the
// punctuation pass below handles shouting and stammering separately.
const ANGRY = /\b(what the|how dare|unacceptable|absurd|ridiculous|outrageous|shut up|stop it|idiot|incompetent|fraud|heresy|blasphem|thief|steal|liar|get out|how could you|i refuse|damn|furious|fuming|are you kidding|criminal|scam|extortion|betray|my fault|you broke)\b/i;
const SHOCKED = /\b(no way|you're joking|are you serious|impossible|unbelievable|wait,? what|excuse me|what do you mean|don't tell me|it can't be|cannot be|gasp|what is that|what the heck)\b/i;
const HAPPY = /\b(haha|hehe|lol|yay|woohoo|awesome|amazing|brilliant|wonderful|delighted|celebrat|we did it|let's go|cheers|great news|thank you|so glad)\b/i;
const SAD = /\b(i'm sorry|apolog|sigh|unfortunately|i regret|we failed|failed anyway|goodbye|farewell|so tired|exhausted|given up|no hope|hopeless|it's over|we lost|i can't do this)\b/i;
const SMUG = /\b(hmph|heh heh|tch|obviously|naturally|as expected|predictable|amateur|child'?s play|watch and learn|allow me|i told you|knew it|kneel|bow before|witness|peasant|simpleton|my dear|if you insist|alas|destiny|as if|doubt me|master of|my middle name|child of light)\b/i;
const EMOJI = /[:;]-?[)D]|♪|\bha(ha)+\b/i;

// The script annotates its own performances with stage directions - "(Slams
// financial binder on the desk)", "(Leaning dramatically against the broken
// window frame)". Those asides are the writer telling us how the line is
// delivered, so they are the strongest signal available.
const DIRECTIONS: Array<[Mood, RegExp]> = [
  ["angry", /\b(slam(?:s|ming)?|storm(?:s|ing)?|snap(?:s|ping)?|yell(?:s|ing)?|shout(?:s|ing)?|glar(?:es|ing)|seiz(?:es|ing)|thunder(?:s|ing)?|bang(?:s|ing)? (?:the|his|her|a)\b)/i],
  ["shocked", /\b(gasp(?:s|ing)?|gawk(?:s|ing)?|recoil(?:s|ing)?|jolt(?:s|ing)?|freez(?:es|ing)|chok(?:es|ing))/i],
  ["happy", /\b(beam(?:s|ing)?|grin(?:s|ning)?|laugh(?:s|ing)?|cheer(?:s|ing)?|bounc(?:es|ing)|giggl(?:es|ing)|hug(?:s|ging)?)/i],
  ["sad", /\b(sigh(?:s|ing)?|slump(?:s|ing)?|deflat(?:es|ing)|rub(?:s|bing)? (?:his|her|their) temple|look(?:s|ing)? (?:away|down)|tears? up|trembl(?:es|ing))/i],
  ["smug", /\b(smirk(?:s|ing)?|smug|drawl(?:s|ing)?|chuckl(?:es|ing)|lean(?:s|ing)? dramatically|adjust(?:s|ing)? (?:his|her) (?:coat|glasses|scarf))/i],
];
/** Words that are just acronyms, so capitalisation alone does not mean shouting. */
const ACRONYMS = new Set(["SSR", "UR", "SR", "R", "OK", "CEO", "GPA", "ID", "P.A.", "CCT", "TV", "AI"]);

/**
 * Pick the face that fits a line of dialogue from how it reads: what it says,
 * how loud it is, and how it is punctuated. Ties resolve toward the calmer
 * face, because most lines are ordinary conversation.
 */
export function moodFor(text: string, fallback: Mood = DEFAULT_MOOD): Mood {
  const line = text.trim();
  const score: Record<Mood, number> = { calm: 0, happy: 0, angry: 0, shocked: 0, sad: 0, smug: 0 };

  if (ANGRY.test(line)) score.angry += 4;
  if (SHOCKED.test(line)) score.shocked += 4;
  if (HAPPY.test(line)) score.happy += 4;
  if (SAD.test(line)) score.sad += 4;
  if (SMUG.test(line)) score.smug += 4;
  if (EMOJI.test(line)) score.happy += 3;
  for (const [mood, pattern] of DIRECTIONS) if (pattern.test(line)) score[mood] += 3;
  if (/\bha!+/i.test(line)) score.smug += 3;

  // Shouting: capitals, and more than one exclamation mark. A single
  // exclamation is ordinary emphasis and should not raise anyone's voice -
  // "Great! Who wants breakfast?" is not an angry line.
  const caps = (line.match(/\b[A-Z][A-Z'’-]{2,}\b/g) ?? []).filter(word => !ACRONYMS.has(word));
  const bangs = (line.match(/!/g) ?? []).length;
  if (caps.length) score.angry += Math.min(4, caps.length * 2);
  if (bangs >= 2) {
    if (caps.length || ANGRY.test(line)) score.angry += 4;
    else score.shocked += 2;          // excited, not furious
  } else if (bangs === 1 && !caps.length) {
    score.calm += 1;
  }

  // a question mark and an exclamation together is a double-take
  if (/[?!]{2,}|\?[!]|![?]/.test(line)) { score.shocked += 4; score.angry -= 1; }

  // trailing off
  if (/(\.\.\.|…)\s*$/.test(line)) { score.sad += 1; score.calm += 2; }
  // a short, plain question is curiosity, not alarm
  if (/\?\s*$/.test(line) && !/[?!]{2,}/.test(line)) score.calm += 2;

  let best: Mood = fallback;
  let bestScore = 0;
  // calm first so ties go to the calm face
  for (const mood of ["calm", "happy", "smug", "sad", "shocked", "angry"] as Mood[]) {
    if (score[mood] > bestScore) { best = mood; bestScore = score[mood]; }
  }
  return best;
}

/**
 * Resolve a dialogue line to the portrait to draw.
 * `speaker` may carry an explicit mood as `Name:mood`, which always wins.
 */
export function portraitFor(speaker: string, text: string): { id: string | null; mood: Mood } {
  const [name, forced] = speaker.split(":");
  const id = speakerIds[name.trim()] ?? null;
  const explicit = (MOODS as readonly string[]).includes((forced ?? "").trim()) ? (forced.trim() as Mood) : null;
  if (!id) return { id: null, mood: explicit ?? DEFAULT_MOOD };
  return { id, mood: explicit ?? moodFor(text) };
}

/**
 * The speaker's display name, with any forced-mood suffix removed. A writer can
 * write `Ruta:smug|line` to pin the face for that line, and the nameplate still
 * reads "Ruta". A colon that is not followed by a mood is left alone, so names
 * containing punctuation survive.
 */
export function speakerName(speaker: string) {
  const [name, forced] = speaker.split(":");
  return (MOODS as readonly string[]).includes((forced ?? "").trim()) ? name.trim() : speaker;
}

/** The URL for a character's expression portrait. */
export function portraitUrl(id: string, mood: Mood) {
  const face = `${id}-${mood}`;
  // The content hash makes the URL change whenever the art does. Portraits are
  // served from /public with a long-lived cache, so without it a browser can
  // keep showing a corrected portrait's old bytes at an unchanged address.
  const version = portraitHashes[face];
  return version ? `/images/faces/${face}.png?v=${version}` : `/images/faces/${face}.png`;
}
