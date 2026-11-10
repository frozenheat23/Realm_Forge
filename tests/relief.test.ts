import { describe, expect, it } from "vitest";
import { generateWorld } from "../src/gen";
import { reliefHeights } from "../src/render3d/reliefHeights";

describe("3D relief heights", () => {
  const { world } = generateWorld("relief-test", 320, 180);
  const cols = 80;
  const rows = 45;
  const heights = reliefHeights(world.heightmap, cols, rows, 100, 1.5);

  it("has one height for every grid point", () => {
    expect(heights.length).toBe((cols + 1) * (rows + 1));
  });

  it("keeps the sea flat and raises the land, never past the peak", () => {
    const { data, width, seaLevel } = world.heightmap;
    let landPoints = 0;
    for (let row = 1; row < rows; row++) {
      for (let col = 1; col < cols; col++) {
        const h = heights[row * (cols + 1) + col]!;
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(100);
        // A point deep in the sea (its four nearest pixels all water) is at 0.
        const x = Math.round((col / cols) * world.width);
        const y = Math.round((row / rows) * world.height);
        const around = [data[(y - 1) * width + x - 1]!, data[(y - 1) * width + x]!, data[y * width + x - 1]!, data[y * width + x]!];
        if (around.every((v) => v <= seaLevel)) expect(h).toBe(0);
        if (h > 0) landPoints++;
      }
    }
    expect(landPoints).toBeGreaterThan(100);
  });

  it("is flatter in the lowlands with a higher curve", () => {
    const steep = reliefHeights(world.heightmap, cols, rows, 100, 3);
    for (let i = 0; i < heights.length; i++) expect(steep[i]!).toBeLessThanOrEqual(heights[i]! + 1e-4);
  });
});
