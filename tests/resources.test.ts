import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Biome, Race, Resource, type ResourceKind, type War } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { RESOURCE_PROB, RESOURCES } from "../src/gen/params";
import { defensibilityOf, fits } from "../src/gen/resources";
import { SIM } from "../src/sim/params";
import { cellValue, effectiveCapacity, resourceBonus } from "../src/sim/resources";
import { updateStability } from "../src/sim/stability";
import { updateTotals } from "../src/sim/totals";
import { campaign } from "../src/sim/armies";
import { declareWars, endWars } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

describe("generation", () => {
  const { world } = generateWorld("resources");
  const land = world.cells.filter((c) => c.isLand);
  const deposits = land.filter((c) => c.resource !== Resource.None);

  it("puts a deposit on about RESOURCE_PROB of land cells, only where it fits", () => {
    expect(deposits.length / land.length).toBeGreaterThan(RESOURCE_PROB / 2);
    expect(deposits.length / land.length).toBeLessThan(RESOURCE_PROB * 1.5);
    for (const c of deposits) {
      expect(fits(c, c.resource as ResourceKind)).toBe(true);
      expect(c.richness).toBeGreaterThan(0);
      expect(c.richness).toBeLessThanOrEqual(1);
    }
  });

  it("makes mountains, forests and rivers harder to take than open plains", () => {
    const plain = land.find((c) => c.biome === Biome.Grassland && !c.mountain && !c.river)!;
    const mountain = land.find((c) => c.mountain)!;
    expect(plain.defensibility).toBe(1);
    expect(mountain.defensibility).toBeGreaterThan(1);
    expect(defensibilityOf({ ...plain, river: true })).toBeGreaterThan(1);
  });
});

// One nation owning a row of 4 cells; cell 3 holds a deposit of `resource`.
function withDeposit(resource: ResourceKind, richness = SIM.RESOURCE_SATURATION) {
  const spec = row(4).map((c, i) => (i === 3 ? { ...c, resource, richness } : c));
  const state = makeState(spec, [1, 1, 1, 1], [makeNation(1, 0)]);
  updateTotals(state);
  return state;
}

describe("resource bonuses", () => {
  it("count access by richness and stop growing once saturated", () => {
    const half = withDeposit(Resource.Iron, SIM.RESOURCE_SATURATION / 2);
    const full = withDeposit(Resource.Iron, SIM.RESOURCE_SATURATION);
    const extra = withDeposit(Resource.Iron, SIM.RESOURCE_SATURATION * 3);
    const effect = RESOURCES[Resource.Iron].effect;
    expect(resourceBonus(half.nations.get(1), Resource.Iron)).toBeCloseTo(1 + (effect - 1) / 2);
    expect(resourceBonus(full.nations.get(1), Resource.Iron)).toBeCloseTo(effect);
    expect(resourceBonus(extra.nations.get(1), Resource.Iron)).toBeCloseTo(effect);
  });

  it("grain feeds more people, iron makes armies stronger, gold steadies the state", () => {
    const plain = makeState(row(4), [1, 1, 1, 1], [makeNation(1, 0)]);
    updateTotals(plain);
    const grain = withDeposit(Resource.Grain);
    expect(effectiveCapacity(grain, 0)).toBeCloseTo(effectiveCapacity(plain, 0) * RESOURCES[Resource.Grain].effect);

    const iron = withDeposit(Resource.Iron);
    expect(iron.nations.get(1)!.strength).toBeGreaterThan(plain.nations.get(1)!.strength);

    const gold = withDeposit(Resource.Gold);
    for (const s of [plain, gold]) s.nations.get(1)!.stability = 0.5;
    updateStability(plain);
    updateStability(gold);
    expect(gold.nations.get(1)!.stability).toBeGreaterThan(plain.nations.get(1)!.stability);
  });
});

describe("value and war", () => {
  it("a race values deposits it favors more", () => {
    const state = withDeposit(Resource.Iron, 0.5);
    const forDwarves = cellValue(state, 3, Race.Dwarf, 1);
    const forElves = cellValue(state, 3, Race.LightElf, 1);
    expect(forDwarves - forElves).toBeCloseTo(0.5 * (SIM.FAVORED_RESOURCE_VALUE - 1));
  });

  it("armies go for the deposit their race prizes, and the peace text names it", () => {
    // Nation 2 holds a plain cell, and an iron hill the same distance away. Dwarves want the iron.
    const spec = [{ neighbors: [1, 2] }, { neighbors: [0] }, { neighbors: [0], resource: Resource.Iron, richness: 1 }];
    const state = makeState(spec, [1, 2, 2], [makeNation(1, 0, { race: Race.Dwarf }), makeNation(2, 1)]);
    const war: War = { id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: SIM.PEACE_SCORE, goal: "conquer" as const, goalCells: [] };
    state.wars.push(war);
    state.armies.push({ id: 1, owner: 1, war: 1, cell: 0, size: 5, morale: 1, target: -1, path: [], trail: [0] });
    campaign(state, createRng("v"));
    expect(state.state.occupier[2]).toBe(1);
    state.state.occupier[1] = 0; // keep the capital out of it: that would win the whole nation
    expect(endWars(state)[0]!.text).toContain("iron");
  });

  it("the log says when a race goes to war over a resource it prizes", () => {
    for (let trial = 0; trial < 3000; trial++) {
      const spec = row(4).map((c, i) => (i === 2 ? { ...c, resource: Resource.Iron as ResourceKind, richness: 1 } : c));
      const state = makeState(spec, [1, 1, 2, 2], [
        makeNation(1, 0, { reserve: 100, race: Race.Dwarf }),
        makeNation(2, 3, { reserve: 1 }),
      ]);
      const events = declareWars(state, createRng(`r${trial}`));
      if (events.length === 0) continue;
      expect(events[0]!.text).toContain("coveting its iron");
      return;
    }
    throw new Error("no war in 3000 tries");
  });
});
