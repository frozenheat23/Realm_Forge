// Debug helpers on screen: key toggles, and hover to inspect a cell.
import type { GeneratedWorld } from "../gen";
import type { WorldState } from "../core/types";
import { BIOME_STATS } from "../gen/params";

/** Calls `action` each time `key` is pressed (upper or lower case). */
export function onKey(key: string, action: () => void): void {
  window.addEventListener("keydown", (event) => {
    const el = event.target as HTMLElement;
    if (el.tagName === "INPUT") return; // don't fire while typing in a box
    if (event.key.toLowerCase() === key) action();
  });
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
    const ownerText = nation ? `${nation.name} (pop ${state.state.pop[cell.id]!.toFixed(2)})` : "unowned";
    panel.textContent =
      `${ownerText} · Cell ${cell.id} · ${BIOME_STATS[cell.biome].name}` +
      ` · ${cell.temp.toFixed(0)}°C · moisture ${cell.moisture.toFixed(2)}` +
      ` · elevation ${cell.elevation.toFixed(2)} · capacity ${cell.capacity.toFixed(2)}` +
      (tags ? ` · ${tags}` : "");
  });
}
