import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { stages } from "../src/lib/campaign";
import { battleScenes, sceneForStage, stageScenes } from "../src/lib/battle-scenes";

const read = (path: string) => readFileSync(path, "utf8");
test("every authored stage explicitly selects a story-location scene", () => {
  assert.deepEqual(Object.keys(stageScenes).sort(), stages.map(s => s.id).sort());
  for (const stage of stages) {
    const scene = sceneForStage(stage);
    assert.ok(existsSync(`public${scene.src}`), `${stage.id}: missing ${scene.src}`);
    assert.ok(scene.ambient && scene.floor && scene.surface);
  }
});
test("chapter one actually moves between the five scripted rooms", () => {
  const rooms = stages.filter(s => s.chapter === 1).map(sceneForStage);
  assert.equal(new Set(rooms.map(s => s.src)).size, 5);
  assert.deepEqual(rooms.map(s => s.id), ["council-office", "council-hallway", "storage", "contraband-vault", "fountain-courtyard"]);
});
test("fungal encounters, servers and the rainy chapel use their proper settings", () => {
  const at = (id: string) => sceneForStage(stages.find(s => s.id === id)!);
  assert.notEqual(at("2-2").src, at("2-4").src);
  assert.equal(at("2-4").surface, "metal");
  assert.notEqual(at("3-1").src, at("3-4").src);
  assert.equal(at("3-4").weather, "rain");
  assert.equal(at("3-5").weather, "rain");
  assert.equal(at("4-1").weather, "rain");
  assert.notEqual(at("5-4").src, at("5-5").src);
});
test("legacy HQ/core art explicitly requests a continuous floor extension", () => {
  for (const stage of stages.filter(s => s.chapter >= 4)) {
    assert.equal(sceneForStage(stage).extendedFloor, true);
  }
  assert.equal(Object.values(battleScenes).filter(s => !s.extendedFloor).length, 10);
  assert.equal(sceneForStage({ id: "unknown", chapter: 99 }).id, "fountain-courtyard");
});
test("story and battle resolve the same location; map art remains chapter-based", () => {
  assert.match(read("src/components/story-battle.tsx"), /src=\{sceneForStage\(stage\)\.src\}/);
  assert.match(read("src/components/combat-stage.tsx"), /const scene = sceneForStage\(stage\)/);
  assert.match(read("src/components/combat-stage.tsx"), /key=\{scene\.id\} src=\{scene\.src\}/);
  assert.match(read("src/components/game-views.tsx"), /src=\{battlefieldFor\(chapterId\)\}/);
});
test("grounding changes layout without replacing or editing character designs", () => {
  const feet = read("src/components/sprite-footing.tsx");
  const css = read("src/app/combat.css");
  assert.match(feet, /getImageData/);
  assert.match(feet, /new ResizeObserver\(align\)/);
  assert.match(feet, /displayedHeight \* bottom/);
  assert.match(feet, /<Chibi id=\{id\}/);
  assert.match(css, /object-position:center bottom/);
  assert.match(css, /background:radial-gradient\(ellipse,#0810199c/);
  assert.match(css, /@keyframes grounded-breathe/);
  assert.match(css, /\.arena-grid\{display:none\}/);
});
