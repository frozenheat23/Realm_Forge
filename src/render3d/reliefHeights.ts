// The shape of the 3D relief map (SPEC §5.4n): how high the ground stands at each point
// of a grid laid over the map. Only math here, no drawing, so it can be tested on its own.
import type { Heightmap } from "../gen/heightmap";
import { sampleAt } from "../render/displayCells";

/**
 * Heights for a grid of (cols + 1) × (rows + 1) points covering the whole map, row by row.
 * The sea is flat at 0; land rises to `peak` at the highest summit. `curve` above 1
 * keeps the lowlands low so mountains stand out.
 */
export function reliefHeights(heightmap: Heightmap, cols: number, rows: number, peak: number, curve: number): Float32Array {
  const { data, width, height, seaLevel } = heightmap;
  const heights = new Float32Array((cols + 1) * (rows + 1));
  for (let row = 0; row <= rows; row++) {
    const y = (row / rows) * height;
    for (let col = 0; col <= cols; col++) {
      const x = (col / cols) * width;
      // 0 at the coast (and under the sea), 1 at the highest peak.
      const land = Math.max(0, (sampleAt(data, width, height, x, y) - seaLevel) / (1 - seaLevel));
      heights[row * (cols + 1) + col] = peak * land ** curve;
    }
  }
  return heights;
}
