import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Biome, Race } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { RACE_HOMES_PER_RACE, RACES } from "../src/gen/params";
import { PLAYABLE_RACES, raceCapacity, traits } from "../src/gen/races";
import { collapses } from "../src/sim/collapse";
import { rebellionEvent } from "../src/sim/events";
import { expand } from "../src/sim/expansion";
import { SIM } from "../src/sim/params";
import { growPopulation } from "../src/sim/population";
import { groundBonus } from "../src/sim/battle";
import { rebel } from "../src/sim/rebellion";
import { updateStability } from "../src/sim/stability";
import { updateTotals } from "../src/sim/totals";
import { makeCells, makeNation, makeState, row, conqueredPeople } from "./tinyWorld";

describe("race traits", () => {
  it("treats nobody (Race.None) as the Human baseline", () => {
    expect(traits(Race.None)).toBe(RACES[Race.Human]);
  });

  it("lets Dwarves hold far more people on a mountain than Humans", () => {
    // Tundra: a biome Dwarves have no special feeling about, so only the mountain counts.
    const [mountain] = makeCells([{ neighbors: [], mountain: true, biome: Biome.Tundra }]);
    expect(raceCapacity(mountain!, Race.Dwarf)).toBeCloseTo(raceCapacity(mountain!, Race.Human) * 2.5);
  });
});

describe("races in the simulation", () => {
  it("grows an orc cell faster than a human one", () => {
    const state = makeState(row(2), [1, 2], [makeNation(1, 0), makeNation(2, 1, { race: Race.Orc })], [0.1, 0.1]);
    growPopulation(state);
    expect(state.state.pop[1]).toBeGreaterThan(state.state.pop[0]!);
  });

  it("empties the race of unowned cells", () => {
    const state = makeState(row(2), [1, 0], [makeNation(1, 0)], [0.5, 0], [Race.Human, Race.Orc]);
    growPopulation(state);
    expect(state.state.race[1]).toBe(Race.None);
  });

  it("counts foreign subjects and their fighting skill in the totals", () => {
    const mixed = makeState(row(2), [1, 1], [makeNation(1, 0)], [0.5, 0.5], [Race.Human, Race.Orc]);
    const human = makeState(row(2), [1, 1], [makeNation(1, 0)], [0.5, 0.5]);
    updateTotals(mixed);
    updateTotals(human);
    expect(mixed.nations.get(1)!.foreignShare).toBeCloseTo(0.5);
    expect(mixed.nations.get(1)!.strength).toBeGreaterThan(human.nations.get(1)!.strength); // orcs are more martial
  });

  it("makes ruling many foreigners cost stability", () => {
    const state = makeState(
      row(2),
      [1, 2],
      [makeNation(1, 0, { stability: 0.5, foreignShare: 0 }), makeNation(2, 1, { stability: 0.5, foreignShare: 1 })],
    );
    updateStability(state);
    expect(state.nations.get(2)!.stability).toBeLessThan(state.nations.get(1)!.stability);
  });

  it("settles newly claimed land with the claiming nation's race", () => {
    const state = makeState(row(2), [1, 0], [makeNation(1, 0, { race: Race.DarkElf })]);
    const rate = SIM.EXPANSION_RATE;
    SIM.EXPANSION_RATE = 100; // make the claim certain
    try {
      expand(state, createRng("x"));
    } finally {
      SIM.EXPANSION_RATE = rate;
    }
    expect(state.state.owner[1]).toBe(1);
    expect(state.state.race[1]).toBe(Race.DarkElf);
  });

  it("an army holds better among dwarves than among humans", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0)], undefined, [Race.Dwarf, Race.Human]);
    const here = (cell: number) => groundBonus(state, { id: 1, owner: 1, war: 1, cell, size: 1, morale: 1, target: -1, path: [], trail: [] });
    expect(here(0)).toBeGreaterThan(here(1));
  });

  it("starts rebellions among subject peoples, who then rule themselves", () => {
    const dist = SIM.REBEL_MIN_CAPITAL_DIST;
    const length = dist + SIM.MIN_AREA + 4;
    // Humans near the capital, Orcs in the far provinces.
    const races = Array.from({ length }, (_, i) => (i >= dist + 2 ? Race.Orc : Race.Human));
    const owners = Array(length).fill(1);
    const state = makeState(row(length), owners, [makeNation(1, 0)], undefined, races);
    conqueredPeople(state, Race.Orc);
    const rebelNation = rebel(state, state.nations.get(1)!, [...owners.keys()], createRng("r"));
    expect(rebelNation).not.toBeNull();
    expect(rebelNation!.race).toBe(Race.Orc);
    // Only the Orc cells broke away; the far Human cells stay loyal.
    expect(state.state.owner[dist]).toBe(1);
    for (let c = dist + 2; c < length; c++) expect(state.state.owner[c]).toBe(rebelNation!.id);
  });

  it("tells an ethnic rebellion differently from an ordinary one", () => {
    const rulers = makeNation(1, 0, { name: "Kethar" });
    const orcs = makeNation(2, 5, { name: "Gorzug", race: Race.Orc });
    expect(rebellionEvent(10, orcs, rulers).text).toContain("the Orcs of Gorzug rise against Kethar");
  });

  it("empties abandoned cells when a nation collapses with no neighbors", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0, { race: Race.Dwarf })]);
    collapses(state);
    expect(state.state.owner[0]).toBe(0);
    expect(state.state.race[0]).toBe(Race.None);
  });
});

describe("races in a generated world", () => {
  const { state } = generateWorld("races-test");

  it("places every race's homelands", () => {
    expect(state.raceHomes.length).toBe(PLAYABLE_RACES.length * RACE_HOMES_PER_RACE);
  });

  it("puts every race on the map at year 0", () => {
    const ruling = new Set([...state.nations.values()].map((n) => n.race));
    for (const race of PLAYABLE_RACES) expect(ruling.has(race)).toBe(true);
  });

  it("settles each starting nation's land with its own race", () => {
    state.state.owner.forEach((owner, cell) => {
      if (owner !== 0) expect(state.state.race[cell]).toBe(state.nations.get(owner)!.race);
    });
  });
});
