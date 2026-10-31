import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Race } from "../src/core/types";
import { assimilate } from "../src/sim/culture";
import { SIM } from "../src/sim/params";
import { makeNation, makeState, row } from "./tinyWorld";

/** Two realms' people in a row of cells: the first two of culture 1, the last of culture 2, all ruled by nation 1. */
function conquered(race2: number = Race.Human) {
  const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0)]);
  state.state.culture.set([1, 1, 2]);
  state.state.race[2] = race2;
  state.year = SIM.CORE_YEARS + 1; // all of it is core land by now
  return state;
}
const fullControl = new Float32Array([1, 1, 1]);

/** Runs assimilation for `years` and returns the last cell's culture. */
function after(state: ReturnType<typeof conquered>, years: number) {
  const rng = createRng("culture");
  for (let y = 0; y < years; y++) assimilate(state, fullControl, rng);
  return state.state.culture[2];
}

describe("assimilation", () => {
  it("turns conquered kin into the ruler's culture", () => {
    expect(after(conquered(), 500)).toBe(1);
  });

  it("never touches another race, so a culture stays inside one race", () => {
    expect(after(conquered(Race.Orc), 500)).toBe(2);
  });

  it("leaves restless land alone", () => {
    const state = conquered();
    state.state.unrest[2] = SIM.ASSIMILATE_MAX_UNREST;
    expect(after(state, 500)).toBe(2);
  });

  it("leaves freshly conquered land alone", () => {
    const state = conquered();
    state.state.ownedSince[2] = state.year;
    expect(after(state, 10)).toBe(2);
  });

  it("leaves occupied land alone", () => {
    const state = conquered();
    state.state.occupier[2] = 9;
    expect(after(state, 500)).toBe(2);
  });

  it("needs a neighbor of the ruler's culture to copy", () => {
    const state = conquered();
    state.state.culture.set([2, 2, 2]);
    expect(after(state, 500)).toBe(2);
  });

  it("goes faster for peoples with higher assimilation", () => {
    let humans = 0;
    let orcs = 0;
    for (let i = 0; i < 300; i++) {
      const rng = createRng(`race-${i}`);
      for (const [race, add] of [[Race.Human, () => humans++], [Race.Orc, () => orcs++]] as const) {
        const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { race })]);
        state.state.culture.set([1, 1, 2]);
        state.year = SIM.CORE_YEARS + 1;
        for (let y = 0; y < 10; y++) assimilate(state, fullControl, rng);
        if (state.state.culture[2] === 1) add();
      }
    }
    expect(orcs).toBeGreaterThan(humans);
  });
});
