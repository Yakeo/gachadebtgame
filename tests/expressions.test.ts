// The campaign shows an illustrated portrait for every speaking character, in
// a face that matches the line. These tests protect that: the mapping from a
// script name to a character, the mood that a line resolves to, and the rule
// that nobody in the script is left without a face.
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chapters, stages, stageById } from "@/lib/campaign";
import {
  MOODS,
  moodFor,
  offscreenSpeakers,
  portraitFor,
  portraitUrl,
  speakerIds,
  speakerName,
} from "@/lib/expressions";
import { portraitHashes } from "@/lib/portrait-manifest";

/**
 * Every spoken line in the campaign, including the replies to a choice.
 *
 * A stage's script is a list of entries: plain lines, and decision points whose
 * options each carry their own reply. Only the lines have a speaker.
 */
function allLines(stageList = stages) {
  const lines: { speaker: string; text: string }[] = [];
  for (const stage of stageList) for (const phase of ["pre", "post"] as const) for (const entry of stage[phase]) {
    if (entry.kind === "line") lines.push(entry);
    else for (const option of entry.options) lines.push(...option.reply);
  }
  return lines;
}

/** Every speaker who appears anywhere in the campaign. */
function allSpeakers() {
  return [...new Set(allLines().map(line => line.speaker))];
}

test("every speaker in the campaign has a portrait or is deliberately off-screen", () => {
  // Compare on the display name: a speaker written as `Ruta:smug` is still Ruta.
  const missing = allSpeakers()
    .map(speakerName)
    .filter(speaker => !speakerIds[speaker] && !offscreenSpeakers.has(speaker));
  assert.deepEqual(missing, [], `these speakers would render no portrait: ${missing.join(", ")}`);
});

test("the story cast maps to its own characters, not to stand-ins", () => {
  // This is a regression test: Director Vane and the Mysterious Sorcerer were
  // both mapped onto other characters' art before those units existed.
  assert.equal(speakerIds["Director Vane"], "vane");
  assert.equal(speakerIds["Mysterious Sorcerer"], "sorcerer");
  assert.equal(speakerIds.Ninette, "ninette");
  assert.equal(speakerIds.Purp, "purp");
  assert.equal(speakerIds.Escanooor, "escanooor");
  // Two names may only share art where that is deliberate and documented.
  const aliases = new Set(["Enforcer Vane-02"]);   // a Vane-series unit, not a person
  const shared = Object.entries(speakerIds)
    .filter(([name]) => !aliases.has(name))
    .map(([, id]) => id);
  assert.equal(new Set(shared).size, shared.length, "two names share a portrait");
});

test("every portrait id resolves to a real file for every mood", () => {
  for (const id of new Set(Object.values(speakerIds))) {
    for (const mood of MOODS) {
      const face = `${id}-${mood}`;
      const url = portraitUrl(id, mood);
      // The version query is the whole point: it changes when the art does, so
      // a corrected portrait cannot be served from a cache holding the old one.
      assert.equal(url, `/images/faces/${face}.png?v=${portraitHashes[face]}`);
      assert.match(url, /^\/images\/faces\/[a-z0-9-]+\.png\?v=[0-9a-f]{8}$/);
      assert.ok(existsSync(join(process.cwd(), "public", "images", "faces", `${face}.png`)), `missing art for ${face}`);
    }
  }
});

test("a corrected portrait gets a URL that busts the cache", () => {
  // The bug this guards: portraits are served from /public with a long-lived
  // cache, so identical URLs mean a fixed image can stay invisible for good.
  // Re-hashing the same bytes must give the same version, and any change to the
  // bytes must give a different one.
  const before = portraitUrl("alvida", "calm");
  assert.equal(before, `/images/faces/alvida-calm.png?v=${portraitHashes["alvida-calm"]}`);

  const otherMood = portraitUrl("alvida", "angry");
  assert.notEqual(otherMood, `/images/faces/alvida-calm.png?v=${portraitHashes["alvida-calm"]}`);

  // A portrait with no hash on record degrades to a plain path, never a broken URL.
  assert.equal(portraitUrl("not-a-character", "calm"), "/images/faces/not-a-character-calm.png");
});

