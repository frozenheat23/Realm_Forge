import { describe, expect, it } from "vitest";
import { generateWorld } from "../src/gen";
import { PROVINCE_SIZE } from "../src/gen/params";
import { floodFill } from "../src/sim/rebellion";
import { makeNation, makeState, row } from "./tinyWorld";

describe("provinces", () => {
  const { world } = generateWorld("provinces");
  const land = world.cells.filter((c) => c.isLand);

  it("cover all land (and no water), about PROVINCE_SIZE cells each", () => {
    for (const c of world.cells) expect(c.province >= 0).toBe(c.isLand);
    const count = new Set(land.map((c) => c.province)).size;
    const average = land.length / count;
    expect(average).toBeGreaterThan(PROVINCE_SIZE / 2);
    expect(average).toBeLessThan(PROVINCE_SIZE * 2);
  });

  it("are connected: every cell can reach its province's other cells without leaving it", () => {
    const byProvince = new Map<number, number[]>();
    for (const c of land) byProvince.set(c.province, [...(byProvince.get(c.province) ?? []), c.id]);
    for (const cells of byProvince.values()) {
      const seen = new Set([cells[0]!]);
      const queue = [cells[0]!];
      for (let head = 0; head < queue.length; head++) {
        for (const n of world.cells[queue[head]!]!.neighbors) {
          if (!seen.has(n) && world.cells[n]!.province === world.cells[cells[0]!]!.province) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
      expect(seen.size).toBe(cells.length);
    }
  });
});

describe("rebellions follow provinces", () => {
  it("fill the seed's own province before spilling into the next", () => {
    // A row of 10 cells; cells 0–5 are province 0, cells 6–9 province 1. Seed at 5.
    const spec = row(10).map((c, i) => ({ ...c, province: i < 6 ? 0 : 1 }));
    const state = makeState(spec, Array(10).fill(1), [makeNation(1, 9)]);
    const region = floodFill(state, state.nations.get(1)!, 5, 5);
    // Without provinces it would take 5, 4, 6, 3, 7; with them it stays in province 0.
    expect(region.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
