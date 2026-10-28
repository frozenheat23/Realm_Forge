import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { FRONT_FLIPS_PER_YEAR, MAX_WAR_YEARS, PEACE_SCORE, TRUCE_YEARS } from "../src/sim/params";
import { declareWars, fightBattle, fightWars, frontCells, neighborPairs } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

// Two nations side by side on a row of 10 cells: nation 1 owns 0–4, nation 2 owns 5–9.
//   [1][1][1][1][1] | [2][2][2][2][2]
function twoNations(strength1 = 10, strength2 = 10) {
  return makeState(row(10), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [
    makeNation(1, 0, { strength: strength1 }),
    makeNation(2, 9, { strength: strength2 }),
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
      const events = declareWars(state, createRng(`d${trial}`));
      if (events.length > 0) {
        wars++;
        expect(state.wars[0]!.attacker).toBe(1);
      }
    }
    expect(wars).toBeGreaterThan(0);

    const truce = twoNations(100, 1);
    truce.truces.push({ a: 1, b: 2, until: 50 });
    for (let trial = 0; trial < 200; trial++) declareWars(truce, createRng(`t${trial}`));
    expect(truce.wars).toHaveLength(0);
  });
});

describe("fightBattle", () => {
  it("moves the front toward the loser, but no more than FRONT_FLIPS_PER_YEAR cells", () => {
    const state = twoNations(1000, 1); // nation 1 is overwhelmingly stronger
    const war = { id: 1, attacker: 1, defender: 2, startYear: 0, score: 0 };
    state.wars.push(war);
    const flipped = fightBattle(state, war, createRng("b"));
    expect(flipped).toBeGreaterThan(0);
    expect(flipped).toBeLessThanOrEqual(FRONT_FLIPS_PER_YEAR);
    expect(state.state.owner[5]).toBe(1);
    expect(war.score).toBeGreaterThan(0);
  });

  it("takes the capital last", () => {
    // Cell 0 (nation 1) touches four nation-2 cells; cell 1 is nation 2's capital.
    // With more front cells than FRONT_FLIPS_PER_YEAR, the capital survives this year.
    const spec = [
      { neighbors: [1, 2, 3, 4] },
      { neighbors: [0] },
      { neighbors: [0] },
      { neighbors: [0] },
      { neighbors: [0] },
    ];
    const state = makeState(spec, [1, 2, 2, 2, 2], [
      makeNation(1, 0, { strength: 1000 }),
      makeNation(2, 1, { strength: 1 }),
    ]);
    const war = { id: 1, attacker: 1, defender: 2, startYear: 0, score: 0 };
    expect(FRONT_FLIPS_PER_YEAR).toBeLessThan(4);
    fightBattle(state, war, createRng("cap"));
    expect(state.state.owner[1]).toBe(2);
  });
});

describe("fightWars", () => {
  it("ends a decisive war with peace and a truce", () => {
    const state = twoNations();
    state.year = 5;
    // Well past the peace line, so one lost battle this year can't pull it back under.
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: PEACE_SCORE * 2 });
    const events = fightWars(state, createRng("p"));
    expect(state.wars).toHaveLength(0);
    expect(events[0]!.type).toBe("peace");
    expect(state.truces[0]!.until).toBe(5 + TRUCE_YEARS);
  });

  it("ends a war that has gone on too long", () => {
    const state = twoNations();
    state.year = MAX_WAR_YEARS + 1;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: 0 });
    fightWars(state, createRng("long"));
    expect(state.wars).toHaveLength(0);
  });

  it("drops wars with a nation that no longer exists", () => {
    const state = twoNations();
    state.nations.get(2)!.alive = false;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0 });
    fightWars(state, createRng("dead"));
    expect(state.wars).toHaveLength(0);
  });
});
