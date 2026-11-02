// Rulers and dynasties (docs/systems/rulers.md), on tiny hand-made worlds.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Faith, Race, RulerType } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { makeRuler, midReign, rulerName } from "../src/gen/rulers";
import { RACES } from "../src/gen/params";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { fightingPower } from "../src/sim/manpower";
import { greatBonus, rollGreatness } from "../src/sim/rulers";
import { adminCap } from "../src/sim/stability";
import { crisisChance, succession } from "../src/sim/succession";
import { spreadFaith } from "../src/sim/faith";
import { makeCells, makeNation, makeState, row } from "./tinyWorld";
import { everyoneAI } from "../src/sim/ai/default";

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
    succession(state, createRng("wait"), everyoneAI);
    expect(nation.ruler).toBe(ruler);
  });

  it("crowns the heir of the same dynasty", () => {
    const { state, nation } = dyingWorld();
    SIM.HEIR_CHANCE = 1;
    succession(state, createRng("heir"), everyoneAI);
    SIM.HEIR_CHANCE = SIM_DEFAULTS.HEIR_CHANCE;
    expect(nation.ruler.dynasty).toBe("House Test");
    expect(nation.ruler.crowned).toBe(5);
    expect(nation.ruler.ends).toBeGreaterThan(5);
  });

  it("gives a new dynasty the throne when there's no heir", () => {
    const { state, nation } = dyingWorld();
    SIM.HEIR_CHANCE = 0;
    succession(state, createRng("no heir"), everyoneAI);
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
      const events = succession(state, createRng("small crisis"), everyoneAI);
      expect(events.map((e) => e.text).join()).toContain("succession crisis");
    });
    expect(nation.stability).toBeCloseTo(0.9 - SIM.CRISIS_STAB_HIT);
    expect(state.nations.size).toBe(1);
  });

  it("splits a large realm between pretenders, and the capital stays", () => {
    const { state } = dyingRealm(60);
    withParams({ CRISIS_BASE: 10, CIVIL_WAR_MIN_AREA: 40, CIVIL_WAR_CELLS_PER_SPLIT: 20, CIVIL_WAR_MAX_SPLITS: 2, CIVIL_WAR_SHARE: 0.25, REBEL_WAR_PROB: 0 }, () => {
      const events = succession(state, createRng("civil war"), everyoneAI);
      expect(events[0]!.text).toContain("civil war");
    });
    expect(state.nations.size).toBeGreaterThan(1);
    expect(state.state.owner[0]).toBe(1);
    const taken = state.state.owner.filter((id) => id !== 1).length;
    expect(taken).toBeLessThanOrEqual(30); // two pretenders, a quarter of the land each
  });
});

describe("great rulers", () => {
  const ruler = (great?: (typeof RulerType)[keyof typeof RulerType]) => ({ name: "Testa", dynasty: "House Test", female: false, crowned: 0, ends: 1_000_000, ...(great ? { great } : {}) });

  it("come mostly as the type their race leans toward", () => {
    const rng = createRng("leanings");
    const count = (race: typeof Race.Orc | typeof Race.Dwarf, type: (typeof RulerType)[keyof typeof RulerType]) => {
      let found = 0;
      SIM.GREAT_RULER_CHANCE = 0.3;
      for (let i = 0; i < 2000; i++) {
        const r = ruler();
        rollGreatness(r, makeNation(1, 0, { race }), rng);
        if (r.great === type) found++;
      }
      SIM.GREAT_RULER_CHANCE = SIM_DEFAULTS.GREAT_RULER_CHANCE;
      return found;
    };
    expect(count(Race.Orc, RulerType.Conqueror)).toBeGreaterThan(count(Race.Dwarf, RulerType.Conqueror) * 3);
    expect(count(Race.Dwarf, RulerType.Builder)).toBeGreaterThan(count(Race.Orc, RulerType.Builder) * 3);
  });

  it("only change their own nation", () => {
    const nation = makeNation(1, 0, { ruler: ruler(RulerType.Builder) });
    expect(greatBonus(nation, RulerType.Builder, 2)).toBe(2);
    expect(greatBonus(nation, RulerType.Conqueror, 2)).toBe(1);
  });

  it("a Conqueror's soldiers fight harder", () => {
    const plain = makeNation(1, 0, { reserve: 10 });
    const led = makeNation(2, 0, { reserve: 10, ruler: ruler(RulerType.Conqueror) });
    const state = makeState(makeCells(row(2)), [1, 2], [plain, led]);
    expect(fightingPower(state, led)).toBeCloseTo(fightingPower(state, plain) * SIM.GREAT_CONQUEROR_POWER);
  });

  it("a Lawgiver rules more land", () => {
    const plain = makeNation(1, 0);
    const wise = makeNation(2, 0, { ruler: ruler(RulerType.Lawgiver) });
    const state = makeState(makeCells(row(2)), [1, 2], [plain, wise]);
    expect(adminCap(state, wise)).toBeCloseTo(adminCap(state, plain) * SIM.GREAT_LAWGIVER_CAP);
  });

  it("a Prophet's faith spreads faster, even beyond their borders", () => {
    const converted = (prophet: boolean) => {
      const believer = makeNation(1, 0, prophet ? { ruler: ruler(RulerType.Prophet) } : {});
      const other = makeNation(2, 2, { faith: Faith.AnvilOath });
      const spec = row(3, { neighbors: [] });
      spec.forEach((c, i) => (c.neighbors = i === 1 ? [0] : [1]));
      const state = makeState(makeCells(spec), [1, 2, 2], [believer, other]);
      state.state.faith.set([Faith.RadiantCovenant, Faith.AnvilOath, Faith.AnvilOath]);
      state.state.race.fill(Race.Human);
      let count = 0;
      const rng = createRng("prophet");
      for (let i = 0; i < 2000; i++) {
        state.state.faith[1] = Faith.AnvilOath;
        spreadFaith(state, rng.fork(`year-${i}`));
        if (state.state.faith[1] === Faith.RadiantCovenant) count++;
      }
      return count;
    };
    expect(converted(true)).toBeGreaterThan(converted(false) * 2);
  });

  it("a Schemer wears down the neighbor they hate most", () => {
    const schemer = makeNation(1, 0, { ruler: ruler(RulerType.Schemer) });
    const friend = makeNation(2, 1);
    const enemy = makeNation(3, 3);
    const spec = row(4);
    spec[0]!.neighbors = [1, 3];
    spec[3]!.neighbors = [0, 2];
    const state = makeState(makeCells(spec), [1, 2, 2, 3], [schemer, friend, enemy]);
    state.relations.set(100002, 0.5);
    state.relations.set(100003, -0.9);
    succession(state, createRng("scheme"), everyoneAI);
    expect(enemy.stability).toBeCloseTo(0.8 - SIM.GREAT_SCHEMER_STAB);
    expect(friend.stability).toBeCloseTo(0.8);
  });

  it("are logged when they rise and when they die", () => {
    const nation = makeNation(1, 0, { ruler: { ...ruler(RulerType.Conqueror), ends: 5 } });
    const state = makeState(makeCells(row(2)), [1, 1], [nation]);
    state.year = 5;
    SIM.CRISIS_BASE = 0;
    SIM.GREAT_RULER_CHANCE = 1;
    const texts = succession(state, createRng("great"), everyoneAI).map((e) => e.text).join();
    Object.assign(SIM, SIM_DEFAULTS);
    expect(texts).toContain("dies after 5 years");
    expect(texts).toContain("rises in Nation1");
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
  }, 30_000); // builds two whole worlds, which is slow on GitHub's computers
});
