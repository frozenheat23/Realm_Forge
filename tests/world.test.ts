import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Biome } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { cellCapacity, classifyBiome } from "../src/gen/biomes";
import { buildCellGraph, jitteredGrid } from "../src/gen/cells";
import { stepsFromWater, temperatureAt } from "../src/gen/climate";
import { EQUATOR_TEMP, POLE_TEMP, RIVER_CAP_MULT } from "../src/gen/params";
import { MinHeap, drainageMap } from "../src/gen/rivers";

// A tiny hand-made "map": 5 cells in a line.  0 = sea, 1..4 = land.
//   [0] - [1] - [2] - [3] - [4]
const lineNeighbors = [[1], [0, 2], [1, 3], [2, 4], [3]];
const lineIsLand = [false, true, true, true, true];

describe("cells", () => {
  it("places about the requested number of points, all inside the map", () => {
    const points = jitteredGrid(createRng("pts"), 200, 100, 200);
    expect(points.length / 2).toBeGreaterThan(180);
    expect(points.length / 2).toBeLessThan(220);
    for (let i = 0; i < points.length; i += 2) {
      expect(points[i]).toBeGreaterThanOrEqual(0);
      expect(points[i]).toBeLessThan(200);
      expect(points[i + 1]).toBeGreaterThanOrEqual(0);
      expect(points[i + 1]).toBeLessThan(100);
    }
  });

  it("makes neighbors two-way: if A touches B, B touches A", () => {
    const points = jitteredGrid(createRng("nb"), 100, 100, 100);
    const { neighbors } = buildCellGraph(points, 100, 100);
    neighbors.forEach((list, a) => {
      for (const b of list) expect(neighbors[b]).toContain(a);
    });
  });
});

describe("climate", () => {
  it("is warmest at the equator and coldest at the poles", () => {
    expect(temperatureAt(50, 100, 0)).toBe(EQUATOR_TEMP);
    expect(temperatureAt(0, 100, 0)).toBe(POLE_TEMP);
    expect(temperatureAt(50, 100, 1)).toBeLessThan(EQUATOR_TEMP); // mountains are colder
  });

  it("counts steps inland from the sea", () => {
    expect([...stepsFromWater(lineIsLand, lineNeighbors)]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("biomes", () => {
  it("follows the temperature × moisture chart", () => {
    expect(classifyBiome(-20, 0.5, 0.5)).toBe(Biome.Ice);
    expect(classifyBiome(25, 0.05, 0.3)).toBe(Biome.Desert);
    expect(classifyBiome(25, 0.9, 0.5)).toBe(Biome.TropicalForest);
    expect(classifyBiome(12, 0.45, 0.3)).toBe(Biome.Grassland);
    expect(classifyBiome(12, 0.9, 0.05)).toBe(Biome.Wetland);
  });

  it("gives river cells more capacity", () => {
    const plain = cellCapacity(Biome.Grassland, false, false, false);
    expect(cellCapacity(Biome.Grassland, true, false, false)).toBe(plain * RIVER_CAP_MULT);
  });
});

describe("rivers", () => {
  it("drains every land cell back toward the sea, even out of a dip", () => {
    // Cell 2 is a dip: lower than both its neighbors. Water must still escape.
    const heights = Float32Array.from([0.1, 0.6, 0.4, 0.7, 0.8]);
    const down = drainageMap(heights, lineIsLand, lineNeighbors);
    expect([...down]).toEqual([-1, 0, 1, 2, 3]);
  });

  it("MinHeap hands back the smallest key first", () => {
    const heap = new MinHeap();
    [5, 1, 4, 2, 3].forEach((key) => heap.push(key * 10, key));
    const order: number[] = [];
    while (heap.size > 0) order.push(heap.pop());
    expect(order).toEqual([10, 20, 30, 40, 50]);
  });
});

describe("generateWorld", () => {
  // A small map with fewer pixels keeps this fast; the cell count stays the same.
  const small = () => generateWorld("eldoria", 320, 180).world;

  it("gives the same world for the same seed", () => {
    const a = small();
    const b = small();
    expect(a.cells.map((c) => c.biome)).toEqual(b.cells.map((c) => c.biome));
    expect(a.cells.map((c) => c.riverFlow)).toEqual(b.cells.map((c) => c.riverFlow));
  });

  it("only puts rivers and capacity on land", () => {
    for (const cell of small().cells) {
      if (!cell.isLand) {
        expect(cell.capacity).toBe(0);
        expect(cell.biome).toBe(Biome.Water);
        expect(cell.river).toBe(false);
      }
    }
  });
});
