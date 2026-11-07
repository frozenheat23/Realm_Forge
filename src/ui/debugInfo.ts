// Debug helpers on screen: key toggles, and hover to inspect a cell.
import type { GeneratedWorld } from "../gen";
import { NO_TARGET, type CellId, type Nation, type NationId, type ResourceKind, type WarGoal, type WorldState } from "../core/types";
import { BIOME_STATS, RESOURCES } from "../gen/params";
import { faithInfo } from "../gen/faiths";
import { rulerName } from "../gen/rulers";
import { traits } from "../gen/races";
import { menText } from "../sim/events";
import { armiesIn } from "../sim/armies";
import { soldiers } from "../sim/manpower";
import { toWorld, WHOLE_MAP, type Camera } from "../render/camera";
import { alliesOf, opinion } from "../sim/diplomacy";

/** Rounds soldier units to men, e.g. 12,000. */

/** "soldiers 12,000 of 20,000": the nation's soldiers and its cap, in men. */
function soldierText(state: WorldState, nation: Nation): string {
  return `soldiers ${menText(soldiers(state, nation))} of ${menText(nation.manpowerCap)}`;
}

const GOAL_WORDS: Record<WarGoal, string> = { conquer: "conquest", reclaim: "reclaiming", raid: "raid", support: "helping an ally" };

/** " · army of Velmora (conquest): 12,000 men, morale 100%, heading for cell 412" for each army at `cells`. */
function armyText(state: WorldState, cells: CellId[]): string {
  return cells
    .flatMap((c) => armiesIn(state, c))
    .map((a) => {
      const heading = a.target === NO_TARGET ? "holding" : `heading for cell ${a.target}`;
      const purpose = GOAL_WORDS[state.wars.find((w) => w.id === a.war)?.goal ?? "support"];
      return ` · army of ${state.nations.get(a.owner)!.name} (${purpose}): ${menText(a.size)} men, morale ${Math.round(a.morale * 100)}%, ${heading}`;
    })
    .join("");
}

/** "High Queen Selena of House Varrin, 12 years on the throne". */
function rulerText(state: WorldState, nation: Nation): string {
  const { ruler } = nation;
  const years = Math.max(0, state.year - ruler.crowned);
  return `${rulerName(ruler, nation.race)} of ${ruler.dynasty}, ${years} year${years === 1 ? "" : "s"} on the throne`;
}

/** Calls `action` each time `key` is pressed (upper or lower case). */
export function onKey(key: string, action: () => void): void {
  window.addEventListener("keydown", (event) => {
    const el = event.target as HTMLElement;
    if (el.tagName === "INPUT") return; // don't fire while typing in a box
    if (event.key.toLowerCase() === key) action();
  });
}

/** Settlement level names, indexed by level (0 = none). */
const SETTLEMENT_NAMES = ["", "village", "town", "city"];

/** " · allies X, Y · rival Z (−0.62)" for a nation, or "" if it has neither. */
function diplomacyText(state: WorldState, id: NationId): string {
  const name = (other: NationId) => state.nations.get(other)?.name ?? "?";
  const allies = alliesOf(state, id);
  // The worst opinion this nation holds of any living nation it has met.
  let rival: NationId | null = null;
  let worst = 0;
  for (const key of state.relations.keys()) {
    const a = Math.floor(key / 100000);
    const b = key % 100000;
    if (a !== id && b !== id) continue;
    const other = a === id ? b : a;
    const value = opinion(state, id, other);
    if (value < worst && state.nations.get(other)?.alive) [rival, worst] = [other, value];
  }
  return (
    (allies.length ? ` · allies ${allies.map(name).join(", ")}` : "") +
    (rival !== null ? ` · rival ${name(rival)} (${worst.toFixed(2)})` : "")
  );
}

/** The canvas pixel under the mouse. The canvas may be shrunk to fit the window, so screen pixels are converted. */
export function canvasPoint(canvas: HTMLCanvasElement, event: MouseEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [((event.clientX - rect.left) / rect.width) * canvas.width, ((event.clientY - rect.top) / rect.height) * canvas.height];
}

/** The map cell under the mouse, if any, seen through `camera` (M19). */
export function cellUnderMouse(canvas: HTMLCanvasElement, world: GeneratedWorld, event: MouseEvent, camera: Camera = WHOLE_MAP): GeneratedWorld["cells"][number] | undefined {
  const [wx, wy] = toWorld(camera, ...canvasPoint(canvas, event));
  const x = Math.floor(wx);
  const y = Math.floor(wy);
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return undefined;
  return world.cells[world.pixelToCell[y * world.width + x]!];
}

/** Shows details of the cell under the mouse in `panel`. */
export function showCellOnHover(
  canvas: HTMLCanvasElement,
  panel: HTMLElement,
  world: GeneratedWorld,
  getState: () => WorldState,
  getCamera: () => Camera = () => WHOLE_MAP,
): void {
  canvas.addEventListener("mousemove", (event) => {
    const cell = cellUnderMouse(canvas, world, event, getCamera());
    if (!cell) return;

    const tags = [cell.coastal && "coastal", cell.mountain && "mountain", cell.river && "river"]
      .filter(Boolean)
      .join(", ");
    const state = getState();
    const nation = state.nations.get(state.state.owner[cell.id]!);
    const people = traits(state.state.race[cell.id]!).plural;
    const ruler = nation ? traits(nation.race).plural : "";
    const culture = state.nations.get(state.state.culture[cell.id]!);
    const peopleOf = culture ? ` of ${culture.name}, followers of ${faithInfo(state.state.faith[cell.id]!).name}` : "";
    const ownerText = nation
      ? `${nation.name} (${ruler}, ${faithInfo(nation.faith).name}) · ${rulerText(state, nation)} · ${people}${peopleOf}, pop ${state.state.pop[cell.id]!.toFixed(2)} · ${soldierText(state, nation)}${diplomacyText(state, nation.id)}`
      : "unowned";
    const s = state.state;
    const deposit = cell.resource ? ` · ${RESOURCES[cell.resource as ResourceKind].name} (richness ${cell.richness.toFixed(2)})` : "";
    const place = SETTLEMENT_NAMES[s.settlement[cell.id]!]!;
    const city = state.cityNames.get(cell.id);
    const placeText = place ? ` · ${place}${city && place === "city" ? ` of ${city}` : ""}` : "";
    const heldBy = state.nations.get(s.occupier[cell.id]!);
    const siege = s.siege[cell.id]! > 0 ? ` · under siege ${Math.round(s.siege[cell.id]! * 100)}%` : "";
    const war = (heldBy ? ` · occupied by ${heldBy.name}` : "") + siege;
    const land = nation
      ? `${war}${placeText} · development ${s.development[cell.id]!.toFixed(2)} · unrest ${s.unrest[cell.id]!.toFixed(2)}` +
        ` · devastation ${s.devastation[cell.id]!.toFixed(2)} · held since year ${s.ownedSince[cell.id]}`
      : "";
    panel.textContent =
      `${ownerText}${armyText(state, [cell.id, ...cell.neighbors])}${land}${deposit} · Cell ${cell.id} · ${BIOME_STATS[cell.biome].name} · province ${cell.province} · defense ${cell.defensibility.toFixed(2)}` +
      ` · ${cell.temp.toFixed(0)}°C · moisture ${cell.moisture.toFixed(2)}` +
      ` · elevation ${cell.elevation.toFixed(2)} · capacity ${cell.capacity.toFixed(2)}` +
      (tags ? ` · ${tags}` : "");
  });
}