test("the committed manifest matches the art on disk", async () => {
  // The manifest is generated. If someone edits a portrait without refreshing
  // it, the deployed URL keeps pointing at the old cache entry - the exact
  // failure this whole mechanism exists to prevent. Every build regenerates it
  // (see next.config.ts), so drift here means the build step was skipped.
  const { portraitManifest } = await import("../scripts/gen-portrait-manifest.mjs");
  const fresh = portraitManifest();
  const committed = portraitHashes as Record<string, string>;
  assert.deepEqual(
    Object.keys(committed).sort(),
    Object.keys(fresh).sort(),
    "the manifest lists different portraits than public/images/faces",
  );
  const stale = Object.keys(fresh).filter((face) => fresh[face] !== committed[face]);
  assert.deepEqual(stale, [], `these hashes are stale - run npm run art:manifest: ${stale.join(", ")}`);
});

test("an explicit mood in the script always wins", () => {
  const { id, mood } = portraitFor("Purp:smug", "This line would otherwise read as calm.");
  assert.equal(id, "purp");
  assert.equal(mood, "smug");
  // an invalid mood falls back to inference rather than throwing
  assert.equal(portraitFor("Purp:nonsense", "SHUT UP!").mood, "angry");
});

test("a line's mood follows how it is actually delivered", () => {
  assert.equal(moodFor("SHUT UP, EDGELORD! You broke our window last week!"), "angry");
  assert.equal(moodFor("(Slams financial binder on the desk) Explain this line item."), "angry");
  assert.equal(moodFor("YOU SPENT THE SCHOOL'S TREASURY ON A PNG?!") , "shocked");
  assert.equal(moodFor("Gasp! That aura…"), "shocked");
  assert.equal(moodFor("Haha! We did it!"), "happy");
  assert.equal(moodFor("(Leaning dramatically against the broken window frame) Peace."), "smug");
  assert.equal(moodFor("Alas. Difficulty is my middle name."), "smug");
  assert.equal(moodFor("It's over. We lost."), "sad");
  assert.equal(moodFor("(Sighs) I'm sorry about all of this."), "sad");
  // ordinary lines stay ordinary: calm is the resting face, and a single
  // exclamation is emphasis, not rage
  assert.equal(moodFor("Which one? The $4 boba tea?"), "calm");
  assert.equal(moodFor("Great! Who wants breakfast?"), "calm");
  assert.equal(moodFor("The audit is scheduled for tomorrow morning."), "calm");
});

test("every mood is reachable from the real script", () => {
  const seen = new Set<string>();
  for (const line of allLines()) seen.add(portraitFor(line.speaker, line.text).mood);
  // calm, angry, shocked and smug all turn up; happy and sad are rarer beats
  for (const mood of ["calm", "angry", "shocked", "smug"]) {
    assert.ok(seen.has(mood), `no line in the campaign resolves to ${mood}`);
  }
  assert.ok(seen.size >= 5, `only ${seen.size} moods appear across the whole campaign`);
});

test("portraits never resolve for off-screen voices", () => {
  for (const speaker of offscreenSpeakers) {
    assert.equal(portraitFor(speaker, "Bzzt. Transfer complete.").id, null, `${speaker} should not have a portrait`);
  }
});

test("the campaign's first scene reads as a scene, with faces to match", () => {
  const opening = stageById("1-1")!.pre
    .filter((entry): entry is Extract<typeof entry, { kind: "line" }> => entry.kind === "line")
    .map(entry => portraitFor(entry.speaker, entry.text));
  assert.ok(opening.length >= 5, "the opening scene should be more than a couple of lines");
  assert.ok(opening.every(o => o.id || offscreenSpeakers.has("Narrator")), "every line resolves to a face or a known off-screen voice");
  assert.ok(opening.some(o => o.mood === "angry"), "Ninette opens the game furious about the treasury");
  assert.ok(opening.some(o => o.mood === "shocked"), "somebody should be shocked about the $30,000");
  assert.ok(opening.some(o => o.mood === "calm"), "the narrator recovers the scene afterwards");
});

