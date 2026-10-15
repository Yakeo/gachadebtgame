import test from "node:test";
import assert from "node:assert/strict";
import { characters } from "../src/lib/game-data";
import { BATTLE_COMMANDS, commandDetails } from "../src/lib/battle-commands";
import { battlefieldFor } from "../src/lib/campaign";
import { readFileSync } from "node:fs";

test("every recruit exposes its actual named skill notes before activation", () => {
  for (const c of characters) {
    assert.equal(commandDetails(c, "skill").name, c.skill);
    assert.equal(commandDetails(c, "skill").description, c.skillNote);
    assert.equal(commandDetails(c, "ultimate").description, c.ultimateNote);
    assert.deepEqual(BATTLE_COMMANDS.map(cmd => commandDetails(c, cmd).cost), [0, 20, 0, 100]);
    for (const cmd of BATTLE_COMMANDS) assert.ok(commandDetails(c, cmd).target.length);
  }
});
test("special kits do not inherit misleading generic ultimate targets", () => {
  const byMechanic = (mechanic: string) => characters.find(c => c.mechanic === mechanic)!;
  for (const mechanic of ["riposte", "rateup", "detention"]) assert.equal(commandDetails(byMechanic(mechanic), "ultimate").target, "Selected enemy");
  assert.equal(commandDetails(byMechanic("sanctify"), "ultimate").target, "Squad");
  assert.match(commandDetails(byMechanic("audit"), "ultimate").target, /Audited/);
  assert.match(commandDetails(byMechanic("siphon"), "skill").target, /Selected enemy/);
});
test("campaign chapters use five distinct cache-fresh anime paintings", () => {
  const paths = [1, 2, 3, 4, 5].map(battlefieldFor);
  assert.equal(new Set(paths).size, 5);
  for (const path of paths) {
    assert.match(path, /-anime\.jpg$/);
    const bytes = readFileSync(`public${path}`);
    assert.equal(bytes.readUInt16BE(0), 0xffd8, "art must actually be encoded as JPEG");
    assert.ok(bytes.length > 40000);
  }
});
