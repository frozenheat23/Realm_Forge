import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Biome } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { expand } from "../src/sim/expansion";
import { SIM } from "../src/sim/params";
import { growPopulation } from "../src/sim/population";
import { tick } from "../src/sim/tick";
import { updateTotals } from "../src/sim/totals";
import { makeNation, makeState, row } from "./tinyWorld";

describe("growPopulation", () => {
  it("grows toward capacity but never past it", () => {
    const state = makeState(row(1), [1], [makeNation(1, 0)], [0.5]);
    for (let year = 0; year < 2000; year++) growPopulation(state);
    expect(state.state.pop[0]).toBeGreaterThan(0.99);
    expect(state.state.pop[0]).toBeLessThanOrEqual(1);
  });

  it("empties unowned cells", () => {
    const state = makeState(row(2), [1, 0], [makeNation(1, 0)], [0.5, 0.5]);
    growPopulation(state);
    expect(state.state.pop[1]).toBe(0);
  });
});

describe("updateTotals", () => {
  it("adds up area, population and strength", () => {
    const state = makeState(row(3), [1, 1, 0], [makeNation(1, 0, { stability: 0.5 })], [0.4, 0.6, 0]);
    updateTotals(state);
    const nation = state.nations.get(1)!;
    expect(nation.area).toBe(2);
    expect(nation.pop).toBeCloseTo(1);
    expect(nation.strength).toBeCloseTo(1 ** SIM.STRENGTH_POP_EXP * 1);
  });
});

describe("expand", () => {
  it("only claims empty land touching the nation, one ring per year", () => {
    //   [0]-[1]-[2]-[3]   nation 1 owns cell 0
    const state = makeState(row(4), [1, 0, 0, 0], [makeNation(1, 0)]);
    for (let year = 1; year <= 200; year++) {
      expand(state, createRng(`y${year}`));
      // Cell 3 can only be owned once cells 1 and 2 are.
      if (state.state.owner[3] !== 0) expect(state.state.owner[2]).toBe(1);
    }
    expect([...state.state.owner]).toEqual([1, 1, 1, 1]);
  });

  it("spreads slower into hard terrain", () => {
    // Two separate pairs: nation 1 next to grassland, nation 2 next to a mountain desert.
    const spec = [
      { neighbors: [1] },
      { neighbors: [0] },
      { neighbors: [3] },
      { neighbors: [2], biome: Biome.Desert, mountain: true },
    ];
    let easy = 0;
    let hard = 0;
    for (let trial = 0; trial < 300; trial++) {
      const state = makeState(spec, [1, 0, 2, 0], [makeNation(1, 0), makeNation(2, 2)]);
      expand(state, createRng(`t${trial}`));
      if (state.state.owner[1] === 1) easy++;
      if (state.state.owner[3] === 2) hard++;
    }
    expect(easy).toBeGreaterThan(hard * 3);
  });

  it("never crosses water", () => {
    const spec = [{ neighbors: [1] }, { neighbors: [0, 2], land: false }, { neighbors: [1] }];
    const state = makeState(spec, [1, 0, 0], [makeNation(1, 0)]);
    for (let year = 1; year <= 100; year++) expand(state, createRng(`w${year}`));
    expect([...state.state.owner]).toEqual([1, 0, 0]);
  });
});

describe("tick", () => {
  it("nations grow across a real map over 100 years", () => {
    const { state } = generateWorld("eldoria", 320, 180);
    const startArea = [...state.state.owner].filter((o) => o !== 0).length;
    const rng = createRng("eldoria").fork("sim");
    for (let i = 0; i < 100; i++) tick(state, rng);
    const endArea = [...state.state.owner].filter((o) => o !== 0).length;
    expect(state.year).toBe(100);
    expect(endArea).toBeGreaterThan(startArea * 3);
  });
});
