// Rulers and dynasties (docs/systems/rulers.md), on tiny hand-made worlds.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Race, RulerType } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { makeRuler, midReign, rulerName } from "../src/gen/rulers";
import { RACES } from "../src/gen/params";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { crisisChance, succession } from "../src/sim/succession";
import { makeCells, makeNation, makeState, row } from "./tinyWorld";

describe("making a ruler", () => {
  it("reigns about as long as the race's trait says", () => {
    const rng = createRng("reign");
    for (const race of [Race.Orc, Race.LightElf]) {
      const ruler = makeRuler(rng, race, 100, "House Test");
      const years = ruler.ends - ruler.crowned;
      expect(years).toBeGreaterThanOrEqual(RACES[race].reign * 0.5 - 1);
      expect(years).toBeLessThanOrEqual(RACES[race].reign * 1.5 + 1);
    }
  });

  it("gives Orcs and Dwarves no queens for now, and Dark Elves mostly matriarchs", () => {
    const rng = createRng("gender");
    const women = (race: typeof Race.Orc | typeof Race.DarkElf) =>
      Array.from({ length: 200 }, () => makeRuler(rng, race, 0, "House Test")).filter((r) => r.female).length;
    expect(women(Race.Orc)).toBe(0);
    expect(women(Race.DarkElf)).toBeGreaterThan(130);
  });

  it("starts a world's first rulers partway through their reign, still on the throne", () => {
    const rng = createRng("mid");
    const ruler = midReign(rng, makeRuler(rng, Race.Human, 0, "House Test"));
    expect(ruler.crowned).toBeLessThanOrEqual(0);
    expect(ruler.ends).toBeGreaterThan(0);
  });

  it("titles a ruler by race, type and gender", () => {
    const base = { name: "Selena", dynasty: "House Test", crowned: 0, ends: 10 };
    expect(rulerName({ ...base, female: true, great: RulerType.Conqueror }, Race.Human)).toBe("High Queen Selena");
    expect(rulerName({ ...base, female: false, great: RulerType.Conqueror }, Race.Orc)).toBe("Warlord Selena");
    expect(rulerName({ ...base, female: true }, Race.DarkElf)).toBe("Matriarch Selena");
  });
});

describe("the throne passing on", () => {
  const dyingWorld = () => {
    const nation = makeNation(1, 0);
    nation.ruler = { ...nation.ruler, ends: 5 };
    const state = makeState(makeCells(row(3)), [1, 1, 1], [nation]);
    state.year = 5;
    return { state, nation };
  };

  it("leaves a ruler alone until the reign ends", () => {
    const { state, nation } = dyingWorld();
    state.year = 4;
    const ruler = nation.ruler;
    succession(state, createRng("wait"));
    expect(nation.ruler).toBe(ruler);
  });

  it("crowns the heir of the same dynasty", () => {
    const { state, nation } = dyingWorld();
    SIM.HEIR_CHANCE = 1;
    succession(state, createRng("heir"));
    SIM.HEIR_CHANCE = SIM_DEFAULTS.HEIR_CHANCE;
    expect(nation.ruler.dynasty).toBe("House Test");
    expect(nation.ruler.crowned).toBe(5);
    expect(nation.ruler.ends).toBeGreaterThan(5);
  });

  it("gives a new dynasty the throne when there's no heir", () => {
    const { state, nation } = dyingWorld();
    SIM.HEIR_CHANCE = 0;
    succession(state, createRng("no heir"));
    SIM.HEIR_CHANCE = SIM_DEFAULTS.HEIR_CHANCE;
    expect(nation.ruler.dynasty).not.toBe("House Test");
  });
});

describe("a succession crisis", () => {
  const withParams = (values: Partial<typeof SIM>, run: () => void) => {
    Object.assign(SIM, values);
    run();
    Object.assign(SIM, SIM_DEFAULTS);
  };

  /** A row of `count` cells, ruled from cell 0, whose ruler has just died. */
  const dyingRealm = (count: number, area = count) => {
    const nation = makeNation(1, 0, { area, stability: 0.9 });
    nation.ruler = { ...nation.ruler, ends: 5 };
    const state = makeState(makeCells(row(count)), new Array(count).fill(1), [nation]);
    state.year = 5;
    state.state.culture.fill(1);
    state.state.pop.fill(1);
    state.state.unrest.fill(0.5);
    return { state, nation };
  };

  it("is likelier in bigger realms, after great rulers, and for orcs", () => {
    const small = makeNation(1, 0, { area: 50 });
    const big = makeNation(2, 0, { area: 1000 });
    const orcs = makeNation(3, 0, { area: 50, race: Race.Orc });
    const dwarves = makeNation(4, 0, { area: 50, race: Race.Dwarf });
    expect(crisisChance(big, false)).toBeGreaterThan(crisisChance(small, false));
    expect(crisisChance(small, true)).toBeGreaterThan(crisisChance(small, false));
    expect(crisisChance(orcs, false)).toBeGreaterThan(crisisChance(dwarves, false));
  });

  it("shakes a small realm without breaking it", () => {
    const { state, nation } = dyingRealm(10);
    withParams({ CRISIS_BASE: 10, CIVIL_WAR_MIN_AREA: 40 }, () => {
      const events = succession(state, createRng("small crisis"));
      expect(events.map((e) => e.text).join()).toContain("succession crisis");
    });
    expect(nation.stability).toBeCloseTo(0.9 - SIM.CRISIS_STAB_HIT);
    expect(state.nations.size).toBe(1);
  });

  it("splits a large realm between pretenders, and the capital stays", () => {
    const { state } = dyingRealm(60);
    withParams({ CRISIS_BASE: 10, CIVIL_WAR_MIN_AREA: 40, CIVIL_WAR_CELLS_PER_SPLIT: 20, CIVIL_WAR_MAX_SPLITS: 2, CIVIL_WAR_SHARE: 0.25, REBEL_WAR_PROB: 0 }, () => {
      const events = succession(state, createRng("civil war"));
      expect(events[0]!.text).toContain("civil war");
    });
    expect(state.nations.size).toBeGreaterThan(1);
    expect(state.state.owner[0]).toBe(1);
    const taken = state.state.owner.filter((id) => id !== 1).length;
    expect(taken).toBeLessThanOrEqual(30); // two pretenders, a quarter of the land each
  });
});

describe("a new world", () => {
  it("gives every nation a ruler, the same each time for one seed", () => {
    const first = generateWorld("rulers").state;
    const again = generateWorld("rulers").state;
    for (const nation of first.nations.values()) {
      expect(nation.ruler.ends).toBeGreaterThan(0);
      expect(again.nations.get(nation.id)!.ruler).toEqual(nation.ruler);
    }
  });
});
