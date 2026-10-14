// The campaign has decision points, and those decisions are meant to matter:
// a pick is recorded on the save, and later scenes can read it back. These
// tests protect the mechanism rather than the prose, so the script can be
// rewritten freely without quietly losing the branching.
import test from "node:test";
import assert from "node:assert/strict";
import { choicePointById, stages, stageScript, type LineEntry, type ScriptEntry, type ScriptLine } from "@/lib/campaign";

const lines = (entries: ScriptEntry[]) => entries.filter((e): e is LineEntry => e.kind === "line");

/** Every choice point in the campaign, with the stage it belongs to. */
function allChoices() {
  const out: { stageId: string; id: string; prompt: string; options: { id: string; label: string; reply: ScriptLine[] }[] }[] = [];
  for (const stage of stages) for (const phase of ["pre", "post"] as const) for (const entry of stage[phase]) {
    if (entry.kind === "choice") out.push({ stageId: stage.id, id: entry.id, prompt: entry.prompt, options: entry.options });
  }
  return out;
}

test("the campaign has decision points, and they are spread across it", () => {
  const choices = allChoices();
  assert.ok(choices.length >= 6, `only ${choices.length} decisions in the whole campaign`);
  const chapters = new Set(choices.map(c => c.stageId.split("-")[0]));
  assert.ok(chapters.size >= 4, `decisions only appear in ${chapters.size} chapter(s)`);
});

test("every decision offers real alternatives", () => {
  for (const choice of allChoices()) {
    assert.ok(choice.options.length >= 2,
      `${choice.id} offers ${choice.options.length} option(s); a decision needs at least two`);
    const ids = choice.options.map(o => o.id);
    assert.equal(new Set(ids).size, ids.length, `${choice.id} has two options with the same id`);
    for (const option of choice.options) {
      assert.ok(option.label.trim().length > 0, `${choice.id}/${option.id} has no label`);
      assert.ok(option.reply.length > 0, `${choice.id}/${option.id} has no reply`);
    }
    // A choice where both answers say the same thing is not a choice.
    const answers = choice.options.map(o => o.reply.map(r => r.text).join("|"));
    assert.equal(new Set(answers).size, answers.length, `${choice.id} has two options that answer identically`);
  }
});

test("every choice point is reachable by its id, so a pick can be validated", () => {
  for (const choice of allChoices()) {
    assert.ok(choicePointById(choice.id), `${choice.id} is not registered`);
  }
  assert.equal(choicePointById("no-such-choice"), undefined);
});

test("picking an option replaces the prompt with that option's reply", () => {
  // This is the branching mechanism: the reply is spliced in where the decision
  // was, so the scene continues from the answer you gave.
  for (const choice of allChoices()) {
    const forOption = (optionId: string) => {
      const stage = stages.find(s => s.id === choice.stageId)!;
      const phase = stage.pre.some(e => e.kind === "choice" && e.id === choice.id) ? "pre" as const : "post" as const;
      const entries = stageScript(stage, phase, { [choice.id]: optionId }, { [choice.id]: optionId });
      const rebuild = entries.map(e => (e.kind === "line" ? `L:${e.text}` : `C:${e.id}`)).join("\n");
      return { entries, rebuild };
    };
    for (const option of choice.options) {
      const { entries } = forOption(option.id);
      // The decision stays in the transcript as a record of what you chose -
      // the screen marks the option you picked - and the reply follows it.
      const decision = entries.find(e => e.kind === "choice");
      assert.ok(decision, `${choice.id} should remain in the transcript as a record`);
      for (const reply of option.reply) {
        assert.ok(entries.some(e => e.kind === "line" && e.text === reply.text),
          `${choice.id}/${option.id}'s reply "${reply.text.slice(0, 40)}…" never appears`);
      }
      // ...and it must come after the decision it answers.
      const at = entries.findIndex(e => e.kind === "choice");
      const replyAt = entries.findIndex(e => e.kind === "line" && e.text === option.reply[0].text);
      assert.ok(replyAt > at, `${choice.id}/${option.id}'s reply appears before the decision`);
    }
    // Two different answers must produce two different scenes.
    const [a, b] = choice.options.slice(0, 2).map(o => forOption(o.id).rebuild);
    assert.notEqual(a, b, `${choice.id} produces the same scene whichever option is picked`);
  }
});

test("a decision that has not been taken is still on screen", () => {
  for (const choice of allChoices()) {
    const stage = stages.find(s => s.id === choice.stageId)!;
    const entries = stageScript(stage, "pre", {}, {});
    const open = entries.some(e => e.kind === "choice" && e.id === choice.id)
      || stageScript(stage, "post", {}, {}).some(e => e.kind === "choice" && e.id === choice.id);
    assert.ok(open, `${choice.id} disappears when no pick has been made`);
  }
});

test("replaying a scene keeps the answer you already gave", () => {
  // The story archive replays scenes. Showing a fresh decision prompt to someone
  // who already decided would be a continuity error.
  const choice = allChoices()[0];
  const stage = stages.find(s => s.id === choice.stageId)!;
  const phase = stage.pre.some(e => e.kind === "choice" && e.id === choice.id) ? "pre" as const : "post" as const;
  const entries = stageScript(stage, phase, { [choice.id]: choice.options[0].id }, { [choice.id]: choice.options[0].id });
  const decision = entries.find(e => e.kind === "choice");
  assert.ok(decision, "the decision point should still be present in the transcript");
  const replyShown = lines(entries).some(l => choice.options[0].reply.some(r => r.text === l.text));
  assert.ok(replyShown, "the earlier answer should be visible in the replay");
});
