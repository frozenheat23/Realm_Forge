// Nation overlay (SPEC §5.2–5.3): tints land with its owner's color and draws borders.
// Redrawn whenever ownership changes. Only reads the world; never changes it.
import type { GeneratedWorld } from "../gen";
import type { WorldState } from "../core/types";
import { hexToRgb, scaleRgb, type Rgb } from "./color";
import { BORDER_ALPHA, BORDER_DARKEN, OVERLAY_ALPHA } from "./palette";

export function renderNationOverlay(world: GeneratedWorld, displayCells: Int32Array, state: WorldState): ImageData {
  const { width, height } = world;
  const owner = state.state.owner;
  const image = new ImageData(width, height); // starts fully transparent
  const px = image.data;

  // Look up each nation's colors once, not once per pixel.
  const fill = new Map<number, Rgb>();
  const border = new Map<number, Rgb>();
  for (const nation of state.nations.values()) {
    const rgb = hexToRgb(nation.color);
    fill.set(nation.id, rgb);
    border.set(nation.id, scaleRgb(rgb, 1 - BORDER_DARKEN));
  }

  // Owner of the cell a pixel shows: 0 = unowned land, −1 = water.
  const ownerAt = (i: number): number => {
    const cell = displayCells[i]!;
    if (cell < 0 || !world.cells[cell]!.isLand) return -1;
    return owner[cell]!;
  };

  const fillAlpha = Math.round(OVERLAY_ALPHA * 255);
  const borderAlpha = Math.round(BORDER_ALPHA * 255);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const me = ownerAt(i);
      if (me <= 0) continue;

      // A border pixel touches land owned by someone else (water doesn't count:
      // the coastline is already inked).
      const differs = (j: number) => {
        const other = ownerAt(j);
        return other !== -1 && other !== me;
      };
      const onBorder =
        (x > 0 && differs(i - 1)) ||
        (x < width - 1 && differs(i + 1)) ||
        (y > 0 && differs(i - width)) ||
        (y < height - 1 && differs(i + width));

      const rgb = onBorder ? border.get(me)! : fill.get(me)!;
      const p = i * 4;
      px[p] = rgb[0];
      px[p + 1] = rgb[1];
      px[p + 2] = rgb[2];
      px[p + 3] = onBorder ? borderAlpha : fillAlpha;
    }
  }
  return image;
}
