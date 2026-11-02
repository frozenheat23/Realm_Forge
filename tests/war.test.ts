import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { SIM } from "../src/sim/params";
import { declareWars, endWars, frontCells, neighborPairs } from "../src/sim/war";
import { releaseOccupations } from "../src/sim/siege";
import { makeNation, makeState, row } from "./tinyWorld";
import { everyoneAI } from "../src/sim/ai/default";

// Two nations side by side on a row of 10 cells: nation 1 owns 0–4, nation 2 owns 5–9.
//   [1][1][1][1][1] | [2][2][2][2][2]
function twoNations(soldiers1 = 10, soldiers2 = 10) {
  return makeState(row(10), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [
    makeNation(1, 0, { reserve: soldiers1 }),
    makeNation(2, 9, { reserve: soldiers2 }),
  ]);
}

describe("fronts and neighbors", () => {
  it("finds which nations touch", () => {
    expect(neighborPairs(twoNations())).toEqual([[1, 2]]);
  });

  it("front cells are the ones touching the enemy", () => {
    const state = twoNations();
    expect(frontCells(state, 1, 2)).toEqual([4]);
    expect(frontCells(state, 2, 1)).toEqual([5]);
  });
});

describe("declareWars", () => {
  it("lets the stronger side attack, and never during a truce", () => {
    let wars = 0;
    for (let trial = 0; trial < 500; trial++) {
      const state = twoNations(100, 1);
      const events = declareWars(state, createRng(`d${trial}`), everyoneAI);
      if (events.length > 0) {
        wars++;
        expect(state.wars[0]!.attacker).toBe(1);
      }
    }
    expect(wars).toBeGreaterThan(0);

    const truce = twoNations(100, 1);
    truce.truces.push({ a: 1, b: 2, until: 50 });
    for (let trial = 0; trial < 200; trial++) declareWars(truce, createRng(`t${trial}`), everyoneAI);
    expect(truce.wars).toHaveLength(0);
  });
});

describe("endWars", () => {
  it("ends a decisive war with peace and a truce", () => {
    const state = twoNations();
    state.year = 5;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: 0, battleScore: SIM.PEACE_SCORE, goal: "conquer" as const, goalCells: [] });
    const events = endWars(state, everyoneAI);
    expect(state.wars).toHaveLength(0);
    expect(events[0]!.type).toBe("peace");
    expect(state.truces[0]!.until).toBe(5 + SIM.TRUCE_YEARS);
  });

  it("ends a war that has gone on too long", () => {
    const state = twoNations();
    state.year = SIM.MAX_WAR_YEARS + 1;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
    endWars(state, everyoneAI);
    expect(state.wars).toHaveLength(0);
  });

  it("drops wars with a nation that no longer exists", () => {
    const state = twoNations();
    state.nations.get(2)!.alive = false;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
    endWars(state, everyoneAI);
    expect(state.wars).toHaveLength(0);
  });

  it("the winner keeps what it occupies; everything else goes back", () => {
    const state = twoNations();
    state.state.occupier[5] = 1;
    state.state.occupier[6] = 1;
    state.state.occupier[3] = 2; // the loser's foothold
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: SIM.PEACE_SCORE, goal: "conquer" as const, goalCells: [] });
    const events = endWars(state, everyoneAI);
    expect(state.state.owner[5]).toBe(1);
    expect(state.state.owner[6]).toBe(1);
    expect(state.state.unrest[5]).toBeCloseTo(SIM.UNREST_CONQUEST);
    expect(state.state.occupier[5]).toBe(0);
    expect(state.state.owner[3]).toBe(1); // still its own
    expect(events[0]!.text).toContain("2 provinces");
    releaseOccupations(state);
    expect(state.state.occupier[3]).toBe(0);
  });

  it("a white peace hands nothing over", () => {
    const state = twoNations();
    state.year = SIM.MAX_WAR_YEARS + 1;
    state.state.occupier[5] = 1; // worth too little for a clear win
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
    endWars(state, everyoneAI);
    releaseOccupations(state);
    expect(state.state.owner[5]).toBe(2);
    expect(state.state.occupier[5]).toBe(0);
  });

  it("score counts battles and occupied land, the enemy capital most", () => {
    const state = twoNations();
    state.state.occupier[9] = 1; // nation 2's capital
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 2, goal: "conquer" as const, goalCells: [] });
    endWars(state, everyoneAI);
    expect(state.wars[0]!.score).toBe(2 + SIM.SCORE_PER_OCCUPIED + SIM.CAPITAL_SCORE);
  });
});
