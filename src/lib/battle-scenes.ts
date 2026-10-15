import type { Stage } from "./campaign";

/** Stage locations, not chapter numbers, determine the battle setting.
 * Paintings are composed with walkable foreground, including dedicated HQ/core
 * rooms; no encounter needs the temporary floor extensions.
 * Story and combat deliberately use the same resolver. */
export type BattleScene = {
  id: string;
  src: string;
  surface: "wood" | "stone" | "earth" | "metal";
  weather: "clear" | "rain";
  ambient: string;
  floor: string;
  extendedFloor?: boolean;
};
const painted = (id: string, surface: BattleScene["surface"], ambient: string, floor: string, weather: BattleScene["weather"] = "clear"): BattleScene => ({
  id, src: `/images/battlefields/${id}.jpg`, surface, ambient, floor, weather,
});
export const battleScenes = {
  office: painted("council-office", "wood", "#ffe2a3", "#6e4b32"),
  hallway: painted("council-hallway", "stone", "#ffe6bb", "#a8997d"),
  storage: painted("storage", "stone", "#ffe4ac", "#817363"),
  contraband: painted("contraband-vault", "metal", "#b5d8f3", "#475d69"),
  fountain: painted("fountain-courtyard", "stone", "#ffedc1", "#a1987d"),
  arena: painted("spore-arena", "earth", "#9edacc", "#6f6450"),
  canopy: painted("mushroom-canopy", "earth", "#9ae5cc", "#455d4a"),
  server: painted("server-vault", "metal", "#8adeef", "#3c5361"),
  sanctuary: painted("chapel-vault", "stone", "#ffe5a2", "#9a8870"),
  cloister: painted("chapel-cloister", "stone", "#dbe1d9", "#8c8a7c"),
  rain: painted("chapel-rain", "stone", "#c4ddf3", "#64727d", "rain"),
  plaza: painted("hq-plaza", "stone", "#bed6ec", "#536778", "rain"),
  lobby: painted("hq-lobby", "stone", "#c6e3f5", "#64737f"),
  hr: painted("hq-human-resources", "wood", "#e3d1b9", "#51453f"),
  data: painted("hq-data-floor", "metal", "#8ddbee", "#344c5e"),
  executive: painted("hq-boardroom", "wood", "#ffd1a4", "#3c3539"),
  corridor: painted("core-access", "metal", "#89dfed", "#314a58"),
  vestibule: painted("core-vestibule", "stone", "#c7aaf6", "#414258"),
  antechamber: painted("core-antechamber", "metal", "#edb6db", "#414757"),
  core: painted("zero-point-core", "metal", "#8ce8f7", "#254958"),
} satisfies Record<string, BattleScene>;
type SceneKey = keyof typeof battleScenes;
export const stageScenes: Record<string, SceneKey> = {
  "1-1": "office", "1-2": "hallway", "1-3": "storage", "1-4": "contraband", "1-5": "fountain",
  "2-1": "arena", "2-2": "canopy", "2-3": "arena", "2-4": "server", "2-5": "server",
  "3-1": "sanctuary", "3-2": "sanctuary", "3-3": "cloister", "3-4": "rain", "3-5": "rain",
  "4-1": "plaza", "4-2": "lobby", "4-3": "hr", "4-4": "data", "4-5": "executive",
  "5-1": "corridor", "5-2": "corridor", "5-3": "vestibule", "5-4": "antechamber", "5-5": "core",
};
export function sceneForStage(stage: Pick<Stage, "id" | "chapter">): BattleScene {
  const key = stageScenes[stage.id];
  if (key) return battleScenes[key];
  return battleScenes[({ 1: "fountain", 2: "arena", 3: "sanctuary", 4: "lobby", 5: "core" } as Record<number, SceneKey>)[stage.chapter] ?? "fountain"];
}
