// Nation overlay (SPEC §5.2–5.3): tints land with its owner's color and draws borders.
// Redrawn whenever ownership changes, so it's written for speed. Only reads the world.
import type { GeneratedWorld } from "../gen";
import type { WorldState } from "../core/types";
import { hexToRgb, scaleRgb, type Rgb } from "./color";
import { BORDER_ALPHA, BORDER_DARKEN, OVERLAY_ALPHA } from "./palette";

/** Packs a color and alpha into one 32-bit number, the way ImageData stores a pixel. */
function packPixel(rgb: Rgb, alpha: number): number {
  // Pixels are stored as bytes R, G, B, A; read as one little-endian number that's A B G R.
  return ((alpha << 24) | (Math.round(rgb[2]) << 16) | (Math.round(rgb[1]) << 8) | Math.round(rgb[0])) >>> 0;
}

export function renderNationOverlay(world: GeneratedWorld, displayCells: Int32Array, state: WorldState): ImageData {
  const { width, height, cells } = world;
  const owner = state.state.owner;
  const image = new ImageData(width, height); // starts fully transparent
  // A second view of the same memory: one number per pixel instead of four bytes.
  const px = new Uint32Array(image.data.buffer);

  // Each nation's fill and border colors, packed once (index = nation id).
  let maxId = 0;
  for (const id of state.nations.keys()) maxId = Math.max(maxId, id);
  const fill = new Uint32Array(maxId + 1);
  const border = new Uint32Array(maxId + 1);
  const fillAlpha = Math.round(OVERLAY_ALPHA * 255);
  const borderAlpha = Math.round(BORDER_ALPHA * 255);
  for (const nation of state.nations.values()) {
    const rgb = hexToRgb(nation.color);
    fill[nation.id] = packPixel(rgb, fillAlpha);
    border[nation.id] = packPixel(scaleRgb(rgb, 1 - BORDER_DARKEN), borderAlpha);
  }

  // Owner of every pixel: 0 = unowned land, −1 = water.
  const pixelOwner = new Int32Array(width * height);
  for (let i = 0; i < pixelOwner.length; i++) {
    const cell = displayCells[i]!;
    pixelOwner[i] = cell < 0 || !cells[cell]!.isLand ? -1 : owner[cell]!;
  }

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const me = pixelOwner[i]!;
      if (me <= 0) continue;

      // A border pixel touches land owned by someone else (water doesn't count:
      // the coastline is already inked).
      const left = x > 0 ? pixelOwner[i - 1]! : -1;
      const right = x < width - 1 ? pixelOwner[i + 1]! : -1;
      const up = y > 0 ? pixelOwner[i - width]! : -1;
      const down = y < height - 1 ? pixelOwner[i + width]! : -1;
      const onBorder =
        (left !== -1 && left !== me) ||
        (right !== -1 && right !== me) ||
        (up !== -1 && up !== me) ||
        (down !== -1 && down !== me);

      px[i] = onBorder ? border[me]! : fill[me]!;
    }
  }
  return image;
}
