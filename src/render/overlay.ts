// Nation overlay (SPEC §5.2–5.3): tints land with its owner's color and draws borders.
// Redrawn every year, so after the first paint it only repaints the cells that changed. Only reads the world.
import type { GeneratedWorld } from "../gen";
import type { CellId, NationId, WorldState } from "../core/types";
import { hexToRgb, lookTint, scaleRgb, type Rgb } from "./color";
import type { CellPixels } from "./displayCells";
import { pairKey } from "../sim/war";
import { BORDER_DARKEN, FAITH_COLORS, HIGHLIGHT_DIM, LOOK_STANDARD, RACE_COLORS, type MapLook } from "./palette";

/** Packs a color and alpha into one 32-bit number, the way ImageData stores a pixel. */
function packPixel(rgb: Rgb, alpha: number): number {
  // Pixels are stored as bytes R, G, B, A; read as one little-endian number that's A B G R.
  return ((alpha << 24) | (Math.round(rgb[2]) << 16) | (Math.round(rgb[1]) << 8) | Math.round(rgb[0])) >>> 0;
}

/** What land is tinted by: who rules it, or who lives there (SPEC §5.4b, §5.4i). */
export type OverlayTint = "nation" | "race" | "culture" | "faith";

export interface NationOverlay {
  /** One packed color per pixel. Stays the same array, so an ImageData can share its memory. */
  readonly pixels: Uint32Array<ArrayBuffer>;
  /**
   * Brings `pixels` up to date. If `highlight` has nations in it, every other nation
   * is drawn faded. `tint` picks the land color; borders are drawn the same either way.
   */
  update(state: WorldState, highlight?: Set<NationId>, tint?: OverlayTint): void;
}

/** War borders are thick, so a change reaches 2 pixels into the next cell, and the wobbly edges can reach one cell further. */
const REPAINT_RINGS = 2;

