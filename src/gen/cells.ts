// Splits the map into cells: scattered points, each owning the area closest to it
// (a Voronoi diagram). Simulation works on cells, not pixels.
import { Delaunay } from "d3-delaunay";
import type { Rng } from "../core/rng";
import { CELL_JITTER } from "./params";

/**
 * Places about `count` points on a grid, each nudged randomly inside its square.
 * Gives even coverage without looking like a grid ("jittered grid").
 */
export function jitteredGrid(rng: Rng, width: number, height: number, count: number): Float64Array {
  const spacing = Math.sqrt((width * height) / count);
  const cols = Math.round(width / spacing);
  const rows = Math.round(height / spacing);
  const stepX = width / cols;
  const stepY = height / rows;
  const points = new Float64Array(cols * rows * 2);

  let p = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jitterX = (rng.next() - 0.5) * CELL_JITTER;
      const jitterY = (rng.next() - 0.5) * CELL_JITTER;
      points[p++] = (col + 0.5 + jitterX) * stepX;
      points[p++] = (row + 0.5 + jitterY) * stepY;
    }
  }
  return points;
}

export interface CellGraph {
  delaunay: Delaunay<Delaunay.Point>;
  /** Neighbor list for each cell. */
  neighbors: number[][];
  /** For every pixel, which cell it belongs to. index = y * width + x. */
  pixelToCell: Int32Array;
}

export function buildCellGraph(points: Float64Array, width: number, height: number): CellGraph {
  const delaunay = new Delaunay(points);
  const count = points.length / 2;

  const neighbors: number[][] = [];
  for (let i = 0; i < count; i++) neighbors.push([...delaunay.neighbors(i)]);

  // find() is fastest when given a nearby starting guess, so we reuse the
  // cell found for the previous pixel.
  const pixelToCell = new Int32Array(width * height);
  let guess = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      guess = delaunay.find(x + 0.5, y + 0.5, guess);
      pixelToCell[y * width + x] = guess;
    }
  }
  return { delaunay, neighbors, pixelToCell };
}
