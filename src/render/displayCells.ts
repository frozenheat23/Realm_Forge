// Which cell each pixel shows, for drawing purposes. Built once per world.
//
// Using the exact cell edges would make biome and nation borders look like
// straight-edged polygons. Instead each pixel looks up a slightly shifted spot
// (shifted by smooth waves), so those borders curve like hand-drawn lines.
import type { GeneratedWorld } from "../gen";
import { CEL_BIOME_EDGE_WOBBLE } from "./palette";

// The cell found at a shifted point near (x, y).
function wobblyCellAt(world: GeneratedWorld, x: number, y: number): number {
  const w = CEL_BIOME_EDGE_WOBBLE;
  const sx = Math.round(x + w * Math.sin(y * 0.11 + x * 0.03) + w * 0.5 * Math.sin(y * 0.37));
  const sy = Math.round(y + w * Math.sin(x * 0.09 - y * 0.04) + w * 0.5 * Math.sin(x * 0.31));
  const cx = Math.min(world.width - 1, Math.max(0, sx));
  const cy = Math.min(world.height - 1, Math.max(0, sy));
  return world.pixelToCell[cy * world.width + cx]!;
}

// For a land pixel whose cell is water (happens right at the coast): the nearest land neighbor.
function nearestLandNeighbor(world: GeneratedWorld, cellId: number, x: number, y: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (const n of world.cells[cellId]!.neighbors) {
    const cell = world.cells[n]!;
    if (!cell.isLand) continue;
    const d = (cell.site[0] - x) ** 2 + (cell.site[1] - y) ** 2;
    if (d < bestDist) [best, bestDist] = [n, d];
  }
  return best;
}

/**
 * For every pixel, the cell to draw it as. Land pixels always map to a land cell
 * (or −1 if none is nearby), so nation colors reach all the way to the coastline.
 */
export function buildDisplayCells(world: GeneratedWorld): Int32Array {
  const { width, height, cells, heightmap } = world;
  const display = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const isLandPixel = heightmap.data[i]! > heightmap.seaLevel;
      let cell = wobblyCellAt(world, x, y);
      if (isLandPixel && !cells[cell]!.isLand) cell = world.pixelToCell[i]!;
      if (isLandPixel && !cells[cell]!.isLand) cell = nearestLandNeighbor(world, cell, x, y);
      display[i] = cell;
    }
  }
  return display;
}

/** The pixels of every cell: cell c's are `pixels[start[c]]` up to, not including, `pixels[start[c + 1]]`. */
export interface CellPixels {
  start: Int32Array;
  pixels: Int32Array;
}

/** Groups pixels by the cell they show, so one cell can be repainted without touching the rest. */
export function groupPixelsByCell(displayCells: Int32Array, cellCount: number): CellPixels {
  // Count each cell's pixels, which says where each cell's run begins, then fill the runs in.
  const start = new Int32Array(cellCount + 1);
  for (const cell of displayCells) if (cell >= 0) start[cell + 1]!++;
  for (let c = 0; c < cellCount; c++) start[c + 1]! += start[c]!;
  const pixels = new Int32Array(start[cellCount]!);
  const next = start.slice();
  for (let i = 0; i < displayCells.length; i++) {
    const cell = displayCells[i]!;
    if (cell >= 0) pixels[next[cell]!++] = i;
  }
  return { start, pixels };
}
