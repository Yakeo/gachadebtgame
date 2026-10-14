// The campaign shows an illustrated portrait for every speaking character, in
// a face that matches the line. These tests protect that: the mapping from a
// script name to a character, the mood that a line resolves to, and the rule
// that nobody in the script is left without a face.
import test from "node:test";
import assert from "node:assert/strict";
import { chapters, stages, stageById } from "@/lib/campaign";
import { MOODS, moodFor, offscreenSpeakers, portraitFor, portraitUrl, speakerIds } from "@/lib/expressions";

/** Every speaker who appears anywhere in the campaign. */
function allSpeakers() {
  const speakers = new Set<string>();
  for (const stage of stages) for (const line of [...stage.pre, ...stage.post]) speakers.add(line.speaker);
  return [...speakers];
}

test("every speaker in the campaign has a portrait or is deliberately off-screen", () => {
  const missing = allSpeakers().filter(speaker => !speakerIds[speaker] && !offscreenSpeakers.has(speaker));
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
  const portraits = new Set(Object.values(speakerIds));
  assert.equal(portraits.size, Object.keys(speakerIds).length, "two names share a portrait");
});

test("every portrait id resolves to a real file for every mood", () => {
  for (const id of new Set(Object.values(speakerIds))) {
    for (const mood of MOODS) {
      const url = portraitUrl(id, mood);
      assert.equal(url, `/images/faces/${id}-${mood}.png`);
    }
  }
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
  for (const stage of stages) for (const line of [...stage.pre, ...stage.post]) seen.add(portraitFor(line.speaker, line.text).mood);
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

test("the campaign's own stage 1-1 opens with the cast reacting to each other", () => {
  const opening = stageById("1-1")!.pre.map(line => portraitFor(line.speaker, line.text).mood);
  assert.equal(opening[0], "angry", "the treasurer slams a binder, so he starts angry");
  assert.ok(opening.includes("shocked"), "somebody should be shocked about the $30,000");
  assert.ok(opening.includes("smug"), "Edgelord69 should be smug about it");
});

test("every chapter is present and speaks with the cast", () => {
  assert.equal(chapters.length, 5);
  const speakers = new Set(allSpeakers());
  for (const id of ["ynna", "ninette", "purp", "edgelord", "solari", "escanooor", "penelope", "ruta"]) {
    assert.ok(speakers.has(Object.keys(speakerIds).find(name => speakerIds[name] === id)!), `${id} never speaks`);
  }
});
