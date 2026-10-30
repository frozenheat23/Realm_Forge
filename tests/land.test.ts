import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Race, Settlement } from "../src/core/types";
import { setOwner } from "../src/sim/helpers";
import { cityNearby, updateLand } from "../src/sim/land";
import { bestCapital } from "../src/sim/newNation";
import { SIM } from "../src/sim/params";
import { growPopulation } from "../src/sim/population";
import { effectiveCapacity } from "../src/sim/resources";
import { rebel } from "../src/sim/rebellion";
import { claims, declareWars } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

// [1][1][1] | [2][2][2]
function twoNations(soldiers1 = 10, soldiers2 = 10) {
  return makeState(row(6), [1, 1, 1, 2, 2, 2], [
    makeNation(1, 0, { reserve: soldiers1 }),
    makeNation(2, 5, { reserve: soldiers2 }),
  ]);
}

describe("ownership history", () => {
  it("remembers the previous owner and when the cell changed hands", () => {
    const state = twoNations();
    state.year = 40;
    setOwner(state, 3, 1);
    expect(state.state.prevOwner[3]).toBe(2);
    expect(state.state.ownedSince[3]).toBe(40);
  });

  it("gives a claim on recently lost land, which runs out after CLAIM_YEARS", () => {
    const state = twoNations();
    state.year = 10;
    setOwner(state, 2, 2); // nation 2 takes one of nation 1's cells
    expect(claims(state).has(1 * 100000 + 2)).toBe(true);
    state.year = 10 + SIM.CLAIM_YEARS + 1;
    expect(claims(state).size).toBe(0);
  });

  it("says so when a war is fought over a claim", () => {
    for (let trial = 0; trial < 2000; trial++) {
      const state = twoNations(100, 1);
      state.state.prevOwner[3] = 1; // nation 2 holds land nation 1 lost
      const events = declareWars(state, createRng(`c${trial}`));
      if (events.length === 0) continue;
      expect(events[0]!.text).toContain("reclaim");
      return;
    }
    throw new Error("no war in 2000 tries");
  });
});

describe("devastation", () => {
  it("cuts what the land can hold", () => {
    const state = twoNations();
    state.state.devastation[2] = 0.8;
    expect(effectiveCapacity(state, 2)).toBeLessThan(effectiveCapacity(state, 0));
  });

  it("heals a share of itself each year", () => {
    const state = twoNations();
    state.state.devastation[1] = 0.5;
    updateLand(state, new Float32Array(6).fill(1), createRng("land"));
    expect(state.state.devastation[1]).toBeCloseTo(0.5 * (1 - SIM.DEVASTATION_HEAL));
  });
});

describe("unrest", () => {
  it("grows where control is weak and under foreign rulers, and fades in core land", () => {
    const races = [Race.Human, Race.Human, Race.Orc, Race.Human, Race.Human, Race.Human];
    const state = makeState(row(6), [1, 1, 1, 2, 2, 2], [makeNation(1, 0), makeNation(2, 5)], undefined, races);
    const control = Float32Array.from([1, 0, 0, 1, 1, 1]);
    updateLand(state, control, createRng("land"));
    const u = state.state.unrest;
    expect(u[0]).toBe(0); // firmly held home
    expect(u[1]).toBeGreaterThan(0); // weak control
    expect(u[2]).toBeGreaterThan(u[1]!); // weak control and foreign rulers

    state.state.unrest[4] = 0.5;
    state.year = SIM.CORE_YEARS; // cells were taken in year 0, so they're core now
    updateLand(state, control, createRng("land"));
    expect(state.state.unrest[4]).toBeCloseTo(0.5 - 2 * SIM.UNREST_DECAY);
  });

  it("is cleared when land is abandoned", () => {
    const state = makeState(row(2), [1, 0], [makeNation(1, 0)]);
    state.state.unrest[1] = 0.7;
    growPopulation(state);
    expect(state.state.unrest[1]).toBe(0);
  });

  it("decides where rebellions start", () => {
    const length = SIM.REBEL_MIN_CAPITAL_DIST + 2 * SIM.REBEL_MAX_CELLS;
    const owners = Array(length).fill(1);
    const state = makeState(row(length), owners, [makeNation(1, 0)]);
    const hotspot = length - 1; // the only restless cell, at the far end
    state.state.unrest[hotspot] = 1;
    const rebelNation = rebel(state, state.nations.get(1)!, [...owners.keys()], createRng("u"))!;
    expect(state.state.owner[hotspot]).toBe(rebelNation.id);
    expect(state.state.unrest[hotspot]).toBe(0); // free at last
  });
});

describe("development and settlements", () => {
  // One nation on a row of `n` cells, every cell full of people.
  const full = (n = 3) => makeState(row(n), Array(n).fill(1), [makeNation(1, 0)], Array(n).fill(1));
  const firm = (n = 3) => new Float32Array(n).fill(1);

  it("grows in full, firmly held, peaceful land and is worn away by devastation", () => {
    const state = full();
    updateLand(state, firm(), createRng("d"));
    expect(state.state.development[0]).toBeCloseTo(SIM.DEV_GROWTH);

    state.state.development[1] = 0.5;
    state.state.devastation[1] = 1;
    updateLand(state, firm(), createRng("d"));
    expect(state.state.development[1]).toBeLessThan(0.5);
  });

  it("villages become towns only with enough people, and shrink only well below the line", () => {
    const state = full();
    state.state.development[0] = SIM.SETTLE_TOWN;
    state.state.settlement[0] = Settlement.Village;
    state.state.pop[0] = 0.1; // too few people for a town
    updateLand(state, firm(), createRng("s"));
    expect(state.state.settlement[0]).toBe(Settlement.Village);

    state.state.pop[0] = 1;
    updateLand(state, firm(), createRng("s"));
    expect(state.state.settlement[0]).toBe(Settlement.Town);

    state.state.development[0] = SIM.SETTLE_TOWN * 0.95; // a little below the line: stays a town
    updateLand(state, firm(), createRng("s"));
    expect(state.state.settlement[0]).toBe(Settlement.Town);
  });

  it("names a new city and logs it, but not right next to another city", () => {
    const n = SIM.CITY_MIN_SPACING + 2;
    const state = full(n);
    state.state.settlement[0] = Settlement.Town;
    state.state.development[0] = 1;
    const events = updateLand(state, firm(n), createRng("c"));
    expect(state.state.settlement[0]).toBe(Settlement.City);
    expect(events[0]!.type).toBe("city_founded");
    expect(events[0]!.text).toContain(state.cityNames.get(0)!);

    expect(cityNearby(state, SIM.CITY_MIN_SPACING - 1)).toBe(true);
    expect(cityNearby(state, SIM.CITY_MIN_SPACING)).toBe(false);
  });

  it("is lost when the land is abandoned", () => {
    const state = makeState(row(2), [1, 0], [makeNation(1, 0)]);
    state.state.development[1] = 0.8;
    state.state.settlement[1] = Settlement.Town;
    growPopulation(state);
    expect(state.state.development[1]).toBe(0);
    expect(state.state.settlement[1]).toBe(0);
  });

  it("decides where a new capital goes: the biggest settlement first", () => {
    const state = full(3);
    state.state.pop[2] = 5; // most people, but no town
    state.state.settlement[1] = Settlement.Town;
    expect(bestCapital(state, [0, 1, 2])).toBe(1);
  });
});
