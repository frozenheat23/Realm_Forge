import { describe, expect, it } from "vitest";
import type { Heightmap } from "../src/gen/heightmap";
import { boxBlur, distanceToCoast } from "../src/render/terrainCel";

describe("boxBlur", () => {
  it("leaves a flat image unchanged", () => {
    const flat = new Float32Array(25).fill(0.5);
    for (const v of boxBlur(flat, 5, 5, 1)) expect(v).toBeCloseTo(0.5);
  });

  it("spreads a single bright pixel to its neighbors", () => {
    const img = new Float32Array(25);
    img[12] = 9; // center of a 5×5 image
    const out = boxBlur(img, 5, 5, 1);
    expect(out[12]).toBeCloseTo(1); // 9 shared across a 3×3 square
    expect(out[0]).toBe(0); // corner is too far away
  });
});

describe("distanceToCoast", () => {
  it("measures how far each pixel is from the shoreline", () => {
    // A 7-wide strip: left 3 columns water (0), right 4 land (1).
    const width = 7;
    const height = 3;
    const data = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 3; x < width; x++) data[y * width + x] = 1;
    }
    const map: Heightmap = { width, height, data, seaLevel: 0.5 };
    const dist = distanceToCoast(map);
    const row = Array.from(dist.slice(width, width * 2)); // middle row
    // Both pixels touching the shore are 0; distance grows away from it.
    expect(row).toEqual([2, 1, 0, 0, 1, 2, 3]);
  });
});
