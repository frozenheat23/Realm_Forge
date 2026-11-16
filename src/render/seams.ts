// Fresh seams (SPEC §5.4s): for some years after a realm breaks away, its border with the
// realm it left (and with other realms that left the same one) is inked red, so a split shows.
// Worked out from each realm's `parent` and `founded`, so nothing has to be remembered.
import type { GeneratedWorld } from "../gen";
import type { NationId, WorldState } from "../core/types";
import type { CellPixels } from "./displayCells";
import { SEAM_ALPHA, SEAM_COLOR, SEAM_YEARS } from "./palette";

/** A realm that broke away lately: the realm it left, and how strong its seam still is (1 fresh .. 0 gone). */
export interface FreshSplit {
  parent: NationId;
  strength: number;
}

/** Every living realm that broke away within SEAM_YEARS. */
export function freshSplits(state: WorldState): Map<NationId, FreshSplit> {
  const fresh = new Map<NationId, FreshSplit>();
  for (const nation of state.nations.values()) {
    if (!nation.alive || nation.parent === undefined) continue;
    const age = state.year - nation.founded;
    if (age < SEAM_YEARS) fresh.set(nation.id, { parent: nation.parent, strength: 1 - age / SEAM_YEARS });
  }
  return fresh;
}

/** Is the border between breakaway `id` and its neighbor `other` a seam? Yes if `other` is the realm it left, or left the same realm. */
export function isSeam(fresh: Map<NationId, FreshSplit>, id: NationId, other: NationId): boolean {
  const split = fresh.get(id);
  if (!split || other === id || other === 0) return false;
  return other === split.parent || fresh.get(other)?.parent === split.parent;
}

export interface Seams {
  /** A see-through picture of the whole map with only the seams on it. */
  canvas: HTMLCanvasElement;
  /** True while there is any seam to show. */
  any: boolean;
  /** Call when borders may have changed (each year). */
  update(state: WorldState): void;
}

/** `displayCells` says which cell each pixel shows, so the seams follow the drawn borders exactly. */
export function createSeams(world: Pick<GeneratedWorld, "width" | "height">, displayCells: Int32Array, cellPixels: CellPixels): Seams {
  const { width, height } = world;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  // The pixels painted last time, so only those need wiping.
  let painted: number[] = [];

  const seams: Seams = {
    canvas,
    any: false,
    update(state) {
      const fresh = freshSplits(state);
      if (fresh.size === 0 && painted.length === 0) return;
      for (const p of painted) image.data[p * 4 + 3] = 0;
      painted = [];
      const owner = state.state.owner;
      const ownerAt = (pixel: number) => {
        const cell = displayCells[pixel]!;
        return cell < 0 ? 0 : owner[cell]!;
      };
      const paint = (pixel: number, alpha: number) => {
        image.data[pixel * 4] = SEAM_COLOR[0];
        image.data[pixel * 4 + 1] = SEAM_COLOR[1];
        image.data[pixel * 4 + 2] = SEAM_COLOR[2];
        image.data[pixel * 4 + 3] = Math.max(image.data[pixel * 4 + 3]!, alpha);
        painted.push(pixel);
      };
      // Only a breakaway's own cells need looking at: every seam has one on at least one side.
      for (let cell = 0; cell < owner.length; cell++) {
        const id = owner[cell]!;
        const split = fresh.get(id);
        if (!split) continue;
        const alpha = Math.round(255 * SEAM_ALPHA * split.strength);
        for (let i = cellPixels.start[cell]!; i < cellPixels.start[cell + 1]!; i++) {
          const pixel = cellPixels.pixels[i]!;
          const x = pixel % width;
          // The pixel's four neighbors, skipping any that would fall off the map.
          const around = [x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1, pixel - width, pixel + width];
          for (const other of around) {
            if (other < 0 || other >= width * height || !isSeam(fresh, id, ownerAt(other))) continue;
            // Both sides of the border are inked, so the line is two pixels wide.
            paint(pixel, alpha);
            paint(other, alpha);
          }
        }
      }
      seams.any = painted.length > 0;
      ctx.putImageData(image, 0, 0);
    },
  };
  return seams;
}
