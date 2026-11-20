import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Faith, Race, type FaithId } from "../src/core/types";
import { assimilate } from "../src/sim/culture";
import { SIM } from "../src/sim/params";
import { rebel } from "../src/sim/rebellion";
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

  it("keeps foreign residents and their culture after a fresh conquest", () => {
    const state = conquered(Race.Orc);
    state.state.ownedSince[2] = state.year;
    expect(after(state, 500)).toBe(2);
    expect(state.state.race[2]).toBe(Race.Orc);
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

describe("settlement under long foreign rule", () => {
  // Vary the year's dice as tick() does. With zero control even centuries cannot change the majority.
  function settle(state: ReturnType<typeof conquered>, control = fullControl) {
    for (let y = 0; y < 1000; y++) assimilate(state, control, createRng(`settlement-${y}`));
  }

  it("changes race and culture together and preserves population and a shared faith", () => {
    const state = conquered(Race.Orc);
    state.state.faith[2] = Faith.RedHunger;
    const population = state.state.pop[2];
    settle(state);
    expect([state.state.race[2], state.state.culture[2]]).toEqual([Race.Human, 1]);
    expect([state.state.pop[2], state.state.faith[2]]).toEqual([population, Faith.RedHunger]);
  });

  it("brings the settlers' homeland faith when the old faith is exclusive to another people", () => {
    const state = conquered(Race.LightElf);
    state.state.faith[2] = Faith.SilverChoir;
    settle(state);
    expect(state.state.race[2]).toBe(Race.Human);
    expect(state.state.faith[2]).toBe(Faith.RadiantCovenant);
  });

  it("leaves an enclave in occupied, restless or uncontrolled land", () => {
    const occupied = conquered(Race.Orc);
    occupied.state.occupier[2] = 2;
    const restless = conquered(Race.Orc);
    restless.state.unrest[2] = SIM.ASSIMILATE_MAX_UNREST;
    const distant = conquered(Race.Orc);
    settle(occupied);
    settle(restless);
    settle(distant, new Float32Array(3));
    for (const state of [occupied, restless, distant]) expect(state.state.race[2]).toBe(Race.Orc);
  });
});

describe("blessings on assimilation", () => {
  /** How many of 300 runs saw the last cell assimilate within 10 years. */
  function changed(rulerFaith: FaithId, cellFaith: FaithId) {
    let count = 0;
    for (let i = 0; i < 300; i++) {
      const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { faith: rulerFaith })]);
      state.state.culture.set([1, 1, 2]);
      state.state.faith[2] = cellFaith;
      state.year = SIM.CORE_YEARS + 1;
      const rng = createRng(`b-${i}`);
      for (let y = 0; y < 10; y++) assimilate(state, fullControl, rng);
      if (state.state.culture[2] === 1) count++;
    }
    return count;
  }

  it("Kinship: Bone Drums rulers gather people in faster", () => {
    expect(changed(Faith.BoneDrums, Faith.BoneDrums)).toBeGreaterThan(changed(Faith.RedHunger, Faith.BoneDrums));
  });

  it("Remembrance: the Silver Choir keep their ways longer", () => {
    expect(changed(Faith.RedHunger, Faith.SilverChoir)).toBeLessThan(changed(Faith.RedHunger, Faith.RedHunger));
  });
});

describe("culture-line revolts", () => {
  const length = SIM.REBEL_MIN_CAPITAL_DIST + SIM.MIN_AREA + 3;
  /** A long realm whose far end is `people` cells of an older realm's culture. */
  function empire(people = SIM.MIN_AREA) {
    const owners = Array<number>(length).fill(1);
    const state = makeState(row(length), owners, [
      makeNation(1, 0),
      makeNation(2, 0, { name: "Velmora", color: "#123456", alive: false, fell: 100 }),
    ]);
    for (let c = length - people; c < length; c++) state.state.culture[c] = 2;
    state.year = 440;
    return state;
  }
  const revolt = (state: ReturnType<typeof empire>) => rebel(state, state.nations.get(1)!, [...state.state.owner.keys()], createRng("r"))!;

  it("brings a fallen realm back under its old name and color", () => {
    const reborn = revolt(empire());
    expect(reborn.name).toBe("Velmora");
    expect(reborn.color).toBe("#123456");
    expect(reborn.culture).toBe(2);
    expect(reborn.id).not.toBe(2);
  });

  it("only takes cells of the one culture", () => {
    const state = empire();
    revolt(state);
    expect(state.state.owner[length - SIM.MIN_AREA - 1]).toBe(1);
  });

  it("makes a sister state, not a copy, if a living nation rules that culture", () => {
    const state = empire();
    state.nations.get(2)!.alive = false;
    state.nations.set(3, makeNation(3, 0, { culture: 2, name: "Velmora", color: "#123456" }));
    const sister = revolt(state);
    expect(sister.culture).toBe(2);
    expect(sister.name).not.toBe("Velmora");
  });

  it("lets the ruling people found a new culture when no one else can rise", () => {
    const state = empire(0);
    const rebels = revolt(state);
    expect(rebels.culture).toBe(rebels.id);
    expect(state.state.culture[length - 1]).toBe(rebels.id);
  });

  it("falls back to the ruling people if a conquered people are too few", () => {
    const state = empire(SIM.MIN_AREA - 1);
    expect(revolt(state).culture).not.toBe(2);
  });
});
