import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { findSeaLevel, generateHeightmap } from "../src/gen/heightmap";
import { LAND_RATIO } from "../src/gen/params";

// A small map keeps the tests fast.
const W = 160;
const H = 90;

function landShare(data: Float32Array, seaLevel: number): number {
  let land = 0;
  for (const v of data) if (v > seaLevel) land++;
  return land / data.length;
}

describe("generateHeightmap", () => {
  it("gives the same heights for the same seed", () => {
    const a = generateHeightmap(createRng("eldoria"), W, H);
    const b = generateHeightmap(createRng("eldoria"), W, H);
    expect(a.data).toEqual(b.data);
    expect(a.seaLevel).toBe(b.seaLevel);
  });

  it("gives different heights for different seeds", () => {
    const a = generateHeightmap(createRng("eldoria"), W, H);
    const b = generateHeightmap(createRng("kethar"), W, H);
    expect(a.data).not.toEqual(b.data);
  });

  it("keeps every height between 0 and 1", () => {
    const { data } = generateHeightmap(createRng("bounds"), W, H);
    for (const v of data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("makes about LAND_RATIO of the map land", () => {
    const { data, seaLevel } = generateHeightmap(createRng("ratio"), W, H);
    expect(landShare(data, seaLevel)).toBeCloseTo(LAND_RATIO, 1);
  });

  it("keeps the map corners underwater", () => {
    const { data, seaLevel } = generateHeightmap(createRng("corners"), W, H);
    const corners = [0, W - 1, (H - 1) * W, H * W - 1];
    for (const i of corners) expect(data[i]).toBeLessThan(seaLevel);
  });
});

describe("findSeaLevel", () => {
  it("puts the sea level so the right share of values is above it", () => {
    // 100 evenly spread values from 0 to 0.99.
    const data = Float32Array.from({ length: 100 }, (_, i) => i / 100);
    expect(findSeaLevel(data, 0.3)).toBeCloseTo(0.7, 2);
  });
});