export function createNationOverlay(world: GeneratedWorld, displayCells: Int32Array, cellPixels: CellPixels, look: MapLook = LOOK_STANDARD): NationOverlay {
  const { width, height, cells } = world;
  const edge = look.overlayEdgeWidth;
  const tinted = (hex: string) => lookTint(hex, look);
  const pixels = new Uint32Array(width * height);
  // Owner of every pixel: 0 = unowned land, −1 = water.
  const pixelOwner = new Int32Array(width * height);
  for (let i = 0; i < pixelOwner.length; i++) pixelOwner[i] = displayCells[i]! < 0 || !cells[displayCells[i]!]!.isLand ? -1 : 0;

  // What each cell looked like at the last update.
  const shownOwner = new Int32Array(cells.length);
  const shownTint = new Int32Array(cells.length);
  let shownMode: OverlayTint | null = null; // null = nothing painted yet
  let shownHighlight = new Set<NationId>();
  let shownWars = new Set<number>();

  const raceFill = RACE_COLORS.map((hex, r) => (r === 0 ? 0 : packPixel(tinted(hex), Math.round(look.overlayAlpha * 255))));
  const faithFill = FAITH_COLORS.map((hex, f) => (f === 0 ? 0 : packPixel(tinted(hex), Math.round(look.overlayAlpha * 255))));
  const warFront = packPixel(hexToRgb(look.warColor), 255);

  /** All of `cell`'s pixels get the owner it has now. */
  function setPixelOwner(cell: CellId, owner: number): void {
    for (let p = cellPixels.start[cell]!; p < cellPixels.start[cell + 1]!; p++) {
      const i = cellPixels.pixels[p]!;
      if (pixelOwner[i] !== -1) pixelOwner[i] = owner;
    }
  }

  function update(state: WorldState, highlight: Set<NationId> = new Set(), tint: OverlayTint = "nation"): void {
    const { owner, race, culture, faith } = state.state;
    const tintOf = tint === "race" ? race : tint === "culture" ? culture : tint === "faith" ? faith : owner;

    // Each nation's fill and border colors, packed once (index = nation id).
    let maxId = 0;
    for (const id of state.nations.keys()) maxId = Math.max(maxId, id);
    const fill = new Uint32Array(maxId + 1);
    const edgeFill = new Uint32Array(maxId + 1);
    const border = new Uint32Array(maxId + 1);
    const fillAlpha = Math.round(look.overlayAlpha * 255);
    const edgeAlpha = Math.round(look.overlayEdgeAlpha * 255);
    const borderAlpha = Math.round(look.borderAlpha * 255);
    const borderInk = look.borderInk === null ? null : hexToRgb(look.borderInk);
    for (const nation of state.nations.values()) {
      const rgb = tinted(nation.color);
      const fade = highlight.size > 0 && !highlight.has(nation.id) ? HIGHLIGHT_DIM : 1;
      fill[nation.id] = packPixel(rgb, Math.round(fillAlpha * fade));
      edgeFill[nation.id] = packPixel(rgb, Math.round(edgeAlpha * fade));
      border[nation.id] = packPixel(borderInk ?? scaleRgb(hexToRgb(nation.color), 1 - BORDER_DARKEN), Math.round(borderAlpha * fade));
    }

    /** Is another realm's land `edge` pixels away, in any of the four directions? */
    const nearAnotherRealm = (me: number, i: number, x: number, y: number): boolean => {
      const foreign = (other: number) => other !== -1 && other !== me;
      return (
        (x >= edge && foreign(pixelOwner[i - edge]!)) ||
        (x < width - edge && foreign(pixelOwner[i + edge]!)) ||
        (y >= edge && foreign(pixelOwner[i - edge * width]!)) ||
        (y < height - edge && foreign(pixelOwner[i + edge * width]!))
      );
    };

    // Borders between nations at war are drawn in red.
    const atWar = new Set(state.wars.map((w) => pairKey(w.attacker, w.defender)));
    const isEnemy = (me: number, other: number) => other > 0 && other !== me && atWar.has(pairKey(me, other));

    function paintPixel(i: number, x: number, y: number): void {
      const me = pixelOwner[i]!;
      if (me <= 0) {
        pixels[i] = 0;
        return;
      }
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
          tint === "race" ? raceFill[race[cell]!]!
          : tint === "culture" ? fill[culture[cell]!]!
          : tint === "faith" ? faithFill[faith[cell]!]!
          : edge > 0 && nearAnotherRealm(me, i, x, y) ? edgeFill[me]!
          : fill[me]!;
        pixels[i] = nearEnemy2 ? warFront : inside;
      } else if (atWar.size > 0 && (isEnemy(me, left) || isEnemy(me, right) || isEnemy(me, up) || isEnemy(me, down))) {
        pixels[i] = warFront;
      } else {
        pixels[i] = border[me]!;
      }
    }

    // Cells whose owner or tint changed, and the pixels that know their owner.
    const repaint = new Uint8Array(cells.length);
    for (let c = 0; c < cells.length; c++) {
      if (owner[c] !== shownOwner[c]) {
        setPixelOwner(c, owner[c]!);
        shownOwner[c] = owner[c]!;
        repaint[c] = 1;
      }
      if (tintOf[c] !== shownTint[c]) repaint[c] = 1;
      shownTint[c] = tintOf[c]!;
    }

    // Changing the tint or the faded nations changes everything.
    const sameHighlight = highlight.size === shownHighlight.size && [...highlight].every((id) => shownHighlight.has(id));
    if (tint !== shownMode || !sameHighlight) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) paintPixel(y * width + x, x, y);
      }
    } else {
      markWarBorders(state, atWar, repaint);
      spread(repaint);
      for (let c = 0; c < cells.length; c++) {
        if (!repaint[c]) continue;
        for (let p = cellPixels.start[c]!; p < cellPixels.start[c + 1]!; p++) {
          const i = cellPixels.pixels[p]!;
          paintPixel(i, i % width, Math.floor(i / width));
        }
      }
    }
    shownMode = tint;
    shownHighlight = new Set(highlight);
    shownWars = atWar;
  }

  /** Marks the border cells of every nation in a war that began or ended. */
  function markWarBorders(state: WorldState, atWar: Set<number>, repaint: Uint8Array): void {
    const owner = state.state.owner;
    const involved = new Set<number>();
    for (const key of atWar) if (!shownWars.has(key)) involved.add(Math.floor(key / 100000)).add(key % 100000);
    for (const key of shownWars) if (!atWar.has(key)) involved.add(Math.floor(key / 100000)).add(key % 100000);
    if (involved.size === 0) return;
    for (let c = 0; c < cells.length; c++) {
      if (involved.has(owner[c]!) && cells[c]!.neighbors.some((n) => owner[n] !== owner[c])) repaint[c] = 1;
    }
  }

  /** Grows the marked cells outward by REPAINT_RINGS, since their edges are shared with their neighbors. */
  function spread(repaint: Uint8Array): void {
    let ring: CellId[] = [];
    for (let c = 0; c < cells.length; c++) if (repaint[c]) ring.push(c);
    for (let step = 0; step < REPAINT_RINGS; step++) {
      const next: CellId[] = [];
      for (const c of ring) {
        for (const n of cells[c]!.neighbors) {
          if (repaint[n]) continue;
          repaint[n] = 1;
          next.push(n);
        }
      }
      ring = next;
    }
  }

  return { pixels, update };
}
