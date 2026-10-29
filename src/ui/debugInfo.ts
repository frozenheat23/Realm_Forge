// Debug helpers on screen: key toggles, and hover to inspect a cell.
import type { GeneratedWorld } from "../gen";
import type { NationId, ResourceKind, WorldState } from "../core/types";
import { BIOME_STATS, RESOURCES } from "../gen/params";
import { traits } from "../gen/races";
import { alliesOf, opinion } from "../sim/diplomacy";

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

/** Shows details of the cell under the mouse in `panel`. */
export function showCellOnHover(
  canvas: HTMLCanvasElement,
  panel: HTMLElement,
  world: GeneratedWorld,
  getState: () => WorldState,
): void {
  canvas.addEventListener("mousemove", (event) => {
    // The canvas may be shrunk to fit the window, so convert screen → map pixels.
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * world.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * world.height);
    const cell = world.cells[world.pixelToCell[y * world.width + x]!];
    if (!cell) return;

    const tags = [cell.coastal && "coastal", cell.mountain && "mountain", cell.river && "river"]
      .filter(Boolean)
      .join(", ");
    const state = getState();
    const nation = state.nations.get(state.state.owner[cell.id]!);
    const people = traits(state.state.race[cell.id]!).plural;
    const ruler = nation ? traits(nation.race).plural : "";
    const ownerText = nation
      ? `${nation.name} (${ruler}) · ${people}, pop ${state.state.pop[cell.id]!.toFixed(2)}${diplomacyText(state, nation.id)}`
      : "unowned";
    const s = state.state;
    const deposit = cell.resource ? ` · ${RESOURCES[cell.resource as ResourceKind].name} (richness ${cell.richness.toFixed(2)})` : "";
    const place = SETTLEMENT_NAMES[s.settlement[cell.id]!]!;
    const city = state.cityNames.get(cell.id);
    const placeText = place ? ` · ${place}${city && place === "city" ? ` of ${city}` : ""}` : "";
    const land = nation
      ? `${placeText} · development ${s.development[cell.id]!.toFixed(2)} · unrest ${s.unrest[cell.id]!.toFixed(2)}` +
        ` · devastation ${s.devastation[cell.id]!.toFixed(2)} · held since year ${s.ownedSince[cell.id]}`
      : "";
    panel.textContent =
      `${ownerText}${land}${deposit} · Cell ${cell.id} · ${BIOME_STATS[cell.biome].name} · defense ${cell.defensibility.toFixed(2)}` +
      ` · ${cell.temp.toFixed(0)}°C · moisture ${cell.moisture.toFixed(2)}` +
      ` · elevation ${cell.elevation.toFixed(2)} · capacity ${cell.capacity.toFixed(2)}` +
      (tags ? ` · ${tags}` : "");
  });
}