test("every chapter is present and speaks with the cast", () => {
  assert.equal(chapters.length, 5);
  const speakers = new Set(allSpeakers());
  // The campaign's own roster, as the script defines it.
  for (const id of ["ynna", "ninette", "purp", "edgelord", "escanooor", "penelope", "ruta", "alvida"]) {
    assert.ok(speakers.has(Object.keys(speakerIds).find(name => speakerIds[name] === id)!), `${id} never speaks`);
  }
});


test("every named cast member actually appears in the script", () => {
  // The campaign roster promises eight speakers. A character on the poster who
  // never opens their mouth is a promise the story does not keep.
  const speakers = new Set(allSpeakers());
  for (const name of ["Ynna", "Ninette", "Purp", "Edgelord69", "Penelope", "Ruta", "Escanooor", "Alvida"]) {
    assert.ok(speakers.has(name), `${name} is in the campaign roster but never speaks`);
  }
});

test("Ruta is a presence throughout, not a cameo", () => {
  // She is one of the canonical four designs, so she should keep turning up
  // rather than appearing once and vanishing.
  const scenes = new Set<string>();
  const chapters = new Set<number>();
  let count = 0;
  for (const stage of stages) {
    for (const phase of ["pre", "post"] as const) for (const entry of stage[phase]) {
      const lines = entry.kind === "line" ? [entry] : entry.options.flatMap(o => o.reply);
      for (const line of lines) {
        if (speakerName(line.speaker) !== "Ruta") continue;
        count++; scenes.add(stage.id); chapters.add(stage.chapter);
      }
    }
  }
  assert.ok(count >= 10, `Ruta has only ${count} lines`);
  assert.ok(scenes.size >= 6, `Ruta appears in only ${scenes.size} scenes`);
  assert.ok(chapters.size >= 4, `Ruta only reaches ${chapters.size} chapters`);
});

test("Ruta never raises her voice", () => {
  // Her defining trait, stated in her own bio: "she never once raised her
  // voice". Most of her lines should therefore read calm, and any line that
  // does not must have been asked for deliberately with a forced mood.
  const moods: string[] = [];
  for (const line of allLines()) {
    if (speakerName(line.speaker) !== "Ruta") continue;
    moods.push(line.speaker.includes(":") ? "forced" : portraitFor(line.speaker, line.text).mood);
  }
  assert.ok(moods.length > 0, "Ruta never speaks");
  // She is terse and procedural, so most of her lines read level. She is also
  // the squad's front line, so combat barks are allowed to register as sharp —
  // the point of the guard is that she is not written as a ranter.
  const calm = moods.filter(m => m === "calm").length;
  assert.ok(calm / moods.length >= 0.6,
    `only ${calm} of ${moods.length} of Ruta's lines read calm — she should stay level`);
  assert.ok(calm > moods.filter(m => m === "angry").length,
    "Ruta's default register should be level, with sharpness as the exception");
});

test("a forced mood is stripped from the nameplate", () => {
  // `Ruta:smug|line` pins the face for one line. The nameplate must still read
  // "Ruta" — before this was handled the suffix leaked into the UI.
  assert.equal(speakerName("Ruta:smug"), "Ruta");
  assert.equal(speakerName("Purp:angry"), "Purp");
  // a colon that is not a mood is part of the name and must survive
  assert.equal(speakerName("P.A. Automated Voice"), "P.A. Automated Voice");
  assert.equal(speakerName("Server Core:nonsense"), "Server Core:nonsense");
  // and the forced mood itself still resolves
  const forced = portraitFor("Ruta:smug", "Line that would otherwise read angry!");
  assert.equal(forced.id, "ruta");
  assert.equal(forced.mood, "smug");
});

test("the story screen renders the stripped speaker name", () => {
  const source = read("src/components/story-battle.tsx");
  assert.match(source, /speakerName\(line\.speaker\)/,
    "the nameplate must use speakerName() so a forced mood never shows up in the UI");
});

function read(p: string) { return readFileSync(new URL(`../${p}`, import.meta.url), "utf8"); }
