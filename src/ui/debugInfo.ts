// Debug helpers on screen: press C to toggle cell outlines, hover to inspect a cell.
import type { GeneratedWorld } from "../gen";
import { BIOME_STATS } from "../gen/params";

/** Calls `onToggle` each time the C key is pressed. */
export function onCellToggleKey(onToggle: () => void): void {
  window.addEventListener("keydown", (event) => {
    if (event.key === "c" || event.key === "C") onToggle();
  });
}

/** Shows details of the cell under the mouse in `panel`. */
export function showCellOnHover(canvas: HTMLCanvasElement, panel: HTMLElement, world: GeneratedWorld): void {
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
    panel.textContent =
      `Cell ${cell.id} · ${BIOME_STATS[cell.biome].name}` +
      ` · ${cell.temp.toFixed(0)}°C · moisture ${cell.moisture.toFixed(2)}` +
      ` · elevation ${cell.elevation.toFixed(2)} · capacity ${cell.capacity.toFixed(2)}` +
      (tags ? ` · ${tags}` : "");
  });
}
