import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Biome, type Cell } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { buildChain, generateName } from "../src/gen/names";
import { claimCore, hslToHex, placeCapitals } from "../src/gen/nations";
import { START_CORE_SIZE, START_NATIONS } from "../src/gen/params";

// A tiny hand-made map: 8 land cells in a line, capacity rising to the right.
//   [0]-[1]-[2]-[3]-[4]-[5]-[6]-[7]
function lineMap(): Cell[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: i,
    site: [i * 10, 0] as [number, number],
    neighbors: [i - 1, i + 1].filter((n) => n >= 0 && n < 8),
    h: 0.6,
    elevation: 0.2,
    isLand: true,
    coastal: false,
    mountain: false,
    temp: 15,
    moisture: 0.5,
    biome: Biome.Grassland,
    downstream: -1,
    riverFlow: 0,
    river: false,
    capacity: 0.1 + i * 0.1,
  }));
}

describe("placeCapitals", () => {
  it("picks the best cell first and keeps capitals apart", () => {
    const capitals = placeCapitals(createRng("cap"), lineMap(), 3, 3);
    expect(capitals[0]).toBe(7); // highest capacity
    // Every pair of capitals is at least 3 steps apart along the line.
    for (const a of capitals) {
      for (const b of capitals) if (a !== b) expect(Math.abs(a - b)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("claimCore", () => {
  it("claims the nearest unowned cells, and never steals owned ones", () => {
    const cells = lineMap();
    const owner = new Int32Array(8);
    owner[5] = 9; // someone else already owns cell 5
    const claimed = claimCore(3, 1, 3, cells, owner);
    expect(claimed.sort()).toEqual([2, 3, 4]);
    expect(owner[5]).toBe(9);
  });
});

describe("names", () => {
  const examples = ["Kethar", "Valdrun", "Skarheim", "Thorvik", "Halvik", "Torsund"];

  it("makes the same names for the same seed", () => {
    const make = () => {
      const rng = createRng("names");
      const taken = new Set<string>();
      return Array.from({ length: 5 }, () => generateName(rng, buildChain(examples), taken, examples));
    };
    expect(make()).toEqual(make());
  });

  it("never repeats a name or copies an example", () => {
    const rng = createRng("unique");
    const taken = new Set<string>();
    const chain = buildChain(examples);
    const names = Array.from({ length: 10 }, () => generateName(rng, chain, taken, examples));
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(examples).not.toContain(name);
  });
});

describe("hslToHex", () => {
  it("converts pure colors correctly", () => {
    expect(hslToHex(0, 1, 0.5)).toBe("#ff0000");
    expect(hslToHex(120, 1, 0.5)).toBe("#00ff00");
    expect(hslToHex(240, 1, 0.5)).toBe("#0000ff");
  });
});

describe("starting nations in a generated world", () => {
  const { state } = generateWorld("eldoria", 320, 180);

  it("creates up to START_NATIONS nations, each with a capital it owns", () => {
    expect(state.nations.size).toBeGreaterThan(0);
    expect(state.nations.size).toBeLessThanOrEqual(START_NATIONS);
    for (const nation of state.nations.values()) {
      expect(state.state.owner[nation.capital]).toBe(nation.id);
      expect(nation.area).toBeLessThanOrEqual(START_CORE_SIZE);
    }
  });

  it("logs a 'founded' event for each nation", () => {
    expect(state.events.filter((e) => e.type === "founded").length).toBe(state.nations.size);
  });
});
