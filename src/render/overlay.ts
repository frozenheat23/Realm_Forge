// Nation overlay (SPEC §5.2–5.3): tints land with its owner's color and draws borders.
// Redrawn whenever ownership changes, so it's written for speed. Only reads the world.
import type { GeneratedWorld } from "../gen";
import type { NationId, WorldState } from "../core/types";
import { hexToRgb, scaleRgb, type Rgb } from "./color";
import { pairKey } from "../sim/war";
import { BORDER_ALPHA, BORDER_DARKEN, FAITH_COLORS, HIGHLIGHT_DIM, OVERLAY_ALPHA, RACE_COLORS, WAR_FRONT_COLOR } from "./palette";

/** Packs a color and alpha into one 32-bit number, the way ImageData stores a pixel. */
function packPixel(rgb: Rgb, alpha: number): number {
  // Pixels are stored as bytes R, G, B, A; read as one little-endian number that's A B G R.
  return ((alpha << 24) | (Math.round(rgb[2]) << 16) | (Math.round(rgb[1]) << 8) | Math.round(rgb[0])) >>> 0;
}

/** What land is tinted by: who rules it, or who lives there (SPEC §5.4b, §5.4i). */
export type OverlayTint = "nation" | "race" | "culture" | "faith";

/**
 * If `highlight` has nations in it, every other nation is drawn faded.
 * `tint` picks the land color; borders are drawn the same either way.
 */
export function renderNationOverlay(
  world: GeneratedWorld,
  displayCells: Int32Array,
  state: WorldState,
  highlight: Set<NationId> = new Set(),
  tint: OverlayTint = "nation",
): ImageData {
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
    const fade = highlight.size > 0 && !highlight.has(nation.id) ? HIGHLIGHT_DIM : 1;
    fill[nation.id] = packPixel(rgb, Math.round(fillAlpha * fade));
    border[nation.id] = packPixel(scaleRgb(rgb, 1 - BORDER_DARKEN), Math.round(borderAlpha * fade));
  }

  // Each race's fill color, packed once (index = race id).
  const raceFill = Uint32Array.from(RACE_COLORS, (hex, r) => (r === 0 ? 0 : packPixel(hexToRgb(hex), fillAlpha)));
  const { race, culture, faith } = state.state;
  const faithFill = Uint32Array.from(FAITH_COLORS, (hex, f) => (f === 0 ? 0 : packPixel(hexToRgb(hex), fillAlpha)));

  // Borders between nations at war are drawn in red.
  const warFront = packPixel(hexToRgb(WAR_FRONT_COLOR), 255);
  const atWar = new Set(state.wars.map((w) => pairKey(w.attacker, w.defender)));
  const isEnemy = (me: number, other: number) => other > 0 && other !== me && atWar.has(pairKey(me, other));

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

      // War fronts are drawn thicker: also check pixels two steps away.
      const nearEnemy2 =
        atWar.size > 0 &&
        ((x > 1 && isEnemy(me, pixelOwner[i - 2]!)) ||
          (x < width - 2 && isEnemy(me, pixelOwner[i + 2]!)) ||
          (y > 1 && isEnemy(me, pixelOwner[i - 2 * width]!)) ||
          (y < height - 2 && isEnemy(me, pixelOwner[i + 2 * width]!)));

      if (!onBorder) {
        const cell = displayCells[i]!;
        // A culture wears the color of the realm it began as, living or dead.
        const inside =
          tint === "race" ? raceFill[race[cell]!]! : tint === "culture" ? fill[culture[cell]!]! : tint === "faith" ? faithFill[faith[cell]!]! : fill[me]!;
        px[i] = nearEnemy2 ? warFront : inside;
      } else if (
        atWar.size > 0 &&
        (isEnemy(me, left) || isEnemy(me, right) || isEnemy(me, up) || isEnemy(me, down))
      ) {
        px[i] = warFront;
      } else {
        px[i] = border[me]!;
      }
    }
  }
  return image;
}
