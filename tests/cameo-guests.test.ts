// Cameo guests: Ch'en (Arknights) and Katsushika Hokusai (Fate/Grand Order).
//
// Both were added as UR cameos from player-supplied source art. A cameo is an
// ordinary recruit mechanically - it must pull, equip, level, fight and talk -
// but its art is not ours, so the record of where it came from is checked here
// alongside the gameplay.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { characterById, characters, cameoGuestIds, companionLines, initialState, pullPool, pullOdds, ssrFeaturedId } from "../src/lib/game-data";
import { CHARACTER_PROFILES } from "../src/lib/character-stats";
import { applyGameAction } from "../src/lib/game-engine";
import { stages } from "../src/lib/campaign";

const guests = ["chen", "hokusai"] as const;
const manifest = JSON.parse(readFileSync("art-source/cameo/manifest.json", "utf8")) as {
  canvas: number[]; floor: number;
  records: { id: string; origin: string; sourceFile: string; sourceSha256: string; model: string; modelSha256: string; keyart: string; keyartSha256: string; matte: string }[];
};
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** PNG header reader: width/height and colour type, without a decoder. */
function pngHead(path: string) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("Ch'en and Hokusai are UR, obtainable, and never the featured banner", () => {
  for (const id of guests) {
    const c = characterById(id);
    assert.equal(c.id, id);
    assert.equal(c.rarity, "UR", `${id} is a UR cameo`);
    assert.ok(!c.retired, `${id} must be pullable`);
    assert.ok(pullOdds().find(o => o.id === id)!.chance > 0, `${id} has no stated chance`);
    assert.ok(pullPool("UR").some(p => p.id === id), `${id} is missing from the UR pool`);
    assert.notEqual(ssrFeaturedId, id, "a cameo must not be the featured banner character");
    assert.ok(CHARACTER_PROFILES[id], `${id} needs a combat class profile`);
    assert.equal(companionLines(id).length, 3, `${id} needs three companion lines`);
    assert.notDeepEqual(companionLines(id), companionLines("ynna"));
  }
  // The cameo register is what the UI reads to label them honestly.
  for (const id of guests) assert.ok(cameoGuestIds.includes(id), `${id} is missing from cameoGuestIds`);
  assert.equal(new Set(characters.map(c => c.id)).size, characters.length, "duplicate character id");
});

test("each cameo ships a real battle model and a separate illustration", () => {
  for (const record of manifest.records) {
    const c = characterById(record.id);
    assert.equal(c.splash, record.model);
    assert.equal(c.keyart, record.keyart);
    assert.notEqual(c.splash, c.keyart);
    assert.ok(existsSync(`public${record.model}`) && existsSync(`public${record.keyart}`));
    // The model must match the roster's shared canvas and floor, or the sprite
    // stands at a different height to everybody else in the same battle.
    const head = pngHead(`public${record.model}`);
    assert.deepEqual([head.width, head.height], manifest.canvas);
    assert.equal(head.colorType, 6, "battle models need an alpha channel");
    assert.equal(sha(`public${record.model}`), record.modelSha256, `${record.id} model drifted from its manifest`);
    assert.equal(sha(`public${record.keyart}`), record.keyartSha256, `${record.id} keyart drifted from its manifest`);
  }
});

test("the cameo manifest records provenance and the supplied sources are kept", () => {
  const ids = manifest.records.map(r => r.id).sort();
  assert.deepEqual(ids, [...guests].sort());
  for (const record of manifest.records) {
    assert.match(record.origin, /Arknights|Fate/);
    assert.match(record.matte, /alpha|GrabCut/, "the matte method must be recorded");
    assert.ok(existsSync(record.sourceFile), `${record.sourceFile} is missing`);
    assert.equal(sha(record.sourceFile), record.sourceSha256);
  }
  // Hokusai's painting has no matte upstream; the tool that cuts it out is the
  // documented record of how the model was produced.
  const tool = readFileSync("scripts/prepare-cameo-models.py", "utf8");
  assert.match(tool, /grabCut/);
  assert.match(tool, /seeded_matte/);
  assert.match(tool, /focus/, "Chen is cropped to the figure rather than shipped as a whole diorama");
});

test("cameo guests fight, level, equip and speak like every other recruit", () => {
  for (const id of guests) {
    let state = initialState();
    if (!state.roster.some(o => o.id === id)) state.roster.push({ id, level: 1, potential: 0, duplicates: 0 });
    state = applyGameAction(state, { action: "equip", id }, () => .5).state;
    assert.ok(state.squad.includes(id), `${id} could not be equipped`);
    state = applyGameAction(state, { action: "upgrade", id, levels: 2 }, () => .5).state;
    assert.equal(state.roster.find(o => o.id === id)!.level, 3);
    assert.equal(applyGameAction(state, { action: "companion", id }, () => .5).state.companion, id);
    for (const command of ["attack", "skill", "guard", "ultimate"]) {
      const fresh = initialState();
      fresh.roster = [{ id, level: 20, potential: 0, duplicates: 0 }];
      fresh.squad = [id];
      fresh.energy = 999;
      const opened = applyGameAction(fresh, { action: "startBattle", id: "1-1" }, () => .5).state;
      opened.battle!.allies[0].energy = 100;
      const resolved = applyGameAction(opened, { action: "act", command, target: 0 }, () => .5).state;
      assert.ok(resolved.battle!.log.some(line => line.includes("Ch’en") || line.includes("Hokusai")),
        `${id}/${command} did not resolve`);
    }
  }
});

test("cameos are recruits, not story characters", () => {
  // Guests do not alter the campaign script; the story cast is the academy's.
  const campaign = readFileSync("src/lib/campaign.ts", "utf8");
  assert.doesNotMatch(campaign, /Ch’en|Hokusai/, "a cameo must not be written into the campaign");
  for (const stage of stages) for (const line of stage.pre) {
    if (line.kind === "line") assert.ok(!guests.includes(line.speaker as typeof guests[number]));
  }
});
